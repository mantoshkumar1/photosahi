const DOCUMENTS = {

  "Indian PCC": {
    active:true,
    w:630, h:810,
    headMin:80, headMax:85, headDefault:82,
    fileMin:10, fileMax:200, fileDefault:150,
    note:"Upload a straight photo. Tool will warn if too close."
  },

  "OCI Card": { active:false },
  "Indian Passport (Reissue)": { active:false },
  "Passport Surrender India": { active:false },
  "Canada Passport": { active:false }

};

const docType = document.getElementById("docType");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const headSlider = document.getElementById("headSlider");
const sizeSlider = document.getElementById("sizeSlider");
const topTrimSlider = document.getElementById("topTrimSlider");

const headValue = document.getElementById("headValue");
const sizeValue = document.getElementById("sizeValue");
const topTrimValue = document.getElementById("topTrimValue");

const statusText = document.getElementById("status");
const modeNote = document.getElementById("modeNote");

const upload = document.getElementById("upload");
const download = document.getElementById("download");

let img = new Image();

/* FACE DETECTION LOAD */
async function loadModels(){
  await faceapi.nets.tinyFaceDetector.loadFromUri(
    "https://cdn.jsdelivr.net/npm/face-api.js/models"
  );
}
loadModels();

/* Populate dropdown */
for (let key in DOCUMENTS){
  let opt = document.createElement("option");
  opt.textContent = key + (DOCUMENTS[key].active ? "" : " (In Progress)");
  opt.value = key;
  docType.appendChild(opt);
}

/* Apply config */
function applyConfig(){

  const cfg = DOCUMENTS[docType.value];

  headSlider.min = cfg.headMin;
  headSlider.max = cfg.headMax;
  headSlider.value = cfg.headDefault;

  sizeSlider.min = cfg.fileMin;
  sizeSlider.max = cfg.fileMax;
  sizeSlider.value = cfg.fileDefault;

  headValue.innerText = cfg.headDefault + "%";
  sizeValue.innerText = cfg.fileDefault + " KB";

  canvas.width = cfg.w;
  canvas.height = cfg.h;
}

/* DISTANCE CHECK ONLY (does not affect drawing) */
async function checkDistance(){

  const detection = await faceapi.detectSingleFace(
    img,
    new faceapi.TinyFaceDetectorOptions()
  );

  if(!detection){
    statusText.innerText = "Face not detected";
    statusText.style.color = "orange";
    return;
  }

  const faceRatio = detection.box.width / img.width;

  if(faceRatio > 0.65){
    statusText.innerText = "❌ Too close – move 1.5m away";
    statusText.style.color = "red";
  } else {
    statusText.innerText = "COMPLIANT";
    statusText.style.color = "green";
  }
}

/* Upload */
upload.onchange = e => img.src = URL.createObjectURL(e.target.files[0]);

img.onload = () => {
  draw();          // always draw immediately
  checkDistance(); // async warning
};

/* Sliders */
headSlider.oninput = () => draw();

sizeSlider.oninput = () =>
  sizeValue.innerText = sizeSlider.value + " KB";

topTrimSlider.oninput = () => {
  topTrimValue.innerText = topTrimSlider.value + "%";
  draw();
};

/* WORKING CROP ENGINE (restored) */
function draw(){

  const cfg = DOCUMENTS[docType.value];
  if(!cfg.active || !img.width) return;

  const TARGET_W = cfg.w;
  const TARGET_H = cfg.h;

  canvas.width = TARGET_W;
  canvas.height = TARGET_H;

  const headRatio = headSlider.value / 100;

  const cropH = img.height * headRatio;
  const cropW = cropH * (TARGET_W / TARGET_H);

  const sx = (img.width - cropW) / 2;

  const topTrimPercent = topTrimSlider.value / 100;

  let sy = (img.height - cropH) * topTrimPercent;

  if (sy < 0) sy = 0;
  if (sy + cropH > img.height)
    sy = img.height - cropH;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.drawImage(
    img,
    sx, sy,
    cropW, cropH,
    0, 0,
    TARGET_W, TARGET_H
  );
}

/* Download */
download.onclick = () => {

  const targetKB = sizeSlider.value;

  let quality=0.95,dataUrl,fileSize;

  do{
    dataUrl = canvas.toDataURL("image/jpeg",quality);
    fileSize = (dataUrl.length*3/4)/1024;
    quality -=0.02;
  }
  while(fileSize>targetKB && quality>0.4);

  const link=document.createElement("a");
  link.download="PhotoSahi_"+docType.value+".jpg";
  link.href=dataUrl;
  link.click();
};

/* Default */
docType.value = "Indian PCC";
docType.onchange = () => {
  modeNote.innerText = DOCUMENTS["Indian PCC"].note;
  applyConfig();
};
docType.onchange();