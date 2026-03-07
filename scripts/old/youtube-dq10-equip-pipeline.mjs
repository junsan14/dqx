#!/usr/bin/env node
/**
 * YouTube のドラクエ10装備動画から
 * 「装備作成に必要な数値を抜くための下準備」を自動化する mjs
 *
 * できること
 * 1) チャンネル / プレイリスト / 動画URL から動画一覧を取得
 * 2) タイトルで「数値取り・武器・防具」系だけ絞り込み
 * 3) メタデータ(JSON/CSV)を書き出し
 * 4) サムネイルを保存
 * 5) 必要なら動画を保存して ffmpeg でフレーム画像を切り出し
 * 6) 手入力用の transcription CSV を作る
 *
 * 必要ツール
 * - yt-dlp
 * - ffmpeg（フレーム切り出しを使う場合）
 *
 * 例:
 *   node scripts/youtube-dq10-equip-pipeline.mjs --channel "https://www.youtube.com/@ウェロア" --out ./out/weroa --download-thumbs
 *   node scripts/youtube-dq10-equip-pipeline.mjs --videos ./video_urls.txt --out ./out/dq10 --download-videos --extract-frames
 */

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_KEYWORDS = [
  "数値", "数値取り", "新武器", "新防具", "武器鍛冶", "防具鍛冶", "裁縫",
  "装備", "盾", "ブーメラン", "片手剣", "両手剣", "短剣", "ヤリ", "オノ",
  "ハンマー", "ツメ", "ムチ", "スティック", "両手杖", "棍", "扇", "弓", "鎌",
  "頭", "体上", "体下", "腕", "足",
];

function parseArgs(argv) {
  const args = {
    channel: "",
    playlist: "",
    videos: "",
    out: "./out/youtube-dq10",
    downloadThumbs: false,
    downloadVideos: false,
    extractFrames: false,
    framesEvery: 20,
    keywords: [...DEFAULT_KEYWORDS],
    limit: 0,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--channel") args.channel = argv[++i] ?? "";
    else if (a === "--playlist") args.playlist = argv[++i] ?? "";
    else if (a === "--videos") args.videos = argv[++i] ?? "";
    else if (a === "--out") args.out = argv[++i] ?? args.out;
    else if (a === "--download-thumbs") args.downloadThumbs = true;
    else if (a === "--download-videos") args.downloadVideos = true;
    else if (a === "--extract-frames") args.extractFrames = true;
    else if (a === "--frames-every") args.framesEvery = Number(argv[++i] ?? 20) || 20;
    else if (a === "--limit") args.limit = Number(argv[++i] ?? 0) || 0;
    else if (a === "--keywords") {
      const raw = argv[++i] ?? "";
      args.keywords = raw.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  return args;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function sanitizeFileName(name) {
  return String(name ?? "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function hasKeyword(text, keywords) {
  const s = String(text ?? "");
  return keywords.some((kw) => s.includes(kw));
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += String(d); });
    child.stderr.on("data", (d) => { stderr += String(d); });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

async function existsInPath(command) {
  try {
    await run(process.platform === "win32" ? "where" : "which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function collectUrlsFromFile(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => /^https?:\/\//i.test(x));
}

async function ytDlpFlatExtract(url) {
  const { stdout } = await run("yt-dlp", [
    "--flat-playlist",
    "--dump-single-json",
    url,
  ]);
  return JSON.parse(stdout);
}

async function ytDlpVideoInfo(url) {
  const { stdout } = await run("yt-dlp", [
    "--dump-single-json",
    "--no-warnings",
    url,
  ]);
  return JSON.parse(stdout);
}

async function collectTargets(args) {
  if (args.videos) return await collectUrlsFromFile(args.videos);

  const sourceUrl = args.channel || args.playlist;
  if (!sourceUrl) throw new Error("`--channel` か `--playlist` か `--videos` のどれかは必須");

  const flat = await ytDlpFlatExtract(sourceUrl);
  const entries = Array.isArray(flat.entries) ? flat.entries : [];

  const urls = entries
    .map((e) => e.url || e.webpage_url || "")
    .filter(Boolean)
    .map((u) => /^https?:\/\//i.test(u) ? u : `https://www.youtube.com/watch?v=${u}`);

  return args.limit > 0 ? urls.slice(0, args.limit) : urls;
}

function normalizeVideoRecord(info) {
  return {
    id: info.id || "",
    title: info.title || "",
    channel: info.channel || info.uploader || "",
    uploadDate: info.upload_date || "",
    duration: info.duration || 0,
    webpageUrl: info.webpage_url || "",
    description: info.description || "",
    thumbnail: info.thumbnail || "",
    tags: Array.isArray(info.tags) ? info.tags : [],
    categories: Array.isArray(info.categories) ? info.categories : [],
    chapters: Array.isArray(info.chapters) ? info.chapters : [],
  };
}

function buildEquipHints(record) {
  const text = `${record.title}\n${record.description}`;
  const hitKeywords = DEFAULT_KEYWORDS.filter((kw) => text.includes(kw));
  const parts = ["頭", "体上", "体下", "腕", "足", "盾"].filter((x) => text.includes(x));
  const craftTypes = ["武器鍛冶", "防具鍛冶", "裁縫"].filter((x) => text.includes(x));

  return {
    hitKeywords,
    parts,
    craftTypes,
    likelyRelevant: hitKeywords.length > 0,
  };
}

async function saveJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function saveCsv(filePath, rows) {
  if (!rows.length) {
    await fs.writeFile(filePath, "", "utf8");
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  await fs.writeFile(filePath, lines.join("\n"), "utf8");
}

async function downloadThumbnail(videoUrl, outDir) {
  await run("yt-dlp", [
    "--skip-download",
    "--write-thumbnail",
    "--convert-thumbnails", "png",
    "-o", path.join(outDir, "%(id)s", "thumb.%(ext)s"),
    videoUrl,
  ]);
}

async function downloadVideo(videoUrl, outDir) {
  await run("yt-dlp", [
    "-f", "mp4/bestvideo+bestaudio/best",
    "--merge-output-format", "mp4",
    "-o", path.join(outDir, "%(id)s", "video.%(ext)s"),
    videoUrl,
  ]);
}

async function extractFrames(videoPath, outDir, everySeconds = 20) {
  await ensureDir(outDir);
  await run("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-vf", `fps=1/${Math.max(1, everySeconds)}`,
    path.join(outDir, "frame_%04d.png"),
  ]);
}

function buildTranscriptionRows(records) {
  const rows = [];
  for (const r of records) {
    const base = {
      videoId: r.id,
      title: r.title,
      channel: r.channel,
      uploadDate: r.uploadDate,
      sourceUrl: r.webpageUrl,
      itemName: "",
      part: "",
      craftType: "",
      slotGridText: "",
      materialsText: "",
      jobsText: "",
      timestamp: "",
      notes: "",
    };

    if (r.chapters?.length) {
      for (const ch of r.chapters) {
        rows.push({
          ...base,
          timestamp: ch.start_time ?? "",
          notes: ch.title || "",
        });
      }
    } else {
      rows.push(base);
    }
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!(await existsInPath("yt-dlp"))) {
    throw new Error("yt-dlp が見つからない。先にインストールして。");
  }
  if (args.extractFrames && !(await existsInPath("ffmpeg"))) {
    throw new Error("ffmpeg が見つからない。フレーム切り出しを使うならインストールして。");
  }

  await ensureDir(args.out);
  const metaDir = path.join(args.out, "meta");
  const thumbsDir = path.join(args.out, "thumbs");
  const videosDir = path.join(args.out, "videos");
  const framesDir = path.join(args.out, "frames");
  await Promise.all([ensureDir(metaDir), ensureDir(thumbsDir), ensureDir(videosDir), ensureDir(framesDir)]);

  const urls = await collectTargets(args);
  console.log(`targets: ${urls.length}`);

  const detailedRecords = [];

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] ${url}`);

    try {
      const info = await ytDlpVideoInfo(url);
      const record = normalizeVideoRecord(info);
      const hints = buildEquipHints(record);

      if (args.keywords?.length && !hasKeyword(`${record.title}\n${record.description}`, args.keywords)) {
        continue;
      }

      detailedRecords.push({ ...record, ...hints });

      const perVideoDirMeta = path.join(metaDir, sanitizeFileName(record.id || String(i + 1)));
      await ensureDir(perVideoDirMeta);
      await saveJson(path.join(perVideoDirMeta, "info.json"), { ...record, ...hints });

      if (args.downloadThumbs) {
        await downloadThumbnail(url, thumbsDir);
      }

      if (args.downloadVideos) {
        await downloadVideo(url, videosDir);

        if (args.extractFrames) {
          const videoDir = path.join(videosDir, record.id);
          const names = await fs.readdir(videoDir).catch(() => []);
          const mp4 = names.find((x) => x.toLowerCase().endsWith(".mp4"));
          if (mp4) {
            await extractFrames(
              path.join(videoDir, mp4),
              path.join(framesDir, record.id),
              args.framesEvery
            );
          }
        }
      }
    } catch (error) {
      console.error(`failed: ${url}`);
      console.error(String(error?.message || error));
    }
  }

  detailedRecords.sort((a, b) => String(a.uploadDate).localeCompare(String(b.uploadDate)));

  await saveJson(path.join(args.out, "videos.filtered.json"), detailedRecords);
  await saveCsv(
    path.join(args.out, "videos.filtered.csv"),
    detailedRecords.map((r) => ({
      id: r.id,
      title: r.title,
      channel: r.channel,
      uploadDate: r.uploadDate,
      duration: r.duration,
      webpageUrl: r.webpageUrl,
      likelyRelevant: r.likelyRelevant,
      hitKeywords: r.hitKeywords.join(" / "),
      parts: r.parts.join(" / "),
      craftTypes: r.craftTypes.join(" / "),
      thumbnail: r.thumbnail,
    }))
  );

  await saveCsv(
    path.join(args.out, "transcription_template.csv"),
    buildTranscriptionRows(detailedRecords)
  );

  const readme = `# youtube-dq10-equip-pipeline 出力

- videos.filtered.json: 動画メタデータ
- videos.filtered.csv: 一覧確認用
- transcription_template.csv: 数値を手入力で起こすためのテンプレ
- thumbs/: サムネ保存先
- videos/: 動画保存先
- frames/: 切り出し画像保存先

## おすすめ運用
1. まず --download-thumbs だけで回す
2. videos.filtered.csv を見て対象動画を絞る
3. 必要な動画だけ --download-videos --extract-frames で回す
4. frames を見ながら transcription_template.csv に
   - itemName
   - part
   - craftType
   - slotGridText
   - materialsText
   - jobsText
   を埋める

## slotGridText の書き方例
頭:
""	460	""
410	180	310

上:
180	100	190
120	90	130
110	160	80
`;
  await fs.writeFile(path.join(args.out, "README.txt"), readme, "utf8");

  console.log(`saved to: ${args.out}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
