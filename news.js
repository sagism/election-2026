// "סקרים חדשים": הסקרים האחרונים ומה השתנה. הכל מחושב מ-polls.js, בלי טקסט ידני.
(function () {
  const { E, P, byId, esc, fmtDate, daysBetween, photo, srcLink, todayIso } = window.EG;
  const box = document.getElementById("newsBody");
  if (!box || !P.length) return;

  const iso = d => d.toISOString().slice(0, 10);
  const shift = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const byDate = (a, b) => b.date.localeCompare(a.date) || b.ref.localeCompare(a.ref);
  const ids = E.active.map(p => p.id);
  const fmt = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(1);
  const fmtInt = v => (v > 0 ? "+" : "−") + Math.abs(v);

  // ממוצע עד תאריך נתון: 14 יום אחורה, הסקר האחרון של כל סוקר (כמו בגרף הראשי)
  function avgAsOf(cut, days = 14) {
    const seen = new Set();
    const win = [...P].filter(p => p.date <= cut && daysBetween(p.date, cut) < days).sort(byDate)
      .filter(p => (seen.has(p.pollster) ? false : (seen.add(p.pollster), true)));
    const out = {};
    ids.forEach(id => { const v = win.map(p => p.seats[id]).filter(x => x !== null && x !== undefined); out[id] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
    return { avg: out, n: win.length };
  }

  const latest = [...P].sort(byDate)[0].date;
  const lastPub = [...P].map(p => p.published || p.date).sort().pop();
  const now = avgAsOf(latest), before = avgAsOf(shift(latest, -7));

  // ---- ממצאים ----
  const findings = [];
  const rank = a => ids.slice().sort((x, y) => a[y] - a[x]);
  const [n1, n2] = rank(now.avg), [b1] = rank(before.avg);
  if (n1 !== b1) findings.push(`<b>${esc(byId[n1].short)}</b> עקפה את <b>${esc(byId[b1].short)}</b> והיא עכשיו הגדולה בממוצע.`);
  const gapBefore = before.avg[n1] - before.avg[n2];
  findings.push(`הפער בין <b>${esc(byId[n1].short)}</b> ל<b>${esc(byId[n2].short)}</b>: ${(now.avg[n1] - now.avg[n2]).toFixed(1)} מנדטים (${gapBefore >= 0 ? `לפני שבוע: ${gapBefore.toFixed(1)}` : `לפני שבוע היתרון היה ל${esc(byId[n2].short)}, ב-${(-gapBefore).toFixed(1)}`}).`);

  const movers = ids.map(id => ({ id, d: now.avg[id] - before.avg[id] })).filter(m => Math.abs(m.d) >= 0.5).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5);

  // מפלגות סביב אחוז החסימה: בכמה מהסקרים האחרונים הן בחוץ
  const recent6 = [...P].sort(byDate).slice(0, 6);
  ids.forEach(id => {
    const a = now.avg[id];
    if (a < 1 || a > 6) return;
    const zeros = recent6.filter(p => p.seats[id] === 0 || p.seats[id] === null).length;
    if (zeros > 0) findings.push(`<b>${esc(byId[id].short)}</b> מתחת לאחוז החסימה ב-${zeros} מתוך ${recent6.length} הסקרים האחרונים.`);
    if (before.avg[id] >= 3.5 && a < 3.5) findings.push(`<b>${esc(byId[id].short)}</b> ירדה בממוצע אל מתחת לסף (${a.toFixed(1)}).`);
    if (before.avg[id] < 3.5 && a >= 3.5) findings.push(`<b>${esc(byId[id].short)}</b> עלתה בממוצע מעל הסף (${a.toFixed(1)}).`);
  });

  // ---- כרטיסי הסקרים האחרונים ----
  // לפי מועד עריכת הסקר, לא לפי מועד הדיווח לוועדה (יש סוקרים שמדווחים באיחור, כמה סקרים בבת אחת)
  const list = [...P].sort(byDate).slice(0, 5);
  function prevSamePollster(p) {
    return [...P].filter(q => q.pollster === p.pollster && q.ref !== p.ref && (q.date < p.date || (q.date === p.date && q.ref < p.ref))).sort(byDate)[0];
  }
  const cards = list.map((p, i) => {
    const isNew = daysBetween(p.published || p.date, lastPub) <= 2 && daysBetween(p.date, latest) <= 7;
    const late = p.published && daysBetween(p.date, p.published) > 4 ? ` · דווח ב-${fmtDate(p.published)}` : "";
    const top = ids.filter(id => p.seats[id]).sort((a, b) => p.seats[b] - p.seats[a]).slice(0, 4)
      .map(id => `<span class="np-seat" title="${esc(byId[id].short)}" style="--pc:${byId[id].color}">${photo(byId[id], "sm")}<b>${p.seats[id]}</b></span>`).join("");
    const prev = prevSamePollster(p);
    let changes = "";
    if (prev) {
      const ch = ids.map(id => ({ id, a: prev.seats[id] || 0, b: p.seats[id] || 0 }))
        .filter(c => Math.abs(c.b - c.a) >= 2 || (c.a === 0) !== (c.b === 0)).sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a)).slice(0, 4);
      changes = ch.length
        ? ch.map(c => `<span class="np-ch ${c.b > c.a ? "up" : "down"}">${esc(byId[c.id].short)} ${c.b} ${c.a === 0 ? "(עברה את הסף)" : c.b === 0 ? "(מתחת לסף)" : `<span dir="ltr">(${fmtInt(c.b - c.a)})</span>`}</span>`).join("")
        : `<span class="np-ch flat">בלי שינויים של 2 מנדטים ומעלה</span>`;
      changes = `<div class="np-changes"><span class="small muted">לעומת הסקר הקודם שלו (${fmtDate(prev.date)}):</span> ${changes}</div>`;
    }
    return `<article class="np-card panel rise" style="--i:${i}">
      <div class="np-head">${isNew ? '<span class="np-new">חדש</span>' : ""}<b>${esc(p.pollster)}</b><span class="muted small">${esc(p.outlet)} · ${fmtDate(p.date, true)}${late}</span>
        <a class="small np-pdf" href="${esc(p.url)}" target="_blank" rel="noopener">PDF ↗</a></div>
      <div class="np-seats">${top}</div>${changes}</article>`;
  }).join("");

  // אירועים מהשבוע האחרון (מ-data.js), לפני ממצאי הסקרים
  const today = todayIso();
  const events = (E.events || []).filter(e => { const d = daysBetween(e.date, today); return d >= 0 && d <= 7; })
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => { const p = byId[e.party]; return `<div class="np-event${p && p.withdrawn ? " out" : ""}" style="--pc:${p ? p.color : "var(--accent)"}">${p ? `<a href="party.html#${p.id}">${photo(p, "sm")}</a>` : ""}<div><span class="np-ev-date">${fmtDate(e.date)}</span><b>${esc(e.title)}</b><p>${esc(e.text)} ${srcLink(e.src)}</p></div></div>`; }).join("");
  box.innerHTML = `
    <div class="np-grid">
      <div class="np-findings panel">
        <h3>מה השתנה השבוע</h3>
        ${events}
        <p class="small muted">ממוצע 14 הימים עד ${fmtDate(latest, true)}, לעומת הממוצע עד ${fmtDate(shift(latest, -7), true)}</p>
        ${movers.length ? `<div class="movers">${movers.map(m => `<a class="mover ${m.d > 0 ? "up" : "down"}" href="party.html#${m.id}" style="--pc:${byId[m.id].color}">${photo(byId[m.id], "sm")}<span>${esc(byId[m.id].short)}</span><b dir="ltr">${fmt(m.d)}</b><small>${now.avg[m.id].toFixed(1)}</small></a>`).join("")}</div>` : '<p class="small">אין שינויים של חצי מנדט ומעלה בממוצע.</p>'}
        <ul class="np-list">${findings.map(f => `<li>${f}</li>`).join("")}</ul>
      </div>
      <div class="np-cards">${cards}</div>
    </div>
    <p class="small muted">השינויים בכל סקר מושווים לסקר הקודם של אותו סוקר, כי לכל סוקר יש נטייה קבועה משלו. שינוי של מנדט או שניים בסקר בודד הוא לרוב בתחום טעות הדגימה.</p>`;
})();
