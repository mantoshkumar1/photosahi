(function(root, factory){
  const config = factory();
  if(typeof module === "object" && module.exports) module.exports = config;
  if(root) root.PhotoSahiConfig = config;
})(typeof window !== "undefined" ? window : globalThis, function(){
  const documents = {
    "Canadian Citizenship / Passport": {
      w:600,
      h:840,
      headRatio:0.48,
      upwardBias:0.12,
      fileMin:60,
      fileMax:240,
      fileDefault:150,
      headDefault:100
    },
    "Indian Passport (Reissue)": {
      w:600,
      h:600,
      headRatio:0.58,
      upwardBias:0.06,
      fileMin:10,
      fileMax:500,
      fileDefault:200,
      headDefault:100
    },
    "Indian Passport Surrender": {
      w:600,
      h:600,
      headRatio:0.55,
      upwardBias:0.05,
      fileMin:10,
      fileMax:500,
      fileDefault:200,
      headDefault:100
    },
    "Indian OCI": {
      w:600,
      h:600,
      headRatio:0.75,
      upwardBias:0.02,
      fileMin:10,
      fileMax:500,
      fileDefault:200,
      headDefault:100
    },
    "Indian PCC": {
      w:600,
      h:600,
      headRatio:0.52,
      upwardBias:0.04,
      fileMin:10,
      fileMax:200,
      fileDefault:150,
      headDefault:100
    },
    "LinkedIn Profile": {
      w:800,
      h:800,
      headRatio:0.88,
      upwardBias:0.02,
      fileMin:50,
      fileMax:500,
      fileDefault:200,
      headDefault:110
    },
    "Microsoft Teams": {
      w:800,
      h:800,
      headRatio:0.75,
      upwardBias:0.06,
      fileMin:50,
      fileMax:500,
      fileDefault:200,
      headDefault:100
    }
  };

  const discovery = {
    siteUrl:"https://mantoshkumar1.github.io/photosahi/",
    repositoryUrl:"https://github.com/mantoshkumar1/photosahi",
    name:"PhotoSahi",
    title:"PhotoSahi – Private Passport, OCI and PCC Photo Maker",
    description:"Prepare passport, OCI, PCC and Canadian application photos privately in your browser. Supports JPEG, PNG, HEIC and HEIF with local processing.",
    shortDescription:"Private browser-based photo preparation for passport, OCI, PCC, Canadian applications, LinkedIn and Microsoft Teams.",
    author:"Mantosh Kumar",
    language:"en-CA",
    applicationCategory:"UtilitiesApplication",
    operatingSystem:"Any device with a modern web browser",
    price:"0",
    priceCurrency:"CAD",
    socialImage:"assets/social-preview.png",
    inputAccept:"image/jpeg,image/png,.heic,.heif,image/heic,image/heif",
    formats:["JPEG", "PNG", "HEIC", "HEIF"],
    features:[
      "Local browser processing",
      "HEIC and HEIF conversion",
      "Face detection and framing guidance",
      "Preset output dimensions",
      "Target JPEG file-size adjustment",
      "Metadata-free JPEG download"
    ],
    limitations:[
      "PhotoSahi assists with sizing and framing but cannot guarantee acceptance by any receiving authority.",
      "Face detection works best when the full head and both eyes are clearly visible in a front-facing photo.",
      "Very large, damaged or browser-incompatible files may not open or convert.",
      "Automated checks cannot validate every lighting, background, expression, recency, printing or authority-specific requirement."
    ],
    faqs:[
      {
        question:"Does PhotoSahi upload my photo?",
        answer:"No. The selected photo, HEIC conversion, face detection, crop, adjustment and JPEG encoding stay in your browser."
      },
      {
        question:"Can I use an iPhone HEIC photo?",
        answer:"Yes. PhotoSahi can convert HEIC and HEIF photos to a working image locally in the browser before processing."
      },
      {
        question:"Which applications have presets?",
        answer:"PhotoSahi includes presets for Canadian citizenship and passport photos, Indian passport reissue and surrender, OCI, PCC, LinkedIn and Microsoft Teams."
      },
      {
        question:"Does PhotoSahi guarantee that my photo will be accepted?",
        answer:"No. PhotoSahi provides preparation and framing assistance. The organization receiving the photo makes the final acceptance decision."
      },
      {
        question:"Is PhotoSahi free and does it require an account?",
        answer:"PhotoSahi is free to use and does not require signup."
      }
    ]
  };

  return {documents, discovery};
});
