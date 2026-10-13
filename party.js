(function () {
  const { E, P, byId, esc, srcLink, fmtDate, pollAverage, surplusPartner, slip, photo, photoCredit, candidateListHtml, initTheme } = window.EG;
  initTheme();
  const $ = id => document.getElementById(id);

  function render() {
    const id = (location.hash || "").replace("#", "");
    const p = byId[id];
    $("pnav").innerHTML = E.parties.map(x => `<a href="#${x.id}" title="${esc(x.short)}" ${x.id === id ? 'aria-current="page"' : ""}>${photo(x, "sm")}</a>`).join("");
    $("notFound").hidden = !!p;
    $("page").hidden = !p;
    if (!p) { document.title = "מדריך בחירות 2026"; return; }
    document.title = `${p.short} · מדריך בחירות 2026`;
    document.documentElement.style.setProperty("--pc", p.color);

    // restart entrance animations on party switch
    const hero = $("pHero"); hero.classList.remove("rise"); void hero.offsetWidth; hero.classList.add("rise");

    $("pPhoto").innerHTML = photo(p, "lg");
    $("pSlip").innerHTML = slip(p, "lg");
    $("pCamp").textContent = `${p.camp} · ${p.composition}`;
    $("pName").textContent = p.short;
    $("pBallot").textContent = `בפתק: ${p.ballot}`;
    $("pCredit").innerHTML = photoCredit(p.id);
    const site = (E.sites || {})[p.id], sb = $("pSite");
    sb.hidden = !site;
    if (site) { sb.href = site; sb.innerHTML = `לאתר המפלגה <span dir="ltr">${esc(site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, ""))}</span> ↗`; }
    $("pBlurb").textContent = p.blurb;

    const a = pollAverage(14, true);
    const r = a.rows.find(x => x.id === p.id) || { avg: 0, min: 0, max: 0 };
    const rank = a.rows.findIndex(x => x.id === p.id) + 1;
    const k = (label, val, cls, i) => `<div class="kpi rise" style="--i:${i}"><span class="small muted">${label}</span><b class="${cls || ""}">${val}</b></div>`;
    $("pKpis").innerHTML = [
      k("בראש הרשימה", esc(p.leader), "txt", 1),
      k("ממוצע סקרים (14 יום)", r.avg.toFixed(1), "", 2),
      k("טווח בסקרים", `<span dir="ltr">${r.min}–${r.max}</span>`, "", 3),
      k("מקום בממוצע", rank, "", 4),
      k("בכנסת ה-25", p.seats25 ?? "—", "", 5)
    ].join("");

    $("pCoalSummary").textContent = p.coalition.summary;
    $("pQuotes").innerHTML = p.coalition.statements.map((s, i) => `<li class="panel rise" style="--i:${i}">${s.date ? `<time datetime="${s.date}">${fmtDate(s.date, true)}</time>` : ""}${esc(s.text)} ${srcLink(s.src, p.id)}</li>`).join("");
    const sp = surplusPartner(p.id);
    $("pSurplus").innerHTML = sp
      ? `<b>הסכם עודפים:</b> עם <a href="#${sp.partner.id}">${esc(sp.partner.short)}</a>, נחתם ${fmtDate(sp.date, true)}. ${srcLink(sp.src)}`
      : `<b>הסכם עודפים:</b> לא ידוע לנו על הסכם חתום (נכון ל-${fmtDate(E.updated, true)}).`;

    const issues = E.issues.map(i => ({ label: i.label, pos: p.positions[i.id] }));
    if (p.positions.extra) issues.push({ label: p.positions.extra.label, pos: p.positions.extra });
    $("pIssues").innerHTML = issues.map((i, n) => `<div class="issue panel rise" style="--i:${n}"><h3>${esc(i.label)}</h3>${i.pos ? `<p>${esc(i.pos.text)} ${srcLink(i.pos.src, p.id)}</p>` : '<p class="muted">לא נמצאה עמדה מפורשת.</p>'}</div>`).join("");
    const pl = $("pPlatform");
    pl.hidden = !p.platform;
    if (p.platform) { pl.href = p.platform; pl.textContent = "המצע באתר המפלגה ↗"; }

    $("pList").innerHTML = candidateListHtml(p.id);
    $("pListPdf").href = p.listPdf;

    drawTrend(p);
    const rows = [...P].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 15);
    $("pPolls").innerHTML = `<thead><tr><th>תאריך</th><th>סוקר</th><th>גוף מפרסם</th><th class="n">מנדטים</th><th>קובץ</th></tr></thead><tbody>${rows.map(x => {
      const v = x.seats[p.id];
      return `<tr><td class="num">${fmtDate(x.date, true)}</td><td>${esc(x.pollster)}</td><td>${esc(x.outlet)}</td><td class="n ${!v ? "zero" : ""}"><b>${v ?? "—"}</b></td><td><a href="${esc(x.url)}" target="_blank" rel="noopener">PDF</a></td></tr>`;
    }).join("")}</tbody>`;
    window.scrollTo(0, 0);
  }

  function drawTrend(p) {
    const pts = [...P].filter(x => x.seats[p.id] !== null && x.seats[p.id] !== undefined).sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
    if (!pts.length) { $("pTrend").innerHTML = '<p class="muted">אין נתונים.</p>'; return; }
    const W = 520, H = 230, m = { t: 14, r: 34, b: 28, l: 12 };
    const t0 = new Date(pts[0].date).getTime(), t1 = new Date(pts[pts.length - 1].date).getTime() || t0 + 1;
    const vmax = Math.max(8, Math.ceil(Math.max(...pts.map(x => x.seats[p.id])) / 5) * 5 + 5);
    // ציר הזמן מימין לשמאל: הישן בימין
    const X = d => W - m.r - ((new Date(d).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - m.l - m.r);
    const Y = v => m.t + (1 - v / vmax) * (H - m.t - m.b);
    const ticks = []; for (let v = 0; v <= vmax; v += 5) ticks.push(v);
    const ma = pts.map((x, i) => { const w = pts.slice(Math.max(0, i - 4), i + 1); return [x.date, w.reduce((s, y) => s + y.seats[p.id], 0) / w.length]; });
    const path = ma.map(([d, v], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    const area = path + ` L${X(ma[ma.length - 1][0]).toFixed(1)},${Y(0)} L${X(ma[0][0]).toFixed(1)},${Y(0)} Z`;
    const dates = [pts[0].date, pts[Math.floor(pts.length / 2)].date, pts[pts.length - 1].date];
    const last = ma[ma.length - 1];
    $("pTrend").innerHTML = `<svg viewBox="0 0 ${W} ${H}" direction="ltr" style="direction:ltr" role="img" aria-label="מנדטים ל${esc(p.short)} בסקרים לאורך זמן">
      ${ticks.map(v => `<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${W - m.r + 6}" y="${Y(v) + 4}">${v}</text>`).join("")}
      <line class="thr" x1="${m.l}" x2="${W - m.r}" y1="${Y(4)}" y2="${Y(4)}"/>
      <path class="area" d="${area}"/>
      ${pts.map(x => `<circle class="dot" cx="${X(x.date).toFixed(1)}" cy="${Y(x.seats[p.id]).toFixed(1)}" r="2.8" opacity=".4"><title>${fmtDate(x.date, true)} · ${esc(x.pollster)}: ${x.seats[p.id]}</title></circle>`).join("")}
      <path class="line" d="${path}"/>
      <circle class="dot" cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="5.5"/>
      <text x="${X(last[0]) + 9}" y="${Y(last[1]) - 8}" style="fill:var(--ink);font-weight:800;font-size:13px">${last[1].toFixed(1)}</text>
      ${dates.map((d, i) => `<text x="${X(d)}" y="${H - 8}" text-anchor="${i === 0 ? "end" : i === 2 ? "start" : "middle"}">${fmtDate(d)}</text>`).join("")}
    </svg>`;
  }

  window.addEventListener("hashchange", render);
  render();
})();
