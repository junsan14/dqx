/**
 * scripts/material-costs-csv-to-js.mjs
 *
 * Reads:  public/data/material_costs.csv
 * Writes: data/material_costs.generated.js
 *
 * Usage:
 *   node scripts/material-costs-csv-to-js.mjs
 */
import fs from "fs";
import path from "path";

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",");
  const idxName = header.indexOf("name");
  const idxUnit = header.indexOf("unitCost");
  const idxAlias = header.indexOf("aliasTo");

  if (idxName < 0 || idxUnit < 0) throw new Error("CSV must contain name,unitCost columns");

  const rows = [];
  for (const line of lines) {
    // Minimal CSV parsing (no quoted commas expected in this dataset)
    const cols = line.split(",");
    rows.push({
      name: (cols[idxName] ?? "").trim(),
      unitCost: Number((cols[idxUnit] ?? "").trim()),
      aliasTo: idxAlias >= 0 ? (cols[idxAlias] ?? "").trim() : "",
    });
  }
  return rows.filter((r) => r.name && Number.isFinite(r.unitCost));
}

function toJsModule(rows) {
  const costs = {};
  const aliases = {};
  for (const r of rows) {
    costs[r.name] = r.unitCost;
    if (r.aliasTo) aliases[r.name] = r.aliasTo;
  }

  return `// AUTO-GENERATED. DO NOT EDIT.
// Generated from public/data/material_costs.csv

export const MATERIAL_COSTS = ${JSON.stringify(costs, null, 2)};

export const MATERIAL_ALIASES = ${JSON.stringify(aliases, null, 2)};

export function getMaterialUnitCost(name) {
  const key = MATERIAL_ALIASES[name] ?? name;
  return MATERIAL_COSTS[key] ?? null;
}
`;
}

const projectRoot = process.cwd();
const inPath = path.join(projectRoot, "public", "data", "material_costs.csv");
const outPath = path.join(projectRoot, "data", "material_costs.js");

if (!fs.existsSync(inPath)) {
  console.error("Not found:", inPath);
  process.exit(1);
}

const csvText = fs.readFileSync(inPath, "utf-8");
const rows = parseCsv(csvText);
const js = toJsModule(rows);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, js, "utf-8");

console.log("Wrote:", outPath);