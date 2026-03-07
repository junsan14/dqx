// node >= 18
// npm i cheerio
import fs from "node:fs";
import * as cheerio from "cheerio";

const TIGER_SEWING = "https://dragon-quest.jp/ten/recipe/saihou.php";

// dq10-db: sewing slots
const DQ10DB_SLOTS = [
  { slot: "頭", url: "https://dq10-db.com/workers/make/sewing/head/" },
  { slot: "体上", url: "https://dq10-db.com/workers/make/sewing/body_u/" },
  { slot: "体下", url: "https://dq10-db.com/workers/make/sewing/body_d/" },
  { slot: "腕", url: "https://dq10-db.com/workers/make/sewing/arm/" },
  { slot: "足", url: "https://dq10-db.com/workers/make/sewing/foot/" },
];

const craftType = "裁縫";

function normalizeName(s) {
  return (s || "")
    .replace(/\s+/g, "")
    .replace(/[　]/g, "")
    .trim();
}

function hashId(prefix, s) {
  // 雑hash（必要なら君のuuidに置き換え）
  let h = 2166136261;
  const str = `${prefix}:${s}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}_${(h >>> 0).toString(16)}`;
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}

// 1) 攻略の虎：裁縫レシピ一覧 → recipeBook単位にitemsを収集
async function scrapeTigerSewing() {
  const html = await fetchHtml(TIGER_SEWING);
  const $ = cheerio.load(html);

  const recipeBookToItems = new Map();

  let currentBook = null;

  const norm = (s) =>
    (s ?? "")
      .replace(/\u00a0/g, " ") // &nbsp;
      .replace(/[　]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const parseLv = (s) => {
    const m = norm(s).match(/^Lv(\d+)$/);
    return m ? Number(m[1]) : null;
  };

  const parseMaterialsFromCell = (cellText) => {
    // "○星光の糸×24 ○おぼろ水晶×3 ..." みたいなのを全部拾う
    const t = norm(cellText).replace(/◯/g, "○");
    const parts = t.split("○").map((x) => x.trim()).filter(Boolean);

    const mats = [];
    for (const p of parts) {
      const m = p.match(/^(.*)×(\d+)$/);
      if (!m) continue;
      mats.push({ name: norm(m[1]), qty: Number(m[2]) });
    }
    return mats;
  };

  // ページ内のテーブル行を総当りで拾う（列数が揺れるので堅牢に）
  $("tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;

    // 空欄を消さず「そのまま列位置で取る」のがポイント
    const col = [];
    tds.each((i, td) => col.push(norm($(td).text())));

    // 代表的な2パターン
    // A) [レシピ名, Lv, 名前, レシピ(素材...), 入手方法]
    // B) ["",      Lv, 名前, レシピ(素材...), 入手方法]
    // C) [Lv, 名前, レシピ(素材...), 入手方法] みたいに左に詰まって見える行が混ざる場合もある（ページの崩れ対策）

    let recipeBook = null;
    let lvText = null;
    let name = null;
    let recipeCellText = null;

    // パターンA/B
    const lv1 = parseLv(col[1]);
    if (lv1 !== null) {
      // 1列目にレシピ名があるなら更新（空欄なら引き継ぎ）
      if (col[0] && !/^Lv\d+$/.test(col[0])) currentBook = col[0];
      recipeBook = currentBook;

      lvText = col[1];
      name = col[2];

      // 「レシピ(素材)」は4列目（index 3）
      recipeCellText = col[3] ?? "";
    } else {
      // パターンC（先頭がLv）
      const lv0 = parseLv(col[0]);
      if (lv0 === null) return;

      recipeBook = currentBook;
      lvText = col[0];
      name = col[1];
      recipeCellText = col[2] ?? "";
    }

    if (!recipeBook || !name || !/^Lv\d+$/.test(lvText)) return;

    const craftLevel = Number(lvText.replace("Lv", ""));
    const materials = parseMaterialsFromCell(recipeCellText);

    const list = recipeBookToItems.get(recipeBook) ?? [];
    list.push({
      name,
      craftLevel,
      recipeBook,
      materials,
    });
    recipeBookToItems.set(recipeBook, list);
  });

  // nameでuniq（同じ行が拾われた時用）
  for (const [book, list] of recipeBookToItems.entries()) {
    const byName = new Map();
    for (const it of list) byName.set(it.name, it);
    recipeBookToItems.set(book, [...byName.values()]);
  }

  return recipeBookToItems;
}

// 2) dq10-db：各スロット一覧 → itemName から equipLv/職人Lv を拾う
async function scrapeDq10dbSlotIndex() {
  const nameToMeta = new Map();

  for (const { slot, url } of DQ10DB_SLOTS) {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // ページ本文はリンクがずらっと並ぶ形式（「名前 ... 装備Lv X 職人Lv Y」）
    // なので a のテキストから抜く
    $("a").each((_, a) => {
      const text = normalizeName($(a).text());
      if (!text) return;

      // "前座芸人の服 ... 装備Lv 1 職人Lv 1" みたいなのを想定
      const mEquip = text.match(/装備Lv(\d+)/);
      const mCraft = text.match(/職人Lv(\d+)/);

      // 名前： "装備Lv" より前を雑に切る
      const name = normalizeName(text.split("装備Lv")[0]);

      if (!name || !mEquip || !mCraft) return;

      const equipLevel = Number(mEquip[1]);
      const craftLevel = Number(mCraft[1]);

      // 同名が別slotにいることは基本ない想定。もし衝突したらslot違いで上書きされる。
      nameToMeta.set(name, { slot, equipLevel, craftLevel });
    });
  }

  return nameToMeta;
}

function buildSets(recipeBookToItems, nameToMeta) {
  const sets = [];

  for (const [recipeBook, itemsFromTiger] of recipeBookToItems.entries()) {
    const mergedItems = itemsFromTiger.map((x) => {
      const meta = nameToMeta.get(x.name) ?? null;

      return {
        id: hashId("item", x.name),
        name: x.name,
        craftType,
        craftLevel: x.craftLevel ?? (meta ? meta.craftLevel : null),
        recipeBook,
        slot: meta ? meta.slot : null,
        equipLevel: meta ? meta.equipLevel : null,
        jobs: [],
        stats: null,
        slotGridType: null,
        slotGridCols: null,
        slotGrid: null,
        baseEffects: [],
        qualityBonus: null,
        materials: x.materials ?? [],
      };
    });

    // setの代表 equip/craft は最小値でまとめる（君の例に寄せる）
    const craftLevel = mergedItems
      .map((x) => x.craftLevel)
      .filter((v) => typeof v === "number")
      .reduce((a, b) => Math.min(a, b), Infinity);
    const equipLevel = mergedItems
      .map((x) => x.equipLevel)
      .filter((v) => typeof v === "number")
      .reduce((a, b) => Math.min(a, b), Infinity);

    // set名：最初のアイテムの「◯◯の〜」の前半を使う（前座芸人のバンダナ → 前座芸人セット）
    const first = mergedItems[0]?.name ?? recipeBook;
    const base = first.includes("の") ? first.split("の")[0] : recipeBook;

    sets.push({
      id: hashId("set", recipeBook),
      name: `${base}セット`,
      craftType,
      craftLevel: craftLevel === Infinity ? null : craftLevel,
      recipeBook,
      equipLevel: equipLevel === Infinity ? null : equipLevel,
      jobs: [],
      setEffects: [],
      crystalByAlchemy: null,
      items: mergedItems,
    });
  }

  return sets;
}

async function main() {
  const recipeBookToItems = await scrapeTigerSewing();
  const nameToMeta = await scrapeDq10dbSlotIndex();

  const sets = buildSets(recipeBookToItems, nameToMeta);

  fs.writeFileSync("./sewing_sets.json", JSON.stringify(sets, null, 2), "utf8");
  console.log(`OK: ${sets.length} sets -> sewing_sets.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});