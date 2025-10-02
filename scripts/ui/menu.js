// scripts/ui/menu.js
// Menú: tema, soporte, idioma y logout con redirección al login.
// Incluye mejoras de accesibilidad y limpieza de eventos.

import { initTheme }   from './theme.js';
import { initSupport } from './support.js';

const SESSION_KEY = 'eco_current_user';       // misma clave que en login.js
const LOGIN_URL   = '/public/login.html';     // ruta absoluta para evitar problemas

export function initMenu() {
  const btn       = document.getElementById('menuBtn');
  const panel     = document.getElementById('menuPanel');
  const miTheme   = document.getElementById('miTheme');
  const miSupport = document.getElementById('miSupport');
  const miLogout  = document.getElementById('miLogout');
  const miLang    = document.getElementById('miLang');

  if (!btn || !panel) return;

  // ---------- utilidades ----------
  const isOpen = () => panel.classList.contains('open');
  const open   = () => {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    // Enfoca el primer item si existe
    const first = panel.querySelector('.menu-item');
    first?.focus?.();
  };
  const close  = () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  };
  const toggle = () => (isOpen() ? close() : open());

  // ---------- eventos de apertura/cierre ----------
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  document.addEventListener('click', (e) => {
    // cierra al click fuera del panel
    if (isOpen() && !panel.contains(e.target) && e.target !== btn) close();
  });
  // cierra con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); btn.focus(); }
  });
  // cierra al redimensionar (por si cambia layout)
  window.addEventListener('resize', close);

  // ---------- integraciones ----------
  initTheme?.(miTheme);        // alterna modo oscuro/claro
  initSupport?.(miSupport);    // abre modal de soporte

  // Idioma (demo)
  miLang?.addEventListener('click', () => {
    const html = document.documentElement;
    html.lang = (html.lang === 'es' ? 'en' : 'es');
    alert(html.lang === 'es' ? 'Idioma cambiado a Español' : 'Language switched to English');
    close();
  });

  // Logout: limpia sesión (y opcionalmente otros datos) y redirige al login
  miLogout?.addEventListener('click', () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      // Si quieres borrar todo, descomenta:
      // localStorage.removeItem('eco_wizard_v5');
      // localStorage.removeItem('eco_goals_v1');
      // localStorage.removeItem('eco_dailies_v1');
    } catch {}
    window.location.href = LOGIN_URL;
  });
}

// Auto init (por si se carga como script simple)
initMenu();
