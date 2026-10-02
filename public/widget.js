/* Asistente IA embebible de HarayaDev — add-on sobre el sitio que el cliente YA tiene.
 *
 * Instalación (una línea, en cualquier sitio: WordPress, Wix, HTML, VTEX):
 *   <script src="https://TU-APP.vercel.app/widget.js" data-tenant="ID-DEL-CLIENTE"></script>
 *
 * Opcionales: data-name="Mi Negocio"  data-color="#FF3D3D"
 *   data-teaser="¿Tienes dudas? ¡Pregúntame!" (globo que invita a hacer clic;
 *   trae un texto genérico por defecto, así que ni siquiera hace falta
 *   setearlo — pero un mensaje propio del rubro convierte más)
 *   data-open-style="popup" (el chat se abre solo al cargar, como modal
 *   centrado con fondo oscurecido, en vez del panel de esquina de siempre —
 *   pensado para una demo de alto impacto, no necesariamente para dejarlo
 *   así en producción; sin este atributo el widget se comporta como siempre)
 * El endpoint se deriva del propio origen donde se sirve widget.js (nuestro deploy).
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;

  var tenant = script.getAttribute("data-tenant");
  if (!tenant) {
    console.error("[HarayaDev widget] falta data-tenant en la etiqueta <script>.");
    return;
  }
  var name = script.getAttribute("data-name") || "Asistente";
  var color = script.getAttribute("data-color") || "#FF3D3D";
  var teaserText = script.getAttribute("data-teaser") || "👋 ¿Tienes preguntas? ¡Pregúntame!";
  var isPopup = script.getAttribute("data-open-style") === "popup";
  var base = new URL(script.src).origin;
  var endpoint = base + "/api/embed/chat?t=" + encodeURIComponent(tenant);

  var messages = []; // {role:'user'|'assistant', content:string}
  var open = false;
  var busy = false;

  // --- estilos (aislados por prefijo hd-) ---
  var css =
    ".hd-w{position:fixed;right:16px;bottom:16px;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
    ".hd-btn{width:56px;height:56px;border:none;border-radius:50%;background:" + color + ";color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}" +
    ".hd-btn svg{width:26px;height:26px}" +
    ".hd-panel{position:absolute;right:0;bottom:68px;width:330px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 100px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden}" +
    ".hd-panel.hd-on{display:flex}" +
    ".hd-head{background:" + color + ";color:#fff;padding:12px 14px;font-weight:600;font-size:14px;display:flex;justify-content:space-between;align-items:center}" +
    ".hd-x{background:none;border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1}" +
    ".hd-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f7f7f8}" +
    ".hd-msg{max-width:85%;padding:8px 11px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}" +
    ".hd-user{align-self:flex-end;background:" + color + ";color:#fff}" +
    ".hd-bot{align-self:flex-start;background:#fff;color:#111;border:1px solid rgba(0,0,0,.08);white-space:normal}" +
    ".hd-bot p{margin:0 0 6px}" +
    ".hd-bot p:last-child{margin-bottom:0}" +
    ".hd-bot ul{margin:2px 0 6px;padding-left:18px}" +
    ".hd-bot ul:last-child{margin-bottom:0}" +
    ".hd-bot li{margin-bottom:2px}" +
    ".hd-bot strong{font-weight:700}" +
    ".hd-bot a{color:inherit;text-decoration:underline;text-underline-offset:2px}" +
    // Defensivo: varios sitios (WordPress con wp-emoji, entre otros) reemplazan
    // el emoji de texto por un <img> propio dentro del DOM del widget — visto en
    // vivo en premiumdental.cl, donde ese <img> salía sin el CSS que lo achica
    // (huérfano de 1em) y ocupaba media pantalla. El widget nunca inserta <img>
    // por su cuenta, así que acotar tamaño acá adentro es siempre seguro.
    ".hd-bot img{height:1.1em;width:1.1em;vertical-align:-.15em;margin:0 1px;display:inline-block}" +
    // Foto real de producto (sintaxis markdown ![alt](url), sentinel de
    // demoStore/imageUrl) — necesita más especificidad que ".hd-bot img" de
    // arriba (que fue pensado para achicar emojis colados, no para esto).
    ".hd-bot img.hd-product-img{display:block;width:140px;height:140px;max-width:100%;object-fit:cover;border-radius:10px;margin:4px 0}" +
    ".hd-cart-btn{display:block;width:100%;margin:4px 0;padding:9px 10px;border:none;border-radius:8px;background:" + color + ";color:#fff;font-size:13px;font-weight:600;cursor:pointer}" +
    ".hd-cart-btn:disabled{opacity:.7;cursor:default}" +
    ".hd-cart-btn.hd-cart-ok{background:#1a9e5c}" +
    ".hd-cart-btn.hd-cart-err{background:#c0392b}" +
    ".hd-thinking{display:inline-block;color:#777;font-style:italic;animation:hd-pulse 1.4s ease-in-out infinite}" +
    "@keyframes hd-pulse{0%,100%{opacity:.5}50%{opacity:1}}" +
    ".hd-form{display:flex;gap:6px;padding:8px;border-top:1px solid rgba(0,0,0,.08);background:#fff}" +
    ".hd-in{flex:1;border:1px solid rgba(0,0,0,.15);border-radius:20px;padding:8px 12px;font-size:14px;outline:none}" +
    ".hd-in:focus{border-color:" + color + "}" +
    ".hd-send{border:none;background:" + color + ";color:#fff;border-radius:50%;width:36px;height:36px;cursor:pointer;flex:0 0 auto}" +
    ".hd-foot{font-size:10px;color:#999;text-align:center;padding:4px}" +
    ".hd-foot a{color:#999;text-decoration:none}" +
    // Globo que invita a hacer clic — aparece solo, a la izquierda del botón,
    // y se retira (nunca vuelve a salir en esa carga de página) al abrir el
    // chat, al cerrarlo con su × propia, o solo después de un rato.
    ".hd-teaser{position:absolute;right:64px;bottom:12px;max-width:200px;background:#fff;color:#222;padding:10px 30px 10px 14px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.2);font-size:13px;line-height:1.35;opacity:0;transform:translateX(6px) scale(.96);pointer-events:none;transition:opacity .25s ease,transform .25s ease}" +
    ".hd-teaser.hd-teaser-on{opacity:1;transform:translateX(0) scale(1);pointer-events:auto}" +
    ".hd-teaser:after{content:'';position:absolute;right:-6px;bottom:20px;width:12px;height:12px;background:#fff;transform:rotate(45deg);box-shadow:2px -2px 3px rgba(0,0,0,.05)}" +
    ".hd-teaser-x{position:absolute;top:2px;right:4px;background:none;border:none;color:#999;font-size:14px;line-height:1;cursor:pointer;padding:4px}" +
    // Modo popup (data-open-style="popup"): fondo oscurecido detrás del panel
    // y el panel mismo pasa de "anclado a la esquina" a "modal centrado" más
    // grande — para una demo de alto impacto, ver comentario de más arriba.
    ".hd-backdrop{position:fixed;inset:0;background:rgba(17,17,17,.5);opacity:0;pointer-events:none;transition:opacity .2s ease}" +
    ".hd-backdrop.hd-on{opacity:1;pointer-events:auto}" +
    ".hd-panel.hd-popup{position:fixed;right:auto;bottom:auto;left:50%;top:50%;transform:translate(-50%,-50%);width:400px;height:600px;max-width:calc(100vw - 32px);max-height:calc(100vh - 64px)}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // --- DOM ---
  var wrap = document.createElement("div");
  wrap.className = "hd-w";
  wrap.innerHTML =
    '<div class="hd-backdrop"></div>' +
    '<div class="hd-panel' + (isPopup ? ' hd-popup' : '') + '" role="dialog" aria-label="Asistente virtual">' +
      '<div class="hd-head"><span>' + escapeHtml(name) + '</span><button class="hd-x" aria-label="Cerrar">✕</button></div>' +
      '<div class="hd-body"></div>' +
      '<form class="hd-form"><input class="hd-in" type="text" placeholder="Escribe tu mensaje…" aria-label="Mensaje" autocomplete="off"/>' +
        '<button class="hd-send" type="submit" aria-label="Enviar">→</button></form>' +
      '<div class="hd-foot"><a href="https://haraya.dev" target="_blank" rel="noopener">con IA por HarayaDev</a></div>' +
    '</div>' +
    '<button class="hd-btn" aria-label="Abrir asistente">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
    '</button>' +
    '<div class="hd-teaser" role="status">' + escapeHtml(teaserText) + '<button type="button" class="hd-teaser-x" aria-label="Cerrar aviso">✕</button></div>';
  document.body.appendChild(wrap);

  var panel = wrap.querySelector(".hd-panel");
  var body = wrap.querySelector(".hd-body");
  var form = wrap.querySelector(".hd-form");
  var input = wrap.querySelector(".hd-in");
  var toggle = wrap.querySelector(".hd-btn");
  var closeBtn = wrap.querySelector(".hd-x");
  var teaser = wrap.querySelector(".hd-teaser");
  var teaserX = wrap.querySelector(".hd-teaser-x");
  var backdrop = wrap.querySelector(".hd-backdrop");

  var teaserTimer = null;
  function hideTeaser() {
    teaser.classList.remove("hd-teaser-on");
    if (teaserTimer) {
      clearTimeout(teaserTimer);
      teaserTimer = null;
    }
  }
  // El globo teaser no aporta nada en modo popup: el propio popup ya invita a
  // conversar apenas carga la página.
  if (!script.getAttribute("data-autoopen") && !isPopup) {
    setTimeout(function () {
      teaser.classList.add("hd-teaser-on");
      teaserTimer = setTimeout(hideTeaser, 18000);
    }, 1200);
  }
  teaserX.addEventListener("click", function (e) {
    e.stopPropagation();
    hideTeaser();
  });

  function setOpen(v) {
    open = v;
    panel.classList.toggle("hd-on", open);
    if (isPopup) backdrop.classList.toggle("hd-on", open);
    if (open) {
      if (body.childElementCount === 0) addBot("¡Hola! ¿En qué te puedo ayudar?");
      input.focus();
    }
  }
  toggle.addEventListener("click", function () {
    hideTeaser();
    setOpen(!open);
  });
  closeBtn.addEventListener("click", function () {
    setOpen(false);
  });
  // Solo tiene efecto en modo popup: fuera de ese modo el fondo queda
  // siempre transparente y con pointer-events:none, así que nunca recibe clicks.
  backdrop.addEventListener("click", function () {
    setOpen(false);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    addUser(text);
    messages.push({ role: "user", content: text });
    send();
  });

  function send() {
    busy = true;
    var bot = addBot("");
    bot.innerHTML = '<span class="hd-thinking">Pensando…</span>';
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().then(
            function (j) { throw new Error(j && j.error ? j.error : "Error"); },
            function () { throw new Error("Error"); }
          );
        }
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var acc = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) {
              messages.push({ role: "assistant", content: acc.replace(THINKING_RE, "") });
              busy = false;
              return;
            }
            acc += dec.decode(r.value, { stream: true });
            renderBotContent(bot, acc);
            body.scrollTop = body.scrollHeight;
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        bot.innerHTML = renderMarkdown((err && err.message) || "No pudimos responder ahora. Escríbenos por WhatsApp.");
        busy = false;
      });
  }

  function addUser(t) { return addMsg(t, "hd-user"); }
  function addBot(t) { return addMsg(t, "hd-bot"); }
  function addMsg(t, cls) {
    var d = document.createElement("div");
    d.className = "hd-msg " + cls;
    if (cls === "hd-bot") d.innerHTML = renderMarkdown(t);
    else d.textContent = t;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // --- markdown liviano, mismo subset que components/chat/ChatMarkdown.tsx
  // (React, sitio single-tenant): **negrita**, [texto](url), URLs sueltas,
  // rutas internas (/ruta) y viñetas (-, *, •, "1."). Siempre escapa el texto
  // plano primero — nunca vuelca la salida del modelo como HTML sin pasar
  // por acá, para no abrir una inyección vía la respuesta del asistente.
  // Sumado: {{cart-add:variantId:cantidad:título}} — sentinel que emite la
  // tool agregar_al_carrito (lib/embed-tools.ts) y que acá se convierte en un
  // botón real; el click ejecuta /cart/add.js (ver más abajo). Y
  // {{cart-add-demo:cantidad:título}} — sentinel de agregar_al_carrito_demo
  // (prospectos sin endpoint real reutilizable, ver buildDemoStoreTools).
  // ![alt](url) — imagen markdown estándar, para fotos reales de producto
  // (demoStore.imageUrl); el modelo la genera solo si el system prompt se lo
  // pide (ver el bloque t.demoStore en embed-tenants.ts). Ambos se agregan AL
  // FINAL de la alternación a propósito, con grupos nuevos (10/11 y 12/13),
  // para no correr la numeración de los grupos que ya usa renderInline.
  var INLINE = /\{\{cart-add:(\d+):(\d+):([^}]+)\}\}|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s)]+)|(^|[\s(])(\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9-]+)*)|\{\{cart-add-demo:(\d+):([^}]+)\}\}|!\[([^\]]*)\]\(([^)\s]+)\)/g;
  var BULLET = /^\s*(?:[-*•]|\d+\.)\s+/;

  // Sentinel que emite app/api/embed/chat/route.ts SOLO mientras corre una
  // tool que pega a un servicio externo (ver TOOL_THINKING_LABELS ahí) — un
  // indicador de "pensando/buscando" con contexto, no un "…" genérico. Vive
  // siempre al PRINCIPIO del stream: en cuanto llega texto real después,
  // renderBotContent lo descarta y muestra solo la respuesta final; nunca
  // queda pegado en el mensaje guardado (ver el .replace en pump()).
  var THINKING_RE = /^\{\{thinking:([^}]*)\}\}\s*/;

  function renderBotContent(bot, acc) {
    var m = THINKING_RE.exec(acc);
    if (!m) {
      bot.innerHTML = renderMarkdown(acc);
      return;
    }
    var rest = acc.slice(m[0].length);
    if (rest.trim()) {
      bot.innerHTML = renderMarkdown(rest);
    } else {
      bot.innerHTML = '<span class="hd-thinking">' + escapeHtml(m[1]) + "</span>";
    }
  }

  function renderInline(text) {
    var out = "";
    var last = 0;
    var m;
    INLINE.lastIndex = 0;
    while ((m = INLINE.exec(text))) {
      var idx = m.index;
      if (idx > last) out += escapeHtml(text.slice(last, idx));
      if (m[1] !== undefined) {
        out +=
          '<button type="button" class="hd-cart-btn" data-variant="' + escapeHtml(m[1]) + '" data-qty="' + escapeHtml(m[2]) + '">' +
          "🛒 Agregar " + escapeHtml(m[3]) + " al carrito</button>";
      } else if (m[4] && m[5]) {
        out += '<a href="' + escapeHtml(m[5]) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(m[4]) + "</a>";
      } else if (m[6]) {
        out += "<strong>" + escapeHtml(m[6]) + "</strong>";
      } else if (m[7]) {
        var url = m[7].replace(/[.,;]+$/, "");
        out += '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + "</a>";
        if (m[7].length > url.length) out += escapeHtml(m[7].slice(url.length));
      } else if (m[9] !== undefined) {
        if (m[8]) out += escapeHtml(m[8]);
        out += '<a href="' + escapeHtml(m[9]) + '">' + escapeHtml(m[9]) + "</a>";
      } else if (m[10] !== undefined) {
        out +=
          '<button type="button" class="hd-cart-btn" data-demo-qty="' + escapeHtml(m[10]) + '" data-demo-title="' + escapeHtml(m[11]) + '">' +
          "🛒 Agregar " + escapeHtml(m[11]) + " al carrito (demo)</button>";
      } else if (m[13] !== undefined) {
        out += '<img src="' + escapeHtml(m[13]) + '" alt="' + escapeHtml(m[12]) + '" class="hd-product-img" loading="lazy">';
      }
      last = idx + m[0].length;
    }
    if (last < text.length) out += escapeHtml(text.slice(last));
    return out;
  }

  // Delegado en .hd-body (no en cada botón): el HTML se reemplaza entero en
  // cada chunk del stream mientras responde, así que un listener puesto
  // directo en el botón se perdería. /cart/add.js es same-origin cuando el
  // widget está instalado de verdad en el sitio del cliente — ahí es donde
  // esto agrega al carrito REAL de esa visita, no a uno nuestro.
  body.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".hd-cart-btn");
    if (!btn || btn.disabled) return;
    // Botón de agregar_al_carrito_demo (buildDemoStoreTools): nunca toca un
    // carrito real, solo confirma en el momento — sin fetch, para que quede
    // clarísimo (visualmente y en el código) que es una simulación.
    if (btn.hasAttribute("data-demo-qty")) {
      btn.disabled = true;
      btn.textContent = "✅ Agregado (demo) — así se vería";
      btn.classList.add("hd-cart-ok");
      return;
    }
    var variantId = btn.getAttribute("data-variant");
    var qty = btn.getAttribute("data-qty");
    btn.disabled = true;
    btn.textContent = "Agregando…";
    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity: Number(qty) }] }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error();
        btn.textContent = "✅ Agregado — Ver carrito";
        btn.classList.add("hd-cart-ok");
        btn.disabled = false;
        btn.onclick = function () {
          window.location.href = "/cart";
        };
      })
      .catch(function () {
        btn.textContent = "No se pudo agregar — reintentar";
        btn.classList.add("hd-cart-err");
        btn.disabled = false;
      });
  });

  function renderMarkdown(content) {
    var lines = String(content).split("\n");
    var html = "";
    var list = [];
    function flushList() {
      if (!list.length) return;
      html += "<ul>" + list.map(function (item) { return "<li>" + renderInline(item) + "</li>"; }).join("") + "</ul>";
      list = [];
    }
    lines.forEach(function (line) {
      if (BULLET.test(line)) {
        list.push(line.replace(BULLET, ""));
        return;
      }
      flushList();
      if (line.trim()) html += "<p>" + renderInline(line) + "</p>";
    });
    flushList();
    return html;
  }

  // data-autoopen (o data-open-style="popup", que siempre abre solo): abre el
  // panel solo al cargar, sin esperar el click — para la página de demo
  // (app/embed/demo), donde quien entra al link ya quiere probar el chat y no
  // debería tener que encontrar el botón primero. Va al final del IIFE a
  // propósito: dispara addBot()->renderMarkdown(), que usa INLINE/BULLET (var
  // de más abajo) — llamarlo antes de que se asignen revienta con "Cannot
  // read properties of undefined" (visto en vivo).
  if (script.getAttribute("data-autoopen") || isPopup) {
    setOpen(true);
  }
})();
