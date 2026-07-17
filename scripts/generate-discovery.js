const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const config = require(path.join(ROOT, "config.js"));
const checkOnly = process.argv.includes("--check");

function escapeHtml(value){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function replaceGeneratedSection(source, marker, content){
  const start = `<!-- ${marker}:START -->`;
  const end = `<!-- ${marker}:END -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if(!pattern.test(source)) throw new Error(`Missing ${marker} markers in index.html`);
  return source.replace(pattern, `${start}\n${content}\n${end}`);
}

function getSourceHash(){
  const hash = crypto.createHash("sha256");
  for(const file of [
    "config.js",
    "app.js",
    "workflow.js",
    "style.css",
    "assets/social-preview.svg",
    "assets/social-preview.png",
    "scripts/generate-discovery.js"
  ]){
    hash.update(file);
    hash.update(fs.readFileSync(path.join(ROOT, file)));
  }
  return hash.digest("hex");
}

function getPreviousManifest(){
  try{
    return JSON.parse(fs.readFileSync(path.join(ROOT, "assets/seo-manifest.json"), "utf8"));
  }catch{
    return null;
  }
}

function renderSeoHead(){
  const site = config.discovery;
  const structuredData = {
    "@context":"https://schema.org",
    "@type":"WebApplication",
    name:site.name,
    url:site.siteUrl,
    description:site.description,
    applicationCategory:site.applicationCategory,
    operatingSystem:site.operatingSystem,
    browserRequirements:"Requires a modern browser with JavaScript enabled",
    isAccessibleForFree:true,
    offers:{
      "@type":"Offer",
      price:site.price,
      priceCurrency:site.priceCurrency
    },
    author:{
      "@type":"Person",
      name:site.author
    },
    codeRepository:site.repositoryUrl,
    featureList:site.features,
    softwareHelp:`${site.repositoryUrl}#readme`
  };
  const jsonLd = JSON.stringify(structuredData, null, 2).replaceAll("<", "\\u003c");
  const imageUrl = new URL(site.socialImage, site.siteUrl).href;

  return [
    `  <title>${escapeHtml(site.title)}</title>`,
    `  <meta name="description" content="${escapeHtml(site.description)}">`,
    `  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">`,
    `  <link rel="canonical" href="${escapeHtml(site.siteUrl)}">`,
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:site_name" content="${escapeHtml(site.name)}">`,
    `  <meta property="og:title" content="${escapeHtml(site.title)}">`,
    `  <meta property="og:description" content="${escapeHtml(site.description)}">`,
    `  <meta property="og:url" content="${escapeHtml(site.siteUrl)}">`,
    `  <meta property="og:image" content="${escapeHtml(imageUrl)}">`,
    `  <meta property="og:image:width" content="1200">`,
    `  <meta property="og:image:height" content="630">`,
    `  <meta property="og:image:alt" content="PhotoSahi private browser-based ID photo preparation">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeHtml(site.title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(site.description)}">`,
    `  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`,
    `  <script type="application/ld+json">`,
    jsonLd.split("\n").map(line=> `  ${line}`).join("\n"),
    `  </script>`
  ].join("\n");
}

function renderDiscoveryContent(){
  const {discovery, documents} = config;
  const applicationCards = Object.entries(documents).map(([name, preset])=> [
    `      <li>`,
    `        <strong>${escapeHtml(name)}</strong>`,
    `        <span>${preset.w} × ${preset.h} px output preset</span>`,
    `      </li>`
  ].join("\n")).join("\n");
  const limitations = discovery.limitations
    .map(item=> `      <li>${escapeHtml(item)}</li>`)
    .join("\n");
  const faqs = discovery.faqs.map(item=> [
    `      <details>`,
    `        <summary>${escapeHtml(item.question)}</summary>`,
    `        <p>${escapeHtml(item.answer)}</p>`,
    `      </details>`
  ].join("\n")).join("\n");

  return [
    `<section class="discoveryContent" aria-labelledby="aboutPhotoSahi">`,
    `  <div class="discoveryIntro">`,
    `    <p class="discoveryEyebrow">Private photo preparation</p>`,
    `    <h2 id="aboutPhotoSahi">Passport, OCI, PCC and Canadian application photo maker</h2>`,
    `    <p>${escapeHtml(discovery.shortDescription)} PhotoSahi assists with sizing and framing; the receiving organization makes the final acceptance decision.</p>`,
    `  </div>`,
    `  <div class="discoveryGrid">`,
    `    <section aria-labelledby="presetHeading">`,
    `      <h3 id="presetHeading">Available photo presets</h3>`,
    `      <ul class="presetList">`,
    applicationCards,
    `      </ul>`,
    `    </section>`,
    `    <section aria-labelledby="privacyHeading">`,
    `      <h3 id="privacyHeading">How your photo stays private</h3>`,
    `      <p>Your local file is opened in the browser, converted from HEIC or HEIF if needed, checked for a face, cropped and adjusted, then encoded as a metadata-free JPEG for local download.</p>`,
    `      <p>The optional feedback form sends only the category, message and optional email that you type. It does not attach your photo.</p>`,
    `    </section>`,
    `  </div>`,
    `  <section class="limitations" aria-labelledby="limitationsHeading">`,
    `    <h3 id="limitationsHeading">Important limitations</h3>`,
    `    <ul>`,
    limitations,
    `    </ul>`,
    `  </section>`,
    `  <section class="faq" aria-labelledby="faqHeading">`,
    `    <h3 id="faqHeading">Frequently asked questions</h3>`,
    faqs,
    `  </section>`,
    `</section>`
  ].join("\n");
}

function buildOutputs(){
  const site = config.discovery;
  const sourceHash = getSourceHash();
  const previous = getPreviousManifest();
  const lastModified = previous?.sourceHash === sourceHash && previous.lastModified
    ? previous.lastModified
    : new Date().toISOString().slice(0, 10);
  let index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  index = replaceGeneratedSection(index, "SEO", renderSeoHead());
  index = replaceGeneratedSection(index, "DISCOVERY_CONTENT", renderDiscoveryContent());

  const appNames = Object.keys(config.documents).join(", ");
  const limitations = site.limitations.map(item=> `- ${item}`).join("\n");
  const outputs = {
    "index.html":index,
    "robots.txt":[
      "User-agent: *",
      "Allow: /",
      "",
      "User-agent: OAI-SearchBot",
      "Allow: /",
      "",
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      `Sitemap: ${new URL("sitemap.xml", site.siteUrl).href}`,
      ""
    ].join("\n"),
    "sitemap.xml":[
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      `  <url>`,
      `    <loc>${escapeHtml(site.siteUrl)}</loc>`,
      `    <lastmod>${lastModified}</lastmod>`,
      `    <changefreq>monthly</changefreq>`,
      `  </url>`,
      `</urlset>`,
      ""
    ].join("\n"),
    "llms.txt":[
      `# ${site.name}`,
      "",
      `> ${site.shortDescription}`,
      "",
      `Canonical URL: ${site.siteUrl}`,
      `Source code: ${site.repositoryUrl}`,
      `Input formats: ${site.formats.join(", ")}`,
      `Available presets: ${appNames}`,
      "",
      "## Processing",
      "The selected photo is processed locally in the browser: local file, optional HEIC/HEIF conversion, face detection, crop and adjustment, metadata-free JPEG encoding, and local download.",
      "The optional feedback form sends user-entered text only and never includes the selected photo.",
      "",
      "## Limitations",
      limitations,
      ""
    ].join("\n"),
    "assets/seo-manifest.json":`${JSON.stringify({
      generatedBy:"npm run seo:generate",
      sourceHash,
      lastModified,
      generatedFiles:["index.html", "robots.txt", "sitemap.xml", "llms.txt"]
    }, null, 2)}\n`
  };
  return outputs;
}

function run(){
  const outputs = buildOutputs();
  const drift = [];
  for(const [relativePath, expected] of Object.entries(outputs)){
    const absolutePath = path.join(ROOT, relativePath);
    const actual = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
    if(actual === expected) continue;
    if(checkOnly){
      drift.push(relativePath);
    }else{
      fs.mkdirSync(path.dirname(absolutePath), {recursive:true});
      fs.writeFileSync(absolutePath, expected);
      process.stdout.write(`generated ${relativePath}\n`);
    }
  }
  if(drift.length){
    process.stderr.write(`Discovery files are stale: ${drift.join(", ")}\nRun npm run seo:generate and commit the results.\n`);
    process.exitCode = 1;
  }
}

if(require.main === module) run();

module.exports = {buildOutputs, renderDiscoveryContent, renderSeoHead};
