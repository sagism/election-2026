// "לפי סוקר": איך כל גוף מפרסם מודד מפלגה לאורך זמן. ברירת מחדל: הליכוד.
(function () {
  const { E, P, byId, esc, fmtDate, daysBetween, photo, initTheme } = window.EG;
  initTheme();
  const $ = id => document.getElementById(id);

  // צבע קבוע לכל גוף מפרסם (לא לפי דירוג), כדי שהצבע לא יקפוץ כשנוספים סקרים.
  // גוף שלא ברשימה מוצג באפור תחת "אחרים".
  const SLOTS = ["ערוץ 14", "חדשות 12", "חדשות 13", "כאן 11", "i24NEWS", "מעריב", "ערוץ 16", "וואלה"];
  const slotOf = o => SLOTS.indexOf(o);
  const colorOf = o => slotOf(o) >= 0 ? `var(--s${slotOf(o) + 1})` : "var(--s-other)";
  const keyOf = o => slotOf(o) >= 0 ? o : "אחרים";

  const byDate = (a, b) => b.date.localeCompare(a.date) || b.ref.localeCompare(a.ref);
  const has = (p, id) => p.seats[id] !== null && p.seats[id] !== undefined;

  // ממוצע של שאר הסוקרים ביום נתון: 14 יום אחורה, הסקר האחרון של כל סוקר, בלי הסוקר עצמו
  function avgAsOf(id, cut, skipPollster, minN = 1) {
    const seen = new Set();
    const win = P.filter(p => p.date <= cut && daysBetween(p.date, cut) < 14 && has(p, id) && p.pollster !== skipPollster)
      .sort(byDate).filter(p => (seen.has(p.pollster) ? false : (seen.add(p.pollster), true)));
    return win.length >= minN ? win.reduce((s, p) => s + p.seats[id], 0) / win.length : null;
  }

  const hidden = new Set();
  let current = null;

  function render() {
    let id = (location.hash || "").replace("#", "");
    if (!byId[id]) id = "likud";
    current = id;
    const p = byId[id];
    document.title = `${p.short} לפי סוקר · מדריך בחירות 2026`;
    document.documentElement.style.setProperty("--pc", p.color);
    $("pnav").innerHTML = E.parties.map(x => `<a href="#${x.id}" title="${esc(x.short)}" style="--pc:${x.color}" ${x.id === id ? 'aria-current="page"' : ""}>${photo(x, "sm")}</a>`).join("");
    $("hName").textContent = p.short;
    $("hBack").href = `party.html#${id}`;
    $("hBack").textContent = `לדף של ${p.short} ←`;

    const polls = P.filter(x => has(x, id)).sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
    // קיבוץ לפי גוף מפרסם
    const groups = new Map();
    polls.forEach(x => {
      const k = keyOf(x.outlet);
      if (!groups.has(k)) groups.set(k, { key: k, color: colorOf(x.outlet), polls: [], pollsters: new Set(), outlets: new Set() });
      const g = groups.get(k); g.polls.push(x); g.pollsters.add(x.pollster); g.outlets.add(x.outlet);
    });
    const order = [...groups.values()].sort((a, b) => (slotOf(a.key) < 0) - (slotOf(b.key) < 0) || slotOf(a.key) - slotOf(b.key));

    // ממוצע כללי לכל תאריך סקר
    const dates = [...new Set(polls.map(x => x.date))];
    const avgLine = dates.map(d => [d, avgAsOf(id, d, null, 4)]).filter(x => x[1] !== null);

    // הטיית בית: ממוצע ההפרש של כל סקר מממוצע שאר הסוקרים באותו זמן
    order.forEach(g => {
      const diffs = g.polls.map(x => { const a = avgAsOf(id, x.date, x.pollster); return a === null ? null : x.seats[id] - a; }).filter(v => v !== null);
      g.bias = diffs.length ? diffs.reduce((s, v) => s + v, 0) / diffs.length : null;
      g.mean = g.polls.reduce((s, x) => s + x.seats[id], 0) / g.polls.length;
      g.last = g.polls[g.polls.length - 1];
    });

    drawChart(p, polls, order, avgLine);
    drawLegend(order, avgLine);
    drawTable(p, order);
  }

  function drawChart(p, polls, order, avgLine) {
    const id = p.id;
    const cw0 = $("hChart").clientWidth - 20;
    const W = Math.max(320, Math.min(1100, cw0 || 900)), H = W < 600 ? 300 : 400, m = { t: 16, r: 34, b: 30, l: 10 };
    const vals = polls.map(x => x.seats[id]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const vmin = lo < 8 ? 0 : Math.floor((lo - 3) / 5) * 5;
    const vmax = Math.ceil((hi + 2) / 5) * 5;
    const t0 = new Date(polls[0].date).getTime(), t1 = new Date(polls[polls.length - 1].date).getTime();
    // ציר זמן מימין לשמאל: הישן בימין, כמו בשאר האתר
    const X = d => W - m.r - ((new Date(d).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - m.l - m.r);
    const Y = v => m.t + (1 - (v - vmin) / (vmax - vmin)) * (H - m.t - m.b);
    const ticks = []; for (let v = vmin; v <= vmax; v += 5) ticks.push(v);
    const path = pts => pts.map(([d, v], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    // תוויות תאריך: תחילת כל שבוע
    const step = W < 600 ? 14 : 7;
    const dticks = []; { const d = new Date(polls[0].date); while (d.getTime() <= t1) { dticks.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + step); } }

    const pts = [];
    const series = order.map(g => {
      const line = slotOf(g.key) >= 0 && g.polls.length > 1 ? `<path class="hl" d="${path(g.polls.map(x => [x.date, x.seats[id]]))}" style="stroke:${g.color}"/>` : "";
      const dots = g.polls.map(x => { pts.push({ x: X(x.date), y: Y(x.seats[id]), poll: x, g }); return `<circle class="hd" cx="${X(x.date).toFixed(1)}" cy="${Y(x.seats[id]).toFixed(1)}" r="4" style="fill:${g.color}"/>`; }).join("");
      return `<g class="hs" data-k="${esc(g.key)}" ${hidden.has(g.key) ? 'style="display:none"' : ""}>${line}${dots}</g>`;
    }).join("");

    $("hChart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="direction:ltr" role="img" aria-label="מנדטים ל${esc(p.short)} לפי גוף מפרסם לאורך זמן. הנתונים המלאים בטבלה שמתחת.">
      ${ticks.map(v => `<line class="gridl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${W - m.r + 8}" y="${Y(v) + 4}">${v}</text>`).join("")}
      ${vmin === 0 ? `<line class="thr" x1="${m.l}" x2="${W - m.r}" y1="${Y(4)}" y2="${Y(4)}"/>` : ""}
      ${dticks.map(d => `<text x="${X(d)}" y="${H - 8}" text-anchor="middle">${fmtDate(d)}</text>`).join("")}
      <g class="hs avg" data-k="avg" ${hidden.has("avg") ? 'style="display:none"' : ""}><path class="havg" d="${path(avgLine)}"/></g>
      ${series}
      <line class="hx" y1="${m.t}" y2="${H - m.b}" x1="-10" x2="-10"/>
      <circle class="hring" r="7" cx="-20" cy="-20"/>
    </svg><div class="htip" hidden></div>`;

    const svg = $("hChart").querySelector("svg"), tip = $("hChart").querySelector(".htip");
    const ring = svg.querySelector(".hring"), cross = svg.querySelector(".hx");
    const clear = () => { tip.hidden = true; ring.setAttribute("cx", -20); cross.setAttribute("x1", -10); cross.setAttribute("x2", -10); highlight(null); };
    svg.addEventListener("pointermove", e => {
      const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) * W / r.width, sy = (e.clientY - r.top) * H / r.height;
      let best = null, bd = 1e9;
      pts.forEach(q => { if (hidden.has(q.g.key)) return; const d = Math.hypot(q.x - sx, (q.y - sy) * 0.6); if (d < bd) { bd = d; best = q; } });
      if (!best || bd > 60) return clear();
      const x = best.poll, a = avgAsOf(current, x.date, x.pollster), v = x.seats[current];
      ring.setAttribute("cx", best.x); ring.setAttribute("cy", best.y); ring.style.stroke = best.g.color;
      cross.setAttribute("x1", best.x); cross.setAttribute("x2", best.x);
      highlight(best.g.key);
      tip.innerHTML = `<b><i style="background:${best.g.color}"></i>${esc(x.outlet)}</b><span class="muted">${esc(x.pollster)} · ${fmtDate(x.date, true)}</span>
        <span class="big">${v} מנדטים</span>${a !== null ? `<span class="muted">שאר הסוקרים באותו זמן: ${a.toFixed(1)} <span dir="ltr">(${v - a >= 0 ? "+" : "−"}${Math.abs(v - a).toFixed(1)})</span></span>` : ""}`;
      tip.hidden = false;
      const cw = $("hChart").clientWidth, px = best.x * r.width / W, py = best.y * r.height / H;
      tip.style.left = Math.min(Math.max(px - tip.offsetWidth / 2, 4), cw - tip.offsetWidth - 4) + "px";
      tip.style.top = (py > tip.offsetHeight + 24 ? py - tip.offsetHeight - 14 : py + 18) + "px";
    });
    svg.addEventListener("pointerleave", clear);
  }

  function highlight(k) {
    document.querySelectorAll("#hChart .hs").forEach(g => g.classList.toggle("dim", !!k && g.dataset.k !== k));
    document.querySelectorAll("#hLegend button").forEach(b => b.classList.toggle("dim", !!k && b.dataset.k !== k));
  }

  function drawLegend(order, avgLine) {
    const item = (k, sw, label, sub) => `<button type="button" data-k="${esc(k)}" aria-pressed="${!hidden.has(k)}">${sw}<span><b>${esc(label)}</b><small>${sub}</small></span></button>`;
    const lastAvg = avgLine.length ? avgLine[avgLine.length - 1][1].toFixed(1) : "—";
    $("hLegend").innerHTML = item("avg", '<i class="sw avg"></i>', "ממוצע כל הסוקרים", `14 יום · עכשיו ${lastAvg}`) +
      order.map(g => item(g.key, `<i class="sw" style="background:${g.color}"></i>`, g.key, `${esc([...(g.key === "אחרים" ? g.outlets : g.pollsters)].join(", "))} · ${g.polls.length} סקרים · אחרון ${g.last.seats[current]}`)).join("");
    $("hLegend").querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => { const k = b.dataset.k; hidden.has(k) ? hidden.delete(k) : hidden.add(k); render(); });
      b.addEventListener("pointerenter", () => highlight(b.dataset.k));
      b.addEventListener("pointerleave", () => highlight(null));
    });
  }

  function drawTable(p, order) {
    const rows = order.filter(g => g.bias !== null).sort((a, b) => b.bias - a.bias);
    const sgn = v => `<span dir="ltr">${v >= 0.05 ? "+" : v <= -0.05 ? "−" : "±"}${Math.abs(v).toFixed(1)}</span>`;
    const maxAbs = Math.max(1, ...rows.map(g => Math.abs(g.bias)));
    $("hTable").innerHTML = `<thead><tr><th>גוף מפרסם</th><th class="hide-sm">סוקר</th><th class="n">סקרים</th><th class="n">אחרון</th><th class="n hide-sm">ממוצע</th><th>נטיית בית</th></tr></thead><tbody>${rows.map(g => `
      <tr><td><i class="sw" style="background:${g.color}"></i>${esc(g.key === "אחרים" ? [...g.outlets].join(", ") : g.key)}</td><td class="small hide-sm">${esc([...g.pollsters].join(", "))}</td>
      <td class="n">${g.polls.length}</td><td class="n"><b>${g.last.seats[p.id]}</b> <span class="small muted">${fmtDate(g.last.date)}</span></td><td class="n hide-sm">${g.mean.toFixed(1)}</td>
      <td><div class="bias"><span class="bar" style="--w:${(Math.abs(g.bias) / maxAbs * 50).toFixed(1)}%" data-s="${g.bias >= 0 ? "pos" : "neg"}"></span><b>${sgn(g.bias)}</b></div></td></tr>`).join("")}</tbody>`;
    if (rows.length > 1) {
      const hiG = rows[0], loG = rows[rows.length - 1];
      $("hSummary").innerHTML = `<b>${esc(hiG.key)}</b> נותן ל${esc(p.short)} בממוצע ${sgn(hiG.bias)} לעומת שאר הסוקרים, ו<b>${esc(loG.key)}</b> ${sgn(loG.bias)}. הפער בין השניים: ${(hiG.bias - loG.bias).toFixed(1)} מנדטים.`;
    }
  }

  let rw = 0;
  window.addEventListener("resize", () => { const w = $("hChart").clientWidth; if (Math.abs(w - rw) > 40) { rw = w; render(); } });
  window.addEventListener("hashchange", render);
  render();
})();
