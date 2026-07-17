const DOCUMENTS = window.PhotoSahiConfig.documents;
  
  
  /* =========================
     DOM
     ========================= */
  
  const docType = document.getElementById("docType");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  
  const headSlider = document.getElementById("headSlider");
  const headValue = document.getElementById("headValue");
  
  const topTrimSlider = document.getElementById("topTrimSlider");
  const topTrimValue = document.getElementById("topTrimValue");
  
  const sizeSlider = document.getElementById("sizeSlider");
  const sizeValue = document.getElementById("sizeValue");
  
  const statusText = document.getElementById("status");
  
  const upload = document.getElementById("upload");
  const uploadTrigger = document.getElementById("uploadTrigger");
  const photoProgress = document.getElementById("photoProgress");
  const photoProgressText = document.getElementById("photoProgressText");
  const download = document.getElementById("download");
  const previewMessage = document.getElementById("previewMessage");
  const outputDimensions = document.getElementById("outputDimensions");
  const metadataNote = document.getElementById("metadataNote");
  const photoRequiredControls = document.querySelectorAll("[data-requires-photo]");
  const feedbackTrigger = document.getElementById("feedbackTrigger");
  const feedbackModal = document.getElementById("feedbackModal");
  const feedbackForm = document.getElementById("feedbackForm");
  const feedbackMessage = document.getElementById("feedbackMessage");
  const feedbackStatus = document.getElementById("feedbackStatus");
  const feedbackSubmit = document.getElementById("feedbackSubmit");
  const feedbackCloseControls = document.querySelectorAll("[data-feedback-close]");

  const FORMSPREE_ENDPOINT = "https://formspree.io/f/xeeyaazn";

  upload.accept = window.PhotoSahiConfig.discovery.inputAccept;

  const {
    convertHeicFile,
    createModelReadiness,
    createSelectionTracker,
    findBestJpegBlob,
    getNoFaceGuidance,
    getQualitySummary,
    getShortcutGuidance,
    isHeicFile
  } = window.PhotoSahiWorkflow;
  
  let img = new Image();
  let lastDetection = null;
  const selections = createSelectionTracker();
  const modelReadiness = createModelReadiness({getFaceApi:()=> window.faceapi});
  let activeImageSelectionToken = 0;
  let activeImageUrl = null;
  
  /* =========================
     DEBUG MODE
     ========================= */
  
  let DEBUG = false;
  let SPLIT_VIEW = false; // default OFF (set trye if you want it on by default)
  
  window.addEventListener("keydown", (e)=>{
    if(!img.width && (e.key.toLowerCase() === "d" || e.key.toLowerCase() === "s")){
      previewMessage.innerText = getShortcutGuidance();
      return;
    }

    if(e.key.toLowerCase() === "d"){
      DEBUG = !DEBUG;
      draw();
    }
    if(e.key.toLowerCase() === "s"){ // press "S"
      SPLIT_VIEW = !SPLIT_VIEW;
      draw();
    }
  });

  function showPhotoRequiredGuidance(){
    if(!img.width){
      previewMessage.hidden = false;
      previewMessage.innerText = "Choose a photo first to use these controls.";
      return;
    }

    if(!lastDetection){
      statusText.innerText =
        "These controls need a detectable, front-facing face. Choose another photo to continue.";
      statusText.dataset.tone = "warning";
    }
  }

  photoRequiredControls.forEach(control=>{
    control.addEventListener("pointerdown", ()=>{
      const disabledControl = control.querySelector(":disabled");
      if(disabledControl) showPhotoRequiredGuidance();
    });
  });

  function openFeedback(){
    feedbackModal.hidden = false;
    document.body.classList.add("feedbackOpen");
    feedbackStatus.innerText = "";
    delete feedbackStatus.dataset.tone;
    requestAnimationFrame(()=> feedbackMessage.focus());
  }

  function closeFeedback(){
    feedbackModal.hidden = true;
    document.body.classList.remove("feedbackOpen");
    feedbackTrigger.focus();
  }

  feedbackTrigger.addEventListener("click", openFeedback);
  feedbackCloseControls.forEach(control=> control.addEventListener("click", closeFeedback));

  document.addEventListener("keydown", event=>{
    if(event.key === "Escape" && !feedbackModal.hidden){
      closeFeedback();
    }
  });

  feedbackForm.addEventListener("submit", async event=>{
    event.preventDefault();
    feedbackStatus.innerText = "";
    delete feedbackStatus.dataset.tone;

    if(!feedbackForm.reportValidity()) return;

    if(!FORMSPREE_ENDPOINT){
      feedbackStatus.innerText = "Feedback sending is being set up. Please try again soon.";
      feedbackStatus.dataset.tone = "error";
      return;
    }

    feedbackSubmit.disabled = true;
    feedbackSubmit.innerText = "Sending…";

    try{
      // Only explicit text fields are sent. The selected photo and canvas are never included.
      const formData = new FormData(feedbackForm);
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method:"POST",
        body:formData,
        headers:{Accept:"application/json"}
      });

      if(!response.ok){
        const result = await response.json().catch(()=> null);
        const formspreeMessage = result?.errors?.map(item=> item.message).filter(Boolean).join(" ") ||
          result?.error || "Feedback request failed";
        throw new Error(formspreeMessage);
      }

      feedbackForm.reset();
      feedbackStatus.innerText = "Thank you. Your feedback has been received.";
      feedbackStatus.dataset.tone = "success";
    }catch(error){
      console.error("Feedback could not be sent", error);
      feedbackStatus.innerText = error.message === "Feedback request failed"
        ? "Feedback could not be sent. Please try again."
        : error.message;
      feedbackStatus.dataset.tone = "error";
    }finally{
      feedbackSubmit.disabled = false;
      feedbackSubmit.innerText = "Send feedback";
    }
  });
  
  /**
   * Draws a vertical line representing the TRUE center of the image
   * This helps user align face to the middle of the frame
   */
  function drawImageCenterGuide(ctx, mapX, imgWidth, H){

    // Convert image-space center → canvas-space
    const guideX = mapX(imgWidth / 2);

    ctx.save();

    // dashed vertical line
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "#f59e0b"; // amber
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(guideX, 0);
    ctx.lineTo(guideX, H);
    ctx.stroke();

    // reset dash
    ctx.setLineDash([]);

    // label
    ctx.fillStyle = "#fde68a";
    ctx.fillText("Center", Math.min(guideX + 6, ctx.canvas.width - 60), 16);

    ctx.restore();
  }

  /**
   * Draws a vertical line for the detected face center
   * Helps compare face position vs image center
   */
  function drawFaceCenterGuide(ctx, mapX, face, H){

    // if no face, nothing to draw
    if(!face) return;

    // face center in image space
    const faceCenterX = face.x + face.width / 2;

    // map to canvas space
    const fx = mapX(faceCenterX);

    ctx.save();

    // dashed vertical line (different pattern for distinction)
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "#22c55e"; // green

    ctx.beginPath();
    ctx.moveTo(fx, 0);
    ctx.lineTo(fx, H);
    ctx.stroke();

    ctx.setLineDash([]);

    // label
    ctx.fillStyle = "#bbf7d0";
    ctx.fillText("Face", Math.min(fx + 6, ctx.canvas.width - 60), 32);

    ctx.restore();
  }

  function drawDebugOverlay(face, headTop, headBottom, sx, sy, cropW, cropH, W, H){
    /* Canvas shows drawImage(img,sx,sy,cropW,cropH,0,0,W,H) — overlay must use OUTPUT space */
    const mapX = (ix)=> (ix - sx) / cropW * W;
    const mapY = (iy)=> (iy - sy) / cropH * H;

    // ===== CENTER GUIDES starts here =====
    // Draw image center and face center for alignment debugging
    drawImageCenterGuide(ctx, mapX, img.width, H);
    drawFaceCenterGuide(ctx, mapX, face, H);
    // ===== CENTER GUIDES ends here =====

    ctx.save();

    ctx.font = "14px sans-serif";
    ctx.lineWidth = 2;

    // ===== FACE BOX =====
    if(face){
      const fx = mapX(face.x);
      const fy = mapY(face.y);
      const fw = face.width / cropW * W;
      const fh = face.height / cropH * H;
      ctx.strokeStyle = "#4ade80";
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.fillStyle = "#bbf7d0";
      ctx.fillText("Face", fx, Math.max(14, fy - 4));
    }

    // ===== HEAD REGION (image Y band → canvas Y band) =====
    let y1 = mapY(headTop);
    let y2 = mapY(headBottom);
    if(y1 > y2){ const t = y1; y1 = y2; y2 = t; }
    y1 = Math.max(0, Math.min(H, y1));
    y2 = Math.max(0, Math.min(H, y2));

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#38bdf8";
    if(y2 > y1) ctx.fillRect(0, y1, W, y2 - y1);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2;
    if(y2 > y1) ctx.strokeRect(0.5, y1 + 0.5, W - 1, y2 - y1 - 1);

    ctx.fillStyle = "#0c4a6e";
    ctx.fillText("Head region", 8, Math.min(H - 6, Math.max(16, y1 + 14)));

    // ===== OUTPUT = CROP (whole canvas) =====
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = "#fecaca";
    ctx.fillText("Output = crop", 8, H - 8);

    // ===== LEGEND =====
    const legendX = 10;
    const legendY = 28;
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(6, 6, 230, 86);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText("DEBUG (press D)", legendX, legendY);
    ctx.fillStyle = "#4ade80";
    ctx.fillText("■ Face", legendX, legendY + 16);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("■ Head region", legendX, legendY + 32);
    ctx.fillStyle = "#f87171";
    ctx.fillText("■ Output frame", legendX, legendY + 48);

    ctx.restore();
  }
  
  
  // Start loading early. detectFace() also awaits this same promise, so an
  // upload made during startup cannot skip detection.
  modelReadiness.ready().catch(error=>{
    console.error("Face models could not be loaded", error);
  });
  
  
  /* =========================
     DROPDOWN
     ========================= */
  
  if(docType.options.length === 0){
    for(let key in DOCUMENTS){
      let opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key;
      docType.appendChild(opt);
    }
  }
  
  
  /* =========================
     APPLY CONFIG
     ========================= */
  
  function applyConfig(){
  
    const cfg = DOCUMENTS[docType.value];

    outputDimensions.innerText = `· ${cfg.w} × ${cfg.h} px`;
  
    canvas.width = cfg.w;
    canvas.height = cfg.h;
  
    headSlider.min = 70;
    headSlider.max = 130;
    headSlider.value = cfg.headDefault;
    headValue.innerText = cfg.headDefault + "%";
  
    topTrimSlider.min = 0;
    topTrimSlider.max = 100;
    topTrimSlider.value = 50;
    topTrimValue.innerText = "Auto";
  
    sizeSlider.min = cfg.fileMin;
    sizeSlider.max = cfg.fileMax;
    sizeSlider.value = cfg.fileDefault;
    sizeValue.innerText = cfg.fileDefault + " KB";
  }
  
  
  /* =========================
     FACE DETECTION
     ========================= */
  
  async function detectFace(image){
    const api = await modelReadiness.ready();
    try{
      return await api
          .detectSingleFace(image, new api.TinyFaceDetectorOptions())
          .withFaceLandmarks(true);
    }catch(error){
      console.error("Face detection failed", error);
      return null;
    }
  }
  
  /* =========================
     ISSUE ANALYZER 
     ========================= */
function issue_analyzer({statusText, face, imgHeight, noVerticalMove, noZoomPossible}) {
  const summary = getQualitySummary({
    face,
    imageHeight:imgHeight,
    noVerticalMove,
    noZoomPossible
  });
  statusText.innerText = summary.message;
  statusText.dataset.tone = summary.tone;
}
  /* =========================
     DRAW
     ========================= */

  /**
   * Rotates a point around image center (same as canvas rotation)
  */
  function rotatePoint(x, y, cx, cy, angle){
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    return {
      x: cos * (x - cx) - sin * (y - cy) + cx,
      y: sin * (x - cx) + cos * (y - cy) + cy
    };
  }

/**
 * Builds rotated debug data so overlay matches rotated image
 */
function buildDebugData({face, headTop, headBottom, centerX, img, angle}){
  const cx = img.width / 2;
  const cy = img.height / 2;

  // rotate face box (top-left only; size unchanged)
  let debugFace = null;

  if(face){
    const p = rotatePoint(face.x, face.y, cx, cy, angle);

    debugFace = {
      x: p.x,
      y: p.y,
      width: face.width,
      height: face.height
    };
  }

  // rotate head region using centerX as anchor
  const topPoint = rotatePoint(centerX, headTop, cx, cy, angle);
  const bottomPoint = rotatePoint(centerX, headBottom, cx, cy, angle);

  return {
    face: debugFace,
    headTop: topPoint.y,
    headBottom: bottomPoint.y
  };
}

/**
 * Background light check using FINAL cropped image
 */
function getBackgroundMessageFromCrop(tempCanvas, sx, sy, cropW, cropH){

  const temp = document.createElement("canvas");
  const tctx = temp.getContext("2d");

  temp.width = cropW;
  temp.height = cropH;

  tctx.drawImage(
    tempCanvas,
    sx, sy, cropW, cropH,
    0, 0, cropW, cropH
  );

  const sampleSize = 10;

  const getAvg = (x, y) => {
    const data = tctx.getImageData(x, y, sampleSize, sampleSize).data;

    let sum = 0, count = 0;

    for(let i = 0; i < data.length; i += 4){
      sum += (data[i] + data[i+1] + data[i+2]) / 3;
      count++;
    }

    return sum / count;
  };

  const samples = [
    getAvg(0, 0),
    getAvg(cropW - sampleSize, 0),
    getAvg(0, cropH - sampleSize),
    getAvg(cropW - sampleSize, cropH - sampleSize)
  ];

  const lightCount = samples.filter(v => v > 200).length;

  return lightCount >= 3 ? "" : "Background not light";
}

function drawOriginalFitted(ctx, img, W, H){
    const ratio = img.width / img.height;
  
    let drawW = W;
    let drawH = W / ratio;
  
    if(drawH > H){
      drawH = H;
      drawW = H * ratio;
    }
  
    const dx = (W - drawW) / 2;
    const dy = (H - drawH) / 2;
  
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

function drawNoFaceState(ctx, img, W, H){
    // Always keep the uploaded photo visible when automatic detection fails.
    download.disabled = true;
    headSlider.disabled = true;
    topTrimSlider.disabled = true;
    sizeSlider.disabled = true;
    metadataNote.hidden = true;
    drawOriginalFitted(ctx, img, W, H);

    statusText.innerText =
      getNoFaceGuidance();
    statusText.dataset.tone = "warning";

    if(SPLIT_VIEW){
      // Compare still has two meaningful sides instead of an unexplained blank area.
      ctx.save();
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(W, 0, W, H);
      ctx.strokeStyle = "#d1d5db";
      ctx.beginPath();
      ctx.moveTo(W, 0);
      ctx.lineTo(W, H);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#991b1b";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("Processed preview", W + W / 2, H / 2 - 30);
      ctx.fillText("unavailable", W + W / 2, H / 2 + 4);
      ctx.fillStyle = "#475569";
      ctx.font = "18px sans-serif";
      ctx.fillText("A front-facing photo is required.", W + W / 2, H / 2 + 40);
      ctx.restore();
    }

    if(DEBUG){
      // Debug cannot draw landmarks without a detection, so explain why.
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
      ctx.fillRect(8, 8, Math.min(360, W - 16), 66);
      ctx.fillStyle = "#fca5a5";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("DEBUG: Face not detected", 18, 34);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "13px sans-serif";
      ctx.fillText("Landmarks and crop guides are unavailable.", 18, 56);
      ctx.restore();
    }
  }

function draw(){
  
    const cfg = DOCUMENTS[docType.value];
    if(!img.width) return;
  
    const W = cfg.w;
    const H = cfg.h;

    const canvasW = SPLIT_VIEW ? W * 2 : W;
    canvas.width = canvasW;
    canvas.height = H;
    ctx.clearRect(0,0,canvasW,H);
  
    if(!lastDetection){
      drawNoFaceState(ctx, img, W, H);
      return;
    }

    download.disabled = false;
    headSlider.disabled = false;
    topTrimSlider.disabled = false;
    sizeSlider.disabled = false;
    metadataNote.hidden = false;

    if(SPLIT_VIEW){
      // LEFT: original
      drawOriginalFitted(ctx, img, W, H);
    
      // divider
      ctx.strokeStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.moveTo(W, 0);
      ctx.lineTo(W, H);
      ctx.stroke();
    
      // label
      ctx.fillStyle = "#000";
      ctx.fillText("Original", 10, 20);
    }

    // ===== SAFE DETECTION (LANDMARK + FALLBACK) starts here =====
    let face, leftEye, rightEye, centerX, headTop, headBottom;

    if(lastDetection.landmarks){

      // ===== LANDMARK PATH =====
      face = lastDetection.detection.box;

      const landmarks = lastDetection.landmarks;
      const jaw = landmarks.getJawOutline();
      leftEye = landmarks.getLeftEye();
      rightEye = landmarks.getRightEye();

      const chin = jaw[8];

      const eyeCenter = {
        x: (
          leftEye.reduce((s,p)=>s+p.x,0)/leftEye.length +
          rightEye.reduce((s,p)=>s+p.x,0)/rightEye.length
        ) / 2,
        y: (
          leftEye.reduce((s,p)=>s+p.y,0)/leftEye.length +
          rightEye.reduce((s,p)=>s+p.y,0)/rightEye.length
        ) / 2
      };

      const eyeToChin = chin.y - eyeCenter.y;

      const crownY = eyeCenter.y - eyeToChin * 0.9;
      const chinY = chin.y + eyeToChin * 0.1;

      headTop = Math.max(0, crownY);
      headBottom = Math.min(img.height, chinY);

      centerX = eyeCenter.x;

    } else {

      // ===== FALLBACK (your old logic) =====
      face = lastDetection.box;

      centerX = face.x + face.width/2;

      const chinY = face.y + face.height;
      const foreheadY = face.y;

      const crownY = foreheadY - face.height * 0.8;
      const extendedChinY = chinY + face.height * 0.25;

      headTop = Math.max(0, crownY);
      headBottom = Math.min(img.height, extendedChinY);

      // fake eyes so tilt logic doesn't crash
      leftEye = [{x: centerX - 10, y: face.y + face.height/3}];
      rightEye = [{x: centerX + 10, y: face.y + face.height/3}];

      if(statusText){
        statusText.innerText = "Using basic mode (face landmarks not detected)";
      }
    }

    // ===== SAFE DETECTION (LANDMARK + FALLBACK) ends here =====
    
    const headHeight = headBottom - headTop;
    const headCenterY = (headTop + headBottom)/2;
  
    let cropH = headHeight / cfg.headRatio;
    let cropW = cropH * (W/H);
  
    const factor = headSlider.value / 100;
    cropH = cropH / factor;
    cropW = cropH * (W/H);
  
    if(cropW > img.width){
      cropW = img.width;
      cropH = cropW * (H/W);
    }
    if(cropH > img.height){
      cropH = img.height;
      cropW = cropH * (W/H);
    }
  
    const noZoomPossible =
      cropH >= img.height - 2 || cropW >= img.width - 2;
  
    if(headSlider){
      headSlider.disabled = noZoomPossible;
      headSlider.style.opacity = noZoomPossible ? 0.5 : 1;
      headSlider.style.cursor = noZoomPossible ? "not-allowed" : "pointer";
    }
  
    // ===== TILT CORRECTION =====
    const leftEyeCenter = {
      x: leftEye.reduce((s,p)=>s+p.x,0)/leftEye.length,
      y: leftEye.reduce((s,p)=>s+p.y,0)/leftEye.length
    };

    const rightEyeCenter = {
      x: rightEye.reduce((s,p)=>s+p.x,0)/rightEye.length,
      y: rightEye.reduce((s,p)=>s+p.y,0)/rightEye.length
    };

    // ===== ADJUST CENTER AFTER ROTATION =====
    const angle = Math.atan2(
      rightEyeCenter.y - leftEyeCenter.y,
      rightEyeCenter.x - leftEyeCenter.x
    );

    // rotate centerX around image center
    const cx = img.width / 2;
    const cy = img.height / 2;

    // original face center
    let fx = centerX;
    let fy = (headTop + headBottom) / 2;

    // apply same rotation as image
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    const rotatedX =
      cos * (fx - cx) - sin * (fy - cy) + cx;

    // use rotated center for cropping
    let sx = rotatedX - cropW / 2;

    // clamp
    if(sx < 0){
      sx = 0;
    }
    else if(sx + cropW > img.width){
      sx = img.width - cropW;
    }

    const minSY = 0;
    const maxSY = img.height - cropH;
  
    const movementRange = maxSY - minSY;
    const noVerticalMove = movementRange < 5;
  
    if(topTrimSlider){
      topTrimSlider.disabled = noVerticalMove;
      topTrimSlider.style.opacity = noVerticalMove ? 0.5 : 1;
      topTrimSlider.style.cursor = noVerticalMove ? "not-allowed" : "pointer";
    }
  
    // ===== STRONG HEAD-BASED VERTICAL POSITION starts here =====
    // anchor strictly to head (this is correct passport logic)
    // let sy = headTop - cropH * (0.20) + cropH * cfg.upwardBias;
    
    // anchor = where headTop should sit inside crop (0 = top, 1 = bottom)
    const anchor = 0.20 + cfg.upwardBias;
    // compute crop start Y
    let sy = headTop - cropH * anchor;

    // user adjustment (more responsive now)
    const t = (topTrimSlider.value - 50) / 100;
    sy += t * cropH * 0.6;  // ↑ increased influence

    // clamp
    if(sy < minSY) sy = minSY;
    if(sy > maxSY) sy = maxSY;

    // ===== STRONG HEAD-BASED VERTICAL POSITION ends here =====

    // temp canvas
    const tempCanvas = document.createElement("canvas");
    const tctx = tempCanvas.getContext("2d");

    tempCanvas.width = img.width;
    tempCanvas.height = img.height;

    tctx.translate(img.width/2, img.height/2);
    tctx.rotate(-angle);
    tctx.drawImage(img, -img.width/2, -img.height/2);

    // analyze any issue in user's pic
    issue_analyzer({
      statusText,
      face,
      centerX: rotatedX, // actual face center after rotation
      imgWidth: cropW,
      imgHeight: cropH,
      cropW,
      angle,
      noVerticalMove,
      noZoomPossible
    });

    // final draw
    const offsetX = SPLIT_VIEW ? W : 0;
    ctx.drawImage(
      tempCanvas,
      sx, sy,
      cropW, cropH,
      offsetX, 0,
      W, H
    );

    // // ===== BACKGROUND CHECK (FINAL OUTPUT) =====
    // const bgMsg = getBackgroundMessageFromCrop(
    //   tempCanvas,
    //   sx,
    //   sy,
    //   cropW,
    //   cropH
    // );

    // if(bgMsg){
    //   if(statusText.innerText){
    //     statusText.innerText += " • " + bgMsg;
    //   } else {
    //     statusText.innerText = bgMsg;
    //   }
    // }

    // // label
    // ctx.fillStyle = "#000";
    // ctx.fillText("PhotoSahi", offsetX + 10, 20);
  

    // ===== DEBUG OVERLAY (ONLY ON PROCESSED SIDE) =====
    if(DEBUG){

      // build rotated debug data
      const dbg = buildDebugData({face,headTop, headBottom, centerX, img, angle});
    
      ctx.save();
    
      if(SPLIT_VIEW){
        ctx.translate(W, 0);
      }
    
      drawDebugOverlay(dbg.face, dbg.headTop, dbg.headBottom, sx, sy, cropW, cropH, W, H);
    
      ctx.restore();
    }
  }
  
  /* =========================
     EVENTS
     ========================= */

  function setPhotoLoadingState(message){
    lastDetection = null;
    metadataNote.hidden = true;
    previewMessage.hidden = false;
    previewMessage.innerText = message;
    statusText.innerText = "";
    delete statusText.dataset.tone;
    uploadTrigger.disabled = true;
    uploadTrigger.innerText = "Processing photo…";
    uploadTrigger.setAttribute("aria-busy", "true");
    photoProgress.hidden = false;
    photoProgressText.innerText = message;
    download.disabled = true;
    headSlider.disabled = true;
    topTrimSlider.disabled = true;
    sizeSlider.disabled = true;
  }

  function updatePhotoLoadingState(message){
    previewMessage.hidden = false;
    previewMessage.innerText = message;
    photoProgress.hidden = false;
    photoProgressText.innerText = message;
  }

  function clearPhotoLoadingState(){
    uploadTrigger.disabled = false;
    uploadTrigger.innerText = "Choose Photo";
    uploadTrigger.removeAttribute("aria-busy");
    photoProgress.hidden = true;
  }

  function showPhotoLoadError(message){
    previewMessage.hidden = false;
    previewMessage.innerText = message;
    statusText.innerText = message;
    statusText.dataset.tone = "error";
    clearPhotoLoadingState();
  }

  function useImageBlob(blob, selectionToken){
    if(activeImageUrl) URL.revokeObjectURL(activeImageUrl);
    activeImageUrl = URL.createObjectURL(blob);
    activeImageSelectionToken = selectionToken;
    img.src = activeImageUrl;
  }
  
  uploadTrigger.onclick = ()=> upload.click();
  
  upload.onchange = async e=>{
    const file = e.target.files[0];
    if(!file) return;

    const selectionToken = selections.next();

    try{
      if(isHeicFile(file)){
        setPhotoLoadingState("Converting Apple photo locally…");

        if(typeof heic2any !== "function"){
          throw new Error("HEIC converter is unavailable");
        }

        const convertedBlob = await convertHeicFile(file, heic2any);

        if(!selections.isCurrent(selectionToken)) return;

        updatePhotoLoadingState("Preparing photo preview…");
        useImageBlob(convertedBlob, selectionToken);
      }else{
        setPhotoLoadingState("Opening photo locally…");
        useImageBlob(file, selectionToken);
      }
    }catch(error){
      if(!selections.isCurrent(selectionToken)) return;
      console.error("Photo could not be opened", error);
      upload.value = "";
      showPhotoLoadError("This Apple photo could not be opened. Try another HEIC photo or convert it to JPEG.");
    }
  };
  
  img.onload = async ()=>{
    const selectionToken = activeImageSelectionToken;
    updatePhotoLoadingState("Checking face and framing…");
    try{
      const detection = await detectFace(img);
      if(!selections.isCurrent(selectionToken) || selectionToken !== activeImageSelectionToken) return;
      lastDetection = detection;
      clearPhotoLoadingState();
      previewMessage.hidden = true;
      draw();
    }catch(error){
      if(!selections.isCurrent(selectionToken) || selectionToken !== activeImageSelectionToken) return;
      console.error("Face checks could not start", error);
      clearPhotoLoadingState();
      drawOriginalFitted(ctx, img, canvas.width, canvas.height);
      previewMessage.hidden = true;
      statusText.innerText = "Face checks could not start. Refresh the page and try again.";
      statusText.dataset.tone = "error";
    }
  };

  img.onerror = ()=>{
    showPhotoLoadError("This photo could not be opened. Try a JPEG, PNG, HEIC, or HEIF file.");
  };
  
  headSlider.oninput = ()=>{
    headValue.innerText = headSlider.value + "%";
    draw();
  };

  topTrimSlider.oninput = ()=>{
    const v = topTrimSlider.value;
  
    if(v === 50){
      topTrimValue.innerText = "Auto";
    } else if(v < 50){
      topTrimValue.innerText = "Up";
    } else {
      topTrimValue.innerText = "Down";
    }
  
    draw();
  };
  
  sizeSlider.oninput = ()=>{
    sizeValue.innerText = sizeSlider.value + " KB";
  };
  
  
  /* =========================
     DOWNLOAD
     ========================= */

/** Returns a canvas containing only the processed output. */
function getProcessedCanvas(canvas, W, H, SPLIT_VIEW){
    const exportCanvas = document.createElement("canvas");
    const ectx = exportCanvas.getContext("2d");

    exportCanvas.width = W;
    exportCanvas.height = H;

    // source X: right half if split view, else full canvas
    const sx = SPLIT_VIEW ? W : 0;

    ectx.drawImage(
      canvas,
      sx, 0,       // source start
      W, H,        // source size
      0, 0,        // dest start
      W, H         // dest size
    );

    return exportCanvas;
  }

  download.onclick = async ()=>{

    const cfg = DOCUMENTS[docType.value];
    const W = cfg.w;
    const H = cfg.h;
  
    const targetKB = Number(sizeSlider.value);
    const exportCanvas = getProcessedCanvas(canvas, W, H, SPLIT_VIEW);
    const downloadSelectionToken = selections.current();
    download.disabled = true;
    download.innerText = "Preparing download…";

    try{
      const best = await findBestJpegBlob(exportCanvas, targetKB);
      if(!selections.isCurrent(downloadSelectionToken)) return;
      const link = document.createElement("a");

      // ===== SMART FILE NAME starts here =====

      // original file name (without extension)
      let originalName = "image";
      if(upload && upload.files && upload.files[0]){
        originalName = upload.files[0].name.replace(/\.[^/.]+$/, "");
      }

      // document type (cleaned)
      const docName = docType.value.replace(/[\/]/g, "").replace(/\s+/g, "_").toLowerCase();

    // final name
      link.download = `photosahi_${docName}_${originalName}.jpg`;
      // ===== SMART FILE NAME ends here =====

      const downloadUrl = URL.createObjectURL(best.blob);
      link.href = downloadUrl;
      link.click();
      setTimeout(()=> URL.revokeObjectURL(downloadUrl), 1000);
    }catch(error){
      if(!selections.isCurrent(downloadSelectionToken)) return;
      console.error("Photo download failed", error);
      statusText.innerText = "The photo could not be prepared for download. Please try again.";
      statusText.dataset.tone = "error";
    }finally{
      if(selections.isCurrent(downloadSelectionToken)){
        download.disabled = !lastDetection;
        download.innerText = "Download Photo";
      }
    }
  };
  
  
  /* =========================
     SWITCH
     ========================= */
  
  docType.onchange = async ()=>{
    applyConfig();
    if(img.width){
      const selectionToken = selections.current();
      try{
        const detection = await detectFace(img);
        if(!selections.isCurrent(selectionToken)) return;
        lastDetection = detection;
        draw();
      }catch(error){
        if(!selections.isCurrent(selectionToken)) return;
        console.error("Face checks could not start", error);
        statusText.innerText = "Face checks could not start. Refresh the page and try again.";
        statusText.dataset.tone = "error";
      }
    }
  };
  
  
  /* =========================
     INIT
     ========================= */
  
  docType.value = "Canadian Citizenship / Passport";
  applyConfig();
