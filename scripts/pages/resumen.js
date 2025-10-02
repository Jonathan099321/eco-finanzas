// scripts/pages/resumen.js
// Resumen: totales, alertas, metas, exportaciones y gastos diarios/imprevistos (claves por usuario, a prueba de doble namespace)

import { KEYS, CATS, LIMITS } from '../data/constants.js';
import { get, set } from '../data/storage.js';
import { armarCategorias, totales } from '../data/calc.js';
import { money } from '../ui/format.js';
import { renderCharts } from '../charts/charts.js';


/* ============ Guardia de sesión ============ */
(function guard(){
  const SESSION_KEY = 'eco_current_user';
  try {
    const ses = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!ses || !ses.email) {
      window.location.href = 'login.html';
    }
  } catch {
    window.location.href = 'login.html';
  }
})();

/* ============ Helpers sesión / claves ============ */
function getSessionEmail(){
  try {
    const ses = JSON.parse(localStorage.getItem('eco_current_user')||'null');
    return ses?.email?.toLowerCase() || null;
  } catch { return null; }
}
const SESSION_EMAIL = getSessionEmail();

/**
 * Si la clave YA viene namespaced (contiene __), la devuelve igual.
 * Si no, y hay sesión, agrega __correo. Si no hay sesión, deja base.
 */
function ensureScoped(baseKey){
  if (!baseKey) return baseKey;
  if (baseKey.includes('__')) return baseKey; // ya está namespaced (por shim/adaptador)
  if (SESSION_EMAIL) return `${baseKey}__${SESSION_EMAIL}`;
  return baseKey;
}

// Claves base (podrían venir ya namespaced si usas adaptador)
const BASE_GOALS_KEY    = KEYS.GOALS   || 'eco_goals_v1';
const BASE_DAILIES_KEY  = KEYS.DAILIES || 'eco_dailies_v1';

// Claves efectivas (a prueba de doble namespace)
const GOALS_KEY   = ensureScoped(BASE_GOALS_KEY);
const DAILIES_KEY = ensureScoped(BASE_DAILIES_KEY);

/* ============ Migración 1 vez (solo si la base NO está namespaced) ============ */
(function migrateGoalsOnce(){
  try {
    if (!SESSION_EMAIL) return;
    // si BASE_GOALS_KEY ya viene con __, asumimos que otro script hizo la migración
    if (BASE_GOALS_KEY.includes('__')) return;

    const legacy = localStorage.getItem(BASE_GOALS_KEY); // global viejo
    const scoped = localStorage.getItem(GOALS_KEY);      // por usuario
    if (legacy && !scoped) {
      localStorage.setItem(GOALS_KEY, legacy);
      localStorage.removeItem(BASE_GOALS_KEY);
    }
  } catch {}
})();

/* ============ Arranque seguro ============ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

function start(){
  // ===== Cargar datos base =====
  const data = get(KEYS.WIZARD, {}) || {};

  // Leer SIEMPRE con las claves efectivas ya “aseguradas”
  let goals   = get(GOALS_KEY, []) || [];
  let dailies = get(DAILIES_KEY, []) || []; // {id, date:'YYYY-MM-DD', desc, tag, amount:Number}

  // Gráficas
  window._ecoCharts = window._ecoCharts || { pie:null, bars:null };

  // ===== Inicial =====
  recomputeAll();

  // ===== Listeners =====
  // Metas: Calcular vs Guardar
  document.getElementById('goalBtn')?.addEventListener('click', onCalcGoal);
  document.getElementById('goalSaveBtn')?.addEventListener('click', onSaveGoal);

  document.getElementById('btnClearGoals')?.addEventListener('click', onClearGoals);
  document.getElementById('btnResetAll')?.addEventListener('click', onResetAll);

  document.getElementById('btnPngPie') ?.addEventListener('click', () => downloadCanvasPNG('pie',  'gastos_por_categoria.png'));
  document.getElementById('btnPngBars')?.addEventListener('click', () => downloadCanvasPNG('bars', 'ingresos_gastos_libre.png'));
  document.getElementById('btnJson')   ?.addEventListener('click', downloadJSON);
  document.getElementById('btnPdf')    ?.addEventListener('click', exportPDF);

  // Gastos diarios / imprevistos
  document.getElementById('addDailyBtn')?.addEventListener('click', (e) => {
    e.preventDefault();

    const dateRaw = document.getElementById('dailyDate')?.value;
    const date    = (dateRaw && dateRaw.trim()) ? dateRaw : new Date().toISOString().slice(0,10);
    const desc    = (document.getElementById('dailyDesc')?.value || '').trim();
    const tag     = (document.getElementById('dailyTag')?.value  || '').trim();
    const amount  = Number(document.getElementById('dailyAmount')?.value || 0);

    if (!(amount > 0)) { alert('Ingresa un monto válido (> 0).'); return; }

    const item = { id: uid(), date, desc, tag, amount };
    dailies = [item, ...dailies];
    set(DAILIES_KEY, dailies);

    // limpiar inputs
    ['dailyAmount','dailyDesc','dailyTag'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.value = '';
    });

    recomputeAll();
    requestAnimationFrame(()=> recomputeAll());
  });

  document.getElementById('clearDailiesBtn')?.addEventListener('click', () => {
    if (!dailies.length) return;
    if (!confirm('¿Borrar todo el historial de gastos diarios del mes actual?')) return;
    const now = new Date();
    dailies = dailies.filter(x => !isSameMonth(x.date, now));
    set(DAILIES_KEY, dailies);
    recomputeAll();
  });

  // ========================================================
  // Recalcula categorías, totales y refresca UI
  // ========================================================
  function recomputeAll() {
    const baseCats = armarCategorias(data);

    const now = new Date();
    const monthItems = dailies.filter(x => isSameMonth(x.date, now));
    const otherItems = dailies.filter(x => !isSameMonth(x.date, now));

    const sumImp = monthItems.reduce((a,b)=> a + Number(b.amount||0), 0);
    const cats = { ...baseCats, [CATS.imprevistos]: sumImp };

    const t = totales(data, cats);

    setText('v_ingresos', money(t.ingresos));
    setText('v_gastos',   money(t.gastos));
    setText('v_libre',    money(t.libre));

    renderCats(cats, t.ingresos);
    try { window._ecoCharts = renderCharts(cats, t); } catch (e) { console.warn('charts error:', e); }

    try { renderAlerts(cats, t.ingresos); } catch (e) { console.warn('alerts error:', e); }

    // ← recargar metas DESDE storage usando la clave efectiva
    goals = get(GOALS_KEY, []) || [];
    renderGoals(goals);

    renderDailies(monthItems, 'dailiesList', 'dailiesEmpty', 'dailiesTotal');

    const nextBlock = document.getElementById('nextBlock');
    if (otherItems.length) {
      if (nextBlock) nextBlock.style.display = '';
      renderDailiesGrouped(otherItems, 'dailiesNextList', 'dailiesNextEmpty', 'dailiesTotalNext');
    } else {
      if (nextBlock) nextBlock.style.display = 'none';
    }
  }

  /* =======================
     Metas
     ======================= */
  function onCalcGoal(){
    const name   = (val('goalName')   || 'Meta').trim();
    const amount = Number(val('goalAmount') || 0);
    const date   = val('goalDate');

    if (!amount || !date) { alert('Completa monto y fecha de la meta'); return; }

    const months  = Math.max(1, diffInMonths(new Date(), new Date(date)));
    const monthly = amount / months;

    setText('goalMonthly', money(monthly));
    setText('goalAdvice', monthly <= readLibre()
      ? 'Vas bien: tu dinero libre cubre el aporte sugerido.'
      : 'Te falta margen: ajusta gastos o extiende la fecha.'
    );

    const saveBtn = document.getElementById('goalSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.dataset.tmpName = name;
      saveBtn.dataset.tmpAmount = String(amount);
      saveBtn.dataset.tmpDate = date;
      saveBtn.dataset.tmpMonthly = String(monthly);
      saveBtn.dataset.tmpMonths = String(months);
      saveBtn.dataset.tmpAdvice = (document.getElementById('goalAdvice')?.textContent || '').trim();
    }
  }

  function onSaveGoal(){
    const btn = document.getElementById('goalSaveBtn');
    const name    = btn?.dataset.tmpName     || (val('goalName')||'Meta').trim();
    const amount  = Number(btn?.dataset.tmpAmount || val('goalAmount') || 0);
    const date    = btn?.dataset.tmpDate     || val('goalDate');
    const monthly = Number(btn?.dataset.tmpMonthly || 0);
    const months  = Number(btn?.dataset.tmpMonths  || 1);
    const advice  = btn?.dataset.tmpAdvice   || (document.getElementById('goalAdvice')?.textContent || '').trim();

    if (!amount || !date) { alert('Primero presiona “Calcular”.'); return; }

    const newGoal = { id: uid(), name, amount, date, months, monthly, advice };
    goals = [newGoal, ...goals];
    set(GOALS_KEY, goals);   // ← guarda con clave efectiva
    renderGoals(goals);
    resetGoalForm();
  }

  function onClearGoals(){
    if(!goals.length) return;
    if(!confirm('¿Borrar todas las metas?')) return;
    goals = [];
    set(GOALS_KEY, goals);
    renderGoals(goals);
    resetGoalForm();
  }

  function resetGoalForm(){
    ['goalName','goalAmount','goalDate'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    setText('goalMonthly','—');
    setText('goalAdvice','—');
    const saveBtn = document.getElementById('goalSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      ['tmpName','tmpAmount','tmpDate','tmpMonthly','tmpMonths','tmpAdvice'].forEach(k=> delete saveBtn.dataset[k]);
    }
  }

  function onResetAll(){
    if(!confirm('¿Borrar datos del cuestionario, metas y gastos diarios SOLO de este usuario?')) return;
    try {
      localStorage.removeItem(ensureScoped(KEYS.WIZARD || 'eco_wizard_v5'));
      localStorage.removeItem(GOALS_KEY);
      localStorage.removeItem(DAILIES_KEY);
    } catch {}
    alert('Datos borrados para este usuario. Vuelve a completar el cuestionario.');
    location.href = 'wizard.html';
  }

  /* =======================
     Renders UI
     ======================= */
  function renderCats(obj, ingreso){
    const kv = document.getElementById('catsKV');
    if(!kv){
      console.warn('No se encontró #catsKV en el HTML.');
      return;
    }
    kv.innerHTML = '';

    Object.entries(obj).forEach(([label, value])=>{
      const l = document.createElement('div');
      const v = document.createElement('div');

      const limite = LIMITS[label];
      let badge = '';
      if(ingreso>0 && typeof limite==='number'){
        const pct = value/ingreso;
        if(pct > limite){
          badge = ` <span class="badge-warn">alto</span>`;
          l.classList.add('warn');
        }
      }

      l.className = 'muted';
      l.innerHTML = `${label}${badge}`;
      v.textContent = money(value);

      kv.appendChild(l); kv.appendChild(v);
    });
  }

  function renderGoals(list){
    const box = document.getElementById('goalsList');
    const empty = document.getElementById('goalsEmpty');
    if(!box){ console.warn('No se encontró #goalsList'); return; }

    if(!list.length){
      if(empty) empty.style.display = 'block';
      box.innerHTML = '';
      return;
    }
    if(empty) empty.style.display = 'none';

    box.innerHTML = list.map(g => `
      <div class="goal" data-id="${g.id}" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong>${escapeHtml(g.name)}</strong>
          <button class="btn" data-del="${g.id}" style="background:#fee2e2;color:#b91c1c">Eliminar</button>
        </div>
        <div class="kv" style="margin-top:8px">
          <div class="muted">Meta</div><div>${money(g.amount)}</div>
          <div class="muted">Fecha objetivo</div><div>${g.date}</div>
          <div class="muted">Meses</div><div>${g.months}</div>
          <div class="muted">Aporte sugerido</div><div>${money(g.monthly)}</div>
          ${g.advice ? `<div class="muted">Consejo</div><div>${escapeHtml(g.advice)}</div>` : ''}
        </div>
      </div>
    `).join('');

    box.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = e.currentTarget.getAttribute('data-del');
        goals = goals.filter(g => g.id !== id);
        set(GOALS_KEY, goals);   // ← clave efectiva
        renderGoals(goals);
        resetGoalForm();
      });
    });
  }

  // Lista simple (mes actual)
  function renderDailies(list, listId, emptyId, totalId){
    const box = document.getElementById(listId);
    const empty = document.getElementById(emptyId);
    const totalEl = document.getElementById(totalId);
    if(!box) return;

    const total = list.reduce((a,b)=> a + Number(b.amount||0), 0);
    if(totalEl) totalEl.textContent = money(total);

    if(!list.length){
      if(empty) empty.style.display = 'block';
      box.innerHTML = '';
      return;
    }
    if(empty) empty.style.display = 'none';

    const sorted = [...list].sort((a,b)=> String(b.date).localeCompare(String(a.date))).reverse();
    box.innerHTML = sorted.map(item => dailyRowHTML(item)).join('');
    attachDeleteHandlers(box);
  }

  // Lista agrupada (otros meses)
  function renderDailiesGrouped(list, listId, emptyId, totalId){
    const box = document.getElementById(listId);
    const empty = document.getElementById(emptyId);
    const totalEl = document.getElementById(totalId);
    if(!box) return;

    const total = list.reduce((a,b)=> a + Number(b.amount||0), 0);
    if(totalEl) totalEl.textContent = money(total);

    if(!list.length){
      if(empty) empty.style.display = 'block';
      box.innerHTML = '';
      return;
    }
    if(empty) empty.style.display = 'none';

    const groups = groupByMonth(list);
    const months = Object.keys(groups).sort().reverse();

    box.innerHTML = months.map(key=>{
      const nice = monthLabel(key);
      const items = groups[key].sort((a,b)=> String(b.date).localeCompare(String(a.date)));
      const subtotal = items.reduce((a,b)=> a + Number(b.amount||0), 0);
      return `
        <div style="margin:10px 0 16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 2px 8px">
            <strong>${nice}</strong>
            <span class="muted">Subtotal: ${money(subtotal)}</span>
          </div>
          ${items.map(d => dailyRowHTML(d)).join('')}
        </div>
      `;
    }).join('');

    attachDeleteHandlers(box);
  }

  function dailyRowHTML(item){
    return `
    <div class="daily" data-id="${item.id}" style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <strong>${money(item.amount)}</strong>
          — ${escapeHtml(item.desc || 'Sin descripción')}
          ${item.tag ? `<span class="pill" style="margin-left:6px">${escapeHtml(item.tag)}</span>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="muted">${escapeHtml(formatDate(item.date))}</span>
          <button class="btn" data-del-daily="${item.id}" style="background:#fee2e2;color:#b91c1c">Eliminar</button>
        </div>
      </div>
    </div>`;
  }

  function attachDeleteHandlers(container){
    container.querySelectorAll('[data-del-daily]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = e.currentTarget.getAttribute('data-del-daily');
        dailies = dailies.filter(x => x.id !== id);
        set(DAILIES_KEY, dailies);   // ← clave efectiva
        recomputeAll();
        requestAnimationFrame(()=> recomputeAll());
      });
    });
  }

  /* =======================
     Alertas
     ======================= */
  function renderAlerts(categorias, ingreso){
    const alertBox = document.getElementById('alertasBox');
    const alertContent = document.getElementById('alertasContent');
    if(!alertBox || !alertContent) return;

    if(!ingreso || ingreso<=0){
      alertBox.style.display = 'none';
      return;
    }

    const violaciones = [];
    Object.entries(categorias).forEach(([label, value])=>{
      const limite = LIMITS[label];
      if(typeof limite === 'number'){
        const pct = value / ingreso;
        if(pct > limite){
          violaciones.push({
            label,
            value,
            limite: Math.round(limite*100),
            pct: Math.round(pct*100)
          });
        }
      }
    });

    if(!violaciones.length){
      alertBox.style.display = 'none';
      return;
    }

    alertBox.style.display = 'block';
    alertContent.innerHTML = `
      <strong>Revisa estas categorías:</strong>
      <ul style="margin:8px 0 0 18px">
        ${violaciones.map(v => `
          <li>
            <span class="warn">${v.label}</span>
            — gastas ${money(v.value)} (${v.pct}%) y el límite sugerido es ${v.limite}%.
          </li>
        `).join('')}
      </ul>
      <p class="muted" style="margin:10px 0 0">
        Sugerencia: recorta pequeñas fugas (suscripciones, comida fuera, taxis) o alarga plazos de metas.
      </p>
    `;
  }

  /* =======================
     Exportaciones
     ======================= */
  function downloadJSON(){
    const payload = {
      timestamp: new Date().toISOString(),
      wizard: get(KEYS.WIZARD, {}),
      dailies: get(DAILIES_KEY, []),
      goals:   get(GOALS_KEY, [])
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'eco_resumen_completo.json');
    URL.revokeObjectURL(url);
  }

  function downloadCanvasPNG(canvasId, filename){
    const c = document.getElementById(canvasId);
    if(!c){ alert('La gráfica aún no está disponible.'); return; }
    const url = c.toDataURL('image/png');
    triggerDownload(url, filename);
  }

  function triggerDownload(url, filename){
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function exportPDF(){
    if(!window.html2canvas || !window.jspdf){ alert('Falta cargar las librerías de PDF.'); return; }
    const container = document.querySelector('main .wrap') || document.body;
    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF('p', 'pt', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = canvas.height * (imgWidth / canvas.width);

    let position = 20;
    pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight, '', 'FAST');
    while ((position + imgHeight) > pageHeight) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight, '', 'FAST');
    }
    pdf.save('Resumen_Financiero.pdf');
  }

  /* =======================
     Helpers
     ======================= */
  function val(id){ return document.getElementById(id)?.value || ''; }
  function setText(id, txt){ const el = document.getElementById(id); if(el) el.textContent = txt; }
  function diffInMonths(a,b){ return (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth()) + (b.getDate()>=a.getDate()?0:-1); }
  function uid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random()); }
  function escapeHtml(s){ const m = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }; return String(s).replace(/[&<>"']/g, ch => m[ch]); }

  function isSameMonth(dateStr, ref){
    const d = new Date(dateStr || new Date());
    if (isNaN(d.getTime())) return true;
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  }

  function formatDate(dateStr){
    const d = new Date(dateStr || new Date());
    if (isNaN(d.getTime())) return String(dateStr || '');
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function groupByMonth(list){
    const map = {};
    list.forEach(it=>{
      const d = new Date(it.date || new Date());
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      (map[key] = map[key] || []).push(it);
    });
    return map;
  }

  function monthLabel(key){
    const [y,m] = key.split('-').map(Number);
    const d = new Date(y, (m-1)||0, 1);
    return d.toLocaleDateString('es-ES', { month:'long', year:'numeric' });
  }

  function readLibre(){
    const t = document.getElementById('v_libre')?.textContent || '0';
    const clean = String(t).replace(/[^\d.-]/g,'');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
} // end start()
