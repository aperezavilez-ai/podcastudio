import assert from "node:assert";
import { readFileSync } from "node:fs";

// Test 1: isSafeExternalUrl logic (replicated from electron/main.js)
function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    const allowed = ["http:", "https:", "mailto:"];
    if (!allowed.includes(parsed.protocol)) return false;
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") return false;
    return true;
  } catch {
    return false;
  }
}

const safeCases = [
  ["https://www.podcastudio.mx", true],
  ["http://example.com", true],
  ["mailto:foo@bar.com", true],
  ["file:///etc/passwd", false],
  ["javascript:alert(1)", false],
  ["ftp://example.com", false],
  ["http://localhost:3000", false],
  ["not-a-url", false],
];

let pass = 0;
for (const [u, expected] of safeCases) {
  const got = isSafeExternalUrl(u);
  assert.strictEqual(got, expected, `isSafeExternalUrl(${u}) expected ${expected} got ${got}`);
  pass++;
}
console.log("Test 1 (isSafeExternalUrl):", pass, "cases passed");

// Test 2: vercel.json parseable and no duplicate redirects, no Clear-Site-Data on sw.js
const v = JSON.parse(readFileSync("vercel.json", "utf8"));
const seen = new Set();
let dup = 0;
for (const r of v.redirects) {
  const key = r.source + JSON.stringify(r.has || []) + r.destination;
  if (seen.has(key)) dup++;
  seen.add(key);
}
assert.strictEqual(dup, 0, "vercel.json still has duplicate redirects");
const swHeaders = v.headers.find(h => h.source === "/sw.js");
const hasClear = swHeaders.headers.some(h => h.key === "Clear-Site-Data");
assert.strictEqual(hasClear, false, "vercel.json still has Clear-Site-Data on /sw.js");
console.log("Test 2 (vercel.json): OK");

// Test 3: api/mux/webhook.js uses raw-body and bodyParser false
const mux = readFileSync("api/mux/webhook.js", "utf8");
assert.ok(mux.includes("import rawBody from 'raw-body'"), "mux webhook missing raw-body import");
assert.ok(mux.includes("api: { bodyParser: false }"), "mux webhook missing bodyParser false");
assert.ok(mux.includes("verifyMuxSignature(rawBodyBuffer, signature)"), "mux webhook missing raw body verification");
console.log("Test 3 (mux webhook): OK");

// Test 4: api/ai/status.js is ESM
const aiStatus = readFileSync("api/ai/status.js", "utf8");
assert.ok(!aiStatus.includes("module.exports"), "ai/status.js still CommonJS");
assert.ok(aiStatus.includes("export default async function handler"), "ai/status.js missing ESM export");
console.log("Test 4 (ai/status.js ESM): OK");

// Test 5: src/lib/supabase.js no hardcoded fallback
const sup = readFileSync("src/lib/supabase.js", "utf8");
assert.ok(!sup.includes("https://fzoiuyyvzhgqcjceagkd.supabase.co"), "supabase.js still has hardcoded URL");
assert.ok(!sup.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "supabase.js still has hardcoded anon key");
console.log("Test 5 (supabase.js): OK");

console.log("ALL P0 TESTS PASSED");


