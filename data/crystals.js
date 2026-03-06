// data/crystals.js

export const CRYSTAL_RULES = [
  { min: 1,  max: 20, values: { plus0: 1, plus1: 1,  plus2: 1,  plus3: 3  } },
  { min: 21, max: 29, values: { plus0: 1, plus1: 2,  plus2: 3,  plus3: 6  } },
  { min: 30, max: 41, values: { plus0: 1, plus1: 3,  plus2: 4,  plus3: 9  } },

  { min: 42, max: 49, values: { plus0: 2, plus1: 4,  plus2: 6,  plus3: 12 } },
  { min: 50, max: 59, values: { plus0: 4, plus1: 8,  plus2: 12, plus3: 24 } },
  { min: 60, max: 69, values: { plus0: 6, plus1: 12, plus2: 18, plus3: 36 } },

  { min: 70, max: 79, values: { plus0: 7, plus1: 14, plus2: 21, plus3: 42 } },
  { min: 80, max: 90, values: { plus0: 8, plus1: 16, plus2: 24, plus3: 48 } },

  // 新ルール
  { min: 90, max: 98, values: { plus0: 9, plus1: 18, plus2: 27, plus3: 54 } },
  { min: 99, max: 119, values: { plus0: 10, plus1: 20, plus2: 30, plus3: 60 } },
  { min: 120, max: 129, values: { plus0: 11, plus1: 21, plus2: 31, plus3: 63 } },
  { min: 130, max: 999, values: { plus0: 11, plus1: 22, plus2: 33, plus3: 66 } },
];

export function getCrystalByEquipLevel(level) {
  const rule = CRYSTAL_RULES.find(r => level >= r.min && level <= r.max);
  return rule ? { ...rule.values } : null;
}