// scripts/scrape-dq10-base-values.mjs
import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import * as cheerio from "cheerio";

const BASE = "https://xn--10-yg4a1a3kyh.jp";

// 武器カテゴリ一覧。
// オノ一覧が /a_buki/dq10_buki_l_07.html だったので、同系統の一覧URLを固定定義している。
const WEAPON_LISTS = [
  { category: "片手剣", url: `${BASE}/a_buki/dq10_buki_l_01.html` },
  { category: "両手剣", url: `${BASE}/a_buki/dq10_buki_l_02.html` },
  { category: "短剣",   url: `${BASE}/a_buki/dq10_buki_l_03.html` },
  { category: "スティック", url: `${BASE}/a_buki/dq10_buki_l_04.html` },
  { category: "両手杖", url: `${BASE}/a_buki/dq10_buki_l_05.html` },
  { category: "ヤリ",   url: `${BASE}/a_buki/dq10_buki_l_06.html` },
  { category: "オノ",   url: `${BASE}/a_buki/dq10_buki_l_07.html` },
  { category: "棍",     url: `${BASE}/a_buki/dq10_buki_l_08.html` },
  { category: "ツメ",   url: `${BASE}/a_buki/dq10_buki_l_09.html` },
  { category: "ムチ",   url: `${BASE}/a_buki/dq10_buki_l_10.html` },
  { category: "扇",     url: `${BASE}/a_buki/dq10_buki_l_11.html` },
  { category: "ハンマー", url: `${BASE}/a_buki/dq10_buki_l_12.html` },
  { category: "ブーメラン", url: `${BASE}/a_buki/dq10_buki_l_13.html` },
  { category: "弓",     url: `${BASE}/a_buki/dq10_buki_l_14.html` },
  { category: "鎌",     url: `${BASE}/a_buki/dq10_buki_l_15.html` },
];

// 防具カテゴリ一覧。
// 防具は 盾 / 頭 / 体上 / 体下 / 腕 / 足 の6系統。
const ARMOR_LISTS = [
  { category: "盾",   url: `${BASE}/a_bogu/dq10_bogu_l_00.html` },
  { category: "頭",   url: `${BASE}/a_bogu/dq10_bogu_l_01.html` },
  { category: "体上", url: `${BASE}/a_bogu/dq10_bogu_l_02.html` },
  { category: "体下", url: `${BASE}/a_bogu/dq10_bogu_l_03.html` },
  { category: "腕",   url: `${BASE}/a_bogu/dq10_bogu_l_04.html` },
  { category: "足",   url: `${BASE}/a_bogu/dq10_bogu_l_05.html` },
];

const HTTP = axios.create({
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; DQXBaseValueBot/1.0; +local-script)",
    "Accept-Language": "ja,en;q=0.8",
  },
});

// 礼儀として少し待つ
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function absoluteUrl(href) {
  if (!href) return "";
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `${BASE}${href}`;
  return `${BASE}/${href.replace(/^\.?\//, "")}`;
}

function normalizeText(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

function htmlToLines(html) {
  if (!html) return [];
  const text = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return text
    .split("\n")
    .map((x) => normalizeText(x))
    .filter(Boolean);
}

function parseRangeTokens(line) {
  // 例: "130-136 160-171" -> ["130-136", "160-171"]
  return [...line.matchAll(/(\d+\s*-\s*\d+)/g)].map((m) => m[1].replace(/\s+/g, ""));
}

function extractHeadingText($) {
  const h1 = normalizeText($("h1").first().text());
  if (h1) return h1;
  const title = normalizeText($("title").first().text());
  return title;
}

function findSectionRoot($, headingText) {
  const candidates = $("h1,h2,h3,h4").toArray();
  for (const el of candidates) {
    const t = normalizeText($(el).text());
    if (t.includes(headingText)) return el;
  }
  return null;
}

function collectSectionLines($, headingText) {
  const root = findSectionRoot($, headingText);
  if (!root) return [];

  const lines = [];
  let cur = $(root).next();

  while (cur.length) {
    const tag = (cur.get(0)?.tagName || "").toLowerCase();
    if (/^h[1-4]$/.test(tag)) break;

    const html = cur.html() ?? "";
    const chunkLines = htmlToLines(html);
    for (const line of chunkLines) {
      lines.push(line);
    }

    cur = cur.next();
  }

  return lines;
}

function parseEquipLevel($) {
  const text = normalizeText($("body").text());
  const m = text.match(/装備レベル\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseCraftType($) {
  const text = normalizeText($("body").text());
  if (text.includes("制作条件 武器鍛冶") || text.includes("制作条件武器鍛冶")) return "武器鍛冶";
  if (text.includes("制作条件 防具鍛冶") || text.includes("制作条件防具鍛冶")) return "防具鍛冶";
  if (text.includes("制作条件 さいほう") || text.includes("制作条件さいほう")) return "さいほう";
  if (text.includes("制作条件 木工") || text.includes("制作条件木工")) return "木工";
  return "";
}

function parseBaseValuesSection($) {
  const lines = collectSectionLines($, "基準値");

  // 「特性」「関連コンテンツ」などに当たる前までの数値行だけ拾う
  const filtered = [];
  for (const line of lines) {
    if (
      line.includes("特性") ||
      line.includes("関連コンテンツ") ||
      line.includes("縫いパワー") ||
      line.includes("白箱")
    ) {
      break;
    }
    const ranges = parseRangeTokens(line);
    if (ranges.length > 0) {
      filtered.push(ranges);
    }
  }

  return {
    rawLines: lines,
    rows: filtered,
    flat: filtered.flat(),
  };
}

function parseItemNameFromHeading(heading) {
  return heading
    .replace(/の詳細.*$/, "")
    .replace(/\(防具\)$/, "")
    .replace(/\(.*?\)$/, "")
    .trim();
}

function detectItemKind(url) {
  if (url.includes("/a_buki/")) return "武器";
  if (url.includes("/a_bogu/")) return "防具";
  return "";
}

async function fetchHtml(url) {
  const res = await HTTP.get(url);
  return res.data;
}

async function collectDetailLinksFromList(list) {
  const html = await fetchHtml(list.url);
  const $ = cheerio.load(html);

  const linkSet = new Map();

  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    const text = normalizeText($(a).text());
    const abs = absoluteUrl(href);

    if (list.url.includes("/a_buki/")) {
      if (/\/a_buki\/dq10_buki_k_.*\.html$/i.test(abs)) {
        linkSet.set(abs, {
          itemName: text,
          category: list.category,
          kind: "武器",
          listUrl: list.url,
          detailUrl: abs,
        });
      }
    } else if (list.url.includes("/a_bogu/")) {
      if (/\/a_bogu\/dq10_bogu_k_.*\.html$/i.test(abs)) {
        linkSet.set(abs, {
          itemName: text,
          category: list.category,
          kind: "防具",
          listUrl: list.url,
          detailUrl: abs,
        });
      }
    }
  });

  return [...linkSet.values()];
}

async function scrapeDetail(meta) {
  await sleep(250);

  const html = await fetchHtml(meta.detailUrl);
  const $ = cheerio.load(html);

  const heading = extractHeadingText($);
  const name = parseItemNameFromHeading(heading) || meta.itemName;
  const base = parseBaseValuesSection($);

  return {
    itemName: name,
    itemKind: meta.kind || detectItemKind(meta.detailUrl),
    category: meta.category,
    equipLevel: parseEquipLevel($),
    craftType: parseCraftType($),
    detailUrl: meta.detailUrl,

    // そのまま確認用
    baseValueRows: base.rows,      // 例: [["130-136","160-171"], ...]
    baseValueFlat: base.flat,      // 例: ["130-136","160-171", ...]
    baseValueRawLines: base.rawLines,
  };
}

function toCsvValue(v) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  const escaped = String(s).replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCsv(rows) {
  const headers = [
    "itemName",
    "itemKind",
    "category",
    "equipLevel",
    "craftType",
    "detailUrl",
    "baseValueRows",
    "baseValueFlat",
    "baseValueRawLines",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => toCsvValue(row[h] ?? ""))
        .join(",")
    );
  }
  return lines.join("\n");
}

async function main() {
  const allLists = [...WEAPON_LISTS, ...ARMOR_LISTS];

  console.log(`list pages: ${allLists.length}`);

  const allMetas = [];
  for (const list of allLists) {
    console.log(`collecting list: ${list.category} ${list.url}`);
    try {
      const links = await collectDetailLinksFromList(list);
      console.log(`  -> found ${links.length} detail links`);
      allMetas.push(...links);
    } catch (err) {
      console.error(`  !! failed list ${list.url}`, err.message);
    }
    await sleep(300);
  }

  // detailUrl で重複除去
  const uniqMap = new Map();
  for (const meta of allMetas) {
    uniqMap.set(meta.detailUrl, meta);
  }
  const metas = [...uniqMap.values()];

  console.log(`unique detail pages: ${metas.length}`);

  const results = [];
  for (const meta of metas) {
    console.log(`scraping: ${meta.itemName} (${meta.category})`);
    try {
      const row = await scrapeDetail(meta);

      // 基準値が1つも取れなかったものも残す
      results.push(row);
    } catch (err) {
      console.error(`  !! failed detail ${meta.detailUrl}`, err.message);
      results.push({
        itemName: meta.itemName,
        itemKind: meta.kind,
        category: meta.category,
        equipLevel: null,
        craftType: "",
        detailUrl: meta.detailUrl,
        baseValueRows: [],
        baseValueFlat: [],
        baseValueRawLines: [],
        error: err.message,
      });
    }
  }

  const outDir = path.resolve("data");
  await fs.mkdir(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "dq10_base_values.json");
  const csvPath = path.join(outDir, "dq10_base_values.csv");

  await fs.writeFile(jsonPath, JSON.stringify(results, null, 2), "utf-8");
  await fs.writeFile(csvPath, toCsv(results), "utf-8");

  console.log(`saved json: ${jsonPath}`);
  console.log(`saved csv : ${csvPath}`);

  const okCount = results.filter((r) => Array.isArray(r.baseValueFlat) && r.baseValueFlat.length > 0).length;
  console.log(`parsed base values: ${okCount}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});