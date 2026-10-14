// Parses the example statblocks and fails if any of them lose core stats. Runs in CI on every push.
import fs from "fs";
import { parseStatblocks } from "../../scripts/parser.js";

const results = parseStatblocks(fs.readFileSync(new URL("../../examples/example-statblocks.txt", import.meta.url), "utf8"));
let failed = 0;
for (const r of results) {
  const d = r.data;
  const missing = ["ac", "hp", "cr", "size", "type"].filter(k => d[k] == null);
  if (Object.keys(d.abilities ?? {}).length !== 6) missing.push("abilities");
  if (!d.entries?.length) missing.push("entries");
  console.log(`${missing.length ? "FAIL" : "ok  "} ${d.name} [${r.rules}] AC ${d.ac} HP ${d.hp} CR ${d.cr} — ${d.entries?.length ?? 0} features${missing.length ? ` — missing ${missing.join(", ")}` : ""}`);
  if (missing.length || r.error) failed++;
}
if (results.length < 6) { console.log(`Expected 6 statblocks, got ${results.length}`); failed++; }
process.exit(failed ? 1 : 0);
