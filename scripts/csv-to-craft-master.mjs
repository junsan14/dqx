// scripts/csv-to-craft-master.mjs
import fs from "node:fs";
import path from "node:path";

const csvPath = path.join(process.cwd(), "public", "data", "craft_master.csv");
const outPath = path.resolve("data/craft_master.js");

const csv = fs.readFileSync(csvPath, "utf8");

// 超シンプルCSVパーサ（ダブルクォート対応）
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQ) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') { inQ = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (ch === "\r") continue;

    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const rows = parseCSV(csv);
const headers = rows[0];
const data = rows.slice(1).map((r) => {
  const o = {};
  headers.forEach((h, idx) => (o[h] = r[idx] ?? ""));
  return o;
});

const js = `// generated from craft_master.csv
export const CRAFT_MASTER = ${JSON.stringify(data, null, 2)};
`;

fs.writeFileSync(outPath, js, "utf8");
console.log("written:", outPath);