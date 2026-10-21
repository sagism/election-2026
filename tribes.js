// "מפת השבטים": המנדטים לפי ארבעת המגזרים (ציונים, דתיים-לאומיים, חרדים, ערבים), לפי ממוצע הסקרים.
(function () {
  const { E, P, byId, esc, fmtDate, daysBetween, srcLink } = window.EG;
  const box = document.getElementById("tribesBody");
  if (!box || !P.length) return;

  const fam = id => E.FAMILIES.find(f => f.label === id);
  // החלוקה המקובלת בתקשורת. "ציונים" כולל ימין, מרכז ושמאל.
  const TRIBES = [
    { id: "zion", label: "ציונים", sub: "ימין, מרכז ושמאל", color: "var(--tz)", ids: fam("ציונים").ids, y2022: 78 },
    { id: "natrel", label: "דתיים-לאומיים", sub: "", color: "var(--tn)", ids: fam("דתיים-לאומיים").ids, y2022: 14 },
    { id: "haredi", label: "חרדים", sub: "", color: "var(--th)", ids: fam("חרדים").ids, y2022: 18 },
    { id: "arab", label: "ערבים", sub: "", color: "var(--ta)", ids: fam("ערבים").ids, y2022: 10 }
  ].map(t => ({ ...t, ids: t.ids.filter(id => byId[id] && !byId[id].withdrawn) }));
  const shade = id => byId[id].color; // צבעי המפלגות באתר כבר לפי משפחת השבט
  const SRC2022 = { name: "תוצאות 2022", url: "https://he.wikipedia.org/wiki/%D7%94%D7%91%D7%97%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%9B%D7%A0%D7%A1%D7%AA_%D7%94%D7%A2%D7%A9%D7%A8%D7%99%D7%9D_%D7%95%D7%97%D7%9E%D7%A9" };

  const byDate = (a, b) => b.date.localeCompare(a.date) || b.ref.localeCompare(a.ref);
  // ממוצע ל-14 יום עד תאריך נתון, הסקר האחרון של כל סוקר (כמו בגרף הראשי)
  function avgAsOf(cut) {
    const seen = new Set();
    const win = P.filter(p => p.date <= cut && daysBetween(p.date, cut) < 14).sort(byDate)
      .filter(p => (seen.has(p.pollster) ? false : (seen.add(p.pollster), true)));
    const out = {};
    E.active.forEach(x => { const v = win.map(p => p.seats[x.id]).filter(v => v !== null && v !== undefined); out[x.id] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
    return out;
  }
  const sum = (avg, t) => t.ids.reduce((s, id) => s + (avg[id] || 0), 0);
  // מנדטים בפועל: מפלגה מתחת לאחוז החסימה (ממוצע מתחת ל-3.5) לא נכנסת, והשאר מחולק מחדש ל-120 (כמו מפת המושבים)
  function seatsOf(avg) {
    const live = E.active.filter(x => avg[x.id] >= 3.5);
    const tot = live.reduce((s, x) => s + avg[x.id], 0);
    return Object.fromEntries(E.active.map(x => [x.id, avg[x.id] >= 3.5 ? avg[x.id] / tot * 120 : 0]));
  }

  const dates = [...new Set(P.map(p => p.date))].sort();
  const latest = dates[dates.length - 1];
  const weekAgo = (() => { const d = new Date(latest + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10); })();
  const nowAvg = avgAsOf(latest), now = seatsOf(nowAvg), before = seatsOf(avgAsOf(weekAgo));
  const series = dates.filter(d => d >= dates[0]).map(d => { const s = seatsOf(avgAsOf(d)); return [d, Object.fromEntries(TRIBES.map(t => [t.id, sum(s, t)]))]; });

  const sgn = v => `<span dir="ltr">${v >= 0.05 ? "+" : v <= -0.05 ? "−" : "±"}${Math.abs(v).toFixed(1)}</span>`;

  // פס 120 המושבים: מקטע לכל מפלגה, מקובץ לפי שבט
  const bar = TRIBES.map(t => {
    const n = sum(now, t);
    const segs = t.ids.filter(id => now[id] > 0).sort((a, b) => now[b] - now[a])
      .map(id => `<a class="tb-seg" href="party.html#${id}" style="flex:${now[id].toFixed(2)};--pc:${shade(id)}" title="${esc(byId[id].short)}: ${now[id].toFixed(1)}"></a>`).join("");
    return `<div class="tb-group" style="flex:${n.toFixed(2)}"><div class="tb-label"><b>${esc(t.label)}</b> <span>${n.toFixed(0)}</span></div><div class="tb-segs">${segs}</div></div>`;
  }).join("");

  // כרטיס לכל שבט, עם גרף קטן וסקאלה משלו
  function spark(t) {
    const W = 260, H = 70, m = { t: 8, b: 8, l: 4, r: 4 };
    const vals = series.map(x => x[1][t.id]).concat([t.y2022]);
    const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    const t0 = +new Date(series[0][0]), t1 = +new Date(series[series.length - 1][0]);
    const X = d => W - m.r - ((+new Date(d) - t0) / Math.max(t1 - t0, 1)) * (W - m.l - m.r);
    const Y = v => m.t + (1 - (v - lo) / Math.max(hi - lo, 1)) * (H - m.t - m.b);
    const path = series.map(([d, v], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(v[t.id]).toFixed(1)}`).join(" ");
    const last = series[series.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" style="direction:ltr" aria-hidden="true">
      <line class="tb-ref" x1="${m.l}" x2="${W - m.r}" y1="${Y(t.y2022)}" y2="${Y(t.y2022)}"/>
      <path class="tb-line" d="${path}" style="stroke:${t.color}"/>
      <circle cx="${X(last[0])}" cy="${Y(last[1][t.id])}" r="3.5" style="fill:${t.color}"/></svg>`;
  }
  const cards = TRIBES.map((t, i) => {
    const n = sum(now, t), d22 = n - t.y2022, dW = n - sum(before, t);
    const chips = t.ids.sort((a, b) => nowAvg[b] - nowAvg[a]).map(id => {
      const below = now[id] === 0;
      return `<a class="chip${below ? " tb-out" : ""}" href="party.html#${id}" style="--pc:${shade(id)}" title="${below ? "מתחת לאחוז החסימה בממוצע" : ""}">${esc(byId[id].short)} ${below ? "—" : now[id].toFixed(0)}</a>`;
    }).join("");
    return `<article class="tb-card panel rise" style="--i:${i};--tc:${t.color}">
      <header><h3>${esc(t.label)}</h3>${t.sub ? `<small class="muted">${esc(t.sub)}</small>` : ""}</header>
      <div class="tb-num"><b>${n.toFixed(1)}</b><span class="small muted">מנדטים</span></div>
      <dl class="tb-deltas"><div><dt>לעומת 2022 (${t.y2022})</dt><dd class="${d22 > 0.05 ? "up" : d22 < -0.05 ? "down" : ""}">${sgn(d22)}</dd></div>
        <div><dt>לעומת לפני שבוע</dt><dd class="${dW > 0.05 ? "up" : dW < -0.05 ? "down" : ""}">${sgn(dW)}</dd></div></dl>
      ${spark(t)}
      <div class="tb-chips">${chips}</div>
    </article>`;
  }).join("");

  box.innerHTML = `
    <div class="tb-bar panel"><div class="tb-groups">${bar}</div><div class="tb-legend small">${TRIBES.map(t => `<span><i style="background:${t.color}"></i>${esc(t.label)} <b>${sum(now, t).toFixed(0)}</b></span>`).join("")}</div><div class="tb-axis small muted"><span>120 מושבים</span></div></div>
    <div class="tb-cards">${cards}</div>
    <p class="small muted">לפי ממוצע הסקרים עד ${fmtDate(latest, true)} (14 יום, הסקר האחרון של כל סוקר). מפלגה שממוצעה מתחת לאחוז החסימה לא מקבלת מושבים, והשאר מחולק ל-120, כמו במפת המושבים. הקו המקווקו בכל גרף: מספר המנדטים בבחירות 2022 ${srcLink(SRC2022)}.
    החלוקה לשבטים היא הסיווג המקובל בתקשורת לפי זהות המפלגה, לא לפי זהות הבוחרים: יש מצביעים דתיים לליכוד, יהודים ברשימה המשותפת וחרדים שמצביעים למפלגות אחרות. "ציונים" כולל את הימין, המרכז והשמאל.</p>`;
})();
