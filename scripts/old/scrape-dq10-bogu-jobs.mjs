#!/usr/bin/env node
/**
 * 指定した防具一覧ページ（頭/体上/体下/腕/足）から
 * 各防具の詳細ページをたどって「装備できる職業」を取得する。
 *
 * 使い方:
 *   npm i cheerio
 *   node scripts/scrape-dq10-bogu-jobs.mjs
 *
 * 出力:
 *   out/dq10_bogu_jobs.json
 *   out/dq10_bogu_jobs.csv
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const LIST_URLS = [
  "https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_01.html",
  "https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_02.html",
  "https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_03.html",
  "https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_04.html",
  "https://xn--10-yg4a1a3kyh.jp/a_bogu/dq10_bogu_l_05.html",
];

const BASE_URL = "https://xn--10-yg4a1a3kyh.jp";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../out");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; dq10-bogu-jobs-scraper/1.0)",
      "accept-language": "ja,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} ${url}`);
  return await res.text();
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n+/g, "\n")
    .trim();
}

function absoluteUrl(href, base = BASE_URL) {
  return new URL(href, base).toString();
}

function uniqueBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) map.set(keyFn(item), item);
  return [...map.values()];
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function detectPartFromListTitle(title) {
  if (title.includes("(頭)")) return "頭";
  if (title.includes("(体上)")) return "体上";
  if (title.includes("(体下)")) return "体下";
  if (title.includes("(腕)")) return "腕";
  if (title.includes("(足)")) return "足";
  return "";
}

function parseListPage(html, url) {
  const $ = cheerio.load(html);
  const title = cleanText($("h1").first().text());
  const part = detectPartFromListTitle(title);

  const links = $("a")
    .toArray()
    .map((a) => {
      const name = cleanText($(a).text());
      const href = absoluteUrl($(a).attr("href"), url);
      return { name, href };
    })
    .filter((x) => /\/a_bogu\/dq10_bogu_k_.+\.html$/i.test(x.href))
    .filter((x) => x.name && !/^(頭|体上|体下|腕|足)$/.test(x.name));

  return uniqueBy(
    links.map((x) => ({
      part,
      name: x.name,
      url: x.href,
      listUrl: url,
    })),
    (x) => x.url
  );
}

function extractJobsNearHeading($, itemName) {
  const headingCandidates = $("h2, h3").toArray();

  for (const el of headingCandidates) {
    const text = cleanText($(el).text());

    if (
      text.includes("装備できる職業") ||
      text.includes("装備可能職業") ||
      text === `${itemName}を装備できる職業` ||
      text === `${itemName}の装備可能職業`
    ) {
      const jobs = [];
      let node = $(el).next();

      while (node.length) {
        const tag = (node.prop("tagName") || "").toLowerCase();
        if (tag === "h2" || tag === "h3") break;

        if (node.is("ul, ol")) {
          node.find("li").each((_, li) => {
            const job = cleanText($(li).text());
            if (job) jobs.push(job);
          });
        } else {
          node.find("a").each((_, a) => {
            const job = cleanText($(a).text());
            if (job) jobs.push(job);
          });
        }

        node = node.next();
      }

      return [...new Set(jobs)];
    }
  }

  return [];
}

function parseDetailPage(html, url, fallback = {}) {
  const $ = cheerio.load(html);
  const h1 = cleanText($("h1").first().text());

  const name =
    h1.replace(/の詳細.*$/, "").trim() ||
    fallback.name ||
    "";

  const bodyText = cleanText($("body").text());
  const levelMatch = bodyText.match(/装備レベル\s*([0-9]+)/);

  const jobs = extractJobsNearHeading($, name);

  return {
    part: fallback.part || "",
    name,
    jobs,
    level: levelMatch ? Number(levelMatch[1]) : null,
    url,
  };
}

async function main() {
  const allTargets = [];

  for (const listUrl of LIST_URLS) {
    console.log(`list: ${listUrl}`);
    const html = await fetchText(listUrl);
    allTargets.push(...parseListPage(html, listUrl));
    await sleep(120);
  }

  const targets = uniqueBy(allTargets, (x) => x.url);
  console.log(`detail targets: ${targets.length}`);

  const results = [];

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    console.log(`[${i + 1}/${targets.length}] ${target.name}`);

    try {
      const html = await fetchText(target.url);
      const parsed = parseDetailPage(html, target.url, target);
      results.push(parsed);
    } catch (error) {
      results.push({
        part: target.part,
        name: target.name,
        jobs: [],
        level: null,
        url: target.url,
        error: String(error?.message || error),
      });
    }

    await sleep(120);
  }

  const normalized = results
    .map((r) => ({
      part: r.part || "",
      name: r.name || "",
      level: r.level ?? "",
      jobs: Array.isArray(r.jobs) ? r.jobs : [],
      jobsText: Array.isArray(r.jobs) ? r.jobs.join(" / ") : "",
      url: r.url || "",
      error: r.error || "",
    }))
    .sort((a, b) => {
      const partOrder = { "頭": 1, "体上": 2, "体下": 3, "腕": 4, "足": 5 };
      const pa = partOrder[a.part] ?? 99;
      const pb = partOrder[b.part] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, "ja");
    });

  await fs.mkdir(OUT_DIR, { recursive: true });

  const jsonPath = path.join(OUT_DIR, "dq10_bogu_jobs.json");
  const csvPath = path.join(OUT_DIR, "dq10_bogu_jobs.csv");

  await fs.writeFile(jsonPath, JSON.stringify(normalized, null, 2), "utf8");

  const csvLines = [
    ["part", "name", "level", "jobsText", "jobsJson", "url", "error"].join(","),
    ...normalized.map((r) =>
      [
        csvEscape(r.part),
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
