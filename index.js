(function () {
  const { E, P, C, byId, esc, srcLink, fmtDate, daysBetween, todayIso, pollAverage, surplusPartner, slip, photo, openCandidates, candidateTiers, initTheme } = window.EG;
  initTheme();
  const $ = id => document.getElementById(id);

  // ---------- header ----------
  const left = daysBetween(todayIso(), E.electionDate);
  $("daysLeft").textContent = left >= 0 ? left : "0";
  $("pollCount").textContent = P.length;
  const newest = P.length ? [...P].sort((a, b) => b.date.localeCompare(a.date))[0].date : null;
  $("updatedLine").textContent = `מידע על מפלגות עודכן ב-${fmtDate(E.updated, true)} · סקר אחרון: ${newest ? fmtDate(newest, true) : "אין"}`;
  const factTitles = ["מתי ואיך", "מי מתמודד", "בית המשפט העליון", "הסכמי עודפים"];
  $("facts").innerHTML = E.keyFacts.map((f, i) => `<li class="rise" style="--i:${i}"><b>${factTitles[i] || ""}</b>${esc(f.text)} ${srcLink(f.src)}</li>`).join("");

  // ---------- state ----------
  let days = 14, latestOnly = true;
  try { const s = JSON.parse(localStorage.getItem("avgPrefs") || "null"); if (s) { days = s.days || 14; latestOnly = s.latestOnly !== false; } } catch (e) {}
  $("latestOnly").checked = latestOnly;
  let avgMap = {};

  // ---------- hemicycle (120 seats) ----------
  function seatsFromAvg(rows) {
    const live = rows.filter(r => r.avg >= 3.5);
    const tot = live.reduce((s, r) => s + r.avg, 0);
    const raw = live.map(r => ({ id: r.id, q: r.avg / tot * 120 }));
    raw.forEach(r => { r.n = Math.floor(r.q); r.rem = r.q - r.n; });
    let left = 120 - raw.reduce((s, r) => s + r.n, 0);
    [...raw].sort((a, b) => b.rem - a.rem).forEach(r => { if (left > 0) { r.n++; left--; } });
    // מקבצים לפי משפחה, ובתוך משפחה לפי גודל
    const famIdx = id => E.FAMILIES.findIndex(f => f.ids.includes(id));
    return raw.sort((a, b) => famIdx(a.id) - famIdx(b.id) || b.q - a.q);
  }
  function drawHemicycle(rows) {
    const seats = seatsFromAvg(rows);
    const W = 420, H = 232, cx = W / 2, cy = 218, R = 200, rows_n = 7, r0 = 0.40;
    const radii = Array.from({ length: rows_n }, (_, i) => r0 + (1 - r0) * i / (rows_n - 1));
    const sum = radii.reduce((a, b) => a + b, 0);
    let counts = radii.map(r => Math.round(120 * r / sum));
    counts[rows_n - 1] += 120 - counts.reduce((a, b) => a + b, 0);
    const pts = [];
    radii.forEach((rr, i) => { const n = counts[i]; for (let j = 0; j < n; j++) { const th = Math.PI * j / (n - 1); pts.push({ th, x: cx + R * rr * Math.cos(th), y: cy - R * rr * Math.sin(th) }); } });
    pts.sort((a, b) => a.th - b.th);
    const order = [];
    seats.forEach(s => { for (let k = 0; k < s.n; k++) order.push(s.id); });
    const sr = 7.2;
    const circles = pts.map((p, i) => { const id = order[i]; const col = id ? byId[id].color : "var(--rule)"; const c = `<circle class="seat" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${sr}" style="--i:${i};fill:${col}"><title>${id ? esc(byId[id].short) + " · לחצו לפרטים" : ""}</title></circle>`; return id ? `<a href="party.html#${id}" data-p="${id}" aria-label="${esc(byId[id].short)}">${c}</a>` : c; }).join("");
    $("hemicycle").innerHTML = `<svg viewBox="0 0 ${W} ${H + 6}">${circles}
      <text class="mid" x="${cx}" y="${cy - 26}" text-anchor="middle" font-size="40">120</text>
      <text class="mid-sub" x="${cx}" y="${cy - 4}" text-anchor="middle">מושבים · 61 לרוב</text></svg>`;
    $("kLegend").innerHTML = seats.map(s => `<a href="party.html#${s.id}" data-p="${s.id}" style="--pc:${byId[s.id].color}"><i></i>${esc(byId[s.id].short)} ${s.n}</a>`).join("") + `<span class="muted">לפי ממוצע הסקרים, ללא חישוב עודפים</span>`;
    $("families").innerHTML = E.FAMILIES.map(f => `<span class="fam"><span class="sw">${f.ids.map(id => `<i style="background:${byId[id].color}"></i>`).join("")}</span>${f.label}</span>`).join("") + `<span>הצבעים מקבצים לפי הסיווג המקובל בתקשורת, לנוחות בלבד</span>`;
  }

  // הדגשת מפלגה במפת המושבים במעבר עכבר
  (function () {
    const fig = document.querySelector(".knesset");
    if (!fig) return;
    const set = id => fig.querySelectorAll("[data-p]").forEach(el => el.classList.toggle("dim", !!id && el.dataset.p !== id));
    fig.addEventListener("mouseover", e => { const t = e.target.closest("[data-p]"); set(t && t.dataset.p); });
    fig.addEventListener("mouseleave", () => set(null));
  })();

  // ---------- seat chart ----------
  function renderChart() {
    const a = pollAverage(days, latestOnly);
    avgMap = Object.fromEntries(a.rows.map(r => [r.id, r]));
    document.querySelectorAll("[data-days]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.days === days)));
    $("avgNote").textContent = `${a.polls.length} סקרים מ-${fmtDate(a.from)} עד ${fmtDate(a.to, true)}${latestOnly ? ", הסקר האחרון של כל סוקר" : ""}`;
    const max = 35, pct = v => (v / max) * 100;
    const ticks = [0, 5, 10, 15, 20, 25, 30, 35];
    const grid = ticks.map(t => `<span class="grid" style="inset-inline-start:${pct(t)}%"></span>`).join("") + `<span class="thr" style="inset-inline-start:${pct(3.9)}%"></span>`;
    $("seatChart").innerHTML = a.rows.map((r, i) => {
      const p = byId[r.id];
      return `<a class="seatrow" href="party.html#${p.id}" title="לכל הפרטים על ${esc(p.short)}" style="--pc:${p.color};--i:${i}">
        <span class="label">${photo(p, "sm")}<span>${esc(p.short)}</span></span>
        <div class="track" aria-hidden="true">${grid}
          <span class="range" style="inset-inline-start:${pct(r.min)}%;width:${Math.max(pct(r.max - r.min), .4)}%"></span>
          <span class="bar" style="width:${Math.max(pct(r.avg), .6)}%"></span>
        </div>
        <span class="val" aria-label="${esc(p.short)}: ממוצע ${r.avg.toFixed(1)}, טווח ${r.min} עד ${r.max}">${r.avg.toFixed(1)}</span>
        <span class="go" aria-hidden="true">←</span>
      </a>`;
    }).join("") + `<div class="axis"><span></span><div class="ticks">${ticks.map(t => `<span style="inset-inline-start:${pct(t)}%">${t}</span>`).join("")}</div><span></span><span></span></div>`;
    drawHemicycle(a.rows);
    renderCards(a);
    renderPicks();
  }

  function renderCards(a) {
    $("cards").innerHTML = a.rows.map((r, i) => {
      const p = byId[r.id], sp = surplusPartner(p.id), t = candidateTiers(p.id);
      const below = r.avg < 3.5;
      const realistic = Math.min((C[p.id] || []).length, Math.max(t.max, t.likely));
      return `<article class="card rise" style="--pc:${p.color};--i:${i}">
        <div class="card-band"><div class="seats">${r.avg.toFixed(1)}<small>מנדטים בממוצע</small></div>${slip(p)}</div>
        <div class="card-head">${photo(p)}<div><h3><a class="stretch" href="party.html#${p.id}">${esc(p.short)}</a></h3><div class="small muted">${esc(p.leader)}</div></div></div>
        <dl>
          <dt>ברשימה</dt><dd>${esc(p.list.slice(1, 4).join(", "))}</dd>
          <dt>מחנה</dt><dd>${esc(p.camp)} ${below ? '<span class="chip warn">סביב החסימה</span>' : ""}</dd>
          <dt>עודפים</dt><dd>${sp ? `<span class="chip" style="--pc:${sp.partner.color}">עם ${esc(sp.partner.short)}</span>` : '<span class="muted">לא נחתם</span>'}</dd>
        </dl>
        <p class="stance">${esc(p.coalition.summary)}</p>
        <div class="card-actions">
          <button class="btn party" type="button" data-cands="${p.id}">מועמדים במקום ריאלי (${realistic})</button>
          <a class="btn party solid" href="party.html#${p.id}">כל הפרטים ←</a>
        </div>
      </article>`;
    }).join("");
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-cands]"); if (b) openCandidates(b.dataset.cands); });

  // ---------- comparison ----------
  (function renderCompare() {
    const head = `<thead><tr><th>מפלגה</th>${E.issues.map(i => `<th>${esc(i.label)}</th>`).join("")}<th>עם מי בממשלה</th></tr></thead>`;
    const body = E.parties.map(p => `<tr style="--pc:${p.color}"><td><a href="party.html#${p.id}">${photo(p, "sm")}<span>${esc(p.short)}<small class="more-link">לכל הפרטים ←</small></span></a></td>${E.issues.map(i => {
      const pos = p.positions[i.id];
      return pos ? `<td>${esc(pos.text)} ${srcLink(pos.src, p.id)}</td>` : `<td class="na">לא נמצאה עמדה מפורשת</td>`;
    }).join("")}<td>${esc(p.coalition.summary)}</td></tr>`).join("");
    $("compareTable").innerHTML = head + `<tbody>${body}</tbody>`;
  })();

  // ---------- coalition calculator ----------
  let picked = new Set();
  function renderPicks() {
    const order = Object.values(avgMap).sort((a, b) => b.avg - a.avg);
    $("picks").innerHTML = order.map(r => {
      const p = byId[r.id];
      return `<label class="pick" for="pk-${p.id}" style="--pc:${p.color}"><input type="checkbox" id="pk-${p.id}" value="${p.id}" ${picked.has(p.id) ? "checked" : ""}>${photo(p, "sm")}<span>${esc(p.short)}</span><span class="s">${Math.round(r.avg)}</span></label>`;
    }).join("");
    $("picks").querySelectorAll("input").forEach(i => i.addEventListener("change", () => { i.checked ? picked.add(i.value) : picked.delete(i.value); updateCalc(); }));
    updateCalc();
  }
  // הצהרות שסותרות צירופים (לפי ההצהרות שב-data.js)
  const conflicts = [
    [["yashar", "together", "yb"], ["likud"], "ישר!, ביחד וישראל ביתנו הצהירו שלא ישבו עם נתניהו."],
    [["together", "yashar"], ["raam", "joint"], "בנט ואיזנקוט אמרו שלא יסתמכו על המפלגות הערביות."],
    [["joint"], [], "הרשימה המשותפת הודיעה שלא תצטרף לקואליציה, אבל מוכנה לתמוך מבחוץ בממשלה חלופית."],
    [["otzma"], ["yashar"], "בן גביר שולל ממשלת אחדות עם איזנקוט."],
    [["yb"], ["raam"], "ישראל ביתנו תמכה בפסילת רע\"ם."]
  ];
  function updateCalc() {
    const sel = [...picked].sort((a, b) => (avgMap[b]?.avg || 0) - (avgMap[a]?.avg || 0));
    const total = sel.reduce((s, id) => s + Math.round((avgMap[id] || { avg: 0 }).avg), 0);
    $("calcTotal").textContent = total;
    $("calcBar").innerHTML = sel.map(id => `<i style="--pc:${byId[id].color};width:${Math.round(avgMap[id].avg) / 120 * 100}%"></i>`).join("") + `<span class="mark" style="inset-inline-start: calc(61 / 120 * 100%)"></span>`;
    $("calcStatus").innerHTML = picked.size ? (total >= 61 ? `<span class="status-ok">רוב של ${total} מנדטים</span>` : `<span class="status-no">חסרים ${61 - total} לרוב</span>`) : "בחרו מפלגות מהרשימה.";
    $("calcWarnings").innerHTML = conflicts.filter(([a, b]) => {
      if (!b.length) return a.some(x => picked.has(x)) && picked.size > 1;
      return a.some(x => picked.has(x)) && b.some(x => picked.has(x));
    }).map(c => `<p><b>שימו לב:</b> ${esc(c[2])}</p>`).join("");
  }
  $("clearCalc").addEventListener("click", () => { picked.clear(); renderPicks(); });

  // ---------- surplus ----------
  $("surplusDeadline").textContent = fmtDate(E.surplusDeadline, true);
  const who = p => `<a class="who" href="party.html#${p.id}" style="--pc:${p.color}">${photo(p, "sm")}${esc(p.short)}</a>`;
  $("surplusList").innerHTML = E.surplus.map((s, i) => `<div class="pair panel rise" style="--i:${i}">${who(byId[s.a])}<span class="plus">+</span>${who(byId[s.b])}<div class="meta"><span class="small muted num">נחתם ${fmtDate(s.date, true)}</span>${srcLink(s.src)}</div></div>`).join("");
  const none = E.parties.filter(p => !surplusPartner(p.id)).map(p => p.short);
  $("noSurplus").textContent = `עדיין בלי הסכם עודפים (לפי המידע שבידינו): ${none.join(", ")}.`;

  // ---------- polls table ----------
  const pollsters = [...new Set(P.map(p => p.pollster))].sort();
  $("pollsterFilter").innerHTML += pollsters.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  function renderPolls() {
    const f = $("pollsterFilter").value;
    const rows = [...P].sort((a, b) => b.date.localeCompare(a.date) || b.ref.localeCompare(a.ref)).filter(p => !f || p.pollster === f);
    const head = `<thead><tr><th>תאריך</th><th>סוקר</th><th>גוף מפרסם</th>${E.parties.map(p => `<th class="n rot" style="--pc:${p.color}">${esc(p.short)}</th>`).join("")}<th>קובץ</th></tr></thead>`;
    const body = rows.map(p => `<tr><td class="num">${fmtDate(p.date, true)}</td><td>${esc(p.pollster)}</td><td>${esc(p.outlet)}</td>${E.parties.map(x => {
      const v = p.seats[x.id];
      return v === null || v === undefined ? `<td class="n zero">—</td>` : `<td class="n ${v === 0 ? "zero" : ""}">${v}</td>`;
    }).join("")}<td><a href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.note || "")}">PDF</a></td></tr>`).join("");
    $("pollsTable").innerHTML = head + `<tbody>${body}</tbody>`;
  }
  $("pollsterFilter").addEventListener("change", renderPolls);
  renderPolls();

  // ---------- others ----------
  $("others").innerHTML = E.others.map(([l, n]) => `<span class="o"><span class="slip sm" style="--pc:var(--rule)"><span class="slip-letters">${esc(l)}</span></span>${esc(n)}</span>`).join("");

  // ---------- controls ----------
  document.querySelectorAll("[data-days]").forEach(b => b.addEventListener("click", () => { days = +b.dataset.days; save(); renderChart(); }));
  $("latestOnly").addEventListener("change", e => { latestOnly = e.target.checked; save(); renderChart(); });
  function save() { try { localStorage.setItem("avgPrefs", JSON.stringify({ days, latestOnly })); } catch (e) {} }
  renderChart();
})();
