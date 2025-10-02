// scripts/pages/login.js
// EcoFinanzas · Login demo (sin backend) universal
// Soporta dos UIs:
//   A) Panes (#loginPane / #signupPane, botones #btnLogin #btnSignup #btnShowSignup #btnBackToLogin)
//   B) Formularios (#formLogin / #formSignup + .tab[data-tab])
// Comportamiento:
//   * Tras CREAR CUENTA => setea sesión, inicializa wizard {completed:false} y REDIRIGE al WIZARD.
//   * Si inicia sesión y NO tiene wizard.completed === true => WIZARD.
//   * Si ya completó wizard => RESUMEN.
//   * Migra metas globales a clave por usuario.
//   * Purga cualquier clave LEGACY del wizard para que no contamine (eco_wizard_v5 global y sus variantes).

(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  function start() {
    // --- Constantes de storage y rutas ---
    const USERS_KEY       = "eco_users_v1";
    const SESSION_KEY     = "eco_current_user";
    const BASE_WIZARD_KEY = "eco_wizard_v5";   // base del wizard
    const GOALS_KEY       = "eco_goals_v1";    // metas (global legacy)

    const WIZARD_PAGE  = "wizard.html";
    const RESUMEN_PAGE = "resumen.html";

    // Helpers DOM
    const $  = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    // ========= Detección de UI =========
    // Opción A (panes)
    const loginPane   = $("#loginPane");
    const signupPane  = $("#signupPane");
    const btnLogin    = $("#btnLogin");
    const btnSignup   = $("#btnSignup");
    const btnShowSignup  = $("#btnShowSignup");
    const btnBackToLogin = $("#btnBackToLogin");

    // Opción B (formularios + tabs)
    const formLogin   = $("#formLogin");
    const formSignup  = $("#formSignup");
    const loginError  = $("#loginError");
    const signupError = $("#signupError");
    const tabs        = $$(".tab");

    // Mostrar/Ocultar password (si hay botones .peek)
    $$(".peek").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-target");
        const input = document.getElementById(id);
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
      })
    );

    // “Olvidé mi contraseña” demo (si existe)
    $("#fakeForgot")?.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Demo: restablecimiento no implementado.");
    });

    // ========= Storage helpers =========
    const loadUsers = () => {
      try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
      catch { return []; }
    };
    const saveUsers = (users) =>
      localStorage.setItem(USERS_KEY, JSON.stringify(users));

    const setSession = (email) =>
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email, ts: Date.now() }));

    const getSessionEmail = () => {
      try {
        const ses = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        return ses?.email || null;
      } catch { return null; }
    };

    const wizardKeyFor = (email) => `${BASE_WIZARD_KEY}__${email.toLowerCase()}`;
    const draftKeyFor  = (email) => `${BASE_WIZARD_KEY}__${email.toLowerCase()}__draft`;
    const goalsKeyFor  = (email) => `${GOALS_KEY}__${email.toLowerCase()}`;

    // ---- Purga de claves LEGACY del wizard (globales) ----
    function purgeLegacyWizardKeys() {
      try {
        // Globales conocidas
        localStorage.removeItem(BASE_WIZARD_KEY);
        localStorage.removeItem(`${BASE_WIZARD_KEY}_draft`);
        // Cualquier clave que empiece por eco_wizard_v5 y NO tenga __email
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith(BASE_WIZARD_KEY) && !k.includes("__")) {
            localStorage.removeItem(k);
          }
        });
      } catch {}
    }

    // Solo considera la clave namespaced y exige completed === true
    function hasWizardCompleted(email) {
      if (!email) return false;
      try {
        const raw = localStorage.getItem(wizardKeyFor(email));
        if (!raw) return false;
        const obj = JSON.parse(raw);
        return obj && obj.completed === true;
      } catch {
        return false;
      }
    }

    // Migra metas globales a clave por usuario (una vez)
    function migrateGoalsToUser(email) {
      if (!email) return;
      try {
        const scopedKey = goalsKeyFor(email);
        const already = localStorage.getItem(scopedKey);
        if (already) return; // ya migrado
        const legacy = localStorage.getItem(GOALS_KEY);
        if (!legacy) return;
        localStorage.setItem(scopedKey, legacy);
        // opcional: borra global para no contaminar
        localStorage.removeItem(GOALS_KEY);
      } catch {}
    }

    // ========= UI helpers =========
    function showPane(which) {
      const isSignup = which === "signup";
      if (loginPane)  loginPane.hidden  = isSignup;
      if (signupPane) signupPane.hidden = !isSignup;
      const title = document.querySelector("section.card.auth h2");
      if (title) title.textContent = isSignup ? "Crear cuenta" : "Login";
      hideError("#loginError");
      hideError("#signupError");
    }

    function showErr(el, msg) {
      if (!el) return;
      el.textContent = msg;
      el.hidden = false;
      el.style.display = "block";
    }
    function hideError(sel) {
      const el = document.querySelector(sel);
      if (!el) return;
      el.hidden = true;
      el.style.display = "none";
      el.textContent = "";
    }

    // ========= Acciones (comparten lógica) =========
    function doLogin(email, pass, errNode) {
      hideError("#loginError");
      if (!email || !pass) return showErr(errNode, "Ingresa tu correo y contraseña.");

      const users = loadUsers();
      const user = users.find((u) => u.email === email && u.pass === pass);
      if (!user) return showErr(errNode, "Credenciales incorrectas.");

      // Limpia cualquier rastro de wizard legacy antes de seguir
      purgeLegacyWizardKeys();

      setSession(email);

      // migra metas del usuario si fuese necesario
      migrateGoalsToUser(email);

      const done = hasWizardCompleted(email);
      window.location.href = done ? RESUMEN_PAGE : WIZARD_PAGE;
    }

    function doSignup(name, email, pass, errNode) {
      hideError("#signupError");
      if (!name || !email || !pass)
        return showErr(errNode, "Completa todos los campos.");
      if (pass.length < 6)
        return showErr(errNode, "La contraseña debe tener al menos 6 caracteres.");

      const users = loadUsers();
      if (users.some((u) => u.email === email))
        return showErr(errNode, "Ese correo ya está registrado.");

      // Limpia cualquier rastro de wizard legacy antes de crear
      purgeLegacyWizardKeys();

      users.push({ name, email, pass });
      saveUsers(users);

      // Inicia sesión, inicializa wizard {completed:false}, limpia draft del usuario y ve al Wizard
      setSession(email);
      try {
        localStorage.setItem(
          wizardKeyFor(email),
          JSON.stringify({ completed: false })
        );
        localStorage.removeItem(draftKeyFor(email)); // draft limpio por si existía
      } catch {}
      // migra metas (si existía algo global previo)
      migrateGoalsToUser(email);

      window.location.href = WIZARD_PAGE;
    }

    // ========= Enlaces según MODO A (panes) =========
    if (loginPane && signupPane) {
      // Navegación entre panes
      btnShowSignup?.addEventListener("click", () => showPane("signup"));
      btnBackToLogin?.addEventListener("click", () => showPane("login"));
      // Acciones
      btnLogin?.addEventListener("click", () => {
        const email = $("#loginEmail")?.value.trim().toLowerCase();
        const pass  = $("#loginPass")?.value;
        doLogin(email, pass, $("#loginError"));
      });
      btnSignup?.addEventListener("click", () => {
        const name  = $("#name")?.value.trim();
        const email = $("#signupEmail")?.value.trim().toLowerCase();
        const pass  = $("#signupPass")?.value;
        doSignup(name, email, pass, $("#signupError"));
      });
      // Estado inicial
      showPane("login");
    }

    // ========= Enlaces según MODO B (formularios) =========
    if (formLogin && formSignup) {
      // Tabs si existen
      if (tabs.length) {
        tabs.forEach((t) =>
          t.addEventListener("click", () => switchTab(t.dataset.tab))
        );
        if (!tabs.some((t) => t.classList.contains("active"))) {
          switchTab("login");
        }
      }

      function switchTab(which) {
        tabs.forEach((t) =>
          t.classList.toggle("active", t.dataset.tab === which)
        );
        formLogin.hidden  = which !== "login";
        formSignup.hidden = which !== "signup";
        hideError("#loginError");
        hideError("#signupError");
      }

      formLogin.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = $("#loginEmail")?.value.trim().toLowerCase();
        const pass  = $("#loginPass")?.value;
        doLogin(email, pass, $("#loginError"));
      });

      formSignup.addEventListener("submit", (e) => {
        e.preventDefault();
        const name  = $("#name")?.value.trim();
        const email = $("#signupEmail")?.value.trim().toLowerCase();
        const pass  = $("#signupPass")?.value;
        doSignup(name, email, pass, $("#signupError"));
      });
    }

    // ========= Auto-redirect si ya hay sesión =========
    (function autoRedirect() {
      try {
        const email = getSessionEmail();
        if (!email) return;

        // Purga legacy siempre por si el navegador tenía restos viejos
        purgeLegacyWizardKeys();

        // migra metas si quedaran globales
        migrateGoalsToUser(email);

        const done = hasWizardCompleted(email);
        window.location.href = done ? RESUMEN_PAGE : WIZARD_PAGE;
      } catch {}
    })();
  }
})();


