/**
 * node scrape_bougu.js
 * 出力: ./bougu.recipes.js
 *
 * Node 18+ 推奨（fetchが標準で使える）
 */

import { writeFileSync } from "node:fs";

const URL = "https://dragon-quest.jp/ten/recipe/bougu.php";

// 文字参照を最低限デコード（必要分だけ）
function decodeHtmlEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

// HTMLを「ページ表示に近いプレーンテキスト」にする
function htmlToText(html) {
  // 改行にしたい要素は先に\nへ
  let t = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<\/\s*div\s*>/gi, "\n")
    .replace(/<\/\s*tr\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n");

  // タグを落とす
  t = t.replace(/<[^>]+>/g, "");

  // entity decode
  t = decodeHtmlEntities(t);

  // 余計なスペース整理
  t = t.replace(/\r/g, "");
  t = t
    .split("\n")
    .map((line) => line.replace(/\u00A0/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return t;
}

// idは「確実に一意寄り」でOK（あなた側で後で置換もできる）
function makeId(name, equipLevel, craftLevel) {
  const enc = encodeURIComponent(name).replace(/%/g, "_");
  return `dq10_bougu_${equipLevel ?? "NA"}_${craftLevel}_${enc}`;
}

// 行から素材抽出（行頭◯縛りなし、行内から全回収）
function extractMaterials(line) {
  // 「店）10000G」「本棚）」など以降はノイズなので切る
  const cut = line.split(/店）|買）|本棚）|落）|クエスト）|レシピ屋）/)[0];

  const mats = [];
  const re = /[◯○]\s*([^×\n\r]+?)\s*×\s*(\d+)/g;
  let m;
  while ((m = re.exec(cut)) !== null) {
    mats.push({ name: m[1].trim(), qty: Number(m[2]) });
  }
  return mats;
}

/**
 * 開始行判定：
 * A) "メタスラの盾のレシピ Lv33 メタスラの盾 ◯ひかりの石×15"
 * B) "Lv34 僧兵のころも上 ◯せいれいせき×3"
 */
function parseStartLine(line) {
  // A: 先頭がLvじゃない & " <recipeBook> Lv<craft> <name> "
  let m = line.match(/^(.+?)\s+Lv(\d+)\s+(.+?)(?:\s+[◯○].*)?$/);
  if (m && !line.startsWith("Lv")) {
    return { recipeBook: m[1].trim(), craftLevel: Number(m[2]), name: m[3].trim(), hasRecipeBook: true };
  }

  // B: "Lv<craft> <name>"
  m = line.match(/^Lv(\d+)\s+(.+?)(?:\s+[◯○].*)?$/);
  if (m) {
    return { recipeBook: null, craftLevel: Number(m[1]), name: m[2].trim(), hasRecipeBook: false };
  }

  return null;
}

async function main() {
  const res = await fetch(URL, {
    headers: {
      // これ無しだと弾かれたり内容変わるサイトがある
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en;q=0.8",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const text = htmlToText(html);
  const lines = text.split("\n");

  let equipLevel = null;       // "Lv60装備" の60
  let lastRecipeBook = null;   // セット装備の続き行用
  const out = [];

  let cur = null;
  const flush = () => {
    if (cur) out.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // セクション: "Lv1-7装備" "Lv65装備" など
    // 例: "Lv1-7装備" / "Lv60装備"
    let sec = line.match(/^Lv(\d+)(?:-\d+)?装備$/);
    if (sec) {
      equipLevel = Number(sec[1]);
      continue;
    }

    // 見出し行ノイズ
    if (line === "レシピ名 職人") continue;
    if (line === "Lv 名前 レシピ 入手方法") continue;

    const start = parseStartLine(line);
    if (start) {
      flush();

      if (start.hasRecipeBook) lastRecipeBook = start.recipeBook;
      const recipeBook = start.recipeBook ?? lastRecipeBook;

      cur = {
        id: makeId(start.name, equipLevel, start.craftLevel),
        name: start.name,
        craftType: "防具鍛冶",
        craftLevel: start.craftLevel,
        recipeBook: recipeBook ?? null,

        // bougu.php からは確実に取れないので空
        slot: null,
        equipLevel: equipLevel,
        jobs: [],
        stats: null,
        slotGridType: null,
        slotGridCols: null,
        slotGrid: null,
        baseEffects: [],
        qualityBonus: null,

        materials: extractMaterials(line),
      };
      continue;
    }

    // 続き行（素材だけの行）を現在アイテムに加算
    if (cur) {
      const mats = extractMaterials(line);
      if (mats.length) cur.materials.push(...mats);
    }
  }

  flush();

  const js = `// generated from ${URL}
export const bouguRecipes = ${JSON.stringify(out, null, 2)};
`;

  writeFileSync("./bougu.recipes.js", js, "utf8");
  console.log(`OK: ${out.length} items -> bougu.recipes.js`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});