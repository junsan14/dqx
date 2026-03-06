// scripts/scrape-saihou-sets.mjs
// Node 18+ 推奨（fetch が使える）
// 依存：cheerio
//   npm i cheerio
//
// 実行：node scripts/scrape-saihou-sets.mjs
// 出力：./data/recipes/saihou.sets.js （パスは好みで変えてOK）
//
// 抽出元：裁縫職人 / 職人レシピ
// https://dragon-quest.jp/ten/recipe/saihou.php

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";

const URL = "https://dragon-quest.jp/ten/recipe/saihou.php";
const OUT = path.resolve(process.cwd(), "data/recipes/saihou.sets.js");

const md5 = (s) => crypto.createHash("md5").update(String(s), "utf8").digest("hex");
const md5_10 = (s) => md5(s).slice(0, 10);

const clean = (s) =>
  String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseLv = (txt) => {
  const m = clean(txt).match(/Lv\s*([0-9]+)/i);
  return m ? Number(m[1]) : null;
};

const parseEquipLevelFromBar = (barText) => {
  // 例: "Lv1-7装備" / "Lv14-28装備" / "Lv125装備"
  // 範囲の場合は先頭Lvを採用（必要なら null にしてもOK）
  const t = clean(barText);
  const single = t.match(/Lv\s*([0-9]+)\s*装備/);
  if (single) return Number(single[1]);

  const range = t.match(/Lv\s*([0-9]+)\s*-\s*([0-9]+)\s*装備/);
  if (range) return Number(range[1]);

  return null;
};

const parseMaterialsFromTd = ($td) => {
  const html = $td.html() ?? "";
  const lines = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map(clean)
    .filter(Boolean);

  const mats = [];
  for (const line of lines) {
    const m = line.match(/[○◯]\s*([^×]+?)\s*×\s*([0-9]+)/);
    if (!m) continue;
    mats.push({ name: clean(m[1]), qty: Number(m[2]) });
  }
  return mats;
};

// 裁縫の部位推定（必要なら増やす）
const inferSlot = (name) => {
  const n = clean(name);

  // 頭
  if (/(ぼうし|ずきん|フード|ハット|キャップ|バンダナ|ベレー|ティアラ|サークレット|リボン|バイザー|はちまき|シャプカ)$/u.test(n))
    return "頭";

  // 体下（上より先に見る：ズボン/タイツ等は明確）
  if (/(よろい下|ころも下|ローブ下|コート下|ドレス下|スーツ下|ズボン|パンツ|タイツ|スカート)$/u.test(n))
    return "体下";

  // 腕
  if (/(てぶくろ|グローブ|ブレス|うでわ|こて|リスト)$/u.test(n)) return "腕";

  // 足
  if (/(くつ|ブーツ|サンダル|シューズ|ながぐつ|足袋|スリッパ)$/u.test(n)) return "足";

  // 体上
  if (/(よろい上|ころも上|ローブ上|コート上|ドレス上|スーツ上|シャツ|ブラウス|ベスト|ジャケット|コート|ローブ|ころも|ドレス|ケープ上|ケープ|マント)$/u.test(n))
    return "体上";

  return "裁縫";
};

const baseNameFromPart = (name) => {
  // セット名推定用：部位っぽい語尾を外す
  let out = clean(name);
  out = out
    .replace(/(よろい上|ころも上|ローブ上|コート上|ドレス上|スーツ上)$/u, "")
    .replace(/(よろい下|ころも下|ローブ下|コート下|ドレス下|スーツ下)$/u, "")
    .replace(/(ぼうし|ずきん|フード|ハット|キャップ|バンダナ|ベレー|ティアラ|サークレット|リボン|バイザー|はちまき)$/u, "")
    .replace(/(てぶくろ|グローブ|ブレス|うでわ|こて|リスト)$/u, "")
    .replace(/(くつ|ブーツ|サンダル|シューズ|ながぐつ|足袋|スリッパ)$/u, "")
    .replace(/の$/u, "");
  return clean(out);
};

const isSetCandidateSlot = (slot) => ["頭", "体上", "体下", "腕", "足"].includes(slot);

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // 1) 生行を抽出（「名前」と「素材」を td で分離するので、名前に素材が混ざらない）
  const rows = [];
  $("table.ta1_sk").each((_, table) => {
    let equipLevel = null;
    let currentRecipeBook = null;

    $(table)
      .find("tr")
      .each((__, tr) => {
        const $tr = $(tr);

        // セクションバー（LvXX装備）
        const $bar = $tr.find("td.cate_bar");
        if ($bar.length) {
          equipLevel = parseEquipLevelFromBar($bar.text());
          currentRecipeBook = null;
          return;
        }

        // 見出し行は飛ばす
        if ($tr.find("td.cate_bar2").length) return;

        const $tds = $tr.find("td");
        if ($tds.length < 3) return;
        if (equipLevel == null) return;

        let idx = 0;

        // レシピ名セル（rowspan）＝セットの親キー
        const bgcolor = clean($tds.eq(0).attr("bgcolor") || "").toLowerCase();
        const hasRecipeCell = bgcolor === "#d5dfec" || bgcolor === "d5dfec";
        if (hasRecipeCell) {
          currentRecipeBook = clean($tds.eq(0).text());
          idx = 1;
        }
        if (!currentRecipeBook) return;

        const craftLevel = parseLv($tds.eq(idx).text());
        const name = clean($tds.eq(idx + 1).text());
        const matsTd = $tds.eq(idx + 2);

        const materials = parseMaterialsFromTd(matsTd);
        const slot = inferSlot(name);

        rows.push({
          id: md5_10(`${currentRecipeBook}|${equipLevel}|${craftLevel}|${name}`),
          name,
          craftType: "裁縫",
          craftLevel,
          recipeBook: currentRecipeBook,
          slot,
          equipLevel,
          jobs: [],
          stats: null,
          slotGridType: null,
          slotGridCols: null,
          slotGrid: null,
          baseEffects: [],
          qualityBonus: null,
          materials,
        });
      });
  });

  // 2) recipeBook 単位でまとめる（同レシピ名＝セット候補）
  const byRecipe = new Map();
  for (const it of rows) {
    const key = it.recipeBook;
    if (!byRecipe.has(key)) byRecipe.set(key, []);
    byRecipe.get(key).push(it);
  }

  const SAIHOU_SET_GROUPS = [];
  const SAIHOU_SINGLES = [];

  const slotOrder = { 頭: 0, 体上: 1, 体下: 2, 腕: 3, 足: 4, 裁縫: 9 };

  for (const [recipeBook, items] of byRecipe.entries()) {
    // セット判定：候補部位が2つ以上 ＆ 部位が2種類以上
    const parts = items.filter((x) => isSetCandidateSlot(x.slot));
    const uniqSlots = new Set(parts.map((x) => x.slot));

    if (parts.length >= 2 && uniqSlots.size >= 2) {
      const proto = parts[0];

      const base = baseNameFromPart(proto.name);
      const setName = base ? `${base}セット` : `${recipeBook}セット`;

      SAIHOU_SET_GROUPS.push({
        id: `set_${md5(`${proto.craftType}|${proto.equipLevel}|${recipeBook}`).slice(0, 10)}`,
        name: setName,
        craftType: proto.craftType,
        craftLevel: proto.craftLevel,
        recipeBook,
        equipLevel: proto.equipLevel,

        // セット固有情報（別ソースで上書き想定）
        jobs: [],
        setEffects: [],
        crystalByAlchemy: null,

        items: parts.sort((a, b) => (slotOrder[a.slot] ?? 99) - (slotOrder[b.slot] ?? 99)),
      });

      // 「裁縫」扱いに落ちた単品は singles 側へ
      const nonParts = items.filter((x) => !isSetCandidateSlot(x.slot));
      SAIHOU_SINGLES.push(...nonParts);
    } else {
      SAIHOU_SINGLES.push(...items);
    }
  }

  const outJs =
    `// Auto-generated from ${URL}\n` +
    `// NOTE: recipeBook(rowspan) is treated as a "set" key.\n\n` +
    `export const SAIHOU_SET_GROUPS = ${JSON.stringify(SAIHOU_SET_GROUPS, null, 2)};\n\n` +
    `export const SAIHOU_SINGLES = ${JSON.stringify(SAIHOU_SINGLES, null, 2)};\n`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, outJs, "utf8");

  console.log(`OK: rows=${rows.length} sets=${SAIHOU_SET_GROUPS.length} singles=${SAIHOU_SINGLES.length}`);
  console.log(`Wrote: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
