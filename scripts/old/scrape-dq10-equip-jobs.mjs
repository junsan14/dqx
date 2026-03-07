#!/usr/bin/env node
/**
 * ドラクエ10極限攻略の装備ページから
 * - 武器
 * - 盾
 * - 防具セット
 * の装備可能職業をまとめて取得するスクリプト
 *
 * 使い方:
 *   node scripts/scrape-dq10-equip-jobs.mjs
 *
 * 出力:
 *   ./out/dq10_equip_jobs.json
 *   ./out/dq10_equip_jobs.csv
 *
 * 依存:
 *   npm i cheerio
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const ROOT_URL = "https://xn--10-yg4a1a3kyh.jp/dq10_item.html";
const BASE_URL = "https://xn--10-yg4a1a3kyh.jp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../out");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; dq10-jobs-scraper/1.0)",
      "accept-language": "ja,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} ${url}`);
  }

  return await res.text();
}

function absoluteUrl(href, base = BASE_URL) {
  return new URL(href, base).toString();
}

function uniqueBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    map.set(keyFn(item), item);
  }
  return [...map.values()];
}

function cleanText(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeJobName(name) {
  return cleanText(name)
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"\${s.replace(/"/g, '""')}"`;
  return s;
}

function findSectionJobsByHeadingText($, headingMatcher) {
  const headings = $("h2, h3").toArray();

  for (const el of headings) {
    const headingText = cleanText($(el).text());
    if (!headingMatcher(headingText)) continue;

    const jobs = [];
    let node = $(el).next();

    while (node.length) {
      if (/^h[23]$/i.test(node.prop("tagName") || "")) break;

      if (node.is("ul, ol")) {
        node.find("li").each((_, li) => {
          const t = normalizeJobName($(li).text());
          if (t) jobs.push(t);
        });
      } else {
        const text = cleanText(node.text());
        if (text) {
          if (
            text.includes("、") ||
            text.includes(",") ||
            /戦士|僧侶|魔法使い|武闘家|盗賊|旅芸人|バトルマスター|パラディン|魔法戦士|レンジャー|賢者|スーパースター|まもの使い|どうぐ使い|踊り子|占い師|天地雷鳴士|遊び人|デスマスター|魔剣士|海賊|ガーディアン|竜術士|隠者/.test(text)
          ) {
            text
              .split(/[、,]/)
              .map((x) => normalizeJobName(x))
              .filter(Boolean)
              .forEach((x) => jobs.push(x));
          }
        }
      }

      node = node.next();
    }

    const uniq = [...new Set(jobs)];
    if (uniq.length) return uniq;
  }

  return [];
}

function parseWeaponCategoryName($) {
  const h1 = cleanText($("h1").first().text());
  const m = h1.match(/武器一覧\((.+?)\)/);
  return m ? m[1] : "";
}

function parseWeaponListPage(html, url) {
  const $ = cheerio.load(html);
  const category = parseWeaponCategoryName($);

  const detailLinks = $("a")
    .toArray()
    .map((a) => ({
      name: cleanText($(a).text()),
      href: absoluteUrl($(a).attr("href"), url),
    }))
    .filter((x) => /\/a_buki\/dq10_buki_k_.+\.html$/i.test(x.href));

  return uniqueBy(
    detailLinks.map((x) => ({
      categoryType: "weapon_or_shield",
      category,
      name: x.name,
      url: x.href,
    })),
    (x) => x.url
  );
}

function parseArmorJobPage(html, url) {
  const $ = cheerio.load(html);
  const h1 = cleanText($("h1").first().text());
  const job = h1.replace(/の防具セット装備$/, "");

  const detailLinks = $("a")
    .toArray()
    .map((a) => ({
      name: cleanText($(a).text()),
      href: absoluteUrl($(a).attr("href"), url),
    }))
    .filter((x) => /\/a_bgset\/dq10_bgset_k_.+\.html$/i.test(x.href));

  return uniqueBy(
    detailLinks.map((x) => ({
      categoryType: "armor_set",
      category: job,
      name: x.name,
      url: x.href,
    })),
    (x) => x.url
  );
}

function parseWeaponDetail(html, url, fallback = {}) {
  const $ = cheerio.load(html);
  const h1 = cleanText($("h1").first().text());
  const name =
    cleanText($("h2").first().text()).split("(")[0].trim() ||
    h1.replace(/の詳細.*$/, "").trim() ||
    fallback.name ||
    "";
  const jobs = findSectionJobsByHeadingText($, (t) => t.includes("装備できる職業"));
  const levelText = cleanText($("body").text()).match(/装備レベル\s*([0-9]+)/)?.[1] ?? "";

  return {
    sourceType: "weapon_or_shield",
    category: fallback.category || "",
    name,
    jobs,
    level: levelText ? Number(levelText) : null,
    url,
  };
}

function parseArmorSetDetail(html, url, fallback = {}) {
  const $ = cheerio.load(html);
  const h1 = cleanText($("h1").first().text());
  const name = h1.replace(/の詳細.*$/, "").trim() || fallback.name || "";
  const jobs = findSectionJobsByHeadingText($, (t) => t.includes("装備可能職業"));
  const levelText = cleanText($("body").text()).match(/装備可能Lv[:：]\s*([0-9]+)/)?.[1] ?? "";

  return {
    sourceType: "armor_set",
    category: fallback.category || "",
    name,
    jobs,
    level: levelText ? Number(levelText) : null,
    url,
  };
}

async function collectRootLinks() {
  const html = await fetchText(ROOT_URL);
  const $ = cheerio.load(html);

  const weaponListUrls = uniqueBy(
    $("a")
      .toArray()
      .map((a) => absoluteUrl($(a).attr("href"), ROOT_URL))
      .filter((href) => /\/a_buki\/dq10_buki_l_.+\.html$/i.test(href)),
    (x) => x
  );

  const armorJobUrls = uniqueBy(
    $("a")
      .toArray()
      .map((a) => absoluteUrl($(a).attr("href"), ROOT_URL))
      .filter((href) => /\/a_bgset\/dq10_bgset_lss_.+\.html$/i.test(href)),
    (x) => x
  );

  return { weaponListUrls, armorJobUrls };
}

async function collectItems() {
  const { weaponListUrls, armorJobUrls } = await collectRootLinks();

  console.log(`weapon list pages: ${weaponListUrls.length}`);
  console.log(`armor job pages: ${armorJobUrls.length}`);

  const itemTargets = [];

  for (const url of weaponListUrls) {
    console.log(`list: ${url}`);
    const html = await fetchText(url);
    itemTargets.push(...parseWeaponListPage(html, url));
    await sleep(120);
  }

  for (const url of armorJobUrls) {
    console.log(`list: ${url}`);
    const html = await fetchText(url);
    itemTargets.push(...parseArmorJobPage(html, url));
    await sleep(120);
  }

  return uniqueBy(itemTargets, (x) => x.url);
}

async function collectDetails(itemTargets) {
  const results = [];

  for (let i = 0; i < itemTargets.length; i += 1) {
    const target = itemTargets[i];
    console.log(`[${i + 1}/${itemTargets.length}] ${target.name}`);

    try {
      const html = await fetchText(target.url);
      const parsed =
        target.categoryType === "weapon_or_shield"
          ? parseWeaponDetail(html, target.url, target)
          : parseArmorSetDetail(html, target.url, target);

      results.push(parsed);
    } catch (error) {
      results.push({
        sourceType: target.categoryType,
        category: target.category || "",
        name: target.name || "",
        jobs: [],
        level: null,
        url: target.url,
        error: String(error?.message || error),
      });
      console.error(`failed: ${target.url}`);
    }

    await sleep(120);
  }

  return results;
}

async function writeOutputs(records) {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const normalized = records
    .map((r) => ({
      sourceType: r.sourceType,
      category: r.category,
      name: r.name,
      level: r.level ?? "",
      jobs: Array.isArray(r.jobs) ? r.jobs : [],
      jobsText: Array.isArray(r.jobs) ? r.jobs.join(" / ") : "",
      url: r.url,
      error: r.error || "",
    }))
    .sort((a, b) => {
      if (a.sourceType !== b.sourceType) return a.sourceType.localeCompare(b.sourceType, "ja");
      if (a.category !== b.category) return a.category.localeCompare(b.category, "ja");
      return a.name.localeCompare(b.name, "ja");
    });

  const jsonPath = path.join(OUT_DIR, "dq10_equip_jobs.json");
  const csvPath = path.join(OUT_DIR, "dq10_equip_jobs.csv");

  await fs.writeFile(jsonPath, JSON.stringify(normalized, null, 2), "utf8");

  const csvLines = [
    ["sourceType", "category", "name", "level", "jobsText", "jobsJson", "url", "error"].join(","),
    ...normalized.map((r) =>
      [
        csvEscape(r.sourceType),
        csvEscape(r.category),
        csvEscape(r.name),
        csvEscape(r.level),
        csvEscape(r.jobsText),
        csvEscape(JSON.stringify(r.jobs)),
        csvEscape(r.url),
        csvEscape(r.error),
      ].join(",")
    ),
  ];

  await fs.writeFile(csvPath, csvLines.join("\n"), "utf8");

  console.log(`saved: ${jsonPath}`);
  console.log(`saved: ${csvPath}`);
}

async function main() {
  const targets = await collectItems();
  console.log(`detail targets: ${targets.length}`);

  const records = await collectDetails(targets);
  const ok = records.filter((x) => !x.error).length;
  const ng = records.filter((x) => x.error).length;

  console.log(`success: ${ok}`);
  console.log(`failed: ${ng}`);

  await writeOutputs(records);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
