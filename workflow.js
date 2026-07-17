(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.PhotoSahiWorkflow = api;
})(typeof window !== "undefined" ? window : globalThis, function(){
  function delay(ms){
    return new Promise(resolve=> setTimeout(resolve, ms));
  }

  function createModelReadiness({
    getFaceApi,
    modelPath = "models",
    retryDelay = 50,
    maxWait = 15000
  }){
    let readinessPromise = null;

    async function waitForFaceApi(){
      const startedAt = Date.now();
      let api = getFaceApi();
      while(!api){
        if(Date.now() - startedAt >= maxWait){
          throw new Error("Face detection library did not become available");
        }
        await delay(retryDelay);
        api = getFaceApi();
      }
      return api;
    }

    function ready(){
      if(!readinessPromise){
        readinessPromise = waitForFaceApi().then(async api=>{
          await Promise.all([
            api.nets.tinyFaceDetector.loadFromUri(modelPath),
            api.nets.faceLandmark68TinyNet.loadFromUri(modelPath)
          ]);
          return api;
        }).catch(error=>{
          readinessPromise = null;
          throw error;
        });
      }
      return readinessPromise;
    }

    return {ready};
  }

  function createSelectionTracker(){
    let current = 0;
    return {
      next(){
        current += 1;
        return current;
      },
      isCurrent(token){
        return token === current;
      },
      current(){
        return current;
      }
    };
  }

  function isHeicFile(file){
    const type = (file?.type || "").toLowerCase();
    const name = (file?.name || "").toLowerCase();
    return type === "image/heic" || type === "image/heif" ||
      name.endsWith(".heic") || name.endsWith(".heif");
  }

  function normalizeHeicResult(converted, BlobType = Blob){
    const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
    if(!(convertedBlob instanceof BlobType)){
      throw new Error("HEIC conversion did not return an image");
    }
    return convertedBlob;
  }

  async function convertHeicFile(file, converter, BlobType = Blob){
    const converted = await converter({
      blob:file,
      toType:"image/jpeg",
      quality:0.95
    });
    return normalizeHeicResult(converted, BlobType);
  }

  function getNoFaceGuidance(){
    return "Face not detected. Use a front-facing photo with the full head and both eyes clearly visible.";
  }

  function getShortcutGuidance(){
    return "Choose a photo first to use Debug or Compare.";
  }

  function getQualitySummary({face, imageHeight, noVerticalMove, noZoomPossible}){
    const messages = [];

    if(noVerticalMove && noZoomPossible){
      messages.push("Framing is locked — choose a photo with more space around the head");
    }else if(noVerticalMove){
      messages.push("Vertical adjustment unavailable — choose a photo with more space above and below");
    }else if(noZoomPossible){
      messages.push("Zoom is limited — choose a photo with more space around the head");
    }

    if(face){
      const ratio = face.height / imageHeight;
      if(ratio < 0.15) messages.push("Face is too small — zoom in or choose a closer photo");
      else if(ratio > 0.65) messages.push("Face is too large — zoom out or choose a photo taken farther away");
    }

    if(messages.length){
      return {tone:"warning", message:messages.join(" • "), issues:messages};
    }

    return {
      tone:"success",
      message:"Photo appears suitable based on the checks available. Review the preview before downloading.",
      issues:[]
    };
  }

  function canvasToBlob(canvas, type, quality){
    return new Promise((resolve, reject)=>{
      canvas.toBlob(blob=>{
        if(blob) resolve(blob);
        else reject(new Error("The processed photo could not be encoded"));
      }, type, quality);
    });
  }

  async function findBestJpegBlob(canvas, targetKB, iterations = 12){
    let low = 0.4;
    let high = 0.95;
    let best = null;

    for(let i = 0; i < iterations; i++){
      const quality = (low + high) / 2;
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      const sizeKB = blob.size / 1024;
      const candidate = {blob, sizeKB, quality};

      if(!best || Math.abs(sizeKB - targetKB) < Math.abs(best.sizeKB - targetKB)){
        best = candidate;
      }

      if(sizeKB > targetKB) high = quality;
      else low = quality;
    }

    return best;
  }

  return {
    convertHeicFile,
    createModelReadiness,
    createSelectionTracker,
    findBestJpegBlob,
    getNoFaceGuidance,
    getQualitySummary,
    getShortcutGuidance,
    isHeicFile,
    normalizeHeicResult
  };
});
