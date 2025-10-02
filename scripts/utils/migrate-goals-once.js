// /scripts/utils/migrate-goals-once.js
// Migra metas globales a la clave por-usuario y elimina SOLO las globales.
// Cargar DESPUÉS del shim y ANTES de resumen.js

(function () {
  try {
    const SESSION_KEY = "eco_current_user";

    // posibles claves globales antiguas
    const LEGACY_GOALS_KEYS = [
      "eco_goals_v1",
      "eco_metas_v1",
      "metas",
      "goals"
    ];

    // Accesos RAW (sin scope) expuestos por el shim
    const RAW = (window.__ecoRawLS) ? window.__ecoRawLS : null;

    const getEmail = () => {
      try {
        const ses = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        return (ses && ses.email) ? String(ses.email).toLowerCase() : null;
      } catch {
        return null;
      }
    };

    const email = getEmail();
    if (!email) return;

    const scopedKey = (base) => `${base}__${email}`;
    const TARGET_BASE = "eco_goals_v1";
    const TARGET = scopedKey(TARGET_BASE);

    // 1) Si ya hay metas scoped, solo limpia globales y sal
    const alreadyScoped = localStorage.getItem(TARGET);
    if (alreadyScoped !== null) {
      if (RAW) {
        for (const k of LEGACY_GOALS_KEYS) {
          try { RAW.removeItem(k); } catch {}
        }
      }
      return;
    }

    // 2) No hay scoped: intenta migrar desde alguna global (usando RAW)
    let migrated = false;
    if (RAW) {
      for (const k of LEGACY_GOALS_KEYS) {
        const val = RAW.getItem(k);
        if (val !== null) {
          try {
            // Guardar con localStorage normal → el shim la guardará scoped
            localStorage.setItem(TARGET_BASE, val);
            migrated = true;
          } catch {}
          // Borrar SOLO la global
          try { RAW.removeItem(k); } catch {}
          break;
        }
      }
    }

    // 3) Limpieza final de posibles residuos globales
    if (RAW) {
      for (const k of LEGACY_GOALS_KEYS) {
        try { RAW.removeItem(k); } catch {}
      }
    }

  } catch (e) {
    console.warn("migrate-goals-once.js:", e);
  }
})();

