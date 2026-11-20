/**
 * Scripturile rulate IN pagina pentru verificarea aspectului (le foloseste `layout-audit.ts`):
 *
 *   - MEASURE_SCRIPT:   "modelul de aranjare" al paginii la latimea curenta a ferestrei: pentru
 *                       fiecare element vizibil cu continut (text, imagine, control), caseta
 *                       continutului, partea lui vizibila, containerul care il taie, daca e fix
 *                       pe ecran etc. (tipurile in `layout-rules.ts`);
 *   - MEASURE_IDS_SCRIPT: la fel, dar doar pentru cateva elemente (cautarea capetelor exacte);
 *   - TIMERS_*_SCRIPT, SETTLE_SCRIPT: dupa schimbarea latimii, asteapta ca pagina sa se
 *                       rearanjeze, doar cat e nevoie (urmareste timerele scurte ale paginii);
 *   - DESCRIBE_SCRIPT:  pentru elementele dintr-un semnal: selectorul CSS, fragmentul HTML, textul
 *                       si pozitia lor (pentru captura);
 *   - META_VIEWPORT_SCRIPT: continutul etichetei <meta name="viewport"> (null = lipseste).
 *
 * Elementele primesc un numar tinut minte in pagina (acelasi la toate latimile), ca masuratorile
 * de la latimi diferite sa poata fi comparate. DOM-ul paginii nu e modificat (nici un atribut nou);
 * singura schimbare e window.setTimeout, inlocuit temporar si pus la loc la final.
 * Scripturile sunt texte (nu functii TypeScript), ca sa ruleze exact asa in browser.
 */

/** Cate elemente cu continut masuram, cel mult (pagina cea mai mare din lucrarea ReDeCheck avea 1469). */
export const MAX_ELEMENTS = 1500;

/**
 * Timerele paginii pe care le asteptam dupa schimbarea latimii: cele programate cu o intarziere
 * de cel mult atat (alegere proprie). Scripturile care reactioneaza la redimensionare isi amana
 * de obicei lucrul cu 100-250 ms ("debounce"; pe primaria-iasi.ro: 200 ms), ca sa nu refaca
 * pagina la fiecare pixel; timerele mai lungi sunt de obicei altceva (pe primaria-iasi.ro: un
 * widget extern la 500 ms, caruselul care se deruleaza singur la ~5 s).
 */
export const MAX_TRACKED_DELAY_MS = 300;
/** Cat asteptam, cel mult, ca pagina sa se linisteasca dupa o redimensionare (alegere proprie). */
export const MAX_SETTLE_MS = 1000;
/**
 * Cat asteptam cand pagina reactioneaza la redimensionare, dar nu i-am vazut niciun timer (ex.
 * un script care si-a pastrat functia setTimeout originala): asteptarea fixa de dinainte.
 */
export const FALLBACK_SETTLE_MS = 150;

/** Numarul elementelor, tinut minte in pagina (functia comuna a scripturilor de mai jos). */
const ID_HELPERS = `
  const state = window.__w4aLayout || (window.__w4aLayout = { ids: new WeakMap(), els: new Map(), next: 1 });
  const idOf = (el) => {
    let id = state.ids.get(el);
    if (!id) {
      id = state.next++;
      state.ids.set(el, id);
      state.els.set(id, el);
    }
    return id;
  };
  const sx = window.scrollX;
  const sy = window.scrollY;
  const R = (r) => [Math.round(r.left + sx), Math.round(r.top + sy), Math.round(r.width), Math.round(r.height)];
  const MEDIA = new Set(["IMG", "SVG", "VIDEO", "CANVAS", "IFRAME", "OBJECT", "EMBED"]);
  const CONTROL = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);
  // Randurile de text scrise direct in element (nu in copii), in coordonatele paginii
  const textRects = (el) => {
    const rects = [];
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.data.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width >= 3 && r.height >= 3) rects.push(R(r));
      if (rects.length >= 12) break;
    }
    return rects;
  };
`;

/**
 * Masurarea unui element, comuna celor doua scripturi de mai jos. `step(el, ctx)` primeste
 * contextul mostenit de la stramosi (ce il taie, daca e fix, opacitatea etc.) si intoarce
 * `{ entry, next }`: masurarea elementului (null = fara continut vizibil) si contextul pentru
 * copiii lui (null = nu intram in el). null = elementul nu se afiseaza deloc.
 */
const MEASURE_HELPERS = `
  const root = document.documentElement;
  const body = document.body;
  const clipsAxis = (value) => value === "hidden" || value === "clip";
  const rootStyle = getComputedStyle(root);
  const bodyStyle = body ? getComputedStyle(body) : null;
  const rootClipsX = clipsAxis(rootStyle.overflowX) ||
    (rootStyle.overflowX === "visible" && !!bodyStyle && clipsAxis(bodyStyle.overflowX));
  const inter = (a, b) => {
    const x = Math.max(a[0], b[0]);
    const y = Math.max(a[1], b[1]);
    const right = Math.min(a[0] + a[2], b[0] + b[2]);
    const bottom = Math.min(a[1] + a[3], b[1] + b[3]);
    return right > x && bottom > y ? [x, y, right - x, bottom - y] : null;
  };
  // Transparenta culorii textului: "rgba(0, 0, 0, 0.1)" -> 0.1; "rgb(...)" -> 1
  const colorAlpha = (color) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(color);
    if (!m) return 1;
    const parts = m[1].split(/[\\s,/]+/).filter(Boolean);
    return parts.length >= 4 ? parseFloat(parts[3]) : 1;
  };
  const INTERACTIVE = "a[href],button,input,select,textarea,summary,[role=button],[role=link]";
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "BR", "WBR", "OPTION", "OPTGROUP", "DATALIST"]);
  const vw = root.clientWidth;
  const ROOT_CTX = {
    parent: null, fixed: false, ellipsis: false, opacityZero: false, opacity: 1,
    clips: [], clip: null, inScroller: false, wide: false,
  };
  // Elementele care ies din fereastra spre dreapta (completat de step, folosit de MEASURE_SCRIPT)
  const overflowing = [];

  function step(el, ctx) {
    const tag = el.tagName.toUpperCase();
    if (SKIP.has(tag)) return null;
    const s = getComputedStyle(el);
    if (s.display === "none") return null;
    const opacityZero = ctx.opacityZero || Number(s.opacity) === 0;
    // Opacitatea efectiva (a elementului si a stramosilor), pentru textul abia vizibil
    const opacity = ctx.opacity * Number(s.opacity);
    const hidden = s.visibility !== "visible" || opacityZero;
    const fixed = ctx.fixed || s.position === "fixed" || s.position === "sticky";
    const lineClamp = s.webkitLineClamp;
    const ellipsis = ctx.ellipsis || s.textOverflow === "ellipsis" ||
      (!!lineClamp && lineClamp !== "none");
    const box = R(el.getBoundingClientRect());
    const isMedia = MEDIA.has(tag);
    // Iese din fereastra spre dreapta (si nu e taiat de un container): cauza derularii
    let wide = ctx.wide;
    if (!wide && !fixed && !ctx.inScroller && box[2] > 0 && box[3] > 0) {
      let seen = box;
      for (const c of ctx.clips) seen = seen && inter(seen, c);
      if (seen && seen[0] + seen[2] > vw + 3) {
        overflowing.push({ id: idOf(el), right: seen[0] + seen[2] });
        wide = true;
      }
    }
    const isControl = CONTROL.has(tag) && !(tag === "INPUT" && el.type === "hidden");

    // Un element care isi taie singur continutul (overflow: hidden) e containerul propriului text
    let ownClips = ctx.clips;
    let ownClip = ctx.clip;
    if (el !== root && el !== body && (s.overflowX !== "visible" || s.overflowY !== "visible")) {
      const bl = parseFloat(s.borderLeftWidth) || 0;
      const br = parseFloat(s.borderRightWidth) || 0;
      const bt = parseFloat(s.borderTopWidth) || 0;
      const bb = parseFloat(s.borderBottomWidth) || 0;
      const inner = [box[0] + bl, box[1] + bt, box[2] - bl - br, box[3] - bt - bb];
      const FAR = 1e7;
      const axisBox = (cx, cy) => [
        cx ? inner[0] : -FAR, cy ? inner[1] : -FAR, cx ? inner[2] : 2 * FAR, cy ? inner[3] : 2 * FAR,
      ];
      // Vizibil: taiat de orice container cu overflow (si de cele cu derulare proprie)
      ownClips = ctx.clips.concat([axisBox(s.overflowX !== "visible", s.overflowY !== "visible")]);
      // Pierdut: doar ce taie overflow hidden / clip (in rest, continutul se poate derula)
      if (clipsAxis(s.overflowX) || clipsAxis(s.overflowY)) {
        ownClip = { id: idOf(el), box: axisBox(clipsAxis(s.overflowX), clipsAxis(s.overflowY)) };
      }
    }

    let kind = null;
    let rects = [];
    if (!hidden) {
      if (isMedia || isControl) {
        kind = isMedia ? "media" : "control";
        rects = box[2] >= 3 && box[3] >= 3 ? [box] : [];
      } else {
        rects = textRects(el);
        kind = "text";
      }
    }
    let parent = ctx.parent;
    let entry = null;
    // Imaginile si controalele sunt taiate doar de stramosi; textul, si de elementul lui
    const myClips = kind === "text" ? ownClips : ctx.clips;
    const myClip = kind === "text" ? ownClip : ctx.clip;
    if (kind && rects.length > 0) {
      let visible = rects;
      for (const c of myClips) visible = visible.map((r) => inter(r, c)).filter(Boolean);
      const id = idOf(el);
      const alpha = kind === "text" ? colorAlpha(s.color) : 1;
      entry = {
        id,
        parent: ctx.parent,
        kind,
        interactive: el.matches(INTERACTIVE),
        fixed,
        ellipsis,
        faint: opacity * alpha < 0.35,
        inScroller: ctx.inScroller,
        rects,
        visible,
        clip: myClip,
      };
      parent = id;
    }
    // Nu intram in imagini (svg), iframe-uri si controale (butonul are deja caseta lui)
    if (isMedia || isControl) return { entry, next: null };

    // Copiii sunt taiati de acest element (daca are overflow), ca si de stramosii lui
    const inScroller = ctx.inScroller ||
      (el !== root && el !== body && (s.overflowX === "auto" || s.overflowX === "scroll"));
    return {
      entry,
      next: { parent, fixed, ellipsis, opacityZero, opacity, clips: ownClips, clip: ownClip, inScroller, wide },
    };
  }

  const scroller = document.scrollingElement || root;
  const pageInfo = () => ({ viewportWidth: vw, scrollWidth: scroller.scrollWidth, rootClipsX });
`;

/** Toata pagina, la latimea curenta (cel mult `maxElements` elemente cu continut). */
export const MEASURE_SCRIPT = `(maxElements) => {
  ${ID_HELPERS}
  ${MEASURE_HELPERS}
  const out = [];
  let truncated = false;
  function walk(el, ctx) {
    if (out.length >= maxElements) {
      truncated = true;
      return;
    }
    const result = step(el, ctx);
    if (!result) return;
    if (result.entry) out.push(result.entry);
    if (!result.next) return;
    for (const child of el.children) walk(child, result.next);
    if (el.shadowRoot) for (const child of el.shadowRoot.children) walk(child, result.next);
  }
  if (body) walk(body, ROOT_CTX);
  return {
    ...pageInfo(),
    elements: out,
    overflowing: overflowing.sort((a, b) => b.right - a.right).slice(0, 10).map((o) => o.id),
    truncated,
  };
}`;

/**
 * Doar elementele cu numerele date (cele dintr-un semnal), la latimea curenta: pentru cautarea
 * capetelor exacte ale unui interval, unde masurarea intregii pagini ar fi prea lenta. Fiecare
 * element e masurat exact ca in MEASURE_SCRIPT, parcurgand doar drumul de la <body> la el
 * (contextul mostenit de la stramosi). Un element care nu se vede lipseste din raspuns.
 */
export const MEASURE_IDS_SCRIPT = `(ids) => {
  ${ID_HELPERS}
  ${MEASURE_HELPERS}
  const out = [];
  for (const id of ids) {
    const el = state.els.get(id);
    if (!el || !el.isConnected || !body) continue;
    const chain = [];
    let n = el;
    while (n && n !== body) {
      chain.unshift(n);
      n = n.parentElement || (n.parentNode && n.parentNode.host) || null;
    }
    if (n !== body) continue;
    chain.unshift(body);
    let ctx = ROOT_CTX;
    for (const node of chain) {
      const result = step(node, ctx);
      if (!result) break;
      if (node === el) {
        if (result.entry) out.push(result.entry);
        break;
      }
      if (!result.next) break;
      ctx = result.next;
    }
  }
  return { ...pageInfo(), elements: out, overflowing: [], truncated: false };
}`;

/**
 * Urmarirea timerelor paginii (instalata o data, inainte de masuratori). Inlocuieste
 * window.setTimeout cu o varianta care tine minte timerele scurte (<= MAX_TRACKED_DELAY_MS)
 * programate imediat dupa o redimensionare (de scripturile care reactioneaza la ea), pana cand
 * ruleaza; restul se comporta exact ca inainte.
 * TIMERS_RESTORE_SCRIPT pune functiile originale la loc, la final.
 */
export const TIMERS_INSTALL_SCRIPT = `(() => {
  if (window.__w4aTimers) return;
  const t = {
    on: false,
    seen: 0,
    pending: new Set(),
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
  };
  window.setTimeout = function (fn, delay, ...args) {
    if (!t.on || typeof fn !== "function" || (Number(delay) || 0) > ${MAX_TRACKED_DELAY_MS}) {
      return t.setTimeout.call(window, fn, delay, ...args);
    }
    let id;
    const wrapped = function () {
      t.pending.delete(id);
      return fn.apply(this, arguments);
    };
    id = t.setTimeout.call(window, wrapped, delay, ...args);
    t.pending.add(id);
    t.seen++;
    return id;
  };
  window.clearTimeout = function (id) {
    t.pending.delete(id);
    return t.clearTimeout.call(window, id);
  };
  window.__w4aTimers = t;
})()`;

export const TIMERS_RESTORE_SCRIPT = `(() => {
  const t = window.__w4aTimers;
  if (!t) return;
  window.setTimeout = t.setTimeout;
  window.clearTimeout = t.clearTimeout;
  delete window.__w4aTimers;
})()`;

/** Chemat chiar inainte de redimensionare: de acum tinem minte timerele noi. */
export const TIMERS_BEGIN_SCRIPT = `(() => {
  const t = window.__w4aTimers;
  if (!t) return;
  t.pending.clear();
  t.seen = 0;
  t.on = true;
})()`;

/**
 * Dupa schimbarea latimii: asteapta ca pagina sa se rearanjeze, doar cat e nevoie.
 *   1. doua cadre de desenare (regulile CSS si ResizeObserver se aplica in ele);
 *   2. timerele scurte programate in acest timp (de scripturile care reactioneaza la
 *      redimensionare) le asteptam sa ruleze, cel mult MAX_SETTLE_MS. Nu urmarim timerele
 *      programate mai tarziu (de ele sau de bucle care se reprogrameaza la nesfarsit: pe
 *      primaria-iasi.ro, la 20 si 60 ms), altfel am astepta mereu pana la limita;
 *   3. daca pagina asculta evenimentul "resize", dar nu i-am vazut timerele, asteptarea fixa
 *      FALLBACK_SETTLE_MS;
 *   4. duce la final animatiile si tranzitiile CSS cu durata finita (ex. un meniu care se strange
 *      animat), ca sa nu masuram pagina la jumatatea unei miscari.
 * O pagina fara scripturi care reactioneaza la latime e gata dupa cateva zeci de milisecunde.
 */
export const SETTLE_SCRIPT = `async (resizeListeners) => {
  const t = window.__w4aTimers;
  const sleep = (ms) => new Promise((resolve) => ((t && t.setTimeout) || setTimeout).call(window, resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const started = performance.now();
  await frame();
  await frame();
  if (t) {
    t.on = false;
    while (t.pending.size > 0 && performance.now() - started < ${MAX_SETTLE_MS}) await sleep(10);
    if (t.seen > 0) {
      await frame();
      await frame();
    }
  }
  if (resizeListeners && (!t || t.seen === 0)) await sleep(${FALLBACK_SETTLE_MS});
  for (const animation of document.getAnimations()) {
    try {
      const end = animation.effect && animation.effect.getComputedTiming().endTime;
      if (animation.playState !== "finished" && Number.isFinite(end)) animation.finish();
    } catch (e) {
      // animatie care nu poate fi terminata: o lasam asa
    }
  }
  await frame();
}`;

/**
 * Descrierea elementelor dintr-un semnal, dupa numarul lor: selector CSS unic, fragmentul HTML
 * (taiat), inceputul textului si pozitia in pagina, la latimea curenta: a continutului (`box`,
 * ex. randurile de text) si a elementului intreg (`elementBox`, ex. un container prea lat).
 * null = elementul nu mai exista in pagina.
 */
export const DESCRIBE_SCRIPT = `(ids) => {
  ${ID_HELPERS}
  const unique = (selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (e) {
      return false;
    }
  };
  const selectorOf = (el) => {
    if (el.id && unique("#" + CSS.escape(el.id))) return "#" + CSS.escape(el.id);
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      if (n.id && unique("#" + CSS.escape(n.id))) {
        parts.unshift("#" + CSS.escape(n.id));
        break;
      }
      let part = n.tagName.toLowerCase();
      const parent = n.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === n.tagName);
        if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(n) + 1) + ")";
      }
      parts.unshift(part);
    }
    return parts.join(" > ");
  };
  return ids.map((id) => {
    const el = state.els.get(id);
    if (!el || !el.isConnected) return null;
    const tag = el.tagName.toUpperCase();
    const own = MEDIA.has(tag) || CONTROL.has(tag) ? [] : textRects(el);
    const rects = own.length > 0 ? own : [R(el.getBoundingClientRect())];
    const x = Math.min(...rects.map((r) => r[0]));
    const y = Math.min(...rects.map((r) => r[1]));
    const right = Math.max(...rects.map((r) => r[0] + r[2]));
    const bottom = Math.max(...rects.map((r) => r[1] + r[3]));
    const html = el.outerHTML;
    const text = (el.innerText || el.getAttribute("alt") || el.getAttribute("aria-label") ||
      el.getAttribute("title") || el.value || "").trim().replace(/\\s+/g, " ");
    return {
      selector: selectorOf(el),
      htmlSnippet: html.length > 300 ? html.slice(0, 300) + "…" : html,
      text: text ? text.slice(0, 120) : null,
      box: [x, y, right - x, bottom - y],
      elementBox: R(el.getBoundingClientRect()),
    };
  });
}`;

/** Continutul etichetei <meta name="viewport"> (null = lipseste). */
export const META_VIEWPORT_SCRIPT = `(() => {
  const meta = [...document.querySelectorAll("meta[name]")]
    .find((m) => m.getAttribute("name").trim().toLowerCase() === "viewport");
  return meta ? (meta.getAttribute("content") || "") : null;
})()`;
