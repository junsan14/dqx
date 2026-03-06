// scripts/scrape_kyokugen_weapon.mjs
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

// ★ここだけ変えれば杖/ブーメラン等にも使える
const LIST_URL = "https://xn--10-yg4a1a3kyh.jp/a_buki/dq10_buki_l_04.html";

// 出力先
const OUT_FILE = path.resolve("data/recipes/stick.from_kyokugen.js");

// 同時取得数（上げすぎると相手に迷惑＆弾かれやすい）
const CONCURRENCY = 4;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
      await sleep(400 * (i + 1));
    }
  }
  throw lastErr;
}

function norm(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function toSnake(s) {
  return String(s)
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function extractSlugFromUrl(url) {
  // 例: .../dq10_buki_k_akumanotakuto.html -> akumanotakuto
  const m = String(url).match(/dq10_buki_[a-z]_(.+?)\.html/i);
  return m ? m[1] : toSnake(url);
}

function parseEquipLevel(lines) {
  // "装備レベル 60"
  for (const l of lines) {
    const m = norm(l).match(/装備レベル\s*(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

function parseSlotType(lines) {
  // "種別 スティック"
  for (const l of lines) {
    const m = norm(l).match(/種別.*?([^\s]+)$/);
    if (m) return m[1];
  }
  return null;
}

function parseJobs(lines) {
  // "### 〜を装備できる職業" の次行に "僧侶、パラディン、..." が来る :contentReference[oaicite:2]{index=2}
  for (let i = 0; i < lines.length; i++) {
    const l = norm(lines[i]);
    if (l.includes("を装備できる職業")) {
      const next = norm(lines[i + 1] ?? "");
      const jobs = next
        .replace(/[、，]/g, ",")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => {
          const map = {
            パラディン: "パラ",
            スーパースター: "スパ",
            天地雷鳴士: "天地",
          };
          return map[x] ?? x;
        });
      return jobs;
    }
  }
  return [];
}

function parseBaseEffects(lines) {
  // "特殊効果" の後に2行以上続くことがある :contentReference[oaicite:3]{index=3}
  const out = [];
  let hit = false;

  for (const raw of lines) {
    const l = norm(raw);
    if (!hit) {
      if (l.startsWith("特殊効果")) {
        hit = true;
        const rest = l.replace(/^特殊効果\s*/g, "").trim();
        if (rest) out.push(rest);
      }
      continue;
    }

    if (!l) continue;
    // 次セクションっぽいなら止める
    if (l.startsWith("備考") || l.startsWith("###") || l.startsWith("##")) break;

    out.push(l);
  }

  return out;
}

function parseStats(lines) {
  // 詳細ページの並び：こうげき力/しゅび力/さいだいHP/さいだいMP/こうげき魔力/かいふく魔力/おしゃれさ/おもさ :contentReference[oaicite:4]{index=4}
  const joined = lines.map(norm).join(" ");

  const pick = (label) => {
    const re = new RegExp(`${label}\\s*(\\d+)`);
    const m = joined.match(re);
    return m ? Number(m[1]) : null;
  };

  const stats = {
    attack: pick("こうげき力"),
    defense: pick("しゅび力"),
    hp: pick("さいだいＨＰ"),
    mp: pick("さいだいＭＰ"),
    attackMagic: pick("こうげき魔力"),
    recoveryMagic: pick("かいふく魔力"),
    stylish: pick("おしゃれさ"),
    weight: pick("おもさ"),
  };

  Object.keys(stats).forEach((k) => stats[k] == null && delete stats[k]);
  return stats;
}

function parseCraftInfo(lines) {
  // "制作条件 木工 (Lv33)" / "必要レシピ XXX" :contentReference[oaicite:5]{index=5}
  let craftType = null;
  let craftLevel = null;
  let recipeBook = null;

  for (const raw of lines) {
    const l = norm(raw);
    const m1 = l.match(/^制作条件\s*(.+?)\s*\(Lv\s*(\d+)\s*\)/i);
    if (m1) {
      craftType = m1[1].trim();
      craftLevel = Number(m1[2]);
    }
    const m2 = l.match(/^必要レシピ\s*(.+)$/);
    if (m2) recipeBook = m2[1].trim();
  }

  return { craftType, craftLevel, recipeBook };
}

function parseMaterials($) {
  // 「必要素材」見出しの直後にあるリスト(<ul>/<ol>)から確実に拾う
  // 例: <li><a>ガーデスの枝 × 30</a></li> が取れる :contentReference[oaicite:2]{index=2}

  // 「必要素材」という文字を含む要素を探す（h*/p/divなど混在対策）
  const header = $("*")
    .filter((_, el) => norm($(el).text()) === "必要素材")
    .first();

  if (!header.length) return [];

  // 見出し以降で、最初に出てくる ul/ol を探す（間に空pが挟まってもOK）
  let list = header.nextAll("ul,ol").first();

  // もし nextAll で取れない場合、親の次なども探す（構造揺れ保険）
  if (!list.length) {
    list = header.parent().nextAll("ul,ol").first();
  }
  if (!list.length) {
    list = header.closest("div,section,article,main,body").find("ul,ol").first();
  }
  if (!list.length) return [];

  const mats = [];
  list.find("li").each((_, li) => {
    const t = norm($(li).text()); // ← ここだと "ガーデスの枝 × 30" だけになる
    const m = t.match(/^(.+?)\s*×\s*(\d+)\s*$/);
    if (!m) return;
    mats.push({ name: m[1].trim(), qty: Number(m[2]) });
  });

  // 重複除去
  const uniq = [];
  const seen = new Set();
  for (const x of mats) {
    const k = `${x.name}|${x.qty}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(x);
  }
  return uniq;
}

function parseBaseline(lines) {
  // 「の基準値」行の次から、見出しが来るまでの間に出てくる
  // 数値/レンジ（例 294 / 207-213）を全部拾う。1行に複数あってもOK。
  let inSection = false;
  const values = [];

  for (const raw of lines) {
    const l = norm(raw);

    if (!inSection) {
      if (l.includes("の基準値")) inSection = true;
      continue;
    }

    if (!l) continue;

    // 次セクションに入ったら終了
    if (l.startsWith("###") || l.startsWith("##") || l.includes("関連コンテンツ") || l.includes("武器・アクセサリー一覧リンク")) break;

    // 行の中から全部拾う（例: "207-213 255-267 ..." みたいなケースも対応）
    const hits = l.match(/\d+(?:-\d+)?/g);
    if (hits) values.push(...hits);

    // 数値を拾い始めた後に、数値がない行が出たら基本終了（安全側）
    if (!hits && values.length) break;
  }

  const slotGrid = {};
  for (let i = 0; i < values.length; i++) slotGrid[i + 1] = values[i];

  const gridSlots = values.length || null;

  const slotGridCols =
    values.length === 2 ? 1 :
    values.length === 4 ? 2 :
    values.length === 6 ? 2 :
    values.length === 8 ? 2 :
    values.length === 9 ? 3 :
    null;

  return { gridSlots, slotGridCols, slotGrid };
}

function prettifyJs(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/"([^"]+)":/g, "$1:")
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, p1) => String.fromCharCode(parseInt(p1, 16)));
}

async function scrapeList() {
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);

  // 一覧のリンク（詳細ページ）
  // 一覧行は「【id†武器名】」形式で a がある :contentReference[oaicite:8]{index=8}
  const items = [];
  $("a").each((_, a) => {
    const href = $(a).attr("href");
    const name = norm($(a).text());
    if (!href || !name) return;
    if (!href.includes("dq10_buki_k_")) return; // 詳細ページ
    const url = new URL(href, LIST_URL).toString();
    items.push({ name, url });
  });

  // 重複除去
  const uniq = [];
  const seen = new Set();
  for (const x of items) {
    if (seen.has(x.url)) continue;
    seen.add(x.url);
    uniq.push(x);
  }

  if (!uniq.length) throw new Error("一覧から詳細リンクが取れなかった（HTML構造が変わったかも）");

  return uniq;
}

async function scrapeDetail({ name, url }) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const lines = $.root().text().split("\n").map(norm);

  const equipLevel = parseEquipLevel(lines);
  const slot = parseSlotType(lines) ?? "その他";
  const jobs = parseJobs(lines);
  const baseEffects = parseBaseEffects(lines);
  const stats = parseStats(lines);
  const { craftType, craftLevel, recipeBook } = parseCraftInfo(lines);
  const materials = parseMaterials($);
  const { gridSlots, slotGridCols, slotGrid } = parseBaseline(lines);

  const slug = extractSlugFromUrl(url);
  const id = `${toSnake(slot)}_${toSnake(slug)}`;
  if (!materials.length) {
    console.warn("[materials missing]", name, url);
  }
  if (!gridSlots || !Object.keys(slotGrid).length) {
    console.warn("[baseline missing]", name, url);
  }
  // 基準値（木工の数値）が無いならスキップOK
    if (!gridSlots || !Object.keys(slotGrid).length) {
      return null;
    }
  return {
    id,
    name,
    craftType,
    craftLevel,
    recipeBook,
    gridSlots,              // ← 今回追加したい要件
    starPrices: { star0: 0, star1: null, star2: null, star3: null },

    slotGridType: "FREE",
    slotGridCols,
    slotGrid,

    slot,
    equipLevel,
    jobs,
    stats,
    baseEffects,

    // qualityBonus / crystalByAlchemy は武器だとページに無いことが多いので空
    // 必要になったらここに後で追加できる
    materials,
    _sourceUrl: url,        // デバッグ用。いらなければ最後に消す
  };
}

async function mapWithConcurrency(list, mapper, concurrency = 4) {
  const out = [];
  let i = 0;
  //const details = (await mapWithConcurrency(list, scrapeDetail, CONCURRENCY)).filter(Boolean);
  async function worker() {
    while (i < list.length) {
      const cur = list[i++];
      const res = await mapper(cur);
      out.push(res);
      // 礼儀のウェイト（軽く）
      await sleep(120);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, list.length) }, worker);
  await Promise.all(workers);
  return out;
  
}

async function main() {
  const list = await scrapeList();
  console.log("list count:", list.length);

  const details = await mapWithConcurrency(list, scrapeDetail, CONCURRENCY);

  // 表示用：equipLevel desc, name asc
  details.sort((a, b) => (b.equipLevel ?? 0) - (a.equipLevel ?? 0) || a.name.localeCompare(b.name, "ja"));

  // _sourceUrl は邪魔なら消す（今はデバッグ用に残す）
  const exportName = "STICKS";

  const js = `// ${path.basename(OUT_FILE)}
// generated from ${LIST_URL}
export const ${exportName} = ${prettifyJs(details)};
`;

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, js, "utf8");

  console.log("OK ->", OUT_FILE, "items:", details.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});