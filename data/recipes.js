// data/recipes.js

export const SETS = [
  {
    id: "totem",
    name: "トーテムセット",
    jobLevel: 41,
    craftType: "裁縫",
    items: [
      {
        id: "totem_crown",
        name: "トーテムクラウン",
        slot: "頭",
        crystalCount: 0,
        materials: [
          { name: "天竜草", qty: 5, defaultUnitCost: 6500 },
          { name: "ドラゴンのツノ", qty: 1, defaultUnitCost: 4100 },
          { name: "かぜきりのはね", qty: 1, defaultUnitCost: 13000 },
          { name: "妖精の綿花", qty: 10, defaultUnitCost: 120 },
          { name: "あまつゆのいと", qty: 5, defaultUnitCost: 1000 },
        ],
      },
      {
        id: "totem_cape_top",
        name: "トーテムケープ上",
        slot: "体上",
        crystalCount: 0,
        materials: [
          { name: "天竜草", qty: 5, defaultUnitCost: 6500 },
          { name: "ナイトメアリーフ", qty: 1, defaultUnitCost: 12000 },
          { name: "ふさふさの毛皮", qty: 30, defaultUnitCost: 150 },
          { name: "ぎんのこうせき", qty: 30, defaultUnitCost: 230 },
          { name: "あまつゆのいと", qty: 5, defaultUnitCost: 1000 },
        ],
      },
      {
        id: "totem_cape_bottom",
        name: "トーテムケープ下",
        slot: "体下",
        crystalCount: 0,
        materials: [
          { name: "天竜草", qty: 5, defaultUnitCost: 6500 },
          { name: "ふしぎなドロドロ", qty: 30, defaultUnitCost: 160 },
          { name: "まじゅうの皮", qty: 1, defaultUnitCost: 7000 },
          { name: "かがやきそう", qty: 30, defaultUnitCost: 140 },
          { name: "あまつゆのいと", qty: 5, defaultUnitCost: 1000 },
        ],
      },
      {
        id: "totem_bless",
        name: "トーテムブレス",
        slot: "首",
        crystalCount: 0,
        materials: [
          { name: "天竜草", qty: 5, defaultUnitCost: 6500 },
          { name: "幻獣のホネ", qty: 1, defaultUnitCost: 7350 },
          { name: "けものの皮", qty: 30, defaultUnitCost: 120 },
          { name: "まじゅうのホネ", qty: 5, defaultUnitCost: 1000 },
          { name: "あまつゆのいと", qty: 5, defaultUnitCost: 1000 },
        ],
      },
      {
        id: "totem_sandals",
        name: "トーテムサンダル",
        slot: "足",
        crystalCount: 0,
        materials: [
          { name: "天竜草", qty: 5, defaultUnitCost: 6500 },
          { name: "まじゅうの皮", qty: 1, defaultUnitCost: 7000 },
          { name: "みかわしそう", qty: 30, defaultUnitCost: 310 },
          { name: "シルク草", qty: 30, defaultUnitCost: 33 },
          { name: "あまつゆのいと", qty: 5, defaultUnitCost: 1000 },
        ],
      },
    ],
  },

  {
  id: "primitive_beast",
  name: "原始獣のコートセット",
  craftType: "裁縫",
  jobLevel: null, // セットの代表LVを置くなら max で 33 とかでもOK
  items: [
    {
      id: "genshiju_shapka",
      name: "原始獣のシャプカ",
      slot: "頭",
      jobLevel: 32,
      crystalCount: 0,
      materials: [
        { name: "ふさふさの毛皮", qty: 12, defaultUnitCost: 150 },
        { name: "ドラゴンの皮", qty: 1, defaultUnitCost: 8500 },
        { name: "グリーンオーブ", qty: 1, defaultUnitCost: 5200 },
        { name: "あまつゆのいと", qty: 10, defaultUnitCost: 1000 },
      ],
    },
    {
      id: "genshiju_coat_top",
      name: "原始獣のコート上",
      slot: "体上",
      jobLevel: 33,
      crystalCount: 0,
      materials: [
        { name: "ふさふさの毛皮", qty: 12, defaultUnitCost: 150 },
        { name: "大きなうろこ", qty: 5, defaultUnitCost: 430 },
        { name: "グリーンオーブ", qty: 1, defaultUnitCost: 5200 },
        { name: "あまつゆのいと", qty: 10, defaultUnitCost: 1000 },
      ],
    },
    {
      id: "genshiju_coat_bottom",
      name: "原始獣のコート下",
      slot: "体下",
      jobLevel: 33,
      crystalCount: 0,
      materials: [
        { name: "ふさふさの毛皮", qty: 12, defaultUnitCost: 150 },
        { name: "小さなうろこ", qty: 30, defaultUnitCost: 230 },
        { name: "グリーンオーブ", qty: 1, defaultUnitCost: 5200 },
        { name: "あまつゆのいと", qty: 10, defaultUnitCost: 1000 },
      ],
    },
    {
      id: "genshiju_glove",
      name: "原始獣のグローブ",
      slot: "腕",
      jobLevel: 33,
      crystalCount: 0,
      materials: [
        { name: "ふさふさの毛皮", qty: 12, defaultUnitCost: 150 },
        { name: "大きなホネ", qty: 5, defaultUnitCost: 1300 },
        { name: "グリーンオーブ", qty: 1, defaultUnitCost: 5200 },
        { name: "あまつゆのいと", qty: 10, defaultUnitCost: 1000 },
      ],
    },
    {
      id: "genshiju_boots",
      name: "原始獣のブーツ",
      slot: "足",
      jobLevel: 32,
      crystalCount: 0,
      materials: [
        { name: "ふさふさの毛皮", qty: 12, defaultUnitCost: 150 },
        { name: "小さなホネ", qty: 25, defaultUnitCost: 130 },
        { name: "グリーンオーブ", qty: 1, defaultUnitCost: 5200 },
        { name: "あまつゆのいと", qty: 10, defaultUnitCost: 1000 },
      ],
    },
  ],
  }
];
