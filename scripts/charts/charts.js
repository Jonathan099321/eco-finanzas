// scripts/charts/charts.js
// Renderiza la dona y las barras con Chart.js.
// Se encarga de destruir instancias previas y devuelve { pie, bars }.

export function renderCharts(cats, totals) {
  const pieCanvas  = document.getElementById('pie');
  const barsCanvas = document.getElementById('bars');

  // Si no hay canvas o Chart.js aún no está cargado, no hacemos nada
  if (!pieCanvas || !barsCanvas || !window.Chart) {
    return { pie: null, bars: null };
  }

  const pieCtx  = pieCanvas.getContext('2d');
  const barsCtx = barsCanvas.getContext('2d');

  // Destruir instancias anteriores si existen
  if (window._ecoCharts?.pie)  { try { window._ecoCharts.pie.destroy();  } catch (e) {} }
  if (window._ecoCharts?.bars) { try { window._ecoCharts.bars.destroy(); } catch (e) {} }

  // ===== Pie/Dona: categorías con valor > 0 (ordenadas desc por valor)
  const entries = Object.entries(cats)
    .map(([k, v]) => [k, Number(v) || 0])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const pieLabels = entries.map(([k]) => k);
  const pieData   = entries.map(([, v]) => v);

  const pie = new window.Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData
        // Sin colores forzados: Chart.js asigna una paleta por defecto
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%', // dona más limpia
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = Number(ctx.parsed);
              return `${ctx.label}: ${fmt(v)}`;
            }
          }
        }
      }
    }
  });

  // ===== Barras: Ingresos vs Gastos vs Libre
  const ingresos = Number(totals?.ingresos || 0);
  const gastos   = Number(totals?.gastos   || 0);
  const libre    = Number(totals?.libre    || 0);

  const bars = new window.Chart(barsCtx, {
    type: 'bar',
    data: {
      labels: ['Ingresos', 'Gastos', 'Libre'],
      datasets: [{
        label: 'Mensual',
        data: [ingresos, gastos, libre]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = Number(ctx.parsed.y);
              return fmt(v);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) { return fmt(value); }
          }
        }
      }
    }
  });

  // Guardar referencias globales para el próximo destroy
  window._ecoCharts = { pie, bars };
  return window._ecoCharts;
}

// ===== Helpers locales =====
function fmt(n) {
  return '$' + Number(n).toLocaleString();
}
