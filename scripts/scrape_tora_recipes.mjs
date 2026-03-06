// scripts/scrape_tora_recipes.mjs
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const PAGES = [
  { craftType: "防具鍛冶", url: "https://dragon-quest.jp/ten/recipe/bougu.php", schema: "HEADER_EQUIP_LV" },
  { craftType: "裁縫", url: "https://dragon-quest.jp/ten/recipe/saihou.php", schema: "HEADER_EQUIP_LV" },

  // まずは裁縫/防具鍛冶の0件問題を潰すため2つだけでOK
  // 次に武器鍛冶も同じ方式で足せる
];

const OUT = path.resolve("data/recipes/all_from_tora.json");

function norm(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

async function fetchHtml(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
          "accept-language": "ja,en;q=0.9",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function toId(name, craftType) {
  return (
    craftType +
    "_" +
    name
      .replace(/[ 　]/g, "_")
      .replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_]/gu, "")
  );
}

function parseHeaderEquipLevel(text) {
  const t = norm(text);
  // "Lv1-7装備" / "Lv1-7" / "Lv14" / "Lv14装備"
  let m = t.match(/^Lv\s*(\d+)\s*-\s*(\d+)(?:\s*装備)?$/);
  if (m) return Number(m[1]);
  m = t.match(/^Lv\s*(\d+)(?:\s*装備)?$/);
  if (m) return Number(m[1]);
  return null;
}

function parseRowByLvSplit(line, currentRecipeBook) {
  const s = norm(line).replace(/◯/g, "○");

  // ✅ \b を使わず、Lv数字を素直に拾う
  const m = s.match(/Lv\s*(\d+)/);
  if (!m) return null;

  const idx = s.indexOf(m[0]);
  const left = norm(s.slice(0, idx)); // レシピ名が入る可能性
  const right = norm(s.slice(idx));   // "Lv1 せいどうの盾 ○どうのこうせき×1 ..."

  const craftLevel = Number(m[1]);
  const afterLv = norm(right.replace(/^Lv\s*\d+\s*/g, "")); // "せいどうの盾 ○どうのこうせき×1 ..."

  // 名前は「最初の ○ の手前」なければ行全体（素材が別行のケース）
  const name = norm(afterLv.split("○")[0]);
  if (!name) return null;

  // 素材っぽい部分（この行内にあればここに入る）
  const matPart = afterLv.includes("○") ? "○" + afterLv.split("○").slice(1).join("○") : "";

  const recipeBook = left || currentRecipeBook || null;
  return { recipeBook, craftLevel, name, matPart };
}
function parseMaterialsFromText(text) {
  const t = norm(text).replace(/◯/g, "○");
  const out = [];
  const re = /○\s*([^×x✕○]+?)\s*[×x✕]\s*(\d+)/g;
  let m;
  while ((m = re.exec(t))) {
    out.push({ name: norm(m[1]), qty: Number(m[2]) });
  }
  return out;
}

function scrapeHeaderEquipLvTextPage(lines, craftType) {
  const results = [];

  let currentEquipLevel = null;
  let currentRecipeBook = null;

  const isHeaderLine = (l) =>
    l === "レシピ名 職人" ||
    l === "Lv 名前 レシピ 入手方法" ||
    l === "Lv 名前 レシピ" ||
    l === "Lv 名前" ||
    l === "すべて";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 装備Lvヘッダ更新（Lv1-7装備 / Lv1-7 / Lv14 など）
    const elv = parseHeaderEquipLevel(line);
    if (elv != null) {
      currentEquipLevel = elv;
      continue;
    }

    if (isHeaderLine(line)) continue;

    // 「○〜」だけの行はデータ行じゃない（直前データの素材の続きとして処理する）
    const normalized = line.replace(/◯/g, "○");
    if (normalized.startsWith("○")) continue;

    // データ行をパース
    const row = parseRowByLvSplit(line, currentRecipeBook);
    if (!row) continue;

    if (row.recipeBook) currentRecipeBook = row.recipeBook;

    // 素材：当該行の "○..." + 直後の "○..." 行を全部連結
    // 素材：当該行 + 次行以降の「○を含む行」を連結（行頭縛りなし）
let matText = row.matPart || "";
let j = i + 1;

while (j < lines.length) {
  const nxtRaw = lines[j];
  const nxt = nxtRaw.replace(/◯/g, "○");

  // 次のレシピ行（Lv〜）や装備ヘッダ（Lv1-7装備など）が来たら終了
  if (/^Lv\s*\d+/.test(nxt) || /^Lv\s*\d+\s*-\s*\d+/.test(nxt) || nxt.includes("装備")) {
    break;
  }

  // ○素材×数 を含む行なら素材として連結
  if (nxt.includes("○") || nxt.includes("×") || nxt.includes("✕") || nxt.includes("x")) {
    matText += " " + nxt;
    j++;
    continue;
  }

  // 入手方法などの続きが来る場合もあるのでここで止める
  break;
}

// 読み取った素材行分だけ i を進める
i = j - 1;

    const materials = parseMaterialsFromText(matText);
    if (!materials.length) continue; // ★素材が取れない行は捨てる（要望）

    results.push({
      id: toId(row.name, craftType),
      name: row.name,
      craftType,
      craftLevel: row.craftLevel,
      equipLevel: currentEquipLevel,
      recipeBook: currentRecipeBook,
      materials,
      slot: null,
      stats: {},
      baseEffects: [],
    });
  }

  return results;
}

async function scrapePage({ craftType, url, schema }) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // ページ全体テキストを行にする（裁縫ページがこの形式） :contentReference[oaicite:1]{index=1}
  const lines = $.root()
    .text()
    .split("\n")
    .map(norm)
    .filter(Boolean);

  // デバッグ：最初の50行見たいときはコメント外す
   console.log(lines.slice(0, 50).join("\n"));

  if (schema === "HEADER_EQUIP_LV") {
    return scrapeHeaderEquipLvTextPage(lines, craftType);
  }

  return [];
}

async function main() {
  const all = [];
  for (const p of PAGES) {
    console.log("scraping:", p.craftType, p.url);
    const rows = await scrapePage(p);
    console.log("  ->", rows.length);
    all.push(...rows);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2), "utf8");
  console.log("OK:", OUT, "total:", all.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});