"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import Papa from "papaparse";

/**
 * ✅ このpage.jsxでできること
 * - CSV編集（/public/data/craft_master.csv の読み込みと保存）
 * - itemName変更OK（選択が壊れない：内部キー __key で選択）
 * - jobs をチップで追加/削除（jobsJson に保存）
 * - slotGrid を表で編集（slotGridJson に保存）
 * - ★ 装備可能タイプ（equipableType）を追加
 *   - 武器：片手剣/両手剣/短剣/ヤリ/オノ/ハンマー/ツメ/ムチ/ブーメラン/スティック/両手杖/棍/扇/弓/鎌
 *   - 防具：戦士系 / 僧侶・魔法使い系 / 武闘家系 / 盗賊系 / 旅芸人系
 *   - equipableType を変更した時、jobs が空ならデフォルト職業を自動セット
 */

const DEFAULT_HEADERS = [
  "itemId",
  "itemName",
  "itemKind",
  "itemTypeKey",
  "itemType",
  "craftType",
  "craftLevel",
  "equipLevel",
  "recipeBook",
  "slot",
  "slotGridType",
  "slotGridCols",
  "groupKind",
  "groupId",
  "groupName",
  "itemsCount",
  "crystalByAlchemy",
  "materialsJson",
  "slotGridJson",
  "jobsJson",
  // ★追加：装備可能タイプ
  "equipableType",
];


const ITEM_KIND_OPTIONS = ["武器", "防具"];

const WEAPON_ITEM_TYPES = [
  "片手剣",
  "両手剣",
  "短剣",
  "ヤリ",
  "オノ",
  "ハンマー",
  "ツメ",
  "ムチ",
  "ブーメラン",
  "スティック",
  "両手杖",
  "棍",
  "扇",
  "弓",
  "鎌",
];

const ARMOR_ITEM_TYPES = [
  "鎧頭",
  "鎧上",
  "鎧下",
  "鎧腕",
  "鎧足",
  "裁縫頭",
  "裁縫上",
  "裁縫下",
  "裁縫腕",
  "裁縫足",
  "盾",
];

const DEFAULT_GRID_TYPES = [...WEAPON_ITEM_TYPES, ...ARMOR_ITEM_TYPES];

// 職業一覧（小盾：全職などにも使う）
const DEFAULT_JOBS = [
  "戦士",
  "僧侶",
  "魔法使い",
  "武闘家",
  "盗賊",
  "旅芸人",
  "バトルマスター",
  "パラディン",
  "魔法戦士",
  "レンジャー",
  "賢者",
  "スーパースター",
  "まもの使い",
  "どうぐ使い",
  "踊り子",
  "占い師",
  "天地雷鳴士",
  "遊び人",
  "デスマスター",
  "魔剣士",
  "海賊",
  "ガーディアン",
  "竜術士",
  "隠者",
];

// ★武器：装備可能タイプ → デフォルト職業
const WEAPON_DEFAULT_JOBS = {
  "片手剣": ["戦士","バトルマスター","魔法戦士","占い師","遊び人","パラディン","魔剣士","ガーディアン"],
  "両手剣": ["戦士","バトルマスター","まもの使い","魔剣士","ガーディアン"],
  "短剣": ["魔法使い","盗賊","旅芸人","踊り子","遊び人","魔剣士","海賊"],
  "ヤリ": ["僧侶","パラディン","どうぐ使い","武闘家","ガーディアン"],
  "オノ": ["戦士","レンジャー","まもの使い","デスマスター","海賊"],
  "ハンマー": ["バトルマスター","パラディン","どうぐ使い","遊び人"],
  "ツメ": ["武闘家","盗賊","まもの使い","レンジャー"],
  "ムチ": ["魔法使い","盗賊","スーパースター","まもの使い","占い師"],
  "ブーメラン": ["レンジャー","賢者","どうぐ使い","遊び人","旅芸人","海賊","隠者"],
  "スティック": ["僧侶","パラディン","スーパースター","踊り子","天地雷鳴士","竜術士","隠者"],
  "両手杖": ["魔法使い","魔法戦士","賢者","天地雷鳴士","竜術士"],
  "棍": ["僧侶","武闘家","旅芸人","占い師","デスマスター"],
  "扇": ["武闘家","旅芸人","スーパースター","踊り子","天地雷鳴士","賢者","隠者"],
  "弓": ["魔法戦士","レンジャー","賢者","どうぐ使い","占い師","デスマスター","海賊","竜術士","隠者"],
  "鎌": ["デスマスター","スーパースター","魔剣士","竜術士"],
  // 盾（必要なら equipableType に入れてOK）
  "大盾": ["戦士","パラディン","魔法戦士","魔剣士","ガーディアン"],
  "小盾": ["戦士","僧侶","魔法","盗賊","旅芸人","パラディン","魔法戦士","レンジャー","賢者","スーパースター","どうぐ使い","占い師","天地雷鳴士","遊び人","魔剣士","海賊","ガーディアン","竜術士","隠者"],
};

// ★防具：装備可能タイプ（グループ）→ デフォルト職業
const ARMOR_GROUP_DEFAULT_JOBS = {
  "戦士系": ["戦士","パラディン","魔法戦士(スキル)","魔剣士","ガーディアン"],
  "僧侶・魔法使い系": ["僧侶","魔法使い","賢者","占い師","天地雷鳴士","デスマスター","竜術士","隠者"],
  "武闘家系": ["武闘家","バトルマスター","まもの使い","踊り子"],
  "盗賊系": ["盗賊","魔法戦士","どうぐ使い","海賊"],
  "旅芸人系": ["旅芸人","レンジャー","スーパースター","踊り子","遊び人"],
};

const WEAPON_EQUIPABLE_TYPES = [
  "片手剣","両手剣","短剣","ヤリ","オノ","ハンマー","ツメ","ムチ","ブーメラン","スティック","両手杖","棍","扇","弓","鎌",
];
const ARMOR_EQUIPABLE_TYPES = ["戦士系","僧侶・魔法使い系","武闘家系","盗賊系","旅芸人系"];


const GROUP_MEMBER_PRESETS = {
  armor_set: [
    { key: "head", label: "頭", itemType: "鎧頭" },
    { key: "bodyTop", label: "体上", itemType: "鎧上" },
    { key: "bodyBottom", label: "体下", itemType: "鎧下" },
    { key: "arm", label: "腕", itemType: "鎧腕" },
    { key: "foot", label: "足", itemType: "鎧足" },
  ],
  tailoring_set: [
    { key: "head", label: "頭", itemType: "裁縫頭" },
    { key: "bodyTop", label: "体上", itemType: "裁縫上" },
    { key: "bodyBottom", label: "体下", itemType: "裁縫下" },
    { key: "arm", label: "腕", itemType: "裁縫腕" },
    { key: "foot", label: "足", itemType: "裁縫足" },
  ],
};

function getGroupKindPreset(craftType, itemKind) {
  const craft = (craftType || "").trim();
  const kind = (itemKind || "").trim();
  if (kind === "防具" && craft === "防具鍛冶") return "armor_set";
  if (kind === "防具" && craft === "裁縫") return "tailoring_set";
  return "armor_set";
}

function getGroupMemberPreset(groupKind) {
  return GROUP_MEMBER_PRESETS[groupKind] ?? [];
}

function buildEmptyGroupMembers(groupKind) {
  return getGroupMemberPreset(groupKind).map((x) => ({
    key: x.key,
    enabled: true,
    slotLabel: x.label,
    itemType: x.itemType,
    itemName: "",
  }));
}

function makeGroupId(groupName, craftType) {
  const base = (groupName || "").trim();
  if (!base) return "";
  return makeItemId({ itemName: `${base}_group`, craftType });
}

function getDefaultGroupItemName(groupName, slotLabel, itemType) {
  const base = (groupName || "").trim();
  if (!base) return "";
  const suffixMap = {
    "鎧頭": "ヘルム",
    "鎧上": "メイル上",
    "鎧下": "メイル下",
    "鎧腕": "グローブ",
    "鎧足": "グリーブ",
    "裁縫頭": "ハット",
    "裁縫上": "ウェア上",
    "裁縫下": "ウェア下",
    "裁縫腕": "グローブ",
    "裁縫足": "ブーツ",
  };
  const suffix = suffixMap[itemType] || slotLabel || "";
  return suffix ? `${base}${suffix}` : base;
}

function safeJsonParse(s, fallback) {
  if (!s || typeof s !== "string") return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}
function toJsonString(v, fallbackJson = "[]") {
  try { return JSON.stringify(v ?? safeJsonParse(fallbackJson, [])); } catch { return fallbackJson; }
}
function str(v) { return v == null ? "" : String(v); }

function makeItemId(row) {
  const craft = (row.craftType || "").trim();
  const name = (row.itemName || "").trim();
  if (!name) return "";
  return craft ? `${craft}_${name}` : name;
}

function normalizeGrid(gridLike, colsHint) {
  if (!gridLike) return { grid: [], rows: 0, cols: colsHint || 0 };

  if (Array.isArray(gridLike) && gridLike.every((x) => Array.isArray(x))) {
    const rows = gridLike.length;
    const cols = Math.max(colsHint || 0, ...gridLike.map((r) => (Array.isArray(r) ? r.length : 0)), 0);
    const grid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => gridLike?.[r]?.[c] ?? "")
    );
    return { grid, rows, cols };
  }

  if (Array.isArray(gridLike)) {
    const cols = Math.max(colsHint || 0, gridLike.length, 0);
    const grid = [Array.from({ length: cols }, (_, c) => gridLike?.[c] ?? "")];
    return { grid, rows: 1, cols };
  }

  return { grid: [], rows: 0, cols: colsHint || 0 };
}

function denormalizeGrid(grid2d) {
  if (!Array.isArray(grid2d) || grid2d.length === 0) return null;
  const rows = grid2d.length;
  const cols = Math.max(...grid2d.map((r) => r.length), 0);
  const trimmed = grid2d.map((r) => Array.from({ length: cols }, (_, c) => r?.[c] ?? ""));
  if (rows === 1) return trimmed[0];
  return trimmed;
}

function ensureGridSize(curGrid, rowsCount, colsCount) {
  return Array.from({ length: rowsCount }, (_, r) =>
    Array.from({ length: colsCount }, (_, c) => curGrid?.[r]?.[c] ?? "")
  );
}
const GRID_TYPE_PRESETS = {
  // 防具鍛冶
  "鎧頭": { rows: 2, cols: 2, disabledCells: [] },
  "鎧上": { rows: 3, cols: 2 , disabledCells: [] },
  "鎧下": { rows: 4, cols: 2, disabledCells: [] },
  "鎧腕": { rows: 3, cols: 1, disabledCells: [] },
  "鎧足": { rows: 3, cols: 2, disabledCells: [[0,0],[1,0]] },

  // 裁縫
  "裁縫頭": { rows: 2, cols: 3, disabledCells: [[0, 0], [0, 2]] }, // 例
  "裁縫上": { rows: 3, cols: 3, disabledCells: [] },
  "裁縫下": { rows: 3, cols: 2, disabledCells: [] },
  "裁縫腕": { rows: 2, cols: 3, disabledCells: [] },
  "裁縫足": { rows: 2, cols: 2, disabledCells: [] },

  // 盾
  "盾": { rows: 2, cols: 2, disabledCells: [] },

  // 武器鍛冶
  "片手剣": { rows: 3, cols: 1, disabledCells: [] },
  "両手剣": { rows: 4, cols: 2, disabledCells: [] },
  "短剣": { rows: 2, cols: 1, disabledCells: [] },
  "ヤリ": { rows: 4, cols: 1, disabledCells: [] },
  "オノ": { rows: 4, cols: 2, disabledCells: [[2, 1],[3, 1]] },
  "ハンマー": { rows: 3, cols: 2, disabledCells: [] },
  "ツメ": { rows: 2, cols: 2, disabledCells: [] },
  "ムチ": { rows: 4, cols: 2, disabledCells: [[3,1]] },
  "ブーメラン": {rows: 3,cols: 2,disabledCells: [[1, 0]]},
  "スティック": { rows: 2, cols: 1, disabledCells: [] },
  "両手杖": { rows: 3, cols: 1, disabledCells: [] },
  "棍": { rows: 3, cols: 2, disabledCells: [] },
  "扇": { rows: 2, cols: 2, disabledCells: [] },
  "弓": { rows: 3, cols: 2, disabledCells: [[1,1]] },
  "鎌": { rows: 4, cols: 2, disabledCells: [[1,1],[2,1],[3,1]] },
};

const WEAPON_GRID_TYPES = [...WEAPON_ITEM_TYPES];
const ARMOR_GRID_TYPES = ["鎧頭", "鎧上", "鎧下", "鎧腕", "鎧足", "盾"];
const SEWING_GRID_TYPES = ["裁縫頭", "裁縫上", "裁縫下", "裁縫腕", "裁縫足"];

function parseGridTypeToSize(gridType) {
  const gt = (gridType || "").trim();

  if (GRID_TYPE_PRESETS[gt]) {
    return {
      rows: GRID_TYPE_PRESETS[gt].rows,
      cols: GRID_TYPE_PRESETS[gt].cols,
    };
  }

  return { rows: null, cols: null };
}
function getGridPreset(gridType) {
  const gt = (gridType || "").trim();
  return GRID_TYPE_PRESETS[gt] ?? null;
}

function isDisabledCell(gridType, r, c) {
  const preset = getGridPreset(gridType);
  if (!preset || !Array.isArray(preset.disabledCells)) return false;
  return preset.disabledCells.some(([rr, cc]) => rr === r && cc === c);
}
function makeKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `k_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeOneRowFromCsv(row, headers) {
  const rr = {};
  headers.forEach((h) => (rr[h] = (row?.[h] ?? "").toString()));

  if (!rr.materialsJson) rr.materialsJson = "[]";
  if (!rr.slotGridJson) rr.slotGridJson = "";
  if (!rr.jobsJson) rr.jobsJson = "[]";
  if (!rr.equipableType) rr.equipableType = "";

  if (!rr.itemId || rr.itemId.trim() === "") rr.itemId = makeItemId(rr);
  if (!rr.groupId || rr.groupId.trim() === "") rr.groupId = rr.itemId;

  rr.__key = makeKey();
  return rr;
}

function getDefaultJobsForEquipableType(equipableType, allJobs) {
  const key = (equipableType || "").trim();
  if (!key) return null;

  // 防具グループ優先
  const a = ARMOR_GROUP_DEFAULT_JOBS[key];
  if (a) return a.slice();

  // 武器
  const w = WEAPON_DEFAULT_JOBS[key];
  if (!w) return null;
  if (w === "__ALL__") return allJobs.slice();
  return w.slice();
}


function getItemTypeOptions(itemKind, craftType = "") {
  const kind = (itemKind || "").trim();
  const craft = (craftType || "").trim();

  if (kind === "武器") return WEAPON_ITEM_TYPES;
  if (kind === "防具") {
    if (craft === "防具鍛冶") return ARMOR_GRID_TYPES;
    if (craft === "裁縫") return SEWING_GRID_TYPES;
    return ARMOR_ITEM_TYPES;
  }
  return [...WEAPON_ITEM_TYPES, ...ARMOR_ITEM_TYPES];
}

function getGridTypeFromItemType(itemType) {
  const v = (itemType || "").trim();
  return GRID_TYPE_PRESETS[v] ? v : "";
}

function getDisplaySlotFromItemType(itemType, itemKind = "") {
  const v = (itemType || "").trim();
  if (!v) return "";
  if (["鎧頭", "裁縫頭"].includes(v)) return "頭";
  if (["鎧上", "裁縫上"].includes(v)) return "体上";
  if (["鎧下", "裁縫下"].includes(v)) return "体下";
  if (["鎧腕", "裁縫腕"].includes(v)) return "腕";
  if (["鎧足", "裁縫足"].includes(v)) return "足";
  if (v === "盾" || v === "小盾" || v === "大盾") return "盾";
  if (itemKind === "武器" || WEAPON_ITEM_TYPES.includes(v)) return "武器";
  return v;
}

function getGroupDisplayName(row) {
  return (row?.groupName ?? "").toString().trim() || (row?.itemName ?? "").toString().trim();
}

function isGroupedRow(row) {
  const kind = (row?.groupKind ?? "").toString().trim();
  const count = Number(row?.itemsCount ?? 0) || 0;
  return kind.endsWith("_set") || count > 1;
}

function buildGroupedRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const groupId = (row?.groupId ?? row?.itemId ?? row?.itemName ?? "").toString().trim();
    const grouped = isGroupedRow(row);

    if (!grouped) {
      map.set(`single:${row.__key}`, {
        __kind: "single",
        __key: row.__key,
        label: (row?.itemName ?? "").toString(),
        searchText: [
          row?.itemName,
          row?.groupName,
          row?.itemType,
          row?.craftType,
        ].filter(Boolean).join(" "),
        row,
      });
      continue;
    }

    const existing = map.get(`group:${groupId}`) ?? {
      __kind: "group",
      __key: `group:${groupId}`,
      groupId,
      label: getGroupDisplayName(row),
      searchText: "",
      craftType: row?.craftType ?? "",
      equipLevel: row?.equipLevel ?? "",
      craftLevel: row?.craftLevel ?? "",
      recipeBook: row?.recipeBook ?? "",
      itemKind: row?.itemKind ?? "",
      groupKind: row?.groupKind ?? "",
      items: [],
      rows: [],
    };

    existing.rows.push(row);
    existing.items.push({
      __key: row.__key,
      itemName: row?.itemName ?? "",
      itemType: row?.itemType ?? "",
      slotLabel: getDisplaySlotFromItemType(row?.itemType ?? "", row?.itemKind ?? ""),
      craftType: row?.craftType ?? "",
      equipLevel: row?.equipLevel ?? "",
      craftLevel: row?.craftLevel ?? "",
      recipeBook: row?.recipeBook ?? "",
      materialsJson: row?.materialsJson ?? "[]",
      slotGridJson: row?.slotGridJson ?? "",
      slotGridType: row?.slotGridType ?? "",
      slotGridCols: row?.slotGridCols ?? "",
      jobsJson: row?.jobsJson ?? "[]",
      equipableType: row?.equipableType ?? "",
      row,
    });

    existing.searchText = [
      existing.label,
      ...existing.items.map((x) => `${x.itemName} ${x.slotLabel} ${x.itemType}`),
      existing.craftType,
    ].filter(Boolean).join(" ");

    map.set(`group:${groupId}`, existing);
  }

  const slotOrder = { "頭": 1, "体上": 2, "体下": 3, "腕": 4, "足": 5, "盾": 6, "武器": 7 };
  const result = Array.from(map.values()).map((entry) => {
    if (entry.__kind === "group") {
      entry.items.sort((a, b) => {
        const sa = slotOrder[a.slotLabel] ?? 99;
        const sb = slotOrder[b.slotLabel] ?? 99;
        if (sa !== sb) return sa - sb;
        return String(a.itemName).localeCompare(String(b.itemName), "ja");
      });
    }
    return entry;
  });

  return result.sort((a, b) => String(a.label).localeCompare(String(b.label), "ja"));
}

async function loadCsvFromPublic(url, onLoaded) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to load: ${url}`);
  const text = await res.text();

  Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    complete: (result) => onLoaded(result),
    error: (err) => alert(err.message),
  });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


const THEME = {
  bg: "var(--bg, #0f172a)",
  card: "var(--card, #0f172a)",
  text: "var(--text, #e2e8f0)",
  border: "var(--border, #334155)",
  muted: "var(--muted, #94a3b8)",
  soft: "var(--soft, #111827)",
  active: "var(--active, #1e293b)",
  activeBorder: "var(--activeBorder, #818cf8)",
  inputBg: "var(--inputBg, #0b1220)",
  chipBg: "var(--chipBg, #111827)",
  preBg: "var(--preBg, #000000)",
  preText: "var(--preText, #e5e7eb)",
  dangerBg: "var(--dangerBg, #3f1d1d)",
  dangerBorder: "var(--dangerBorder, #b91c1c)",
  dangerText: "var(--dangerText, #fecaca)",
};

export default function Page() {
  const fileRef = useRef(null);

  const [headers, setHeaders] = useState(DEFAULT_HEADERS);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [syncGroup, setSyncGroup] = useState(true); // デフォON
  const [selectedKey, setSelectedKey] = useState("");

  const [gridRows, setGridRows] = useState(0);
  const [gridCols, setGridCols] = useState(0);
  const [grid2d, setGrid2d] = useState([]);

  const [newMode, setNewMode] = useState("single");
  const [newItem, setNewItem] = useState({
    itemName: "",
    craftType: "",
    itemType: "",
    itemKind: "",
  });
  const [newGroup, setNewGroup] = useState({
    groupName: "",
    craftType: "",
    itemKind: "防具",
    groupKind: "armor_set",
    members: buildEmptyGroupMembers("armor_set"),
  });

  const [jobQuery, setJobQuery] = useState("");

  const selectedRow = useMemo(() => {
    if (!selectedKey) return null;
    return rows.find((r) => r.__key === selectedKey) ?? null;
  }, [rows, selectedKey]);
  const [isNarrow, setIsNarrow] = useState(false);

    useEffect(() => {
      const mq = window.matchMedia("(max-width: 900px)");
      const update = () => setIsNarrow(mq.matches);

      update();
      mq.addEventListener("change", update);

      return () => mq.removeEventListener("change", update);
    }, []);
    const layoutStyle = {
      display: "grid",
      gap: 12,
      alignItems: "start",
      gridTemplateColumns: isNarrow
        ? "1fr"
        : "minmax(280px, 360px) 1fr",
    };
  // ★ rows差し替えで選択が無効になったら先頭へ（null参照防止）
  useEffect(() => {
    if (rows.length === 0) {
      if (selectedKey) setSelectedKey("");
      return;
    }
    const exists = rows.some((r) => r.__key === selectedKey);
    if (!exists) setSelectedKey(rows[0].__key);
  }, [rows, selectedKey]);

  const enums = useMemo(() => {
    const uniq = (key) =>
      Array.from(new Set(rows.map((r) => str(r[key]).trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ja")
      );

    const craftTypes = uniq("craftType");
    const itemTypes = Array.from(new Set([...WEAPON_ITEM_TYPES, ...ARMOR_ITEM_TYPES, ...uniq("itemType")])).sort((a, b) => a.localeCompare(b, "ja"));
    const itemKinds = Array.from(new Set([...ITEM_KIND_OPTIONS, ...uniq("itemKind")])).sort((a, b) => a.localeCompare(b, "ja"));
    const slots = uniq("slot");

    const gridTypes = Array.from(new Set([...DEFAULT_GRID_TYPES, ...uniq("slotGridType")])).sort((a, b) =>
      a.localeCompare(b, "ja")
    );

    const materialSet = new Set();
    for (const r of rows) {
      const arr = safeJsonParse(r.materialsJson, []);
      if (!Array.isArray(arr)) continue;
      for (const m of arr) {
        const name = (m?.name ?? "").toString().trim();
        if (name) materialSet.add(name);
      }
    }
    const materialNames = Array.from(materialSet).sort((a, b) => a.localeCompare(b, "ja"));

    const jobSet = new Set(DEFAULT_JOBS);
    for (const r of rows) {
      const arr = safeJsonParse(r.jobsJson, []);
      if (!Array.isArray(arr)) continue;
      for (const j of arr) {
        const name = (j ?? "").toString().trim();
        if (name) jobSet.add(name);
      }
    }
    const jobNames = Array.from(jobSet).sort((a, b) => a.localeCompare(b, "ja"));

    // equipableType 候補：既存 + 武器 + 防具グループ
    const equipableFromCsv = uniq("equipableType");
    const equipableTypeOptions = Array.from(
      new Set([...equipableFromCsv, ...WEAPON_EQUIPABLE_TYPES, ...ARMOR_EQUIPABLE_TYPES, "大盾", "小盾"])
    ).sort((a, b) => a.localeCompare(b, "ja"));

    return { craftTypes, itemTypes, itemKinds, slots, gridTypes, materialNames, jobNames, equipableTypeOptions };
  }, [rows]);

  const displayEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const grouped = buildGroupedRows(rows);
    if (!q) return grouped;

    return grouped.filter((entry) => {
      const baseText = (entry.searchText || "").toLowerCase();

      if (entry.__kind === "group") {
        const equipLevels = Array.isArray(entry.items)
          ? entry.items.map((it) => String(it.equipLevel ?? "")).join(" ")
          : "";
        const craftLevels = Array.isArray(entry.items)
          ? entry.items.map((it) => String(it.craftLevel ?? "")).join(" ")
          : "";
        const groupEquipLevel = String(entry.equipLevel ?? "");
        const groupCraftLevel = String(entry.craftLevel ?? "");

        return (
          baseText.includes(q) ||
          groupEquipLevel.includes(q) ||
          groupCraftLevel.includes(q) ||
          equipLevels.includes(q) ||
          craftLevels.includes(q)
        );
      }

      const rowEquipLevel = String(entry.row?.equipLevel ?? "");
      const rowCraftLevel = String(entry.row?.craftLevel ?? "");

      return (
        baseText.includes(q) ||
        rowEquipLevel.includes(q) ||
        rowCraftLevel.includes(q)
      );
    });
  }, [rows, query]);
  const gridTypeOptionsForSelectedRow = useMemo(() => {
    const itemKind = (selectedRow?.itemKind ?? "").trim();
    const craftType = (selectedRow?.craftType ?? "").trim();

    if (itemKind === "武器") return WEAPON_GRID_TYPES;
    if (itemKind === "防具") {
      if (craftType === "防具鍛冶") return ARMOR_GRID_TYPES;
      if (craftType === "裁縫") return SEWING_GRID_TYPES;
      return ARMOR_ITEM_TYPES;
    }

    if (craftType === "武器鍛冶") return WEAPON_GRID_TYPES;
    if (craftType === "防具鍛冶") return ARMOR_GRID_TYPES;
    if (craftType === "裁縫") return SEWING_GRID_TYPES;

    return enums.gridTypes;
  }, [selectedRow?.itemKind, selectedRow?.craftType, enums.gridTypes]);

  const itemTypeOptionsForSelectedRow = useMemo(() => {
    return getItemTypeOptions(selectedRow?.itemKind ?? "", selectedRow?.craftType ?? "");
  }, [selectedRow?.itemKind, selectedRow?.craftType]);

  const itemTypeOptionsForNewItem = useMemo(() => {
    return getItemTypeOptions(newItem.itemKind, newItem.craftType);
  }, [newItem.itemKind, newItem.craftType]);

  const groupKindOptions = useMemo(() => {
    return ["armor_set", "tailoring_set"];
  }, []);

  const materials = useMemo(() => {
    if (!selectedRow) return [];
    const arr = safeJsonParse(selectedRow.materialsJson, []);
    if (!Array.isArray(arr)) return [];
    return arr.map((m) => ({ name: m?.name ?? "", qty: Number(m?.qty ?? 0) }));
  }, [selectedRow]);

  const jobs = useMemo(() => {
    if (!selectedRow) return [];
    const arr = safeJsonParse(selectedRow.jobsJson, []);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => (x ?? "").toString()).filter(Boolean);
  }, [selectedRow]);

useEffect(() => {
  if (!selectedRow) {
    setGridRows(1);
    setGridCols(1);
    setGrid2d([[""]]);
    return;
  }

  const gridType = (selectedRow.slotGridType ?? "").trim();
  const preset = GRID_TYPE_PRESETS[gridType] ?? null;

  const colsHintFromRow = Number(selectedRow.slotGridCols ?? 0) || 0;
  const colsHint = preset?.cols ?? colsHintFromRow;

  const gridLike = safeJsonParse(selectedRow.slotGridJson, null);
  const norm = normalizeGrid(gridLike, colsHint);

  // まず preset を優先、なければ既存grid、最後に 1x1
  const rows =
    preset?.rows ??
    (norm.rows > 0 ? norm.rows : 1);

  const cols =
    preset?.cols ??
    (norm.cols > 0 ? norm.cols : 1);

  // 既存gridがあればそれを使う。足りない分は補完
  const baseGrid =
    norm.rows > 0 && norm.cols > 0
      ? norm.grid
      : [];

  const resized = ensureGridSize(baseGrid, rows, cols);

  setGridRows(rows);
  setGridCols(cols);
  setGrid2d(resized);
}, [selectedRow?.__key]);

  function setSelectedRowPatch(patch) {
    if (!selectedKey) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.__key !== selectedKey) return r;
        const next = { ...r, ...patch };

        if (!next.itemId || next.itemId.trim() === "") next.itemId = makeItemId(next);
        if ((next.groupId ?? "").trim() === "" && next.itemId) next.groupId = next.itemId;

        return next;
      })
    );
  }
  function setGroupPatch(patch) {
    if (!selectedRow) return;

    const gid = (selectedRow.groupId ?? "").trim();
    if (!gid) {
      // groupId 無いなら通常の単体更新だけ
      setSelectedRowPatch(patch);
      return;
    }

    setRows((prev) =>
      prev.map((r) => {
        if ((r.groupId ?? "").trim() !== gid) return r;

        const next = { ...r, ...patch };

        // itemName は個別の可能性が高いので、グループ同期では基本触らない前提
        // itemId は craftType 変更時に空にした時だけ再生成
        if (!next.itemId || next.itemId.trim() === "") next.itemId = makeItemId(next);
        if ((next.groupId ?? "").trim() === "" && next.itemId) next.groupId = next.itemId;

        return next;
      })
    );
  }

  function newEmpty() {
    setHeaders(DEFAULT_HEADERS);
    setRows([]);
    setSelectedKey("");
    setQuery("");
    setJobQuery("");
    setNewMode("single");
    setNewItem({ itemName: "", craftType: "", itemType: "", itemKind: "" });
    setNewGroup({
      groupName: "",
      craftType: "",
      itemKind: "防具",
      groupKind: "armor_set",
      members: buildEmptyGroupMembers("armor_set"),
    });
  }

  function handleUpload(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data || []).map((r) => {
          const rr = {};
          Object.keys(r || {}).forEach((h) => (rr[h] = (r?.[h] ?? "").toString()));
          return rr;
        });

        const hs = Array.from(new Set([...(Object.keys(data[0] || {})), ...DEFAULT_HEADERS]));

        const normalized = data.map((r) => normalizeOneRowFromCsv(r, hs));

        setHeaders(hs);
        setRows(normalized);
        setSelectedKey(normalized[0]?.__key || "");
      },
      error: (err) => alert(err.message),
    });
  }

  async function exportCsv() {
    const csv = Papa.unparse(rows, { columns: headers });
    downloadText("craft_master.csv", csv);

    await fetch("/api/save-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });

    alert("CSV saved to /public/data/craft_master.csv");
  }

  async function saveCsvToPublicAndReload() {
    const csv = Papa.unparse(rows, { columns: headers });

    const res = await fetch("/api/save-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      console.error("save failed", res.status, json);
      alert(`save failed: ${res.status} ${json?.error ?? ""}`);
      return;
    }

    const textRes = await fetch(`/data/craft_master.csv?v=${Date.now()}`, { cache: "no-store" });
    const text = await textRes.text();

    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const data = (parsed.data || []).map((r) => {
          const rr = {};
          Object.keys(r || {}).forEach((k) => (rr[k] = (r?.[k] ?? "").toString()));
          return rr;
        });

        const hs = Array.from(new Set([...(Object.keys(data[0] || {})), ...DEFAULT_HEADERS]));
        const normalized = data.map((r) => normalizeOneRowFromCsv(r, hs));

        setHeaders(hs);
        setRows(normalized);
        setSelectedKey(normalized[0]?.__key || "");
      },
    });

    alert("saved to /public/data/craft_master.csv");
  }
function deleteCurrentItem() {
  if (!selectedRow) return;

  if (!confirm(`「${selectedRow.itemName}」を削除しますか？`)) return;

  setRows((prev) => prev.filter((r) => r.__key !== selectedRow.__key));
  setSelectedKey("");
}

function deleteCurrentGroup() {
  if (!selectedRow) return;

  const gid = (selectedRow.groupId ?? "").trim();
  if (!gid) return deleteCurrentItem();

  if (!confirm(`セット「${selectedRow.groupName}」を全部削除しますか？`)) return;

  setRows((prev) => prev.filter((r) => (r.groupId ?? "").trim() !== gid));
  setSelectedKey("");
}
  // ===== Materials CRUD =====
  function addMaterial() {
    const next = [...materials, { name: "", qty: 1 }];
    setSelectedRowPatch({ materialsJson: toJsonString(next, "[]") });
  }
  function updateMaterial(i, key, value) {
    const next = materials.map((m, idx) =>
      idx === i ? { ...m, [key]: key === "qty" ? Number(value) : value } : m
    );
    setSelectedRowPatch({ materialsJson: toJsonString(next, "[]") });
  }
  function deleteMaterial(i) {
    const next = materials.filter((_, idx) => idx !== i);
    setSelectedRowPatch({ materialsJson: toJsonString(next, "[]") });
  }

  // ===== Jobs CRUD =====
  function addJob(name) {
    const v = (name ?? "").toString().trim();
    if (!v) return;
    if (jobs.includes(v)) return;
    const next = [...jobs, v];
    setSelectedRowPatch({ jobsJson: toJsonString(next, "[]") });
  }
  function deleteJob(name) {
    const next = jobs.filter((x) => x !== name);
    setSelectedRowPatch({ jobsJson: toJsonString(next, "[]") });
  }
  const jobCandidates = useMemo(() => {
    const q = jobQuery.trim();
    if (!q) return enums.jobNames;
    return enums.jobNames.filter((x) => x.includes(q));
  }, [enums.jobNames, jobQuery]);

  // ===== Grid =====
  function applyGridResize(nextRows, nextCols) {
    const r = Math.max(0, Number(nextRows) || 0);
    const c = Math.max(0, Number(nextCols) || 0);
    const resized = ensureGridSize(grid2d, r, c);

    setGridRows(r);
    setGridCols(c);
    setGrid2d(resized);

    const den = denormalizeGrid(resized);
    setSelectedRowPatch({
      slotGridCols: c ? String(c) : "",
      slotGridJson: den == null ? "" : toJsonString(den, ""),
    });
  }

  function updateGridCell(r, c, value) {
    const next = ensureGridSize(grid2d, gridRows, gridCols);
    next[r][c] = value;
    setGrid2d(next);

    const den = denormalizeGrid(next);
    setSelectedRowPatch({ slotGridJson: den == null ? "" : toJsonString(den, "") });
  }

  function applyGridAll(nextGrid, r, c) {
    const resized = ensureGridSize(nextGrid, r, c);
    setGridRows(r);
    setGridCols(c);
    setGrid2d(resized);

    const den = denormalizeGrid(resized);
    setSelectedRowPatch({
      slotGridCols: c ? String(c) : "",
      slotGridJson: den == null ? "" : toJsonString(den, ""),
    });
  }

  function handleGridPaste(startR, startC, text) {
    const raw = (text ?? "").toString().replace(/\r\n?/g, "\n");
    if (!raw) return;

    // Excel/スプレッドシートは TSV（タブ区切り） + 改行で来る
    const lines = raw.split("\n");
    // 末尾の空行だけ落とす（最後に改行が付くケース）
    if (lines.length && lines[lines.length - 1] === "") lines.pop();

    const rowsData = lines.map((line) => line.split("\t"));

    const pasteRows = rowsData.length;
    const pasteCols = Math.max(0, ...rowsData.map((r) => r.length));

    const needRows = Math.max(gridRows, startR + pasteRows);
    const needCols = Math.max(gridCols, startC + pasteCols);

    const next = ensureGridSize(grid2d, needRows, needCols);

    for (let rr = 0; rr < pasteRows; rr++) {
      for (let cc = 0; cc < rowsData[rr].length; cc++) {
        next[startR + rr][startC + cc] = rowsData[rr][cc];
      }
    }

    applyGridAll(next, needRows, needCols);
  }

  function handleSelectedItemKindChange(v) {
    const allowedTypes = getItemTypeOptions(v, selectedRow?.craftType ?? "");
    const currentType = (selectedRow?.itemType ?? "").trim();
    const keepType = allowedTypes.includes(currentType);
    const nextItemType = keepType ? currentType : "";
    const nextGridType = keepType ? getGridTypeFromItemType(nextItemType) : "";

    const patch = {
      itemKind: v,
      itemType: nextItemType,
      slot: keepType ? nextItemType : "",
      slotGridType: nextGridType,
      slotGridCols: nextGridType ? String(GRID_TYPE_PRESETS[nextGridType]?.cols ?? "") : "",
      slotGridJson: keepType ? selectedRow?.slotGridJson ?? "" : "",
    };

    setSelectedRowPatch(patch);

    if (nextGridType) {
      const size = parseGridTypeToSize(nextGridType);
      if (size.rows != null && size.cols != null) applyGridResize(size.rows, size.cols);
    } else {
      setGridRows(1);
      setGridCols(1);
      setGrid2d([[""]]);
    }
  }

  function handleSelectedItemTypeChange(v) {
    const nextGridType = getGridTypeFromItemType(v);
    const patch = {
      itemType: v,
      slot: v,
      slotGridType: nextGridType,
    };

    setSelectedRowPatch(patch);

    if (nextGridType) {
      const size = parseGridTypeToSize(nextGridType);
      if (size.rows != null && size.cols != null) {
        applyGridResize(size.rows, size.cols);
      }
    }
  }

  function handleNewItemKindChange(v) {
    setNewItem((p) => {
      const allowedTypes = getItemTypeOptions(v, p.craftType);
      const keepType = allowedTypes.includes(p.itemType);
      return {
        ...p,
        itemKind: v,
        itemType: keepType ? p.itemType : "",
      };
    });
  }

  function handleNewItemTypeChange(v) {
    setNewItem((p) => ({ ...p, itemType: v }));
  }

  function onChangeGridType(value) {
    const nextGridType = value;
    const size = parseGridTypeToSize(nextGridType);
    setSelectedRowPatch({ slotGridType: nextGridType });

    if (size.rows != null && size.cols != null) {
      applyGridResize(size.rows, size.cols);
      return;
    }
    if (String(nextGridType).toLowerCase() === "1d") {
      const cols = gridCols > 0 ? gridCols : 1;
      applyGridResize(1, cols);
    }
  }


  function handleNewGroupCraftTypeChange(v) {
    const nextGroupKind = getGroupKindPreset(v, newGroup.itemKind);
    setNewGroup((p) => ({
      ...p,
      craftType: v,
      groupKind: nextGroupKind,
      members: buildEmptyGroupMembers(nextGroupKind),
    }));
  }

  function handleNewGroupItemKindChange(v) {
    const nextGroupKind = getGroupKindPreset(newGroup.craftType, v);
    setNewGroup((p) => ({
      ...p,
      itemKind: v,
      groupKind: nextGroupKind,
      members: buildEmptyGroupMembers(nextGroupKind),
    }));
  }

  function handleNewGroupKindChange(v) {
    setNewGroup((p) => ({
      ...p,
      groupKind: v,
      members: buildEmptyGroupMembers(v),
    }));
  }

  function updateNewGroupMember(index, patch) {
    setNewGroup((p) => ({
      ...p,
      members: p.members.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  }

  function addNewGroup() {
    const groupName = newGroup.groupName.trim();
    if (!groupName) {
      alert("groupName は必須");
      return;
    }

    const enabledMembers = newGroup.members.filter((m) => m.enabled);
    if (enabledMembers.length === 0) {
      alert("少なくとも1部位は選んで");
      return;
    }

    const gid = makeGroupId(groupName, newGroup.craftType.trim());
    const gkind = (newGroup.groupKind || "").trim() || "armor_set";
    const itemsCount = String(enabledMembers.length);

    const createdRows = enabledMembers.map((member) => {
      const row = {};
      headers.forEach((h) => (row[h] = ""));

      row.itemName = (member.itemName || "").trim() || getDefaultGroupItemName(groupName, member.slotLabel, member.itemType);
      row.craftType = newGroup.craftType.trim();
      row.itemType = member.itemType;
      row.itemKind = newGroup.itemKind.trim() || "防具";
      row.slot = member.itemType;
      row.slotGridType = getGridTypeFromItemType(member.itemType);
      row.slotGridCols = row.slotGridType ? String(GRID_TYPE_PRESETS[row.slotGridType]?.cols ?? "") : "";
      row.materialsJson = "[]";
      row.slotGridJson = "";
      if (row.slotGridType) {
        const size = parseGridTypeToSize(row.slotGridType);
        if (size.rows != null && size.cols != null) {
          row.slotGridJson = toJsonString(ensureGridSize([], size.rows, size.cols), "");
        }
      }
      row.jobsJson = "[]";
      row.equipableType = "";
      row.groupKind = gkind;
      row.groupId = gid;
      row.groupName = groupName;
      row.itemsCount = itemsCount;
      row.itemId = makeItemId(row);
      row.__key = makeKey();
      return row;
    });

    setRows((prev) => [...createdRows, ...prev]);
    setSelectedKey(createdRows[0]?.__key || "");
    setNewGroup({
      groupName: "",
      craftType: newGroup.craftType,
      itemKind: newGroup.itemKind,
      groupKind: gkind,
      members: buildEmptyGroupMembers(gkind),
    });
  }

  // ===== 新規装備追加 =====
  function addNewItem() {
    const name = newItem.itemName.trim();
    if (!name) {
      alert("itemName は必須");
      return;
    }

    const row = {};
    headers.forEach((h) => (row[h] = ""));

    row.itemName = name;
    row.craftType = newItem.craftType.trim();
    row.itemType = newItem.itemType.trim();
    row.itemKind = newItem.itemKind.trim() || (ARMOR_ITEM_TYPES.includes(row.itemType) ? "防具" : "武器");
    row.slot = row.itemType;
    row.slotGridType = getGridTypeFromItemType(row.itemType);
    row.slotGridCols = row.slotGridType ? String(GRID_TYPE_PRESETS[row.slotGridType]?.cols ?? "") : "";

    row.materialsJson = "[]";
    row.slotGridJson = "";
    if (row.slotGridType) {
      const size = parseGridTypeToSize(row.slotGridType);
      if (size.rows != null && size.cols != null) {
        row.slotGridJson = toJsonString(ensureGridSize([], size.rows, size.cols), "");
      }
    }
    row.jobsJson = "[]";
    row.equipableType = "";

    row.groupKind = row.itemKind === "防具" ? "armor_single" : "weapon_single";
    row.itemId = makeItemId(row);
    row.groupId = row.itemId;
    row.groupName = name;
    row.itemsCount = "1";

    row.__key = makeKey();

    setRows((prev) => [row, ...prev]);
    setSelectedKey(row.__key);
    setNewItem({ itemName: "", craftType: "", itemType: "", itemKind: "" });
  }

  // 初回ロード
  useEffect(() => {
    if (rows.length > 0) return;

    loadCsvFromPublic("/data/craft_master.csv", (res) => {
      const data = (res.data || []).map((r) => {
        const rr = {};
        Object.keys(r || {}).forEach((h) => (rr[h] = (r?.[h] ?? "").toString()));
        return rr;
      });

      const hs = Array.from(new Set([...(Object.keys(data[0] || {})), ...DEFAULT_HEADERS]));
      const normalized = data.map((r) => normalizeOneRowFromCsv(r, hs));

      setHeaders(hs);
      setRows(normalized);
      setSelectedKey(normalized[0]?.__key || "");
    }).catch((e) => console.warn(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ★equipableType変更ハンドラ：jobsが空ならデフォルトを入れる
  function onChangeEquipableType(v) {
  if (!selectedRow) return;

  const defaults = getDefaultJobsForEquipableType(v, enums.jobNames);

  // jobsが空の行にだけデフォを入れる（既に手入力がある行は守る）
  const apply = (r) => {
    const patch = { equipableType: v };

    const currentJobs = safeJsonParse(r.jobsJson, []);
    const hasJobs = Array.isArray(currentJobs) && currentJobs.length > 0;

    if (!hasJobs && defaults && defaults.length) {
      patch.jobsJson = toJsonString(defaults, "[]");
    }
    return patch;
  };

  if (!syncGroup) {
    setSelectedRowPatch(apply(selectedRow));
    return;
  }

  const gid = (selectedRow.groupId ?? "").trim();
  if (!gid) {
    setSelectedRowPatch(apply(selectedRow));
    return;
  }

  setRows((prev) =>
    prev.map((r) => {
      if ((r.groupId ?? "").trim() !== gid) return r;
      return { ...r, ...apply(r) };
    })
  );
}

  return (
    <div style={{ ...page, background: THEME.bg, color: THEME.text }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Craft CSV Editor（装備可能タイプ対応）</h1>

      <div style={toolbar}>
        <button onClick={newEmpty}>新規（空）</button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />

        {/* 必要なら */}
        {/* <button onClick={exportCsv} disabled={rows.length === 0}>CSVを書き出し</button> */}

        <button onClick={saveCsvToPublicAndReload} disabled={rows.length === 0}>
          /data に保存（上書き）
        </button>

        <span style={{ marginLeft: "auto", color: THEME.muted, fontSize: 12 }}>rows: {rows.length}</span>
      </div>

      {/* 新規追加 */}
      <div style={card}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={cardTitle}>新しい装備を追加</div>
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setNewMode("single")} style={newMode === "single" ? activeMiniButton : miniButton}>単品</button>
            <button type="button" onClick={() => setNewMode("group")} style={newMode === "group" ? activeMiniButton : miniButton}>グループ</button>
          </div>
        </div>

        {newMode === "single" ? (
          <div style={grid2}>
            <label style={field}>
              <span style={label}>itemName（必須）</span>
              <input
                value={newItem.itemName}
                onChange={(e) => setNewItem((p) => ({ ...p, itemName: e.target.value }))}
                style={input}
                placeholder="例: バトルアックス"
              />
            </label>

            <label style={field}>
              <span style={label}>itemKind</span>
              <select value={newItem.itemKind} onChange={(e) => handleNewItemKindChange(e.target.value)} style={input}>
                <option value="">（選択）</option>
                {ITEM_KIND_OPTIONS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>

            <label style={field}>
              <span style={label}>craftType</span>
              <select
                value={newItem.craftType}
                onChange={(e) => setNewItem((p) => ({ ...p, craftType: e.target.value, itemType: getItemTypeOptions(p.itemKind, e.target.value).includes(p.itemType) ? p.itemType : "" }))}
                style={input}
              >
                <option value="">（未設定）</option>
                {enums.craftTypes.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>

            <label style={field}>
              <span style={label}>itemType（分類）</span>
              <select value={newItem.itemType} onChange={(e) => handleNewItemTypeChange(e.target.value)} style={input}>
                <option value="">（選択）</option>
                {itemTypeOptionsForNewItem.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button onClick={addNewItem}>追加</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <div style={grid2}>
              <label style={field}>
                <span style={label}>groupName（必須）</span>
                <input
                  value={newGroup.groupName}
                  onChange={(e) => setNewGroup((p) => ({ ...p, groupName: e.target.value }))}
                  style={input}
                  placeholder="例: アビス"
                />
              </label>

              <label style={field}>
                <span style={label}>itemKind</span>
                <select value={newGroup.itemKind} onChange={(e) => handleNewGroupItemKindChange(e.target.value)} style={input}>
                  {ITEM_KIND_OPTIONS.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label style={field}>
                <span style={label}>craftType</span>
                <select value={newGroup.craftType} onChange={(e) => handleNewGroupCraftTypeChange(e.target.value)} style={input}>
                  <option value="">（未設定）</option>
                  {enums.craftTypes.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label style={field}>
                <span style={label}>groupKind</span>
                <select value={newGroup.groupKind} onChange={(e) => handleNewGroupKindChange(e.target.value)} style={input}>
                  {groupKindOptions.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>グループに入れる部位</div>
              <div style={{ display: "grid", gap: 10 }}>
                {newGroup.members.map((member, i) => (
                  <div key={member.key} style={groupMemberRow}>
                    <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <input type="checkbox" checked={member.enabled} onChange={(e) => updateNewGroupMember(i, { enabled: e.target.checked })} />
                      <span style={{ fontWeight: 800, minWidth: 56 }}>{member.slotLabel}</span>
                    </label>

                    <input
                      value={member.itemName}
                      onChange={(e) => updateNewGroupMember(i, { itemName: e.target.value })}
                      style={{ ...input, width: "100%" }}
                      placeholder={getDefaultGroupItemName(newGroup.groupName, member.slotLabel, member.itemType) || "部位名"}
                    />

                    <select
                      value={member.itemType}
                      onChange={(e) => updateNewGroupMember(i, { itemType: e.target.value })}
                      style={{ ...input, width: "100%" }}
                    >
                      {getItemTypeOptions(newGroup.itemKind, newGroup.craftType).map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, color: THEME.muted, fontSize: 12 }}>
                ※ 名前を空欄にすると、groupName から仮の装備名を自動で入れる
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button onClick={addNewGroup}>グループ追加</button>
            </div>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={empty}>
          <div style={{ fontWeight: 900 }}>使い方</div>
          <ol style={{ marginTop: 8, color: THEME.muted }}>
            <li>craft_master.csv をアップロード or 自動ロード</li>
            <li>左から装備を選択</li>
            <li>右で編集</li>
            <li>「/data に保存」で上書き</li>
          </ol>
        </div>
      ) : (
        <div style={layoutStyle}>
          {/* 左：リスト */}
          <div style={listWrap}>
            <div style={listHeader}>
              <input
                placeholder="検索（名前 / 装備Lv / 職人Lv）"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ ...input, width: "100%", minWidth: 0 }}
              />
            </div>

            <div style={listBody}>
              {displayEntries.map((entry) => {
                const active = entry.__kind === "group"
                  ? entry.items.some((it) => it.__key === selectedKey)
                  : entry.__key === selectedKey;
                return (
                  <button
                    key={entry.__key}
                    onClick={() => setSelectedKey(entry.__kind === "group" ? (entry.items[0]?.__key || "") : entry.__key)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: 0,
                      borderBottom: `1px solid ${THEME.border}`,
                      background: active ? THEME.active : THEME.card,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{entry.label}</div>
                    <div style={{ fontSize: 12, color: THEME.muted }}>
                      {entry.__kind === "group"
                        ? `${entry.craftType ?? ""} / ${entry.items.map((it) => `${it.slotLabel}:${it.itemName}`).join(" / ")}`
                        : `${entry.row?.itemType ?? ""} / ${entry.row?.craftType ?? ""} / ${entry.row?.equipableType ?? ""}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右：編集 */}
          <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
            {!selectedRow ? (
              <div style={card}>左からアイテムを選んでくれ</div>
            ) : (
              <>
                {/* 基本情報 */}
                <div style={card}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>基本情報</div>
                    <div style={{ color: THEME.muted, fontSize: 12 }}>
                      itemId: {selectedRow?.itemId || "（自動生成）"}
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      <button
                        onClick={deleteCurrentItem}
                        style={{ ...dangerButton }}
                      >
                        この装備削除
                      </button>

                      <button
                        onClick={deleteCurrentGroup}
                        style={{ ...dangerButton }}
                      >
                        セット削除
                      </button>
                    </div>
                  </div>
                  <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginLeft: 12 }}>
                    <input type="checkbox" checked={syncGroup} onChange={(e) => setSyncGroup(e.target.checked)} />
                    <span style={{ fontSize: 12, color: THEME.muted, fontWeight: 800 }}>グループ同期</span>
                  </label>
                  <div style={grid3}>
                    <FieldInput
                      labelText="itemName（変更OK）"
                      value={selectedRow?.itemName ?? ""}
                      onChange={(v) => setSelectedRowPatch({ itemName: v, itemId: "" })}
                      placeholder="例: トーテムケープ"
                    />

                    <FieldSelect
                      labelText="craftType"
                      value={selectedRow?.craftType ?? ""}
                      options={enums.craftTypes}
                      onChange={(v) => {
                        const patch = { craftType: v, itemId: "" }; // itemId再生成
                        if (syncGroup) setGroupPatch(patch);
                        else setSelectedRowPatch(patch);
                      }}
                      allowEmpty
                    />
                    <FieldSelect
                      labelText="itemKind"
                      value={selectedRow?.itemKind ?? ""}
                      options={ITEM_KIND_OPTIONS}
                      onChange={(v) => handleSelectedItemKindChange(v)}
                      allowEmpty
                    />
                    <FieldSelect
                      labelText="itemType（分類）"
                      value={selectedRow?.itemType ?? ""}
                      options={itemTypeOptionsForSelectedRow}
                      onChange={(v) => handleSelectedItemTypeChange(v)}
                      allowEmpty
                    />


                    {/* ★追加：装備可能タイプ */}
                    <FieldSelect
                      labelText="装備可能タイプ（equipableType）"
                      value={selectedRow?.equipableType ?? ""}
                      options={enums.equipableTypeOptions}
                      onChange={(v) => onChangeEquipableType(v)}
                      allowEmpty
                    />

                    <FieldInput
                      labelText="craftLevel"
                      value={selectedRow?.craftLevel ?? ""}
                      onChange={(v) => setSelectedRowPatch({ craftLevel: v })}
                      placeholder="例: 41"
                    />
                    <FieldInput
                        labelText="equipLevel"
                        value={selectedRow?.equipLevel ?? ""}
                        onChange={(v) => {
                          const patch = { equipLevel: v };
                          if (syncGroup) setGroupPatch(patch);
                          else setSelectedRowPatch(patch);
                        }}
                        placeholder="例: 90"
                      />
                    <FieldInput
                      labelText="recipeBook"
                      value={selectedRow?.recipeBook ?? ""}
                      onChange={(v) => {
                        const patch = { recipeBook: v };
                        if (syncGroup) setGroupPatch(patch);
                        else setSelectedRowPatch(patch);
                      }}
                      placeholder="例: ○○の書"
                    />

                    <FieldSelect
                      labelText="slot"
                      value={selectedRow?.slot ?? ""}
                      options={Array.from(new Set([...itemTypeOptionsForSelectedRow, ...(selectedRow?.slot ? [selectedRow.slot] : [])]))}
                      onChange={(v) => setSelectedRowPatch({ slot: v })}
                      allowEmpty
                    />

                    <FieldInput
                      labelText="groupKind"
                      value={selectedRow?.groupKind ?? ""}
                      onChange={(v) => setSelectedRowPatch({ groupKind: v })}
                      placeholder="armor_set / weapon_single…"
                    />
                    <FieldInput
                      labelText="groupName"
                      value={selectedRow?.groupName ?? ""}
                      onChange={(v) => setSelectedRowPatch({ groupName: v })}
                      placeholder="セット名など"
                    />
                    <FieldInput
                      labelText="crystalByAlchemy"
                      value={selectedRow?.crystalByAlchemy ?? ""}
                      onChange={(v) => setSelectedRowPatch({ crystalByAlchemy: v })}
                      placeholder="任意"
                    />
                  </div>

                  {(() => {
                    const currentGroupId = (selectedRow?.groupId ?? "").toString().trim();
                    const groupedItems = rows
                      .filter((r) => (r?.groupId ?? "").toString().trim() === currentGroupId)
                      .filter((r) => isGroupedRow(r))
                      .sort((a, b) => {
                        const order = { "頭": 1, "体上": 2, "体下": 3, "腕": 4, "足": 5, "盾": 6, "武器": 7 };
                        const sa = order[getDisplaySlotFromItemType(a?.itemType ?? "", a?.itemKind ?? "")] ?? 99;
                        const sb = order[getDisplaySlotFromItemType(b?.itemType ?? "", b?.itemKind ?? "")] ?? 99;
                        if (sa !== sb) return sa - sb;
                        return String(a?.itemName ?? "").localeCompare(String(b?.itemName ?? ""), "ja");
                      });

                    if (groupedItems.length <= 1) return null;

                    return (
                      <div style={{ marginTop: 14, borderTop: `1px solid ${THEME.border}`, paddingTop: 12 }}>
                        <div style={{ fontWeight: 900, marginBottom: 8 }}>セット内の装備</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {groupedItems.map((r) => {
                            const active = r.__key === selectedKey;
                            const slotLabel = getDisplaySlotFromItemType(r?.itemType ?? "", r?.itemKind ?? "");
                            const mats = safeJsonParse(r?.materialsJson ?? "[]", []);
                            return (
                              <button
                                key={r.__key}
                                type="button"
                                onClick={() => setSelectedKey(r.__key)}
                                style={{
                                  textAlign: "left",
                                  padding: "10px 12px",
                                  borderRadius: 10,
                                  border: active ? `1px solid ${THEME.activeBorder}` : `1px solid ${THEME.border}`,
                                  background: active ? THEME.active : THEME.card,
                                  cursor: "pointer",
                                }}
                              >
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                  <strong>{slotLabel || "部位不明"}</strong>
                                  <span>{r?.itemName ?? ""}</span>
                                  <span style={{ color: THEME.muted, fontSize: 12 }}>{r?.itemType ?? ""}</span>
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12, color: THEME.muted }}>
                                  素材: {Array.isArray(mats) && mats.length > 0
                                    ? mats.map((m) => `${m?.name ?? ""}×${m?.qty ?? ""}`).join(" / ")
                                    : "なし"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginTop: 10, color: THEME.muted, fontSize: 12 }}>
                    ※ 装備可能タイプを変えた時、jobsが空なら自動でデフォルト職業が入る
                  </div>
                </div>

                {/* Jobs（チップ） */}
                <div style={card}>
                  <div style={rowHead}>
                    <div style={cardTitle}>装備可能職業（チップ）</div>
                    <div style={hint}>×で削除。入力→追加、候補クリックでも追加</div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {jobs.length === 0 ? (
                        <div style={{ color: THEME.muted, fontSize: 13 }}>未設定</div>
                      ) : (
                        jobs.map((j) => (
                          <span key={j} style={chip}>
                            {j}
                            <button onClick={() => deleteJob(j)} style={chipX} aria-label={`${j}を削除`}>×</button>
                          </span>
                        ))
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                      <label style={{ ...field, minWidth: 260 }}>
                        <span style={label}>職業を追加</span>
                        <input
                          value={jobQuery}
                          onChange={(e) => setJobQuery(e.target.value)}
                          style={{ ...input, width: "100%" }}
                          placeholder="例: 戦士"
                        />
                      </label>

                      <button
                        onClick={() => {
                          addJob(jobQuery);
                          setJobQuery("");
                        }}
                      >
                        追加
                      </button>

                      <button
                        onClick={() => {
                          // 便利：equipableTypeのデフォルトを手動適用（上書き）
                          const defaults = getDefaultJobsForEquipableType(selectedRow?.equipableType ?? "", enums.jobNames);
                          if (defaults && defaults.length) {
                            setSelectedRowPatch({ jobsJson: toJsonString(defaults, "[]") });
                          }
                        }}
                      >
                        デフォルト職業を適用（上書き）
                      </button>
                    </div>

                    <div style={jobPickWrap}>
                      {jobCandidates.map((name) => {
                        const disabled = jobs.includes(name);
                        return (
                          <button
                            key={name}
                            disabled={disabled}
                            onClick={() => addJob(name)}
                            style={{
                              ...jobPick,
                              opacity: disabled ? 0.5 : 1,
                              cursor: disabled ? "not-allowed" : "pointer",
                            }}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Materials */}
                <div style={card}>
                  <div style={rowHead}>
                    <div style={cardTitle}>Materials</div>
                    <button onClick={addMaterial}>＋追加</button>
                    <div style={hint}>素材名は候補から選べる（入力もOK）</div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {materials.length === 0 ? (
                      <div style={{ color: THEME.muted, fontSize: 13 }}>素材なし（必要なら追加）</div>
                    ) : (
                      materials.map((m, i) => (
                        <div key={i} style={matRow}>
                          <input
                            list="materialNameDict"
                            value={m.name}
                            onChange={(e) => updateMaterial(i, "name", e.target.value)}
                            style={{ ...input, width: "100%", minWidth: 0 }}
                            placeholder="素材名（候補あり）"
                          />
                          <input
                            type="number"
                            min={0}
                            value={String(m.qty ?? 0)}
                            onChange={(e) => updateMaterial(i, "qty", e.target.value)}
                            style={{ ...input, width: "100%" }}
                            placeholder="数量"
                          />
                          <button onClick={() => deleteMaterial(i)}>削除</button>
                        </div>
                      ))
                    )}
                  </div>

                  <datalist id="materialNameDict">
                    {enums.materialNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                {/* Grid */}
                <div style={card}>
                  <div style={rowHead}>
                    <div style={cardTitle}>Grid（視覚編集）</div>
                    <div style={hint}>gridTypeは名前付きプリセットのみ。itemTypeを選ぶと自動入力</div>
                  </div>

                  <div style={gridControls}>
                    <label style={fieldInline}>
                      <span style={label}>gridType</span>
                      <select
                        value={selectedRow?.slotGridType ?? ""}
                        onChange={(e) => onChangeGridType(e.target.value)}
                        style={{ ...input, minWidth: 0 }}
                      >
                        {gridTypeOptionsForSelectedRow.map((x) => (
                          <option key={x} value={x}>{x || "（未設定）"}</option>
                        ))}
                      </select>
                    </label>

                    <label style={fieldInline}>
                      <span style={label}>rows</span>
                      <input
                        type="number"
                        min={0}
                        value={gridRows}
                        onChange={(e) => applyGridResize(e.target.value, gridCols)}
                        style={{ ...input, width: 120 }}
                      />
                    </label>

                    <label style={fieldInline}>
                      <span style={label}>cols</span>
                      <input
                        type="number"
                        min={0}
                        value={gridCols}
                        onChange={(e) => applyGridResize(gridRows, e.target.value)}
                        style={{ ...input, width: 120 }}
                      />
                    </label>

                    <button onClick={() => applyGridResize(gridRows + 1, gridCols)}>行＋</button>
                    <button onClick={() => applyGridResize(gridRows, gridCols + 1)}>列＋</button>
                    <button onClick={() => applyGridResize(Math.max(0, gridRows - 1), gridCols)}>行−</button>
                    <button onClick={() => applyGridResize(gridRows, Math.max(0, gridCols - 1))}>列−</button>
                  </div>

                  {gridRows === 0 || gridCols === 0 ? (
                    <div style={{ marginTop: 10, color: THEME.muted }}>
                      itemTypeかgridTypeを選ぶと作れる。
                    </div>
                  ) : (
                    <div style={gridTableWrap}>
                      <table style={gridTable}>
                        <thead>
                          <tr>
                            <th style={th}>r\\c</th>
                            {Array.from({ length: gridCols }, (_, c) => (
                              <th key={c} style={th}>{c + 1}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: gridRows }, (_, r) => (
                            <tr key={r}>
                              <th style={th}>{r + 1}</th>
                              {Array.from({ length: gridCols }, (_, c) => {
                                const disabled = isDisabledCell(selectedRow?.slotGridType ?? "", r, c);

                                return (
                                  <td key={c} style={td}>
                                    <input
                                      value={str(grid2d?.[r]?.[c] ?? "")}
                                      onChange={(e) => {
                                         updateGridCell(r, c, e.target.value);
                                      }}
                                      onPaste={(e) => {
                                        if (disabled) {
                                          e.preventDefault();
                                          return;
                                        }

                                        const t = e.clipboardData?.getData("text") ?? "";
                                        if (t.includes("\n") || t.includes("\t")) {
                                          e.preventDefault();
                                          handleGridPaste(r, c, t);
                                        }
                                      }}
                                     
                                      style={{
                                        ...cellInput,
                                        backgroundColor: disabled ? THEME.soft : THEME.inputBg,
                                        color: disabled ? THEME.muted : THEME.text,
                                      
                                      }}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* デバッグ */}
                <details style={card}>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>JSON確認（デバッグ）</summary>
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div>
                      <div style={label}>equipableType</div>
                      <pre style={pre}>{selectedRow?.equipableType ?? ""}</pre>
                    </div>
                    <div>
                      <div style={label}>jobsJson</div>
                      <pre style={pre}>{selectedRow?.jobsJson || "[]"}</pre>
                    </div>
                    <div>
                      <div style={label}>materialsJson</div>
                      <pre style={pre}>{selectedRow?.materialsJson || "[]"}</pre>
                    </div>
                    <div>
                      <div style={label}>slotGridJson</div>
                      <pre style={pre}>{selectedRow?.slotGridJson || ""}</pre>
                    </div>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldInput({ labelText, value, onChange, placeholder }) {
  return (
    <label style={field}>
      <span style={label}>{labelText}</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...input, width: "100%", minWidth: 0 }}
        placeholder={placeholder}
      />
    </label>
  );
}

function FieldSelect({ labelText, value, options, onChange, allowEmpty }) {
  const ops = Array.isArray(options) ? options : [];
  return (
    <label style={field}>
      <span style={label}>{labelText}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ ...input, width: "100%" }}>
        {allowEmpty && <option value="">（未設定）</option>}
        {!allowEmpty && !ops.includes("") && <option value="">（未設定）</option>}
        {ops.map((x) => (
          <option key={x} value={x}>{x || "（未設定）"}</option>
        ))}
      </select>
    </label>
  );
}

/* styles */
const page = { padding: 18, display: "grid", gap: 12, maxWidth: 1400 };
const toolbar = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const empty = { padding: 16, border: `1px dashed ${THEME.border}`, borderRadius: 12, background: THEME.card, color: THEME.text };

const layout = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 360px) 1fr",
  gap: 12,
  alignItems: "start",
};

const listWrap = { border: `1px solid ${THEME.border}`, borderRadius: 12, overflow: "hidden", minWidth: 0 };
const listHeader = { padding: 10, background: THEME.soft, borderBottom: `1px solid ${THEME.border}` };
const listBody = { maxHeight: 680, overflow: "auto" };

const card = { padding: 14, border: `1px solid ${THEME.border}`, borderRadius: 12, width: "100%", minWidth: 0 };
const cardTitle = { fontWeight: 900 };
const hint = { marginLeft: "auto", color: THEME.muted, fontSize: 12 };

const rowHead = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };

const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 10 };
const grid3 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 10 };

const field = { display: "grid", gap: 4, minWidth: 0 };
const fieldInline = { display: "grid", gap: 4 };

const label = { fontSize: 12, color: THEME.muted, fontWeight: 800 };
const input = { padding: "8px 10px", borderRadius: 10, border: `1px solid ${THEME.border}`, minWidth: 0, background: THEME.inputBg, color: THEME.text };

const matRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 8,
  alignItems: "center",
};

const gridControls = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "end",
  marginTop: 10,
};

const gridTableWrap = {
  marginTop: 12,
  width: "100%",
  overflowX: "auto",
  border: `1px solid ${THEME.border}`,
  borderRadius: 12,
};

const gridTable = { borderCollapse: "collapse", width: "max-content", minWidth: "100%" };

const th = {
  position: "sticky",
  top: 0,
  background: THEME.soft,
  border: `1px solid ${THEME.border}`,
  padding: "8px 10px",
  textAlign: "center",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const td = { border: `1px solid ${THEME.border}`, padding: 6 };

const cellInput = {
  width: 96,
  minWidth: 96,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  textAlign: "center",
  fontSize: 16,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
};

const pre = {
  background: THEME.preBg,
  color: THEME.preText,
  padding: 12,
  borderRadius: 12,
  overflow: "auto",
  fontSize: 12,
};

// chips
const chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: THEME.soft,
  fontSize: 13,
  fontWeight: 800,
};
const chipX = {
  border: 0,
  background: "transparent",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

const jobPickWrap = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  paddingTop: 8,
  borderTop: `1px dashed ${THEME.border}`,
};
const jobPick = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: THEME.card,
  fontSize: 13,
  fontWeight: 800,
};
const miniButton = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: THEME.card,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const activeMiniButton = {
  ...miniButton,
  background: THEME.active,
  border: "1px solid #6366f1",
  color: "#4338ca",
};

const groupMemberRow = {
  display: "grid",
  gridTemplateColumns: "120px minmax(180px, 1fr) minmax(140px, 220px)",
  gap: 8,
  alignItems: "center",
};
const dangerButton = {
  padding: "6px 12px",
  borderRadius: 8,
  border: `1px solid ${THEME.dangerBorder}`,
  background: THEME.dangerBg,
  color: THEME.dangerText,
  fontWeight: 800,
  cursor: "pointer",
};