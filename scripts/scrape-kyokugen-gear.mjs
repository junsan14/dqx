// scripts/scrape-kyokugen-gear.mjs
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import pLimit from "p-limit";

// =====================
// 設定
// =====================
const START_URL = "https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_01.html"; // 武器/防具入口 :contentReference[oaicite:7]{index=7}
const OUT_DIR = path.resolve("data_out");
const CONCURRENCY = 4;      // 同時接続は控えめに
const WAIT_MS = 250;        // 礼儀として少し待つ
const USER_AGENT = "Mozilla/5.0 (compatible; dqx-csv-bot/1.0; +local-personal-use)";

fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  await sleep(WAIT_MS);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.text();
}

function absUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

// START_URL からカテゴリリンクを抽出（武器種/盾/防具部位） :contentReference[oaicite:8]{index=8}
function extractCategoryLinksFromItemTop($, baseUrl) {
  const links = new Set();

  // ページ内の「武器と盾」「防具（部位別）」セクションから拾う。
  // ざっくり：aタグのhrefで /a_ っぽいリストページを拾う（極限の一覧ページ群）
  $("a").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;

    // 極限の一覧ページは相対/絶対混在。武器/防具の一覧ページを広く拾う
    // 例: /a_bogu/... /a_buki/... など（サイト側命名は揺れる可能性あるので緩める）
    if (
      href.includes("a_bogu") ||
      href.includes("a_buki") ||
      href.includes("a_shield") ||
      href.includes("dq10_item") // 連鎖で別ページがある可能性
    ) {
      const u = absUrl(baseUrl, href);
      if (u) links.add(u);
    }

    // STARTページのクリックIDで見えてる「片手剣」「体上」などは
    // 実体として別URLになってるので全部拾われる想定 :contentReference[oaicite:9]{index=9}
  });

  return [...links];
}

function extractDetailLinksFromListPage($, baseUrl) {
  const links = new Set();

  // 一覧ページ内の装備詳細ページは /dq10_????.html のような固定HTMLが多い
  $("a").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;

    // 詳細ページっぽいものを拾う（/a_bogu/xxx.html など）
    if (href.endsWith(".html") && (href.includes("dq10_") || href.includes("a_"))) {
      const u = absUrl(baseUrl, href);
      if (u) links.add(u);
    }
  });

  // ノイズも混じるので後でフィルタする
  return [...links];
}

function pickSectionTextByHeading($, headingIncludes) {
  // h2/h3で見出しを探して、その次の見出しまでのテキストを集める
  const heads = $("h2, h3").toArray();
  for (const h of heads) {
    const title = $(h).text().trim();
    if (!title.includes(headingIncludes)) continue;

    const texts = [];
    let n = $(h).next();
    while (n.length) {
      const tag = n.get(0)?.tagName?.toLowerCase();
      if (tag === "h2" || tag === "h3") break;
      const t = n.text().trim();
      if (t) texts.push(t);
      n = n.next();
    }
    return texts.join("\n");
  }
  return "";
}

function parseMaterials(sectionText) {
  // "ふさふさの毛皮 × 30" 形式が多い :contentReference[oaicite:10]{index=10}
  const mats = [];
  const lines = sectionText.split("\n").map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(.+?)\s*[×x]\s*(\d+)\s*$/);
    if (m) mats.push({ name: m[1].trim(), qty: Number(m[2]) });
  }
  return mats;
}

function parseJobsFromPage($) {
  // 「装備できる職業」セクションのリスト :contentReference[oaicite:11]{index=11}
  const jobs = [];
  const sec = pickSectionTextByHeading($, "装備できる職業");
  for (const line of sec.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    // 行に余計な語が混じることもあるので、短い日本語だけ拾う
    if (t.length <= 6) jobs.push(t);
  }
  return [...new Set(jobs)];
}

function parseEquipLevelAndType($) {
  // 基本情報セクションから装備Lvと部位/武器種を拾う :contentReference[oaicite:12]{index=12}
  const sec = pickSectionTextByHeading($, "基本情報");
  // 例: "部位 体上 装備レベル 65" :contentReference[oaicite:13]{index=13}
  const equipLevel = (() => {
    const m = sec.match(/装備レベル\s*(\d+)/);
    return m ? Number(m[1]) : null;
  })();

  const partOrType = (() => {
    const m = sec.match(/部位\s*([^\s]+)\s*装備レベル/);
    return m ? m[1].trim() : null;
  })();

  return { equipLevel, partOrType };
}

function parseCraftInfo($) {
  // 職人情報とレシピ :contentReference[oaicite:14]{index=14}
  const sec = pickSectionTextByHeading($, "職人情報とレシピ");
  // 例: "制作条件 さいほう (Lv35)" :contentReference[oaicite:15]{index=15}
  const craft = {};

  const m1 = sec.match(/制作条件.*?([^\s]+)\s*\(Lv\s*(\d+)\)/);
  if (m1) {
    craft.craftType = m1[1].trim();
    craft.craftLevel = Number(m1[2]);
  }

  // 必要素材ブロック
  const matText = (() => {
    const idx = sec.indexOf("必要素材");
    if (idx === -1) return "";
    return sec.slice(idx).split("必要レシピ")[0] ?? "";
  })();

  craft.materials = parseMaterials(matText);

  const m2 = sec.match(/必要レシピ\s*([^\n]+)/);
  if (m2) craft.recipeBook = m2[1].trim();

  const m3 = sec.match(/レシピ入手方法\s*([^\n]+)/);
  if (m3) craft.recipeSource = m3[1].trim();

  const m4 = sec.match(/職人経験値\s*(\d+)/);
  if (m4) craft.craftExp = Number(m4[1]);

  return craft;
}

function parseGrid($) {
  // 基準値セクション :contentReference[oaicite:16]{index=16}
  const sec = pickSectionTextByHeading($, "基準値");
  const lines = sec.split("\n").map((s) => s.trim()).filter(Boolean);

  const rows = [];
  for (const line of lines) {
    // "90 69 115" のような行 :contentReference[oaicite:17]{index=17}
    if (/^\d+(?:\s+\d+)+$/.test(line)) {
      rows.push(line.split(/\s+/).map((n) => Number(n)));
    }
  }
  if (!rows.length) return null;

  const cols = Math.max(...rows.map((r) => r.length));
  const slotGridType = `${cols}x${rows.length}`; // だいたい合う（特殊形状は後で改善）
  return { slotGridType, slotGridCols: cols, slotGridJson: JSON.stringify(rows) };
}

function parseSetInfo($) {
  const sec = pickSectionTextByHeading($, "装備セット効果");
  if (!sec) return { setName: null, setEffectsText: "" };

  // 例: "アイドルスーツセット：" :contentReference[oaicite:18]{index=18}
  const m = sec.match(/^(.+?)：/m);
  const setName = m ? m[1].trim() : null;
  return { setName, setEffectsText: sec };
}

function parseDropEnemies($) {
  const sec = pickSectionTextByHeading($, "白箱で落とす敵");
  const enemies = [];
  for (const line of sec.split("\n")) {
    const t = line.trim();
    if (t && t.length <= 10) enemies.push(t); // モンス名は短いことが多い :contentReference[oaicite:19]{index=19}
  }
  return [...new Set(enemies)];
}

function parseTraitsAndSewPower($) {
  // 特性 / 縫いパワーがある装備だけ
  const traitsSec = pickSectionTextByHeading($, "特性");
  const sewSec = pickSectionTextByHeading($, "縫いパワー");
  const traits = traitsSec ? traitsSec.replace(/^特性：?/m, "").trim() : "";
  const sewPower = sewSec ? sewSec.replace(/^縫いパワー：?/m, "").trim() : "";
  return { traits, sewPower };
}

function normalizeCraftTypeLabel(label) {
  // CSV側の craftType は「武器鍛冶/防具鍛冶/さいほう/木工」などで揃える想定
  if (!label) return null;
  if (label.includes("さいほう")) return "さいほう";
  if (label.includes("防具")) return "防具鍛冶";
  if (label.includes("武器")) return "武器鍛冶";
  if (label.includes("木工")) return "木工";
  return label;
}

function itemKindFromUrl(url) {
  if (url.includes("/a_bogu/") || url.includes("bogu")) return "防具";
  if (url.includes("/a_buki/") || url.includes("buki")) return "武器";
  // 盾は防具扱いにする
  if (url.includes("shield") || url.includes("tate")) return "防具";
  return null;
}

function slugifyJa(str) {
  // ざっくりID（既存と完全一致を狙うなら、あなたの既存ID規則に合わせて別途マップ必要）
  return str
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .slice(0, 80);
}

function buildCraftMasterRow(parsed) {
  // craft_master.csv (21列) 互換
  // columns:
  // itemId,itemName,itemKind,itemTypeKey,itemType,craftType,craftLevel,equipLevel,recipeBook,slot,slotGridType,slotGridCols,groupKind,groupId,groupName,itemsCount,crystalByAlchemy,materialsJson,slotGridJson,jobsJson,equipableType
  const craftType = normalizeCraftTypeLabel(parsed.craft?.craftType);
  const itemType = parsed.partOrType ?? "";

  const itemId = `${craftType ?? "不明"}_${parsed.name}`;
  const groupKind = parsed.itemKind === "武器" ? "weapon_single" : "armor_single";

  return {
    itemId,
    itemName: parsed.name,
    itemKind: parsed.itemKind ?? "",
    itemTypeKey: "",
    itemType,
    craftType: craftType ?? "",
    craftLevel: parsed.craft?.craftLevel ?? "",
    equipLevel: parsed.equipLevel ?? "",
    recipeBook: parsed.craft?.recipeBook ?? "",
    slot: "",
    slotGridType: parsed.grid?.slotGridType ?? "",
    slotGridCols: parsed.grid?.slotGridCols ?? "",
    groupKind,
    groupId: itemId,
    groupName: parsed.name,
    itemsCount: 1,
    crystalByAlchemy: "",
    materialsJson: JSON.stringify(parsed.craft?.materials ?? []),
    slotGridJson: parsed.grid?.slotGridJson ?? "",
    jobsJson: JSON.stringify(parsed.jobs ?? []),
    equipableType: "",
  };
}

function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const lines = [];
  lines.push(columns.join(","));
  for (const r of rows) {
    lines.push(columns.map((c) => esc(r[c])).join(","));
  }
  return lines.join("\n");
}

async function main() {
  console.log("[1] fetch START_URL:", START_URL);
  const topHtml = await fetchHtml(START_URL);
  const $top = cheerio.load(topHtml);

  const categoryLinks = extractCategoryLinksFromItemTop($top, START_URL);
  console.log("[2] categoryLinks:", categoryLinks.length);

  const limit = pLimit(CONCURRENCY);

  // [A] 一覧ページから詳細ページURLを集める
  const detailUrlSet = new Set();

  await Promise.all(
    categoryLinks.map((u) =>
      limit(async () => {
        try {
          const html = await fetchHtml(u);
          const $ = cheerio.load(html);
          const links = extractDetailLinksFromListPage($, u);

          for (const x of links) {
            // 詳細ページっぽいものだけ残す（雑にフィルタ）
            if (x.includes("dq10_") && x.endsWith(".html")) detailUrlSet.add(x);
          }
          console.log(" list ok", u, "->", links.length);
        } catch (e) {
          console.warn(" list fail", u, e.message);
        }
      })
    )
  );

  const detailUrls = [...detailUrlSet];
  console.log("[3] detailUrls:", detailUrls.length);

  // [B] 詳細ページをパース
  const parsedItems = [];

  await Promise.all(
    detailUrls.map((u, idx) =>
      limit(async () => {
        try {
          const html = await fetchHtml(u);
          const $ = cheerio.load(html);

          const title = $("h1").first().text().trim();
          if (!title) return;

          const name = title.replace(/の詳細.*$/, "").trim();
          const itemKind = itemKindFromUrl(u);

          const { equipLevel, partOrType } = parseEquipLevelAndType($);
          const jobs = parseJobsFromPage($);
          const craft = parseCraftInfo($);
          const grid = parseGrid($);
          const { setName, setEffectsText } = parseSetInfo($);
          const dropEnemies = parseDropEnemies($);
          const { traits, sewPower } = parseTraitsAndSewPower($);

          // ざっくり stats（基本情報セクション内の「しゅび力 40」等を全部拾う）
          const basicSec = pickSectionTextByHeading($, "基本情報");
          const stats = {};
          for (const m of basicSec.matchAll(/([ぁ-んァ-ヶ一-龠A-Za-z]+)\s*(\d+)/g)) {
            const k = m[1];
            const v = Number(m[2]);
            // 装備レベルなどが混ざるので軽く除外
            if (k.includes("装備")) continue;
            if (["部位"].includes(k)) continue;
            stats[k] = v;
          }

          parsedItems.push({
            url: u,
            name,
            itemKind,
            equipLevel,
            partOrType,
            jobs,
            craft,
            grid,
            setName,
            setEffectsText,
            dropEnemies,
            traits,
            sewPower,
            stats,
          });

          if ((idx + 1) % 50 === 0) {
            console.log(" parsed", idx + 1, "/", detailUrls.length);
          }
        } catch (e) {
          console.warn(" detail fail", u, e.message);
        }
      })
    )
  );

  console.log("[4] parsedItems:", parsedItems.length);

  // [C] craft_master互換CSVを書き出し
  const craftMasterRows = parsedItems.map(buildCraftMasterRow);

  const craftMasterCols = [
    "itemId","itemName","itemKind","itemTypeKey","itemType","craftType","craftLevel","equipLevel",
    "recipeBook","slot","slotGridType","slotGridCols","groupKind","groupId","groupName","itemsCount",
    "crystalByAlchemy","materialsJson","slotGridJson","jobsJson","equipableType"
  ];

  fs.writeFileSync(
    path.join(OUT_DIR, "craft_master_full.csv"),
    toCsv(craftMasterRows, craftMasterCols),
    "utf-8"
  );

  // [D] 拡張CSV
  const plusCols = [
    "id","name","itemKind","itemType","equipLevel","jobsJson",
    "craftType","craftLevel","recipeBook","recipeSource","craftExp","materialsJson",
    "slotGridType","slotGridCols","slotGridJson",
    "statsJson","setName","setEffectsText","dropEnemiesJson","traits","sewPower","sourceUrl"
  ];

  const plusRows = parsedItems.map((x) => ({
    id: slugifyJa(`${x.itemKind}_${x.partOrType ?? ""}_${x.name}`),
    name: x.name,
    itemKind: x.itemKind ?? "",
    itemType: x.partOrType ?? "",
    equipLevel: x.equipLevel ?? "",
    jobsJson: JSON.stringify(x.jobs ?? []),
    craftType: normalizeCraftTypeLabel(x.craft?.craftType) ?? "",
    craftLevel: x.craft?.craftLevel ?? "",
    recipeBook: x.craft?.recipeBook ?? "",
    recipeSource: x.craft?.recipeSource ?? "",
    craftExp: x.craft?.craftExp ?? "",
    materialsJson: JSON.stringify(x.craft?.materials ?? []),
    slotGridType: x.grid?.slotGridType ?? "",
    slotGridCols: x.grid?.slotGridCols ?? "",
    slotGridJson: x.grid?.slotGridJson ?? "",
    statsJson: JSON.stringify(x.stats ?? {}),
    setName: x.setName ?? "",
    setEffectsText: x.setEffectsText ?? "",
    dropEnemiesJson: JSON.stringify(x.dropEnemies ?? []),
    traits: x.traits ?? "",
    sewPower: x.sewPower ?? "",
    sourceUrl: x.url,
  }));

  fs.writeFileSync(
    path.join(OUT_DIR, "gear_full_plus.csv"),
    toCsv(plusRows, plusCols),
    "utf-8"
  );

  console.log("DONE ->", OUT_DIR);
  console.log(" - data_out/craft_master_full.csv");
  console.log(" - data_out/gear_full_plus.csv");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});