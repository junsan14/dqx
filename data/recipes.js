// data/recipes.js
import { CRAFT_MASTER } from "./craft_master";

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

const jsonOr = (s, fallback) => {
  try {
    if (s == null || s === "") return fallback;
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

export const SETS = (() => {
  const groups = new Map();

  for (const r of CRAFT_MASTER) {
    const groupId = r.groupId || r.itemId; // 単品は自分をグループ扱い
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        name: r.groupName || r.itemName,
        craftType: r.craftType || null,
        craftLevel: n(r.craftLevel),
        recipeBook: r.recipeBook || null,
        equipLevel: n(r.equipLevel),
        jobs: [],
        setEffects: [],
        crystalByAlchemy: jsonOr(r.crystalByAlchemy, null),
        items: [],
      });
    }

    const g = groups.get(groupId);

    // set側のレベルは「最大」で持っておく（必要なら好みで）
    g.craftLevel = Math.max(g.craftLevel ?? 0, n(r.craftLevel) ?? 0) || g.craftLevel;
    g.equipLevel = Math.max(g.equipLevel ?? 0, n(r.equipLevel) ?? 0) || g.equipLevel;

    const item = {
      id: r.itemId,
      name: r.itemName,
      craftType: r.craftType || null,
      craftLevel: n(r.craftLevel),
      recipeBook: r.recipeBook || null,

      slot: r.slot || null,
      equipLevel: n(r.equipLevel),
      jobs: jsonOr(r.jobsJson, null),
      stats: null,

      slotGridType: r.slotGridType || null,
      slotGridCols: r.slotGridCols ? Number(r.slotGridCols) : null,
      slotGrid: jsonOr(r.slotGridJson, null),

      baseEffects: [],
      qualityBonus: null,

      materials: jsonOr(r.materialsJson, []),
    };

    g.items.push(item);
  }

  return Array.from(groups.values());
})();