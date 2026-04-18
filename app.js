/* =========================
   DOCUMENT CONFIG
   ========================= */

   const DOCUMENTS = {

    "Canadian Citizenship / Passport": {
      w:600, h:840, 
      // Output image size in pixels (aspect ratio must match real spec: 50x70 mm → 5:7)

      headRatio:0.48,     
      // Ratio of head height (chin → crown) relative to total image height
      // Example: 0.48 means head occupies 48% of final image height
      // Canada spec: 31–36 mm out of 70 mm → ~0.44–0.51

      upwardBias:0.12,    
      // Controls vertical placement of head inside frame
      // Higher value → more space above head (moves face slightly downward)
      // Lower value → centers face more
      // Canada needs noticeable top margin → hence higher value

      fileMin:60, fileMax:240, fileDefault:150,
      // File size constraints in KB
      // Used to auto-adjust JPEG compression during download

      headDefault:100
      // Default zoom level (%)
      // 100 = use exact computed headRatio
      // >100 = zoom in (larger face)
      // <100 = zoom out (smaller face)
    },

    "Indian Passport (Reissue)": {
      w:600, h:600,
      headRatio:0.58,     // ✅ accurate midpoint of spec range
      upwardBias:0.06,    // slight top margin (India less strict than Canada)
      fileMin:10, fileMax:500, fileDefault:200,
      headDefault:100
    },

    "Indian Passport Surrender": {
      w:600, h:600,
      headRatio:0.55,     // slightly smaller than passport (safer)
      upwardBias:0.05,    // mild top margin
      fileMin:10, fileMax:500, fileDefault:200,
      headDefault:100
    },

    "Indian OCI": {
      w:600, h:600,
      headRatio:0.75,     // ✅ balanced within 70–80% range
      upwardBias:0.02,    // very little top space (OCI prefers centered)
      fileMin:10, fileMax:500, fileDefault:200,
      headDefault:100
    },
  
    "Indian PCC": {
      w:600, h:600,
      headRatio:0.52,     // slightly smaller face (safe + accepted)
      upwardBias:0.04,    // mild headroom
      fileMin:10, fileMax:200, fileDefault:150,
      headDefault:100
    },

    "LinkedIn Profile": {
      w:800, h:800,
      headRatio:0.88,      // strong face presence
      upwardBias:0.02,     // almost centered (less passport bias)
      fileMin:50, fileMax:500, fileDefault:200,
      headDefault:110
    },

    "Microsoft Teams": {
      w:800, h:800,
      headRatio:0.75,      // slightly smaller face (video-call feel)
      upwardBias:0.06,     // more headroom (natural framing)
      fileMin:50, fileMax:500, fileDefault:200,
      headDefault:100
    },

  };
  
  
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
  const download = document.getElementById("download");
  
  let img = new Image();
  let lastDetection = null;
  let modelsLoaded = false;
  
  /* =========================
     DEBUG MODE
     ========================= */
  
  let DEBUG = false;
  let SPLIT_VIEW = false; // default OFF (set trye if you want it on by default)
  
  window.addEventListener("keydown", (e)=>{
    if(e.key.toLowerCase() === "d"){
      DEBUG = !DEBUG;
      draw();
    }
    if(e.key.toLowerCase() === "s"){ // press "S"
      SPLIT_VIEW = !SPLIT_VIEW;
      draw();
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
  
  
  /* =========================
     LOAD MODEL
     ========================= */
  
  async function loadModels(){
    if(!window.faceapi){
      setTimeout(loadModels,300);
      return;
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri("models");
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri("models");
    modelsLoaded = true;
  }
  loadModels();
  
  
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
  
  async function detectFace(){
    if(!modelsLoaded) return;
  
    try{
      lastDetection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true);
    }catch{
      lastDetection = null;
    }
  }
  
  /* =========================
     ISSUE ANALYZER 
     ========================= */
function issue_analyzer({
  statusText,
  face,
  centerX,
  imgWidth,
  imgHeight,
  cropW,
  angle,
  noVerticalMove,
  noZoomPossible
}) {
  let messages = [];

  // System constraints
  if(noVerticalMove && noZoomPossible){
    messages.push("Framing locked");
  } else if(noVerticalMove){
    messages.push("No vertical movement");
  } else if(noZoomPossible){
    messages.push("Zoom limited");
  }

  // Tilt Check
  if(Math.abs(angle) > 0.25){
    messages.push("Tilt corrected");
  }

  // Face size
  if(face){
    const ratio = face.height / imgHeight;
    if(ratio < 0.15) messages.push("Face too small");
    else if(ratio > 0.65) messages.push("Face too large");
  }

  if(statusText){
    statusText.innerText = messages.join(" • ");
  }
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

function draw(){
  
    const cfg = DOCUMENTS[docType.value];
    if(!img.width) return;
  
    const W = cfg.w;
    const H = cfg.h;

    const canvasW = SPLIT_VIEW ? W * 2 : W;
    canvas.width = canvasW;
    canvas.height = H;
    ctx.clearRect(0,0,canvasW,H);
  
    console.log(lastDetection);
  
    if(!lastDetection){
      ctx.drawImage(img,0,0,W,H);
      return;
    }

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

    // ===== MODE LABEL (OVERRIDE / ADD) =====
    if(docType.value.includes("LinkedIn")){
      if(!statusText.innerText){
        statusText.innerText = "Optimized for LinkedIn";
      }
    }

    if(docType.value.includes("Microsoft Teams")){
      if(!statusText.innerText){
        statusText.innerText = "Optimized for MS Teams";
      }
    }

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
  
  uploadTrigger.onclick = ()=> upload.click();
  
  upload.onchange = e=>{
    const file = e.target.files[0];
    if(!file) return;
    img.src = URL.createObjectURL(file);
  };
  
  img.onload = async ()=>{
    await detectFace();
    draw();
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

/**
 * Returns JPEG dataURL of the processed image only.
 * If split view is on, it extracts the right half.
 */
function getProcessedDataURL(canvas, W, H, quality, SPLIT_VIEW){
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

    return exportCanvas.toDataURL("image/jpeg", quality);
  }

  download.onclick = ()=>{

    const cfg = DOCUMENTS[docType.value];
    const W = cfg.w;
    const H = cfg.h;
  
    const targetKB = sizeSlider.value;
  
    const sizeOf = (d)=>(d.length*3/4)/1024;
  
    function render(q){
      const url = getProcessedDataURL(canvas, W, H, q, SPLIT_VIEW);
      return {url, size:sizeOf(url)};
    }
  
    let low=0.4, high=0.95, best=null;
  
    for(let i=0;i<12;i++){
      const mid=(low+high)/2;
      const r=render(mid);
  
      if(!best || Math.abs(r.size-targetKB)<Math.abs(best.size-targetKB)){
        best=r;
      }
  
      if(r.size>targetKB) high=mid;
      else low=mid;
    }
  
    const link=document.createElement("a");

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

    link.href=best.url;
    link.click();
  };
  
  
  /* =========================
     SWITCH
     ========================= */
  
  docType.onchange = async ()=>{
    applyConfig();
    if(img.width){
      await detectFace();
      draw();
    }
  };
  
  
  /* =========================
     INIT
     ========================= */
  
  docType.value = "Canadian Citizenship / Passport";
  applyConfig();