// /scripts/utils/scoped-localstorage-shim.js
// Namespacing por usuario para claves eco_* (excepto sesión y usuarios)
// y MIGRACIÓN automática global -> scoped cuando aplica.
// Además expone window.__ecoRawLS para acceder a localStorage SIN scope.

(function () {
  try {
    const SESSION_KEY = "eco_current_user";
    const USERS_KEY   = "eco_users_v1";

    // email activo
    const getEmail = () => {
      try {
        const ses = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        return (ses && ses.email) ? String(ses.email).toLowerCase() : null;
      } catch {
        return null;
      }
    };

    const shouldScope = (key) => {
      if (!key || typeof key !== "string") return false;
      if (!key.startsWith("eco_")) return false;                // solo claves del proyecto
      if (key === SESSION_KEY || key === USERS_KEY) return false; // nunca scopear estas
      if (key.includes("__")) return false;                     // ya viene con scope
      return true;
    };

    const scopedKey = (key, email) => `${key}__${email}`;

    // Referencias originales (raw)
    const _getItem    = localStorage.getItem.bind(localStorage);
    const _setItem    = localStorage.setItem.bind(localStorage);
    const _removeItem = localStorage.removeItem.bind(localStorage);
    const _clear      = localStorage.clear.bind(localStorage);

    // EXPONER accesos "raw" para otros scripts (p.ej. migraciones)
    window.__ecoRawLS = {
      getItem: _getItem,
      setItem: _setItem,
      removeItem: _removeItem,
      clear: _clear
    };

    // GET
    localStorage.getItem = function (key) {
      const email = getEmail();
      if (email && shouldScope(key)) {
        const skey = scopedKey(key, email);
        const valScoped = _getItem(skey);
        if (valScoped !== null) return valScoped;

        // Migración automática global -> scoped si existe la global
        const valGlobal = _getItem(key);
        if (valGlobal !== null) {
          try { _setItem(skey, valGlobal); } catch {}
          try { _removeItem(key); } catch {}
          return valGlobal;
        }
        return null;
      }
      return _getItem(key);
    };

    // SET
    localStorage.setItem = function (key, value) {
      const email = getEmail();
      if (email && shouldScope(key)) {
        const skey = scopedKey(key, email);
        return _setItem(skey, value);
      }
      return _setItem(key, value);
    };

    // REMOVE
    localStorage.removeItem = function (key) {
      const email = getEmail();
      if (email && shouldScope(key)) {
        const skey = scopedKey(key, email);
        try { _removeItem(skey); } catch {}
        try { _removeItem(key); } catch {}
        return;
      }
      return _removeItem(key);
    };

    // CLEAR
    localStorage.clear = function () {
      return _clear();
    };

  } catch (e) {
    console.warn("scoped-localstorage-shim desactivado por error:", e);
  }
})();
