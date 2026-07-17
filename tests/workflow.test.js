const test = require("node:test");
const assert = require("node:assert/strict");

const {
  convertHeicFile,
  createModelReadiness,
  createSelectionTracker,
  findBestJpegBlob,
  getNoFaceGuidance,
  getQualitySummary,
  getShortcutGuidance,
  isHeicFile
} = require("../workflow.js");

test("front-facing photo produces a cautious positive summary", ()=>{
  const result = getQualitySummary({
    face:{height:320},
    imageHeight:840,
    noVerticalMove:false,
    noZoomPossible:false
  });

  assert.equal(result.tone, "success");
  assert.match(result.message, /appears suitable based on the checks available/i);
  assert.doesNotMatch(result.message, /accepted|compliant|guaranteed/i);
});

test("face looking downward that is not detected gets front-facing guidance", async ()=>{
  const faceapi = createFaceApiMock(null);
  const readiness = createModelReadiness({getFaceApi:()=> faceapi, retryDelay:1});
  const api = await readiness.ready();
  const detection = await api.detectSingleFace({fixture:"looking-down"}).withFaceLandmarks(true);

  assert.equal(detection, null);
  assert.match(getNoFaceGuidance(), /front-facing.*both eyes/i);
});

test("photo with no face gets clear guidance", ()=>{
  assert.equal(
    getNoFaceGuidance(),
    "Face not detected. Use a front-facing photo with the full head and both eyes clearly visible."
  );
});

test("model readiness waits for face-api and loads models only once", async ()=>{
  const faceapi = createFaceApiMock({detection:{box:{height:300}}});
  let available = false;
  const readiness = createModelReadiness({
    getFaceApi:()=> available ? faceapi : null,
    retryDelay:1
  });

  const first = readiness.ready();
  const second = readiness.ready();
  setTimeout(()=>{ available = true; }, 3);

  assert.equal(await first, faceapi);
  assert.equal(await second, faceapi);
  assert.equal(faceapi.modelLoads.length, 2);
});

test("model readiness fails clearly instead of waiting forever", async ()=>{
  const readiness = createModelReadiness({
    getFaceApi:()=> null,
    retryDelay:1,
    maxWait:3
  });

  await assert.rejects(readiness.ready(), /did not become available/);
});

test("HEIC photo is recognized and converted result is usable", async ()=>{
  const source = {name:"iphone-photo.HEIC", type:""};
  const converted = new Blob(["jpeg bytes"], {type:"image/jpeg"});
  const converter = async options=>{
    assert.equal(options.blob, source);
    assert.equal(options.toType, "image/jpeg");
    return converted;
  };

  assert.equal(isHeicFile(source), true);
  assert.equal(await convertHeicFile(source, converter), converted);
});

test("corrupt HEIC conversion is rejected", async ()=>{
  await assert.rejects(
    convertHeicFile({name:"broken.heic"}, async ()=> "not a blob"),
    /did not return an image/
  );
});

test("rapid consecutive selections keep only the newest result", async ()=>{
  const selections = createSelectionTracker();
  const applied = [];

  async function select(label, wait){
    const token = selections.next();
    await new Promise(resolve=> setTimeout(resolve, wait));
    if(selections.isCurrent(token)) applied.push(label);
  }

  await Promise.all([
    select("first", 12),
    select("second", 1)
  ]);

  assert.deepEqual(applied, ["second"]);
});

test("Debug and Compare without a detectable face provide guidance", ()=>{
  assert.match(getShortcutGuidance(), /choose a photo first/i);
  assert.match(getNoFaceGuidance(), /face not detected/i);
});

test("download sizing uses canvas.toBlob without Base64 data URLs", async ()=>{
  const qualities = [];
  const fakeCanvas = {
    toBlob(callback, type, quality){
      qualities.push({type, quality});
      callback(new Blob([new Uint8Array(Math.round(quality * 200 * 1024))], {type}));
    }
  };

  const result = await findBestJpegBlob(fakeCanvas, 150, 8);

  assert.equal(qualities.length, 8);
  assert.ok(qualities.every(item=> item.type === "image/jpeg"));
  assert.ok(Math.abs(result.sizeKB - 150) < 2);
});

function createFaceApiMock(detection){
  const modelLoads = [];
  return {
    modelLoads,
    nets:{
      tinyFaceDetector:{loadFromUri:async path=> modelLoads.push(["detector", path])},
      faceLandmark68TinyNet:{loadFromUri:async path=> modelLoads.push(["landmarks", path])}
    },
    TinyFaceDetectorOptions:function(){},
    detectSingleFace(){
      return {
        withFaceLandmarks:async ()=> detection
      };
    }
  };
}
