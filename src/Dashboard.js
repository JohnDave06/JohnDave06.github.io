import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import Papa from "papaparse";

function summarizeNulls(rows, columns) {
  const res = columns.map((col) => {
    let nulls = 0;
    for (const r of rows) {
      const v = r[col];
      if (v === null || v === undefined || v === "" || (typeof v === 'number' && Number.isNaN(v))) nulls++;
    }
    const percent = rows.length === 0 ? 0 : (nulls / rows.length) * 100;
    return { column: col, nulls, percent };
  });
  return res;
}

function summarizeDistinct(rows, columns) {
  const res = columns.map((col) => {
    const set = new Set();
    for (const r of rows) set.add(String(r[col]));
    return { column: col, distinct: set.size };
  });
  return res;
}

function summarizeDuplicates(rows) {
  const seen = new Set();
  let dup = 0;
  for (const r of rows) {
    // stable stringify of values in order
    const s = JSON.stringify(r);
    if (seen.has(s)) dup++;
    else seen.add(s);
  }
  return { duplicates_rows: dup, total_rows: rows.length };
}

function detectColumnTypes(rows, columns) {
  // simple heuristic: numeric if all non-empty values are numbers; date if parseable as Date for many values
  const types = {};
  for (const c of columns) types[c] = "unknown";
  for (const c of columns) {
    let numCount = 0;
    let dateCount = 0;
    let totalNonEmpty = 0;
    for (const r of rows) {
      const v = r[c];
      if (v === null || v === undefined || v === "") continue;
      totalNonEmpty++;
      if (typeof v === 'number' && !Number.isNaN(v)) numCount++;
      else {
        // try parse number
        const n = Number(v);
        if (!Number.isNaN(n)) numCount++;
        else {
          const d = Date.parse(String(v));
          if (!Number.isNaN(d)) dateCount++;
        }
      }
    }
    if (totalNonEmpty === 0) types[c] = 'empty';
    else if (numCount / totalNonEmpty > 0.9) types[c] = 'numeric';
    else if (dateCount / totalNonEmpty > 0.8) types[c] = 'date';
    else types[c] = 'string';
  }
  return types;
}

function makeHistogramData(rows, column, bins = 12) {
  const values = [];
  for (const r of rows) {
    const v = r[column];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) values.push(n);
  }
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const binsArr = Array.from({ length: bins }, (_, i) => ({ bin: i, x0: min + i * width, x1: min + (i + 1) * width, count: 0 }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    binsArr[idx].count += 1;
  }
  // format for recharts
  return binsArr.map(b => ({ name: `${b.x0.toFixed(2)}–${b.x1.toFixed(2)}`, count: b.count }));
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [fileName, setFileName] = useState("");
  const [selectedNumeric, setSelectedNumeric] = useState("");

  const nulls = useMemo(() => summarizeNulls(rows, columns), [rows, columns]);
  const distinct = useMemo(() => summarizeDistinct(rows, columns), [rows, columns]);
  const dupInfo = useMemo(() => summarizeDuplicates(rows), [rows]);
  const types = useMemo(() => detectColumnTypes(rows, columns), [rows, columns]);
  const numericColumns = useMemo(() => Object.keys(types).filter(c => types[c] === 'numeric'), [types]);
  const histogram = useMemo(() => (selectedNumeric ? makeHistogramData(rows, selectedNumeric, 16) : []), [rows, selectedNumeric]);

  // prepare sorted and colored versions
  const nullsPrepared = useMemo(() => {
    return [...nulls].sort((a, b) => b.percent - a.percent).map(n => {
      const p = n.percent;
      let color = '#82ca9d';
      if (p >= 30) color = '#d9534f';
      else if (p >= 10) color = '#f0ad4e';
      return { ...n, color };
    });
  }, [nulls, rows]);

  const distinctPrepared = useMemo(() => [...distinct].sort((a, b) => b.distinct - a.distinct), [distinct]);

  const onUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data || [];
        // Normalize columns order
        const cols = results.meta && results.meta.fields ? results.meta.fields : (data[0] ? Object.keys(data[0]) : []);
        setColumns(cols);
        setRows(data);
      },
      error: (err) => {
        console.error("Error parseando CSV", err);
        alert("Error parseando CSV: " + err.message);
      },
    });
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Data Quality Dashboard (Client-side)</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <label style={{ padding: 8, border: "1px solid #ccc", cursor: "pointer" }}>
          Subir CSV (se procesa en el navegador)
          <input type="file" accept=".csv" style={{ display: "none" }} onChange={onUpload} />
        </label>
        <div style={{ marginLeft: 8 }}>{fileName ? `Archivo: ${fileName} (${rows.length} filas)` : "Ningún archivo cargado"}</div>
      </div>

      <section style={{ marginTop: 12 }}>
        <h2>Resumen rápido (KPIs)</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ padding: 12, border: '1px solid #ddd', minWidth: 160 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Filas totales</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{rows.length}</div>
          </div>
          <div style={{ padding: 12, border: '1px solid #ddd', minWidth: 160 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Filas duplicadas</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{dupInfo.duplicates_rows} ({rows.length ? ((dupInfo.duplicates_rows/rows.length)*100).toFixed(1) : '0'}%)</div>
          </div>
          <div style={{ padding: 12, border: '1px solid #ddd', minWidth: 160 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Columnas con &gt;=30% nulos</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{nulls.filter(n=>n.percent>=30).length}</div>
          </div>
          <div style={{ padding: 12, border: '1px solid #ddd', minWidth: 160 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Columnas numéricas</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{numericColumns.length}</div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <h2>Valores nulos por columna</h2>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={nullsPrepared} margin={{ right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="column" angle={-30} textAnchor="end" interval={0} height={80} />
              <YAxis />
              <Tooltip formatter={(value, name, props) => {
                if (name === 'nulls') return [value, 'Nulls'];
                if (name === 'percent') return [value.toFixed(1)+'%', 'Percent'];
                return [value, name];
              }} />
              <Bar dataKey="nulls">
                {nullsPrepared.map((entry) => (
                  <Cell key={`cell-${entry.column}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Valores distintos por columna</h2>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={distinctPrepared}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="column" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="distinct" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {numericColumns.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Histograma de columna numérica</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label>
              Seleccionar columna:&nbsp;
              <select value={selectedNumeric} onChange={e => setSelectedNumeric(e.target.value)}>
                <option value="">-- seleccionar --</option>
                {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <div style={{ color: '#666' }}>{selectedNumeric ? `Muestras válidas: ${histogram.reduce((s,i)=>s+i.count,0)}` : ''}</div>
          </div>

          {selectedNumeric && (
            <div style={{ width: '100%', height: 260, marginTop: 12 }}>
              <ResponsiveContainer>
                <BarChart data={histogram}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} angle={-30} height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Filas duplicadas</h2>
        <p>
          Duplicadas: <b>{dupInfo.duplicates_rows}</b> / Total: <b>{dupInfo.total_rows}</b>
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Vista de datos (primeras 10 filas)</h2>
        <div style={{ overflowX: "auto", border: "1px solid #eee", padding: 8 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} style={{ border: "1px solid #ddd", padding: 6, background: "#fafafa" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c} style={{ border: "1px solid #eee", padding: 6 }}>{String(r[c] === undefined ? "" : r[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
