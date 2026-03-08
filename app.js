"use strict";
// app.js — depends on data.js being loaded first (globals: euCountries, manualCenters,
// TOTAL, MAJORITY, stateOrder, stateColors, stateLabels, stateLabelColors,
// stateShort, shortToState, WEST_COUNTRIES, EAST_COUNTRIES)

/* ════════════════════════════════════════════════════
   RUNTIME STATE
════════════════════════════════════════════════════ */

// One debounce timer slot per country id (ticker debounce)
const newsTimers = {};

/* ════════════════════════════════════════════════════
   FEATURE 1 — URL STATE MANAGEMENT
   Encode every non-neutral country into a compact
   query string and keep the address bar in sync via
   window.history.replaceState (no page reload).
════════════════════════════════════════════════════ */
function encodeMapState() {
  const parts = [];
  for (const id in euCountries) {
    const st = euCountries[id].state;
    if (st !== "neutral") parts.push(id + ":" + stateShort[st]);
  }
  return parts.join(",");
}

function decodeMapState(str) {
  if (!str) return;
  str.split(",").forEach(part => {
    const [id, code] = part.split(":");
    if (id && code && euCountries[id] && shortToState[code])
      euCountries[id].state = shortToState[code];
  });
}

function pushUrl() {
  const enc = encodeMapState();
  const url  = enc
    ? window.location.pathname + "?map=" + encodeURIComponent(enc)
    : window.location.pathname;
  window.history.replaceState(null, "", url);
}

function loadFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const m = p.get("map");
  if (m) decodeMapState(decodeURIComponent(m));
}

function copyShareUrl() {
  const enc = encodeMapState();
  const url  = enc
    ? window.location.origin + window.location.pathname + "?map=" + encodeURIComponent(enc)
    : window.location.origin + window.location.pathname;
  navigator.clipboard.writeText(url).then(() => {
    const t = document.getElementById("share-toast");
    t.style.display = "block";
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.display = "none"; }, 2800);
  }).catch(() => prompt("Copiez ce lien :", url));
}

/* ════════════════════════════════════════════════════
   FEATURE 2 — BREAKING NEWS TICKER
   The DOM node is destroyed and recreated on each
   message so the CSS animation always restarts from
   position 0 rather than continuing mid-scroll.
════════════════════════════════════════════════════ */
const TICKER_DEFAULT =
  "EN DIRECT : Simulation des élections des États-Unis d'Europe" +
  " &nbsp;·&nbsp; Majorité requise : 470 sièges" +
  " &nbsp;·&nbsp; 39 États participants" +
  " &nbsp;·&nbsp; Total : 938 grands électeurs" +
  " &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";

let _tickerQueue = [];
let _tickerBusy  = false;
let _tickerTimer = null;

function _setTickerHTML(html, fast) {
  const track = document.getElementById("ticker-track");
  const old   = track.querySelector(".ticker-text");
  if (old) track.removeChild(old);
  const el = document.createElement("div");
  el.className = "ticker-text " + (fast ? "fast" : "normal");
  el.innerHTML  = html;
  track.appendChild(el);
}

function pushTicker(html) {
  _tickerQueue.push(html);
  if (!_tickerBusy) _nextTicker();
}

function _nextTicker() {
  if (_tickerQueue.length === 0) {
    _tickerBusy = false;
    _setTickerHTML(TICKER_DEFAULT, false);
    return;
  }
  _tickerBusy = true;
  if (_tickerTimer) { clearTimeout(_tickerTimer); _tickerTimer = null; }
  const msg = _tickerQueue.shift();
  _setTickerHTML(msg + " &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; " + TICKER_DEFAULT, true);
  _tickerTimer = setTimeout(_nextTicker, 19000);
}

/* ── Debounced ticker: fires 800 ms after the LAST click on a country ── */
function scheduleTickerNews(id) {
  clearTimeout(newsTimers[id]);
  newsTimers[id] = setTimeout(() => {
    const c  = euCountries[id];
    const st = c.state;
    if (st === "neutral") {
      pushTicker(
        "⬜ RECOMPTAGE : Les résultats de <b>" + c.name + "</b> sont annulés" +
        " — " + c.seats + " EV repassent en Non Assigné"
      );
      return;
    }
    const isDem = st === "blue" || st === "lightBlue";
    const icons = { blue:"🔵", lightBlue:"💙", red:"🟣", lightRed:"💜" };
    const icon  = icons[st] || "";
    const party = isDem ? "Fédéralistes" : "Souverainistes";
    const col   = stateLabelColors[st];
    pushTicker(
      icon + " PROJECTION : <b>" + c.name + "</b> remportée par le parti" +
      " <span style='color:" + col + ";font-weight:700'>" + party + "</span>" +
      " — " + c.seats + " grands électeurs"
    );
  }, 800);
}

/* ════════════════════════════════════════════════════
   COUNTUP (requestAnimationFrame)
════════════════════════════════════════════════════ */
const _raf = { dem: { id: null }, rep: { id: null } };
const DUR  = 500;

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function animateCount(side, end) {
  const st = _raf[side];
  if (st.id) { cancelAnimationFrame(st.id); st.id = null; }
  const el   = document.getElementById("score-" + side);
  const from = parseInt(el.textContent) || 0;
  if (from === end) return;
  const diff = end - from;
  const t0   = performance.now();
  const tick = now => {
    const p = Math.min((now - t0) / DUR, 1);
    el.textContent = Math.round(from + diff * easeOut(p));
    if (p < 1) { st.id = requestAnimationFrame(tick); }
    else        { el.textContent = end; st.id = null; }
  };
  st.id = requestAnimationFrame(tick);
}

/* ════════════════════════════════════════════════════
   SCORE CALCULATION
════════════════════════════════════════════════════ */
function getScores() {
  let dem = 0, rep = 0;
  const dB = [], rB = [];
  for (const id in euCountries) {
    const c = euCountries[id];
    if      (c.state === "blue")      { dem += c.seats; dB.push({ id, seats: c.seats, state: "blue" }); }
    else if (c.state === "lightBlue") { dem += c.seats; dB.push({ id, seats: c.seats, state: "lightBlue" }); }
    else if (c.state === "red")       { rep += c.seats; rB.push({ id, seats: c.seats, state: "red" }); }
    else if (c.state === "lightRed")  { rep += c.seats; rB.push({ id, seats: c.seats, state: "lightRed" }); }
  }
  dB.sort((a, b) => {
    const o = { blue: 0, lightBlue: 1 };
    return o[a.state] !== o[b.state] ? o[a.state] - o[b.state] : b.seats - a.seats;
  });
  rB.sort((a, b) => {
    const o = { red: 0, lightRed: 1 };
    return o[a.state] !== o[b.state] ? o[a.state] - o[b.state] : b.seats - a.seats;
  });
  return { dem, rep, demBlocks: dB, repBlocks: rB };
}

/* ════════════════════════════════════════════════════
   MASTER DASHBOARD UPDATE
════════════════════════════════════════════════════ */
function updateDashboard() {
  const s = getScores();
  animateCount("dem", s.dem);
  animateCount("rep", s.rep);
  updateSnake(s);
  updateWinnerBar(s);
  updateMapColors();
  updateSidebar(s);
  pushUrl();
}

/* ════════════════════════════════════════════════════
   ELECTORAL SNAKE
════════════════════════════════════════════════════ */
function updateSnake(s) {
  const wrap    = document.getElementById("snake-wrap");
  const totalPx = wrap.getBoundingClientRect().width || wrap.offsetWidth || 1;
  const toPx    = seats => ((seats / TOTAL) * totalPx).toFixed(2) + "px";

  function sync(container, blocks) {
    const existing = {};
    for (const el of container.children)
      if (!el.dataset.exiting) existing[el.dataset.id] = el;

    const seen = new Set();
    blocks.forEach((b, i) => {
      seen.add(b.id);
      let el = existing[b.id];
      if (!el) {
        el = document.createElement("div");
        el.dataset.id  = b.id;
        el.className   = "snake-block " + b.state;
        el.style.width = "0px";
        el.title       = euCountries[b.id].name + " · " + b.seats + " EV";
        container.insertBefore(el, container.children[i] || null);
        // Double-rAF: let browser register width=0 before animating open
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = toPx(b.seats); }));
      } else {
        el.className   = "snake-block " + b.state;
        el.title       = euCountries[b.id].name + " · " + b.seats + " EV";
        el.style.width = toPx(b.seats);
        const sib = container.children[i];
        if (sib && sib !== el) container.insertBefore(el, sib);
      }
    });

    for (const el of [...container.children]) {
      if (el.dataset.exiting) continue;
      if (!seen.has(el.dataset.id)) {
        el.dataset.exiting = "1";
        el.style.width = "0px";
        setTimeout(() => { if (el.parentNode === container) container.removeChild(el); }, 520);
      }
    }
  }

// --- NOUVEAU MOTEUR DE BARRE DE PROGRESSION ---
    const wrapDem = document.getElementById("snake-dem");
    const wrapRep = document.getElementById("snake-rep");
    const wrapToss = document.getElementById("snake-tossup");

    // 1. On supprime la limite invisible des 50%
    wrapDem.style.maxWidth = "100%";
    wrapRep.style.maxWidth = "100%";
    wrapDem.style.transition = "width 0.5s ease";
    wrapRep.style.transition = "width 0.5s ease";

    // 2. On compte précisément les voix pour chaque nuance
    let dD = 0, dL = 0, rD = 0, rL = 0, nt = 0;
    for (const key in euCountries) {
        const state = euCountries[key].state;
        const ev = euCountries[key].seats;
        if (state === "blue") dD += ev;
        else if (state === "lightBlue") dL += ev;
        else if (state === "red") rD += ev;
        else if (state === "lightRed") rL += ev;
        else nt += ev;
    }

    // 3. On peint la barre des Fédéralistes (Bleu Europe)
    wrapDem.style.width = ((dD + dL) / TOTAL * 100) + "%";
    wrapDem.style.display = "flex";
    wrapDem.innerHTML = 
        (dD > 0 ? `<div style="height:100%; width:${(dD/(dD+dL))*100}%; background:var(--blue);"></div>` : "") +
        (dL > 0 ? `<div style="height:100%; width:${(dL/(dD+dL))*100}%; background:var(--blue-1);"></div>` : "");

    // 4. On peint la barre des Souverainistes (Pourpre)
    wrapRep.style.width = ((rD + rL) / TOTAL * 100) + "%";
    wrapRep.style.display = "flex";
    wrapRep.innerHTML = 
        (rL > 0 ? `<div style="height:100%; width:${(rL/(rD+rL))*100}%; background:var(--red-1);"></div>` : "") +
        (rD > 0 ? `<div style="height:100%; width:${(rD/(rD+rL))*100}%; background:var(--red);"></div>` : "");

    if (wrapToss) wrapToss.style.width = (nt / TOTAL * 100) + "%";
    // ----------------------------------------------
  document.getElementById("score-tossup").textContent = TOTAL - s.dem - s.rep;
}

/* ════════════════════════════════════════════════════
   WINNER BANNER
════════════════════════════════════════════════════ */
function updateWinnerBar(s) {
  const wb = document.getElementById("winner-bar");
  if (s.dem >= MAJORITY) {
    wb.style.cssText = "display:block;background:rgba(0,51,153,0.15);color:#3366CC;border:1px solid rgba(0,51,153,0.6)";
    wb.textContent = "🔵 VICTOIRE FÉDÉRALISTE — " + s.dem + " GRANDS ÉLECTEURS";
  } else if (s.rep >= MAJORITY) {
    wb.style.cssText = "display:block;background:rgba(106,27,154,0.15);color:#9C27B0;border:1px solid rgba(106,27,154,0.6)";
    wb.textContent = "🟣 VICTOIRE SOUVERAINISTE — " + s.rep + " GRANDS ÉLECTEURS";
  } else {
    wb.style.display = "none";
  }
}

/* ════════════════════════════════════════════════════
   MAP COLOUR REFRESH
════════════════════════════════════════════════════ */
function updateMapColors() {
  for (const id in euCountries) {
    const c   = euCountries[id];
    const col = stateColors[c.state];
    const p   = document.getElementById("path-"   + id);
    if (p)  { p.setAttribute("fill", col);  p.className.baseVal  = "country state-"      + c.state; }
    const ci  = document.getElementById("circle-" + id);
    if (ci) { ci.setAttribute("fill", col); ci.className.baseVal = "micro-circle state-" + c.state; }
  }
}

/* ════════════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════════════ */
function updateSidebar(s) {
  const dL = [], rL = [];
  for (const id in euCountries) {
    const c = euCountries[id];
    if      (c.state === "blue"     || c.state === "lightBlue") dL.push({ ...c, id });
    else if (c.state === "red"      || c.state === "lightRed")  rL.push({ ...c, id });
  }
  dL.sort((a, b) => b.seats - a.seats);
  rL.sort((a, b) => b.seats - a.seats);

  const row = c =>
    `<div class="sb-row">` +
    `<div class="sb-dot" style="background:${stateColors[c.state]}"></div>` +
    `<span class="sb-name">${c.name}</span>` +
    `<span class="sb-seats">${c.seats}</span>` +
    `</div>`;

  let html = "";
  html += `<div class="sb-sec dem">Fédéralistes · <span style="opacity:.6">${s.dem} EV</span></div>`;
  html += dL.length ? dL.map(row).join("") : '<div class="sb-empty">Aucun état attribué</div>';
  html += `<div class="sb-sec rep">Souverainistes · <span style="opacity:.6">${s.rep} EV</span></div>`;
  html += rL.length ? rL.map(row).join("") : '<div class="sb-empty">Aucun état attribué</div>';

  const nN = Object.values(euCountries).filter(c => c.state === "neutral").length;
  html += `<div class="sb-total"><span>${nN} neutres</span><span>${TOTAL - s.dem - s.rep} EV</span></div>`;
  document.getElementById("sb-content").innerHTML = html;
}

/* ════════════════════════════════════════════════════
   TOOLTIP — ENRICHED WITH MINI DATAVIZ
════════════════════════════════════════════════════ */
const tooltip = document.getElementById("tooltip");

function showTT(evt, id) {
  const c      = euCountries[id];
  const pct    = ((c.seats / TOTAL) * 100).toFixed(1);
  const col    = stateColors[c.state];
  const lc     = stateLabelColors[c.state];
  const badgeBg = col + "28";
  const hint   = c.state === "neutral" ? "Cliquez pour attribuer" : "Clic gauche · Clic droit = effacer";

  tooltip.innerHTML =
    `<div class="tt-abbr">${c.abbr} &nbsp;·&nbsp; ${c.seats} sièges</div>` +
    `<div class="tt-name">${c.name}</div>` +
    `<span class="tt-badge" style="background:${badgeBg};color:${lc};border:1px solid ${lc}44">${stateLabels[c.state]}</span>` +
    `<div class="tt-sep"></div>` +
    `<div class="tt-weight-row">` +
      `<span class="tt-weight-lbl">Poids électoral</span>` +
      `<span class="tt-weight-pct">${pct} %</span>` +
    `</div>` +
    `<div class="tt-track"><div class="tt-fill" style="width:${pct}%;background:${col}"></div></div>` +
    `<div class="tt-seats-row">` +
      `<span>Grands électeurs</span>` +
      `<span class="tt-seats-val">${c.seats} / ${TOTAL}</span>` +
    `</div>` +
    `<div class="tt-hint">${hint}</div>`;

  tooltip.style.display = "block";
  posTT(evt);
}

function posTT(evt) {
  const mx = evt.clientX, my = evt.clientY;
  const tw = tooltip.offsetWidth  || 210;
  const th = tooltip.offsetHeight || 155;
  const m  = 14;
  let x = mx + m, y = my + m;
  if (x + tw > window.innerWidth  - 6) x = mx - tw - m;
  if (y + th > window.innerHeight - 6) y = my - th - m;
  tooltip.style.left = x + "px";
  tooltip.style.top  = y + "px";
}

function moveTT(evt) { if (tooltip.style.display === "block") posTT(evt); }
function hideTT()    { tooltip.style.display = "none"; }

/* ════════════════════════════════════════════════════
   STATE CYCLE + RESET
════════════════════════════════════════════════════ */
function cycleState(id) {
  const c = euCountries[id];
  c.state = stateOrder[(stateOrder.indexOf(c.state) + 1) % stateOrder.length];
  scheduleTickerNews(id);   // debounced — only fires 800 ms after the last click
}

function resetCountry(id) {
  const old = euCountries[id].state;
  euCountries[id].state = "neutral";
  if (old !== "neutral") scheduleTickerNews(id);
  updateDashboard();
}

/* ════════════════════════════════════════════════════
   SCENARIO BUTTONS
════════════════════════════════════════════════════ */
function resetAll() {
  for (const id in euCountries) euCountries[id].state = "neutral";
  pushTicker("↺ RÉINITIALISATION — Tous les États repassent en Non Assigné");
  updateDashboard();
}

function applyWave(side) {
    const [winDark, winLight, loseDark, loseLight] = side === "blue" 
        ? ["blue", "lightBlue", "red", "lightRed"] 
        : ["red", "lightRed", "blue", "lightBlue"];

    const ids = Object.keys(euCountries);
    
    // 1. Mélange total des pays
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    let winnerEV = 0;
    const targetEV = Math.floor(Math.random() * (580 - 480 + 1)) + 480;

    // 2. Distribution intelligente avec sécurité anti-variable fantôme
    ids.forEach(id => {
        const country = euCountries[id];
        // On cherche le nombre de points peu importe le nom que Claude lui a donné !
        const points = country.ev || country.votes || country.electoralVotes || country.seats || 15; 
        
        if (winnerEV < targetEV) {
            country.state = Math.random() < 0.65 ? winDark : winLight;
            winnerEV += points;
        } else {
            // Le vainqueur a atteint son score, le reste va à l'adversaire
            const rand = Math.random();
            if (rand < 0.85) {
                country.state = Math.random() < 0.65 ? loseDark : loseLight;
            } else {
                country.state = "neutral";
            }
        }
    });

    pushTicker(side === "blue" 
        ? "🌊 VICTOIRE FÉDÉRALISTE — La majorité est atteinte, mais l'opposition résiste !" 
        : "🌊 VICTOIRE SOUVERAINISTE — La majorité est atteinte, mais l'opposition résiste !");
    updateDashboard();
}

function applyClivage() {
  // WEST_COUNTRIES and EAST_COUNTRIES are defined in data.js
  for (const id in euCountries) {
    if      (WEST_COUNTRIES.has(id)) euCountries[id].state = Math.random() < 0.6 ? "blue" : "lightBlue";
    else if (EAST_COUNTRIES.has(id)) euCountries[id].state = Math.random() < 0.6 ? "red"  : "lightRed";
    else                             euCountries[id].state = "neutral";
  }
  pushTicker("🗺 CLIVAGE EST/OUEST — Fédéralistes à l'Ouest · Souverainistes à l'Est · États charnières en suspens");
  updateDashboard();
}

/* ════════════════════════════════════════════════════
   EXPORT
════════════════════════════════════════════════════ */
function exportImage() {
  const btn = document.querySelector(".btn-export");
  btn.textContent = "⏳ Capture…"; btn.disabled = true;
  html2canvas(document.getElementById("app-root"), {
    backgroundColor: "#0b0f1e", scale: 2,
    useCORS: true, allowTaint: true, logging: false
  }).then(canvas => {
    const a      = document.createElement("a");
    a.download   = "election-ue-" + new Date().toISOString().slice(0, 10) + ".png";
    a.href       = canvas.toDataURL("image/png");
    a.click();
    btn.textContent = "📸 Exporter PNG"; btn.disabled = false;
  }).catch(() => { btn.textContent = "📸 Exporter PNG"; btn.disabled = false; });
}

/* ════════════════════════════════════════════════════
   D3 MAP  (static — no zoom / pan)
   Layer structure:
     gRoot
     ├── background-country paths  (non-EU, inert)
     ├── gEU  [filter: eu-shadow]
     │   ├── .country paths  (EU, clickable)
     │   └── .micro-circle   (MLT, KOS)
     └── gLbl  [pointer-events: none]
         └── .clabel text pairs (crisp, no shadow)
════════════════════════════════════════════════════ */
const svgEl  = d3.select("#map");
const W = 1400, H = 900;
const proj   = d3.geoMercator().scale(960).center([10, 52]).translate([W / 2, H / 2]);
const pathGen= d3.geoPath().projection(proj);
const euIds  = new Set(Object.keys(euCountries));
const gRoot  = svgEl.append("g");

// Apply any URL-encoded state BEFORE the GeoJSON fetch so the
// first render already shows the correct colour assignment.
loadFromUrl();

// Initialise the ticker with the default scrolling message
_setTickerHTML(TICKER_DEFAULT, false);

fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
  .then(r => r.json())
  .then(world => {
    const drawnIds = new Set();

    /* ── Layer 1: inert background world ── */
    gRoot.selectAll(".background-country")
      .data(world.features.filter(d => {
        const id = d.id || (d.properties && d.properties.iso_a3);
        return id && !euIds.has(id);
      }))
      .enter()
      .append("path")
      .attr("class", "background-country")
      .attr("d", pathGen);

    /* ── Layer 2: active EU countries with 3D shadow ── */
    const gEU = gRoot.append("g").attr("filter", "url(#eu-shadow)");

    const features = world.features.filter(d => {
      const id = d.id || (d.properties && d.properties.iso_a3);
      return euIds.has(id);
    });

    gEU.selectAll(".country")
      .data(features)
      .enter()
      .append("path")
      .attr("class", d => "country state-" + euCountries[d.id || d.properties.iso_a3].state)
      .attr("d",    pathGen)
      .attr("fill", d => stateColors[euCountries[d.id || d.properties.iso_a3].state])
      .attr("id",   d => "path-" + (d.id || d.properties.iso_a3))
      .on("click", function(evt, d) {
        evt.stopPropagation();
        const id = d.id || d.properties.iso_a3;
        cycleState(id);
        updateDashboard();
        showTT(evt, id);
      })
      .on("contextmenu", function(evt, d) {
        evt.preventDefault(); evt.stopPropagation();
        const id = d.id || d.properties.iso_a3;
        resetCountry(id);
        showTT(evt, id);
      })
      .on("mouseover", (evt, d) => showTT(evt, d.id || d.properties.iso_a3))
      .on("mousemove", moveTT)
      .on("mouseout",  hideTT);

    /* ── Label group — separate so text has no shadow (stays crisp) ── */
    const gLbl = gRoot.append("g").attr("pointer-events", "none");

    features.forEach(d => {
      const id = d.id || d.properties.iso_a3;
      drawnIds.add(id);
      const c = euCountries[id];
      let cx, cy;
      if (manualCenters[id]) {
        [cx, cy] = proj(manualCenters[id]);
      } else {
        const cn = pathGen.centroid(d); cx = cn[0]; cy = cn[1];
      }
      if (isNaN(cx) || isNaN(cy)) return;
      const lg = gLbl.append("g");
      lg.append("text")
        .attr("class", "clabel lbl-a")
        .attr("x", cx).attr("y", cy - 2)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .text(c.abbr);
      lg.append("text")
        .attr("class", "clabel lbl-s")
        .attr("x", cx).attr("y", cy + 10)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .text(c.seats);
    });

    /* ── Micro-states: circles in shadow group, labels in crisp group ── */
    const missing = [...euIds].filter(id => !drawnIds.has(id));
    missing.forEach(id => {
      const c = euCountries[id];
      if (!manualCenters[id]) return;
      const [cx, cy] = proj(manualCenters[id]);

      // Circle → shadow group (gets the 3D drop shadow)
      gEU.append("circle")
        .attr("class", "micro-circle state-" + c.state)
        .attr("id",    "circle-" + id)
        .attr("cx", cx).attr("cy", cy).attr("r", 14)
        .attr("fill", stateColors[c.state])
        .on("click", function(evt) {
          evt.stopPropagation();
          cycleState(id); updateDashboard(); showTT(evt, id);
        })
        .on("contextmenu", function(evt) {
          evt.preventDefault(); evt.stopPropagation();
          resetCountry(id); showTT(evt, id);
        })
        .on("mouseover", evt => showTT(evt, id))
        .on("mousemove", moveTT)
        .on("mouseout",  hideTT);

      // Labels → crisp group (no shadow)
      const ml = gLbl.append("g");
      ml.append("text")
        .attr("class", "clabel lbl-a")
        .attr("x", cx).attr("y", cy - 2)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .text(c.abbr);
      ml.append("text")
        .attr("class", "clabel lbl-s")
        .attr("x", cx).attr("y", cy + 10)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .text(c.seats);
    });

    // First full render (includes any state loaded from URL)
    updateDashboard();
  });

  // GESTION DE L'ÉCRAN D'ACCUEIL
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('welcome-overlay').classList.add('hidden');
});

// ACTUALISATION AUTOMATIQUE DES TEXTES DE L'INTERFACE
document.querySelector('.sc-470').textContent = MAJORITY;
document.getElementById('score-tossup').textContent = TOTAL;
document.getElementById('subtitle').innerHTML = "Simulateur &middot; Élection Présidentielle &middot; " + TOTAL + " Grands Électeurs";

// ==========================================
// INTÉGRATION DU PANNEAU D'INFOS SUR MOBILE
// ==========================================
if (window.matchMedia("(max-width: 900px)").matches) {
    const controls = document.getElementById("controls");
    const tooltip = document.getElementById("tooltip");
    // Déplace l'infobulle juste sous les boutons de scénarios
    controls.parentNode.insertBefore(tooltip, controls.nextSibling);
}

// ==========================================
// DÉPLACEMENT INFOBULLE (ANTI-CRASH)
// ==========================================
try {
    if (window.matchMedia("(max-width: 900px)").matches) {
        const controls = document.getElementById("controls");
        const tooltip = document.getElementById("tooltip");
        if (controls && tooltip) {
            controls.parentNode.insertBefore(tooltip, controls.nextSibling);
        }
    }
} catch(e) { console.log("Erreur mineure ignorée"); }