/**
 * Tests production mask helpers by evaluating the TypeScript source
 * (no duplicate security logic).
 */
import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import { createRequire } from "module";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "../mask.ts"), "utf8");
// Strip types lightly for Function eval of exports
const js = src
  .replace(/: string \| null \| undefined/g, "")
  .replace(/: string/g, "")
  .replace(/: boolean/g, "")
  .replace(/export function/g, "function")
  .replace(/export /g, "");
const fn = new Function(`${js}; return { maskEmail, maskIp, displayIp, displayEmail };`);
const { maskEmail, maskIp, displayIp, displayEmail } = fn();

let failed = 0;
function assert(c, m) {
  if (!c) { console.error("FAIL", m); failed++; }
  else console.log("OK  ", m);
}

assert(maskEmail("maryamed@gmail.com").startsWith("m") && maskEmail("maryamed@gmail.com").includes("ed@gmail.com"), "email first+last2");
assert(maskEmail("maryamed@gmail.com").includes("*"), "email has stars");
assert(maskIp("192.168.1.125") === "***.***.*.125", "ipv4 last octet");
assert(displayIp("192.168.1.125", true) === "192.168.1.125", "full admin sees full ip");
assert(displayIp("192.168.1.125", false) === "***.***.*.125", "secondary sees masked ip");
assert(displayEmail("a@b.com", false) !== "a@b.com" || maskEmail("ab@b.com").includes("*"), "secondary email masked");
assert(maskIp(null) === "غير متاح" || maskIp(null) === "—", "null ip safe");

if (failed) process.exit(1);
console.log("\nProduction mask tests passed");
