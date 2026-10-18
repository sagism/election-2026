// "שוק התחזיות": מי יהיה ראש הממשלה לפי Polymarket.
// מציג קודם את תמונת המצב מ-polymarket.js, ואז מנסה לרענן מה-API הציבורי.
(function () {
  const { byId, esc, fmtDate, photo } = window.EG;
  const M = window.MARKET;
  const box = document.getElementById("marketBody");
  if (!box || !M) return;
  const GAMMA = `https://gamma-api.polymarket.com/events?slug=${M.slug}`;
  const HIST = tok => `https://clob.polymarket.com/prices-history?market=${tok}&interval=max&fidelity=1440`;
  const MIN = 10; // באלפיות: מועמדים מתחת ל-1% מקובצים ל"כל השאר"

  // היסטוריה מהקובץ: "YYYY-MM-DD:v MM-DD:v ..." -> [[iso, v], ...]
  function parseHist(s) {
    let year = "";
    return s.split(" ").map(tok => {
      const [d, v] = tok.split(":");
      const full = d.length === 10 ? d : `${year}-${d}`;
      year = full.slice(0, 4);
      return [full, +v];
    });
  }
  let state = {
    live: false, asOf: M.asOf, volume: M.volume, prices: { ...M.prices }, tokens: { ...M.tokens },
    hist: Object.fromEntries(Object.entries(M.history).map(([k, v]) => [k, parseHist(v)]))
  };

  const who = k => { const p = M.people[k]; return { he: p ? p[0] : k, party: p && p[1] ? byId[p[1]] : null }; };
  const pct = v => (v / 10).toFixed(v < 100 ? 1 : 0) + "%";
  const color = k => { const w = who(k); return w.party ? w.party.color : "var(--ink-2)"; };

  function weekAgo(k) {
    const h = state.hist[k]; if (!h || h.length < 2) return null;
    const last = new Date(h[h.length - 1][0]); last.setUTCDate(last.getUTCDate() - 7);
    const cut = last.toISOString().slice(0, 10);
    let best = null; h.forEach(([d, v]) => { if (d <= cut) best = v; });
    return best;
  }

  function render() {
    const rows = Object.entries(state.prices).sort((a, b) => b[1] - a[1]);
    const main = rows.filter(([, v]) => v >= MIN), rest = rows.filter(([, v]) => v < MIN);
    const restSum = rest.reduce((s, [, v]) => s + v, 0);
    const bars = main.map(([k, v], i) => {
      const w = who(k), wa = weekAgo(k), d = wa === null ? null : (v - wa) / 10;
      const chg = d === null || Math.abs(d) < 0.5 ? `<span class="mk-chg flat">ללא שינוי</span>` :
        `<span class="mk-chg ${d > 0 ? "up" : "down"}"><span dir="ltr">${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}</span></span>`;
      return `<div class="mk-row rise" style="--i:${i};--pc:${color(k)}">
        ${w.party ? `<a href="party.html#${w.party.id}" class="mk-av">${photo(w.party, "sm")}</a>` : '<span class="mk-av"></span>'}
        <div class="mk-name"><b>${esc(w.he)}</b><small>${w.party ? esc(w.party.short) : ""}</small></div>
        <div class="mk-bar"><span style="width:${Math.min(100, v / 10)}%"></span></div>
        <b class="mk-val">${pct(v)}</b>${chg}
      </div>`;
    }).join("") + (rest.length ? `<div class="mk-row mk-rest"><span class="mk-av"></span><div class="mk-name"><b>כל השאר</b><small>${rest.length} מועמדים, כל אחד מתחת ל-1%</small></div><div class="mk-bar"><span style="width:${restSum / 10}%"></span></div><b class="mk-val">${pct(restSum)}</b><span></span></div>` : "");

    const when = new Date(state.asOf);
    const stamp = `${fmtDate(when.toISOString().slice(0, 10), true)}, ${when.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}`;
    box.innerHTML = `
      <div class="mk-grid">
        <div class="mk-bars panel">
          <div class="mk-status ${state.live ? "live" : ""}"><i></i>${state.live ? "נתונים חיים" : "תמונת מצב"} · ${stamp}</div>
          ${bars}
          <p class="small muted mk-foot">השינוי: נקודות אחוז לעומת לפני שבוע. מחזור מסחר כולל: <span dir="ltr">$${(state.volume / 1e6).toFixed(1)}M</span>. <a href="${M.url}" target="_blank" rel="noopener">לשוק ב-Polymarket ↗</a></p>
        </div>
        <div class="mk-chart panel" id="mkChart"></div>
      </div>`;
    drawChart(main.map(([k]) => k).filter(k => state.hist[k] && state.hist[k].length > 1));
  }

  function drawChart(keys) {
    const el = document.getElementById("mkChart");
    if (!keys.length) { el.innerHTML = '<p class="muted">אין היסטוריה להצגה.</p>'; return; }
    const W = Math.max(320, Math.min(760, el.clientWidth - 24 || 600)), H = W < 500 ? 260 : 300;
    const m = { t: 14, r: 40, b: 28, l: 104 };
    const all = keys.flatMap(k => state.hist[k]);
    const t0 = Math.min(...all.map(x => +new Date(x[0]))), t1 = Math.max(...all.map(x => +new Date(x[0])));
    const X = d => W - m.r - ((+new Date(d) - t0) / Math.max(t1 - t0, 1)) * (W - m.l - m.r);  // ישן בימין
    const Y = v => m.t + (1 - v / 1000 * 100 / 70) * (H - m.t - m.b);                        // סקאלה 0–70%
    const ticks = [0, 10, 20, 30, 40, 50, 60, 70];
    const months = []; { const d = new Date(t0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); const step = W < 500 ? 2 : 1; while (+d <= t1) { months.push(d.toISOString().slice(0, 10)); d.setUTCMonth(d.getUTCMonth() + step); } }
    const MON = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
    // תוויות בקצה הקו (שמאל), עם הזזה קטנה כדי שלא יתנגשו
    const ends = keys.map(k => { const h = state.hist[k]; return { k, y: Y(h[h.length - 1][1]) }; }).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    el.innerHTML = `<h3>ההסתברות לאורך זמן</h3>
      <div class="mk-svgwrap"><svg viewBox="0 0 ${W} ${H}" style="direction:ltr" role="img" aria-label="ההסתברות לפי Polymarket לאורך זמן: ${keys.map(k => `${who(k).he} ${pct(state.prices[k])}`).join(", ")}">
        ${ticks.map(v => `<line class="gridl${v === 50 ? " half" : ""}" x1="${m.l}" x2="${W - m.r}" y1="${Y(v * 10)}" y2="${Y(v * 10)}"/><text x="${W - m.r + 6}" y="${Y(v * 10) + 4}">${v}%</text>`).join("")}
        ${months.map(d => `<text x="${X(d)}" y="${H - 8}" text-anchor="middle">${MON[+d.slice(5, 7) - 1]}</text>`).join("")}
        ${keys.map(k => `<path class="mk-line" style="stroke:${color(k)}" d="${state.hist[k].map(([d, v], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`).join("")}
        ${ends.map(e => { const h = state.hist[e.k]; const last = h[h.length - 1]; return `<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="4" style="fill:${color(e.k)}" class="mk-end"/><text class="mk-lab" x="${X(last[0]) - 8}" y="${e.y + 4}" direction="rtl" text-anchor="start">${esc(who(e.k).he.split(" ").slice(-1)[0])} ${pct(last[1])}</text>`; }).join("")}
        <line class="mk-x" x1="-10" x2="-10" y1="${m.t}" y2="${H - m.b}"/>
      </svg><div class="mk-tip" hidden></div></div>`;
    const svg = el.querySelector("svg"), tip = el.querySelector(".mk-tip"), cross = el.querySelector(".mk-x");
    const dates = [...new Set(all.map(x => x[0]))].sort();
    const valAt = (k, d) => { let v = null; state.hist[k].forEach(([dd, vv]) => { if (dd <= d) v = vv; }); return v; };
    svg.addEventListener("pointermove", e => {
      const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) * W / r.width;
      let best = dates[0], bd = 1e9; dates.forEach(d => { const dd = Math.abs(X(d) - sx); if (dd < bd) { bd = dd; best = d; } });
      cross.setAttribute("x1", X(best)); cross.setAttribute("x2", X(best));
      tip.innerHTML = `<b>${fmtDate(best, true)}</b>` + keys.map(k => [k, valAt(k, best)]).filter(x => x[1] !== null).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<span><i style="background:${color(k)}"></i>${esc(who(k).he)} <b>${pct(v)}</b></span>`).join("");
      tip.hidden = false;
      const px = X(best) * r.width / W, cw = el.querySelector(".mk-svgwrap").clientWidth;
      tip.style.left = (px > cw / 2 ? px - tip.offsetWidth - 12 : px + 12) + "px";
    });
    svg.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("x1", -10); cross.setAttribute("x2", -10); });
  }

  // רענון חי. אם Polymarket לא זמין (חסימה, רשת), נשארים עם תמונת המצב.
  async function refresh() {
    const get = (url, ms = 7000) => Promise.race([fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);
    try {
      const ev = (await get(GAMMA))[0];
      const prices = {}, tokens = {};
      ev.markets.filter(m => m.active && !m.closed).forEach(m => {
        const p = +JSON.parse(m.outcomePrices || "[0]")[0];
        if (!m.groupItemTitle || /^Person [A-Z]$|^Other$/.test(m.groupItemTitle)) return;
        prices[m.groupItemTitle] = Math.round(p * 10000) / 10; tokens[m.groupItemTitle] = JSON.parse(m.clobTokenIds || "[]")[0];
      });
      if (!Object.keys(prices).length) return;
      state = { ...state, live: true, asOf: new Date().toISOString(), volume: ev.volume || state.volume, prices, tokens };
      render();
      const top = Object.entries(prices).filter(([, v]) => v >= MIN).map(([k]) => k);
      const hs = await Promise.all(top.map(k => get(HIST(tokens[k])).then(j => [k, j.history]).catch(() => [k, null])));
      hs.forEach(([k, h]) => { if (h && h.length) state.hist[k] = h.map(x => [new Date(x.t * 1000).toISOString().slice(0, 10), Math.round(x.p * 1000)]); });
      render();
    } catch (e) { /* נשארים עם תמונת המצב */ }
  }

  render();
  refresh();
  let rw = 0;
  window.addEventListener("resize", () => { const c = document.getElementById("mkChart"); if (c && Math.abs(c.clientWidth - rw) > 40) { rw = c.clientWidth; render(); } });
})();
