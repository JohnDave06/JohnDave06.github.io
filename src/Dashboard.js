import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const API_BASE = process.env.REACT_APP_API || "http://127.0.0.1:8000/api";

export default function Dashboard() {
  const [table, setTable] = useState("dataset");
  const [nulls, setNulls] = useState([]);
  const [distinct, setDistinct] = useState([]);
  const [dupInfo, setDupInfo] = useState({duplicates_rows:0,total_rows:0});
  const [uploading, setUploading] = useState(false);

  const loadAll = async (t = table) => {
    try {
      const [nRes, dRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/nulls/?table=${encodeURIComponent(t)}`),
        fetch(`${API_BASE}/distinct/?table=${encodeURIComponent(t)}`),
        fetch(`${API_BASE}/duplicates/?table=${encodeURIComponent(t)}`),
      ]);
      const n = await nRes.json();
      const d = await dRes.json();
      const r = await rRes.json();
      setNulls(n.nulls || []);
      setDistinct(d.distinct || []);
      setDupInfo({ duplicates_rows: r.duplicates_rows || 0, total_rows: r.total_rows || 0 });
    } catch (err) {
      console.error("Error cargando métricas", err);
    }
  };

  useEffect(()=>{ loadAll(); /* eslint-disable-next-line */ },[]);

  const onUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/upload-csv/?table=${encodeURIComponent(table)}`, { method: "POST", body: form });
      const j = await res.json();
      if (j.error) alert("Error: "+j.error);
      else {
        alert(`Tabla ${j.table} subida (${j.rows} filas).`);
        loadAll(table);
      }
    } catch (err) {
      alert("Error subiendo CSV: "+err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Data Quality Dashboard</h1>

      <div style={{ display:"flex", gap:12, marginBottom:12, alignItems:"center" }}>
        <label>
          Tabla:&nbsp;
          <input value={table} onChange={e=>setTable(e.target.value)} placeholder="nombre_tabla" />
        </label>
        <label style={{ padding:8, border:"1px solid #ccc", cursor:"pointer" }}>
          {uploading ? "Cargando..." : "Subir CSV (reemplaza tabla)"}
          <input type="file" accept=".csv" style={{ display:"none" }} onChange={onUpload} />
        </label>
        <button onClick={()=>loadAll()}>Refrescar</button>
      </div>

      <section style={{ marginTop: 12 }}>
        <h2>Valores nulos por columna</h2>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={nulls}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="column" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="nulls" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Valores distintos por columna</h2>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={distinct}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="column" angle={-30} textAnchor="end" interval={0} height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="distinct" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Filas duplicadas</h2>
        <p>Duplicadas: <b>{dupInfo.duplicates_rows}</b> / Total: <b>{dupInfo.total_rows}</b></p>
      </section>
    </div>
  );
}
