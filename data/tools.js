// data/tools.js
export const TOOL_USES = 30;

// craftType は recipes の craftType と合わせる（例： "裁縫", "防具鍛冶"）
export const TOOLS_BY_CRAFT = {
  武器鍛冶: [
    { id: "none", name: "選択なし", defaultPrice: 0 },
    { id: "copper_hammer", name: "銅の鍛冶ハンマー", defaultPrice: 120000 },
    { id: "iron_hammer", name: "鉄の鍛冶ハンマー", defaultPrice: 120000 },
    { id: "silver_hammer", name: "銀の鍛冶ハンマー", defaultPrice: 120000 },
    { id: "platina_hammer", name: "プラチナ鍛冶ハンマー", defaultPrice: 120000 },
    { id: "super_hammer", name: "超鍛冶ハンマー", defaultPrice: 120000 },
    { id: "miracle_hammer", name: "奇跡の鍛冶ハンマー", defaultPrice: 430000 },
    { id: "light_hammer", name: "光の鍛冶ハンマー", defaultPrice: 450000 },
  ],
  木工: [
    { id: "none", name: "選択なし", defaultPrice: 0 },
    { id: "copper_wood", name: "銅の木工刀", defaultPrice: 120000 },
    { id: "iron_wood", name: "鉄の木工刀", defaultPrice: 120000 },
    { id: "silver_wood", name: "銀の木工刀", defaultPrice: 120000 },
    { id: "super_wood", name: "プラチナ木工刀", defaultPrice: 120000 },
    { id: "platina_wood", name: "超木工刀", defaultPrice: 120000 },
    { id: "miracle_wood", name: "奇跡の木工刀", defaultPrice: 450000 },
    { id: "light_wood", name: "光の木工刀", defaultPrice: 450000 },
  ],
  裁縫: [
    { id: "none", name: "選択なし", defaultPrice: 0 },
    { id: "copper_needle", name: "銅のさいほう針", defaultPrice: 120000 },
    { id: "iron_needle", name: "鉄のさいほう針", defaultPrice: 120000 },
    { id: "silver_needle", name: "銀のさいほう針", defaultPrice: 120000 },
    { id: "super_needle", name: "プラチナさいほう針", defaultPrice: 120000 },
    { id: "platina_needle", name: "超さいほう針", defaultPrice: 150000 },
    { id: "miracle_needle", name: "奇跡のさいほう針", defaultPrice: 250000 },
    { id: "light_needle", name: "光のさいほう針", defaultPrice: 250000 },
  ]
};