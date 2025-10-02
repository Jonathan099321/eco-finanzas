// scripts/pages/wizard.js
// Wizard: autoguardado, validación y preview
import { KEYS } from '../data/constants.js';
import { set, get } from '../data/storage.js';
import { money, parseMoney, attachMoneyMask } from '../ui/format.js';

// ===== Guardia de sesión =====
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

// Helpers clave por usuario
function getSessionEmail(){
  try {
    const ses = JSON.parse(localStorage.getItem('eco_current_user')||'null');
    return ses?.email || null;
  } catch { return null; }
}
function scopedWizardKey(){
  const email = getSessionEmail() || '';
  return `${KEYS.WIZARD || 'eco_wizard_v5'}__${email.toLowerCase()}`;
}
function mirrorToScoped(obj){
  try { localStorage.setItem(scopedWizardKey(), JSON.stringify(obj)); } catch {}
}

// Limpia la clave global legacy para evitar redirecciones viejas
(function cleanupLegacyWizard(){
  try { localStorage.removeItem(KEYS.WIZARD || 'eco_wizard_v5'); } catch {}
})();

const stepText = document.getElementById('stepText');
const v1 = document.getElementById('view-1');
const v2 = document.getElementById('view-2');

const data = get(KEYS.WIZARD, {}) || {};
const DRAFT_KEY = (KEYS.WIZARD || 'eco_wizard_v5') + '_draft';

function show(el){ el.removeAttribute('hidden'); }
function hide(el){ el.setAttribute('hidden',''); }
const n = (x)=> parseMoney(x);

// ===== PASO 1 =====
document.getElementById('form1').addEventListener('submit', (e)=>{
  e.preventDefault();
  const estadoCivil = document.querySelector('input[name="estadoCivil"]:checked')?.value || 'soltero';
  const tieneDependientes = document.querySelector('input[name="tieneDependientes"]:checked')?.value || 'no';
  const parejaAporta = document.querySelector('input[name="parejaAporta"]:checked')?.value || 'no';
  const apoyaTerceros = document.querySelector('input[name="apoyaTerceros"]:checked')?.value || 'no';

  Object.assign(data, {
    estadoCivil, tieneDependientes, parejaAporta, apoyaTerceros,
    completed: false // ← AÚN NO completado
  });

  const isPareja = (estadoCivil==='pareja_sin_hijos' || estadoCivil==='pareja_con_hijos');
  data.activeFlows = {
    base: true,
    apoyo: apoyaTerceros==='si',
    dep: tieneDependientes==='si',
    pareja: isPareja
  };
  set(KEYS.WIZARD, data);
  mirrorToScoped(data); // completed:false

  // Mostrar/ocultar bloques del paso 2
  document.getElementById('flowApoyo').hidden = !(data.activeFlows.apoyo);
  document.getElementById('flowDependientes').hidden = !(data.activeFlows.dep);
  document.getElementById('flowPareja').hidden = !(data.activeFlows.pareja);
  document.getElementById('parejaSiAporta').style.display = (isPareja && parejaAporta==='si') ? 'grid' : 'none';
  document.getElementById('parejaNoAporta').style.display = (isPareja && parejaAporta==='no') ? 'grid' : 'none';

  hide(v1); show(v2); stepText.textContent = 'Paso 2 de 2';

  initStep2();
});

// Botón Anterior
document.getElementById('back1').addEventListener('click', ()=>{
  hide(v2); show(v1); stepText.textContent = 'Paso 1 de 2';
});

// ===== PASO 2 → Guardar y redirigir =====
document.getElementById('form2').addEventListener('submit', (e)=>{
  e.preventDefault();
  if(!validateForm2()) return;

  const g = (id)=> document.getElementById(id)?.value || '';
  const act = (data.activeFlows||{});

  // Base (siempre)
  Object.assign(data, {
    ingresoMensual: g('ingresoMensual'),
    otrosIngresos: g('otrosIngresos'),
    serviciosBasicos: g('serviciosBasicos'),
    suscripciones: g('suscripciones'),
    transportePublico: g('transportePublico'),
    gasolina: g('gasolina'),
    alimentacion: g('alimentacion'),
    renta: g('renta'),
    salud: g('salud'),
    deudas: g('deudas')
  });

  // Apoyo
  if(act.apoyo){
    Object.assign(data, {
      relacion: g('relacion'),
      frecuenciaApoyo: g('frecuenciaApoyo'),
      montoApoyo: g('montoApoyo'),
      conceptoApoyo: g('conceptoApoyo')
    });
  }

  // Dependientes
  if(act.dep){
    Object.assign(data, {
      cantidadDependientes: g('cantidadDependientes'),
      gastoMensualDependientes: g('gastoMensualDependientes'),
      educacionDep: g('educacionDep'),
      saludDep: g('saludDep')
    });
  }

  // Pareja
  if(act.pareja){
    const comentarioAporta   = g('comentarioParejaAporta');
    const comentarioNoAporta = g('comentarioPareja');
    const comentario = comentarioAporta || comentarioNoAporta;
    Object.assign(data, {
      montoParaPareja: g('montoParaPareja'),
      montoParejaAporta: g('montoParejaAporta'),
      comentarioPareja: comentario
    });
  }

  // Marca COMPLETADO
  data.completed = true;

  try {
    localStorage.setItem(scopedWizardKey(), JSON.stringify(data)); // namespaced
    localStorage.removeItem(KEYS.WIZARD || 'eco_wizard_v5');       // cleanup global
  } catch {}

  // Mantén también la global si la usas en otras pantallas
  set(KEYS.WIZARD, data);

  localStorage.removeItem(DRAFT_KEY); // limpia el borrador al terminar
  window.location.href = './resumen.html';
});

/* ============================
   Paso 2: autoguardado + máscara + preview
   ============================ */
function initStep2(){
  const form2 = document.getElementById('form2');
  if(!form2) return;

  // Campos de dinero
  const moneyIds = [
    'ingresoMensual','otrosIngresos','serviciosBasicos','suscripciones',
    'transportePublico','gasolina','alimentacion','renta','salud','deudas',
    'montoApoyo','gastoMensualDependientes','educacionDep','saludDep',
    'montoParaPareja','montoParejaAporta'
  ];
  moneyIds.forEach(id => attachMoneyMask(document.getElementById(id)));

  // Autoguardado (cada input/select)
  form2.querySelectorAll('input, select').forEach(el=>{
    const handler = ()=>{
      saveDraft();
      // snapshot + completed:false mientras no se termine
      const snap = collectForm2Snapshot();
      snap.completed = false;
      set(KEYS.WIZARD, snap);
      mirrorToScoped(snap);
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  // Cargar borrador si existe
  restoreDraft();

  // Validación + preview al iniciar
  setupValidationUI();
  validateForm2();
  refreshPreview();

  // Recalcular en vivo
  form2.querySelectorAll('input, select').forEach(el=>{
    el.addEventListener('input', ()=>{ validateForm2(); refreshPreview(); });
  });
}

// Toma un snapshot rápido de los campos del paso 2
function collectForm2Snapshot(){
  const form2 = document.getElementById('form2');
  if(!form2) return data;
  const snap = { ...(data||{}) };
  form2.querySelectorAll('input, select').forEach(el=>{
    if(el?.id) snap[el.id] = el.value;
  });
  return snap;
}

function saveDraft(){
  const form2 = document.getElementById('form2');
  if(!form2) return;
  const draft = {};
  form2.querySelectorAll('input, select').forEach(el=>{
    draft[el.id] = el.value;
  });
  set(DRAFT_KEY, draft);
}

function restoreDraft(){
  const draft = get(DRAFT_KEY, null);
  if(!draft) return;
  Object.entries(draft).forEach(([id,val])=>{
    const el = document.getElementById(id);
    if(el) el.value = val;
  });
}

function setupValidationUI(){
  const form2 = document.getElementById('form2');
  if(!form2) return;
  // Envuelve inputs con .field y agrega .error-msg si falta
  form2.querySelectorAll('input, select').forEach(input=>{
    let wrap = input.closest('.field');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.className = 'field';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    if(!wrap.querySelector('.error-msg')){
      const em = document.createElement('div');
      em.className = 'error-msg';
      em.style.display = 'none';
      wrap.appendChild(em);
    }
  });
}

function validateForm2(){
  const act = (data.activeFlows||{});
  let ok = true;

  const rules = [
    {id:'ingresoMensual', type:'money', required:true},
    {id:'otrosIngresos', type:'money'},
    {id:'serviciosBasicos', type:'money'},
    {id:'suscripciones', type:'money'},
    {id:'transportePublico', type:'money'},
    {id:'gasolina', type:'money'},
    {id:'alimentacion', type:'money'},
    {id:'renta', type:'money'},
    {id:'salud', type:'money'},
    {id:'deudas', type:'money'},
  ];
  if(act.apoyo) rules.push({id:'montoApoyo', type:'money'});
  if(act.dep){
    rules.push({id:'cantidadDependientes', type:'int'});
    rules.push({id:'gastoMensualDependientes', type:'money'});
    rules.push({id:'educacionDep', type:'money'});
    rules.push({id:'saludDep', type:'money'});
  }
  if(act.pareja){
    if(data.parejaAporta==='si') rules.push({id:'montoParejaAporta', type:'money'});
    else rules.push({id:'montoParaPareja', type:'money'});
  }

  rules.forEach(r=>{
    const el = document.getElementById(r.id);
    if(!el) return;
    const wrap = el.closest('.field');
    const em = wrap?.querySelector('.error-msg');
    let valid = true, msg = '';

    const raw = el.value.trim();
    if(r.required && !raw){
      valid = false; msg = 'Este campo es requerido';
    } else if(r.type==='money'){
      const num = n(raw);
      if(isNaN(num) || num < 0){ valid=false; msg='Ingresa un número válido (≥ 0)'; }
    } else if(r.type==='int'){
      const num = parseInt(raw || '0', 10);
      if(!Number.isInteger(num) || num < 0){ valid=false; msg='Ingresa un entero válido (≥ 0)'; }
    }

    if(!valid){
      ok = false;
      wrap?.classList.add('invalid');
      if(em){ em.textContent = msg; em.style.display = 'block'; }
    }else{
      wrap?.classList.remove('invalid');
      if(em){ em.textContent = ''; em.style.display = 'none'; }
    }
  });

  const submitBtn = document.querySelector('#form2 button[type="submit"]');
  if(submitBtn){
    submitBtn.disabled = !ok;
    submitBtn.style.opacity = ok ? '1' : '.6';
    submitBtn.style.cursor  = ok ? 'pointer' : 'not-allowed';
  }
  return ok;
}

function refreshPreview(){
  const g = (id)=> document.getElementById(id)?.value || '';
  const act = (data.activeFlows||{});

  const ingresos = n(g('ingresoMensual')) + n(g('otrosIngresos')) +
    ((act.pareja && data.parejaAporta==='si') ? n(document.getElementById('montoParejaAporta')?.value) : 0);

  const gastosBase = n(g('serviciosBasicos')) + n(g('suscripciones')) + n(g('transportePublico')) +
                     n(g('gasolina')) + n(g('alimentacion')) + n(g('renta')) +
                     n(g('salud')) + n(g('deudas'));

  const gastosApoyo = act.apoyo ? n(document.getElementById('montoApoyo')?.value) : 0;
  const depDetalle = n(document.getElementById('educacionDep')?.value) + n(document.getElementById('saludDep')?.value);
  const gastosDependientes = act.dep ? (depDetalle>0 ? depDetalle : n(document.getElementById('gastoMensualDependientes')?.value)) : 0;
  const gastosPareja = (act.pareja && data.parejaAporta==='no') ? n(document.getElementById('montoParaPareja')?.value) : 0;

  const totalGastos = gastosBase + gastosApoyo + gastosDependientes + gastosPareja;
  const libre = ingresos - totalGastos;

  setText('pv_ingreso', money(ingresos));
  setText('pv_gastosBase', money(totalGastos));
  setText('pv_libre', money(libre));
}

function setText(id, txt){ const el = document.getElementById(id); if(el) el.textContent = txt; }
