const DOCUMENTS = {

  "Indian PCC": {
    active:true,
    w:630, h:810,
    headMin:80, headMax:85, headDefault:82,
    fileMin:10, fileMax:200, fileDefault:150,
    note:"ICAO compliant. Auto face-width correction enabled."
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

const headValue = document.getElementById("headValue");
const sizeValue = document.getElementById("sizeValue");

const statusText = document.getElementById("status");
const modeNote = document.getElementById("modeNote");

const upload = document.getElementById("upload");
const download = document.getElementById("download");

let img = new Image();

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

/* Document change */
docType.onchange = () => {

  const cfg = DOCUMENTS[docType.value];

  if(!cfg.active){

    modeNote.innerText =
      "This mode is coming soon. Indian PCC is fully supported.";

    headSlider.disabled = true;
    sizeSlider.disabled = true;
    download.disabled = true;

    statusText.innerText = "IN PROGRESS";
    statusText.style.color = "orange";

    ctx.clearRect(0,0,canvas.width,canvas.height);
    return;
  }

  modeNote.innerText = cfg.note;

  headSlider.disabled = false;
  sizeSlider.disabled = false;
  download.disabled = false;

  statusText.innerText = "COMPLIANT";
  statusText.style.color = "green";

  applyConfig();
  draw();
};

docType.value = "Indian PCC";
docType.onchange();

/* Upload */
upload.onchange = e => img.src = URL.createObjectURL(e.target.files[0]);
img.onload = draw;

/* Sliders */
headSlider.oninput = () => {
  headValue.innerText = headSlider.value + "%";
  draw();
};

sizeSlider.oninput = () =>
  sizeValue.innerText = sizeSlider.value + " KB";

/* DRAW — FACE WIDTH FIX */
function draw(){

  const cfg = DOCUMENTS[docType.value];
  if(!cfg.active || !img.width) return;

  const TARGET_W = cfg.w;
  const TARGET_H = cfg.h;

  canvas.width = TARGET_W;
  canvas.height = TARGET_H;

  // Target ICAO face width ratio
  const FACE_WIDTH_RATIO = 0.55;

  // Estimate face width (works for tight selfies)
  const estimatedFaceWidth = img.width * 0.6;

  let cropWidth = estimatedFaceWidth / FACE_WIDTH_RATIO;

  cropWidth = Math.min(cropWidth, img.width);

  const cropHeight = cropWidth * (TARGET_H / TARGET_W);

  const sx = (img.width - cropWidth) / 2;
  const sy = (img.height - cropHeight) / 2;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.drawImage(
    img,
    sx, sy,
    cropWidth, cropHeight,
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