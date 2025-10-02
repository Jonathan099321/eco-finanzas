// scripts/pages/resumen-goals-adapter.js
// Sincroniza metas entre clave global y clave por usuario.
// - Prefiere la namespaced (eco_goals_v1__email).
// - Si solo existe la global, la migra a la namespaced.
// - A partir de ahora, cualquier set/remove a la GLOBAL se refleja también en la namespaced,
//   para que el código legado siga funcionando sin perder persistencia tras recargar.

(function () {
  const SESSION_KEY = 'eco_current_user';
  const GOALS_KEY   = 'eco_goals_v1';

  function getSessionEmail() {
    try {
      const ses = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return ses?.email?.toLowerCase() || null;
    } catch {
      return null;
    }
  }

  function scopedKeyFor(email) {
    return `${GOALS_KEY}__${email}`;
  }

  // Copia valor JSON (string) de srcKey -> dstKey
  function copyKey(srcKey, dstKey) {
    try {
      const raw = localStorage.getItem(srcKey);
      if (raw !== null && raw !== undefined) {
        localStorage.setItem(dstKey, raw);
      }
    } catch {}
  }

  // Comparación leve (evita sobrescribir si ya son iguales)
  function areEqualJSON(a, b) {
    if (a === b) return true;
    try {
      return JSON.stringify(JSON.parse(a || 'null')) === JSON.stringify(JSON.parse(b || 'null'));
    } catch {
      return false;
    }
  }

  function syncNow() {
    const email = getSessionEmail();
    if (!email) return;

    const scoped = scopedKeyFor(email);
    const rawGlobal = localStorage.getItem(GOALS_KEY);
    const rawScoped = localStorage.getItem(scoped);

    // Regla: si hay namespaced, es la fuente de la verdad → copiar a global (para código viejo)
    if (rawScoped && rawScoped !== 'undefined' && rawScoped !== 'null') {
      if (!areEqualJSON(rawScoped, rawGlobal)) {
        localStorage.setItem(GOALS_KEY, rawScoped);
      }
      return; // listo
    }

    // Si no hay namespaced pero sí global, migrar a namespaced y mantener global por compatibilidad
    if (rawGlobal && rawGlobal !== 'undefined' && rawGlobal !== 'null') {
      localStorage.setItem(scoped, rawGlobal);
      return;
    }

    // Si no hay nada, no hacemos nada.
  }

  // Monkey patch para reflejar escrituras a la clave GLOBAL → también a la namespaced
  function patchLocalStorage() {
    const email = getSessionEmail();
    if (!email) return;

    const scoped = scopedKeyFor(email);
    const _setItem    = localStorage.setItem.bind(localStorage);
    const _removeItem = localStorage.removeItem.bind(localStorage);

    localStorage.setItem = function (key, value) {
      if (key === GOALS_KEY) {
        try { _setItem(GOALS_KEY, value); } catch {}
        try { _setItem(scoped, value); } catch {}
        return;
      }
      return _setItem(key, value);
    };

    localStorage.removeItem = function (key) {
      if (key === GOALS_KEY) {
        try { _removeItem(GOALS_KEY); } catch {}
        try { _removeItem(scoped); } catch {}
        return;
      }
      return _removeItem(key);
    };
  }

  // Ejecutar
  try {
    syncNow();        // Sincroniza al entrar
    patchLocalStorage(); // Asegura persistencia para escrituras futuras
  } catch {}
})();
