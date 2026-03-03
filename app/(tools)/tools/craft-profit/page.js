"use client";

import { useMemo, useState } from "react";
import { SETS } from "@/data/recipes";
import { clamp0, yen } from "@/lib/money";

const DEFAULT_FEE_RATE = 0.05;
const TOOL_USES = 30;

// 裁縫の針（例）
const NEEDLES = [
  { id: "none", name: "選択なし", price: 0 },
  { id: "bronze", name: "どうの針（例）", price: 3000 },
  { id: "silver", name: "ぎんの針（例）", price: 12000 },
  { id: "platinum", name: "プラチナ針（例）", price: 50000 },
];

function normalizeSlots(items) {
  const slotOrder = ["頭", "体上", "体下", "腕", "足", "首", "顔", "盾", "武器", "その他"];
  const slots = Array.from(new Set((items || []).map((it) => it.slot || "その他")));
  slots.sort((a, b) => {
    const ia = slotOrder.indexOf(a);
    const ib = slotOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "ja");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return slots;
}

function buildMatrix(selectedSet) {
  const items = selectedSet?.items || [];
  const slots = normalizeSlots(items);

  // materialName => { perSlotQty, totalQty, defaultUnitCost }
  const map = new Map();

  for (const it of items) {
    const slot = it.slot || "その他";
    for (const m of it.materials || []) {
      const key = m.name;
      const cur = map.get(key) || {
        materialName: key,
        perSlotQty: {},
        totalQty: 0,
        defaultUnitCost: 0,
      };
      const q = Number(m.qty || 0);
      cur.perSlotQty[slot] = (cur.perSlotQty[slot] || 0) + q;
      cur.totalQty += q;
      if (!cur.defaultUnitCost && m.defaultUnitCost) cur.defaultUnitCost = Number(m.defaultUnitCost);
      map.set(key, cur);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) =>
    a.materialName.localeCompare(b.materialName, "ja")
  );

  return { slots, rows };
}

export default function CraftProfitPage() {
  const [setId, setSetId] = useState(SETS[0]?.id || "");
  const selectedSet = useMemo(() => SETS.find((s) => s.id === setId) || SETS[0], [setId]);

  const [salePrice, setSalePrice] = useState(0);
  const [feeRate, setFeeRate] = useState(DEFAULT_FEE_RATE);

  const [needleId, setNeedleId] = useState("none");

  const { slots, rows } = useMemo(() => buildMatrix(selectedSet), [selectedSet]);

  const [unitCostMap, setUnitCostMap] = useState(() => {
    const init = {};
    const s = SETS.find((x) => x.id === setId) || SETS[0];
    const { rows: r } = buildMatrix(s);
    for (const row of r) init[row.materialName] = row.defaultUnitCost || 0;
    return init;
  });

  const onChangeSet = (nextId) => {
    setSetId(nextId);
    const nextSet = SETS.find((s) => s.id === nextId) || SETS[0];
    const { rows: nextRows } = buildMatrix(nextSet);
    const nextMap = {};
    for (const row of nextRows) nextMap[row.materialName] = row.defaultUnitCost || 0;
    setUnitCostMap(nextMap);
    if (nextSet?.craftType !== "裁縫") setNeedleId("none");
  };

  const updateUnitCost = (materialName, value) => {
    setUnitCostMap((prev) => ({ ...prev, [materialName]: Number(value) }));
  };

  // 各素材行の金額
  const rowAmount = (r) => clamp0(r.totalQty) * clamp0(unitCostMap[r.materialName] ?? 0);

  // 素材原価合計
  const materialCost = useMemo(() => {
    return rows.reduce((sum, r) => sum + rowAmount(r), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, unitCostMap]);

  // 部位別：合計個数 / 合計金額
  const slotTotals = useMemo(() => {
    const qty = {};
    const amount = {};
    for (const slot of slots) {
      qty[slot] = 0;
      amount[slot] = 0;
    }
    for (const r of rows) {
      const unit = clamp0(unitCostMap[r.materialName] ?? 0);
      for (const slot of slots) {
        const q = Number(r.perSlotQty[slot] || 0);
        qty[slot] += q;
        amount[slot] += q * unit;
      }
    }
    return { qty, amount };
  }, [rows, slots, unitCostMap]);

  const needleCostPerCraft = useMemo(() => {
    if (selectedSet?.craftType !== "裁縫") return 0;
    const needle = NEEDLES.find((n) => n.id === needleId) || NEEDLES[0];
    return clamp0(needle.price) / TOOL_USES;
  }, [selectedSet, needleId]);

  const totalCost = useMemo(() => materialCost + needleCostPerCraft, [materialCost, needleCostPerCraft]);

  const fee = useMemo(() => clamp0(salePrice) * clamp0(feeRate), [salePrice, feeRate]);
  const netSale = useMemo(() => clamp0(salePrice) - fee, [salePrice, fee]);
  const profit = useMemo(() => netSale - totalCost, [netSale, totalCost]);

  const profitBadge = (v) => {
    if (v > 0) return "text-emerald-600";
    if (v < 0) return "text-rose-600";
    return "text-slate-700";
  };

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">職人利益計算</h1>
        <p className="text-sm text-slate-600">
          素材単価・売値は手入力。セットはプルダウンで切替。
        </p>
      </header>

      {/* セット選択 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-[260px] flex-1">
            <label className="text-xs text-slate-500">装備セット</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={setId}
              onChange={(e) => onChangeSet(e.target.value)}
            >
              {SETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[260px]">
            <div className="text-xs text-slate-500">職種</div>
            <div className="mt-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm font-semibold">{selectedSet?.craftType || "—"}</span>
              {selectedSet?.craftType === "裁縫" && (
                <span className="text-[11px] text-slate-500">針コスト反映あり</span>
              )}
            </div>
          </div>

          {selectedSet?.craftType === "裁縫" && (
            <div className="min-w-[260px] flex-1">
              <label className="text-xs text-slate-500">使用する針（道具は30回）</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
                value={needleId}
                onChange={(e) => setNeedleId(e.target.value)}
              >
                {NEEDLES.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}（{yen(n.price)}G）
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-500">
                針コスト/1回：<span className="font-semibold text-slate-700">{yen(needleCostPerCraft)} G</span>
                （= 針代 ÷ 30）
              </div>
            </div>
          )}
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">素材原価</div>
            <div className="mt-1 text-lg font-bold">{yen(materialCost)} G</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">道具コスト</div>
            <div className="mt-1 text-lg font-bold">{yen(needleCostPerCraft)} G</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">合計原価</div>
            <div className="mt-1 text-lg font-bold">{yen(totalCost)} G</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">現在の利益</div>
            <div className={`mt-1 text-lg font-bold ${profitBadge(profit)}`}>
              {yen(Math.abs(profit))} G {profit > 0 ? "＋" : profit < 0 ? "−" : ""}
            </div>
          </div>
        </div>
      </section>

      {/* 必要素材（マトリクス表） */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">必要素材</h2>
          <p className="text-sm text-slate-600">
            単価を入れると金額が自動計算される（表は横スクロール可）
          </p>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 border-b border-slate-200 sticky left-0 z-20 bg-slate-50">
                  素材
                </th>
                {slots.map((slot) => (
                  <th key={slot} className="text-right p-3 border-b border-slate-200 whitespace-nowrap">
                    {slot}
                  </th>
                ))}
                <th className="text-right p-3 border-b border-slate-200 whitespace-nowrap">合計</th>
                <th className="text-right p-3 border-b border-slate-200 whitespace-nowrap">単価(G)</th>
                <th className="text-right p-3 border-b border-slate-200 whitespace-nowrap">金額(G)</th>
              </tr>
            </thead>

            <tbody>
              {rows.length ? (
                rows.map((r, idx) => {
                  const unit = clamp0(unitCostMap[r.materialName] ?? 0);
                  const amount = clamp0(r.totalQty) * unit;

                  return (
                    <tr
                      key={r.materialName}
                      className={`border-b border-slate-100 hover:bg-slate-50/60 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                      }`}
                    >
                      <td className="p-3 whitespace-nowrap sticky left-0 z-10 bg-inherit">
                        <span className="font-medium text-slate-900">{r.materialName}</span>
                      </td>

                      {slots.map((slot) => (
                        <td key={slot} className="p-3 text-right tabular-nums text-slate-700">
                          {r.perSlotQty[slot] ? r.perSlotQty[slot] : ""}
                        </td>
                      ))}

                      <td className="p-3 text-right font-semibold tabular-nums text-slate-900">
                        {r.totalQty}
                      </td>

                      <td className="p-3 text-right">
                        <input
                          type="number"
                          inputMode="numeric"
                          className="w-28 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-slate-200"
                          value={unitCostMap[r.materialName] ?? 0}
                          min={0}
                          onChange={(e) => updateUnitCost(r.materialName, e.target.value)}
                        />
                      </td>

                      <td className="p-3 text-right font-semibold tabular-nums text-slate-900">
                        {yen(amount)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={slots.length + 4}>
                    このセットのレシピが空だ。data/recipes.js に items を追加してくれ。
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="bg-slate-50">
              {/* 合計個数 */}
              <tr>
                <td className="p-3 font-semibold sticky left-0 z-10 bg-slate-50 border-t border-slate-200">
                  合計（個数）
                </td>
                {slots.map((slot) => (
                  <td key={slot} className="p-3 text-right font-semibold tabular-nums border-t border-slate-200">
                    {slotTotals.qty[slot] || ""}
                  </td>
                ))}
                <td className="p-3 text-right font-semibold tabular-nums border-t border-slate-200">
                  {rows.reduce((sum, r) => sum + r.totalQty, 0)}
                </td>
                <td className="p-3 text-right border-t border-slate-200">—</td>
                <td className="p-3 text-right font-semibold border-t border-slate-200">
                  {yen(materialCost)}
                </td>
              </tr>

              {/* ★部位別 合計金額（G） */}
              <tr>
                <td className="p-3 font-semibold sticky left-0 z-10 bg-slate-50 border-t border-slate-200">
                  合計（部位別金額 / G）
                </td>
                {slots.map((slot) => (
                  <td key={slot} className="p-3 text-right font-semibold tabular-nums border-t border-slate-200">
                    {slotTotals.amount[slot] ? yen(slotTotals.amount[slot]) : ""}
                  </td>
                ))}
                <td className="p-3 text-right font-semibold tabular-nums border-t border-slate-200">
                  {yen(materialCost)}
                </td>
                <td className="p-3 text-right border-t border-slate-200">—</td>
                <td className="p-3 text-right font-semibold border-t border-slate-200">
                  {yen(materialCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 利益 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">利益計算（売却）</h2>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6">
            <label className="text-xs text-slate-500">売値（出品価格 / G）</label>
            <input
              type="number"
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={salePrice}
              min={0}
              onChange={(e) => setSalePrice(Number(e.target.value))}
            />
          </div>

          <div className="col-span-6">
            <label className="text-xs text-slate-500">手数料率（例: 0.05 = 5%）</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={feeRate}
              min={0}
              onChange={(e) => setFeeRate(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">手数料</div>
            <div className="mt-1 font-semibold">{yen(fee)} G</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">手取り</div>
            <div className="mt-1 font-semibold">{yen(netSale)} G</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">原価</div>
            <div className="mt-1 font-semibold">{yen(totalCost)} G</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">利益</div>
            <div className={`mt-1 font-bold ${profitBadge(profit)}`}>
              {yen(Math.abs(profit))} G {profit > 0 ? "＋" : profit < 0 ? "−" : ""}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          ※ 裁縫の場合、針代 ÷ 30 を1回あたり原価に加算。
        </p>
      </section>
    </main>
  );
}
