import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

function App() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ URL dinámica para desarrollo y producción
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : 'https://mysql-production-e60d.up.railway.app';

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      // ✅ Usa la URL dinámica
      const response = await fetch(`${API_BASE_URL}/api/registros/analizar_csv/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Error al analizar el archivo');
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Colores para gráficos
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>📊 Dashboard de Inteligencia de Negocios</h1>
      
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload}
        style={{ margin: '20px 0' }}
      />
      
      {loading && <p>⏳ Analizando archivo...</p>}
      {error && <p style={{ color: 'red' }}>❌ Error: {error}</p>}
      
      {stats && (
        <div>
          <h2>📈 Estadísticas Generales</h2>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={cardStyle}>
              <h3>📋 {stats.estadisticas_generales.total_filas} Filas</h3>
            </div>
            <div style={cardStyle}>
              <h3>🏷️ {stats.estadisticas_generales.total_columnas} Columnas</h3>
            </div>
            <div style={cardStyle}>
              <h3>⚠️ {stats.estadisticas_generales.nulos_totales} Nulos</h3>
            </div>
            <div style={cardStyle}>
              <h3>🔁 {stats.estadisticas_generales.duplicados_totales} Duplicados</h3>
            </div>
          </div>

          <h2>📊 Valores Nulos por Columna</h2>
          <BarChart width={600} height={300} data={stats.graficos.nombres_columnas.map((name, i) => ({
            name,
            nulos: stats.graficos.nulos_por_columna[i]
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="nulos" fill="#8884d8" />
          </BarChart>

          <h2>🎨 Distribución de Tipos de Datos</h2>
          <PieChart width={400} height={300}>
            <Pie
              data={Object.entries(
                stats.graficos.distribucion_tipos.reduce((acc, tipo) => {
                  acc[tipo] = (acc[tipo] || 0) + 1;
                  return acc;
                }, {})
              ).map(([name, value]) => ({ name, value }))}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label
            >
              {Object.entries(
                stats.graficos.distribucion_tipos.reduce((acc, tipo) => {
                  acc[tipo] = (acc[tipo] || 0) + 1;
                  return acc;
                }, {})
              ).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>

          <h2>📋 Detalles por Columna</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {stats.por_columna.map((col, index) => (
              <div key={index} style={{...cardStyle, textAlign: 'left'}}>
                <h3>{col.nombre}</h3>
                <p><strong>Tipo:</strong> {col.tipo}</p>
                <p><strong>Valores nulos:</strong> {col.nulos}</p>
                <p><strong>Valores únicos:</strong> {col.unicos}</p>
                <p><strong>Valores duplicados:</strong> {col.duplicados}</p>
                <p><strong>Ejemplos:</strong> {col.ejemplos.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: '#f5f5f5',
  padding: '15px',
  borderRadius: '8px',
  textAlign: 'center',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

export default App;