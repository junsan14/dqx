"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";

/**
 * Material Cost CSV Editor
 * - Reads:  /public/data/material_costs.csv  (served at /data/material_costs.csv)
 * - Writes: /public/data/material_costs.csv via POST /api/save-material-costs
 *
 * CSV columns: name, unitCost, aliasTo, note
 */

const DEFAULT_HEADERS = ["name", "unitCost", "aliasTo", "note"];

function str(v) {
  return v == null ? "" : String(v);
}

function normalizeRow(row) {
  return {
    __key: crypto?.randomUUID ? crypto.randomUUID() : `k_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: str(row?.name).trim(),
    unitCost: str(row?.unitCost).trim(),
    aliasTo: str(row?.aliasTo).trim(),
    note: str(row?.note).trim(),
  };
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

export default function MaterialCostsPage() {
  const fileRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    const base = rows.slice().sort((a, b) => a.name.localeCompare(b.name, "ja"));
    if (!q) return base;
    return base.filter((r) => r.name.includes(q));
  }, [rows, query]);

  // Load from /data/material_costs.csv
  useEffect(() => {
    fetch(`/data/material_costs.csv?v=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.text())
      .then((text) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const data = (res.data || []).map(normalizeRow);
            setRows(data);
          },
        });
      })
      .catch((e) => console.warn(e));
  }, []);

  function handleUpload(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data || []).map(normalizeRow);
        setRows(data);
      },
      error: (err) => alert(err.message),
    });
  }

  function addRow() {
    setRows((prev) => [
      {
        __key: crypto?.randomUUID ? crypto.randomUUID() : `k_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: "",
        unitCost: "",
        aliasTo: "",
        note: "",
      },
      ...prev,
    ]);
  }

  function updateRow(key, patch) {
    setRows((prev) => prev.map((r) => (r.__key === key ? { ...r, ...patch } : r)));
  }

  function deleteRow(key) {
    setRows((prev) => prev.filter((r) => r.__key !== key));
  }

  function toCsvText(list) {
    // Strip __key, enforce headers
    const data = list.map((r) => ({
      name: str(r.name).trim(),
      unitCost: str(r.unitCost).trim(),
      aliasTo: str(r.aliasTo).trim(),
      note: str(r.note).trim(),
    }));
    return Papa.unparse(data, { columns: DEFAULT_HEADERS });
  }

  async function saveToPublic() {
    const csv = toCsvText(rows);

    const res = await fetch("/api/save-material-costs", {
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

    alert("saved: /public/data/material_costs.csv");
  }

  function exportCsv() {
    downloadText("material_costs.csv", toCsvText(rows));
  }

  return (
    <div style={page}>
      <h1 style={{ margin: 0, fontSize: 22 }}>素材単価 CSV エディタ</h1>

      <div style={toolbar}>
        <button onClick={addRow}>＋行追加</button>
        <button onClick={saveToPublic} disabled={rows.length === 0}>/data に保存（上書き）</button>
        <button onClick={exportCsv} disabled={rows.length === 0}>CSV書き出し</button>

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

        <input
          placeholder="検索（素材名）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...input, marginLeft: "auto", width: 280 }}
        />
      </div>

      <div style={card}>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          aliasTo は「この素材名は別名に寄せる」用（表記ゆれ対策）。unitCost は数値。
        </div>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>素材名 (name)</th>
              <th style={th}>単価 (unitCost)</th>
              <th style={th}>aliasTo</th>
              <th style={th}>note</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.__key}>
                <td style={td}>
                  <input
                    value={r.name}
                    onChange={(e) => updateRow(r.__key, { name: e.target.value })}
                    style={cellInputWide}
                    placeholder="例: マゴニア草"
                  />
                </td>
                <td style={td}>
                  <input
                    type="number"
                    min={0}
                    value={r.unitCost}
                    onChange={(e) => updateRow(r.__key, { unitCost: e.target.value })}
                    style={cellInput}
                    placeholder="例: 1000"
                  />
                </td>
                <td style={td}>
                  <input
                    value={r.aliasTo}
                    onChange={(e) => updateRow(r.__key, { aliasTo: e.target.value })}
                    style={cellInputWide}
                    placeholder="例: ようせいのひだね"
                  />
                </td>
                <td style={td}>
                  <input
                    value={r.note}
                    onChange={(e) => updateRow(r.__key, { note: e.target.value })}
                    style={cellInputWide}
                    placeholder="任意"
                  />
                </td>
                <td style={td}>
                  <button onClick={() => deleteRow(r.__key)}>削除</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td style={td} colSpan={5}>
                  <span style={{ color: "#94a3b8" }}>該当なし</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ color: "#64748b", fontSize: 12 }}>
        反映するには（生成JSを使う場合）ローカルで script を実行：<code>node scripts/material-costs-csv-to-js.mjs</code>
      </div>
    </div>
  );
}

const page = { padding: 18, display: "grid", gap: 12, maxWidth: 1200 };
const toolbar = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const card = { padding: 12, border: "1px solid #e2e8f0", borderRadius: 12 };
const input = { padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" };

const tableWrap = { border: "1px solid #e2e8f0", borderRadius: 12, overflow: "auto" };
const table = { borderCollapse: "collapse", width: "100%" };
const th = { background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: 10, textAlign: "left", fontSize: 12, color: "#475569" };
const td = { borderBottom: "1px solid #f1f5f9", padding: 8, verticalAlign: "top" };
const cellInput = { width: 140, padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" };
const cellInputWide = { width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" };