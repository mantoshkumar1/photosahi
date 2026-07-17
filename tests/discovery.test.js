const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = require("../config.js");
const {buildOutputs, renderSeoHead} = require("../scripts/generate-discovery.js");

test("discovery configuration uses a canonical HTTPS URL", ()=>{
  const url = new URL(config.discovery.siteUrl);
  assert.equal(url.protocol, "https:");
  assert.equal(url.pathname, "/photosahi/");
});

test("structured data is valid JSON-LD for a free web application", ()=>{
  const head = renderSeoHead();
  const match = head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  const data = JSON.parse(match[1]);
  assert.equal(data["@type"], "WebApplication");
  assert.equal(data.url, config.discovery.siteUrl);
  assert.equal(data.offers.price, "0");
  assert.doesNotMatch(data.description, /guaranteed|accepted|compliant/i);
});

test("generated crawler files expose the canonical page", ()=>{
  const outputs = buildOutputs();
  assert.match(outputs["robots.txt"], /User-agent: OAI-SearchBot\nAllow: \//);
  assert.match(outputs["robots.txt"], /User-agent: GPTBot\nDisallow: \//);
  assert.match(outputs["robots.txt"], /Sitemap: https:\/\/mantoshkumar1\.github\.io\/photosahi\/sitemap\.xml/);
  assert.match(outputs["sitemap.xml"], /<loc>https:\/\/mantoshkumar1\.github\.io\/photosahi\/<\/loc>/);
  assert.match(outputs["llms.txt"], /selected photo is processed locally/i);
});

test("generated crawlable content contains every configured preset", ()=>{
  const content = buildOutputs()["index.html"];
  for(const name of Object.keys(config.documents)) assert.match(content, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("config is loaded before the application script", ()=>{
  const index = buildOutputs()["index.html"];
  assert.ok(index.indexOf("config.js") < index.indexOf("app.js"));
});

test("social preview is the declared 1200 by 630 PNG", ()=>{
  const png = fs.readFileSync(path.join(__dirname, "../assets/social-preview.png"));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
