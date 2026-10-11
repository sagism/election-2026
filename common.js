// פונקציות משותפות לדף הראשי ולדפי המפלגות
(function () {
  const E = window.ELECTION, P = window.POLLS || [], C = window.CANDIDATES || {}, PH = window.PHOTOS || {};
  const byId = Object.fromEntries(E.parties.map(p => [p.id, p]));

  // צבע זיהוי לכל רשימה (לנוחות קריאה בלבד, לא צבעי מותג רשמיים)
  const COLORS = {
    likud: "#2459d6", yashar: "#0d9f99", together: "#6b3fd4", dems: "#e0334a", yb: "#0a84c6",
    utj: "#46566e", shas: "#b5651d", otzma: "#e9a100", rzp: "#4f7d12", joint: "#d0368a",
    raam: "#0f9a63", amcha: "#ec6a1c", reservists: "#8d7a3a", bw: "#3fa9e8"
  };
  E.parties.forEach(p => { p.color = COLORS[p.id] || "#666"; });

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function srcOf(src, partyId) {
    if (!src) return null;
    if (typeof src === "object") return src;
    const s = E.sources[src];
    if (!s) return null;
    return { name: s.name, url: s.url || (s.base + (E.polimeterSlug[partyId] || "")) };
  }
  function srcLink(src, partyId) {
    const s = srcOf(src, partyId);
    return s ? `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : "";
  }
  function fmtDate(iso, withYear) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return withYear ? `${d}.${m}.${y}` : `${d}.${m}`;
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
  }
  function todayIso() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }

  // ממוצע סקרים: חלון של N ימים אחורה מהסקר האחרון, אופציונלית רק הסקר האחרון של כל סוקר
  function pollAverage(days, latestPerPollster) {
    if (!P.length) return { rows: [], polls: [], from: null, to: null };
    const sorted = [...P].sort((a, b) => b.date.localeCompare(a.date) || b.ref.localeCompare(a.ref));
    const to = sorted[0].date;
    let inWin = sorted.filter(p => daysBetween(p.date, to) < days);
    if (latestPerPollster) {
      const seen = new Set();
      inWin = inWin.filter(p => (seen.has(p.pollster) ? false : (seen.add(p.pollster), true)));
    }
    const rows = E.parties.map(party => {
      const vals = inWin.map(p => p.seats[party.id]).filter(v => v !== null && v !== undefined);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { id: party.id, avg, min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0, n: vals.length };
    }).sort((a, b) => b.avg - a.avg);
    const from = inWin.length ? inWin[inWin.length - 1].date : to;
    return { rows, polls: inWin, from, to };
  }
  // הטווח המלא מאז סגירת הרשימות
  function allTimeMax(id) {
    const v = P.map(p => p.seats[id]).filter(x => x !== null && x !== undefined);
    return v.length ? Math.max(...v) : 0;
  }

  function surplusPartner(id) {
    const s = E.surplus.find(x => x.a === id || x.b === id);
    if (!s) return null;
    return { partner: byId[s.a === id ? s.b : s.a], date: s.date, src: s.src };
  }

  function slip(p, size) {
    return `<span class="slip ${size || ""}" style="--pc:${p.color}" aria-label="אותיות הפתק: ${esc(p.letters)}"><span class="slip-letters">${esc(p.letters)}</span></span>`;
  }
  function photo(p, size) {
    const ph = PH[p.id];
    const alt = (window.PHOTO_ALT || {})[p.id] || p.leader.split(",")[0];
    return `<span class="avatar ${size || ""}" style="--pc:${p.color}">${ph ? `<img src="img/${p.id}.jpg" alt="${esc(alt)}" loading="lazy" width="96" height="96">` : ""}</span>`;
  }
  function photoCredit(id) {
    const ph = PH[id];
    return ph && ph.credit ? esc(ph.credit) : "";
  }

  // ---- חלון מועמדים במקום ריאלי ----
  function candidateTiers(id) {
    const a = pollAverage(14, true).rows.find(r => r.id === id) || { avg: 0, max: 0 };
    const likely = Math.round(a.avg);
    const max = Math.max(allTimeMax(id), a.max);
    return { likely, max, avg: a.avg };
  }
  function candidateListHtml(id) {
    const list = C[id] || [];
    const { likely, max } = candidateTiers(id);
    const row = (n, i) => {
      const pos = i + 1;
      const tier = pos <= likely ? "in" : pos <= max ? "edge" : "out";
      return `<li class="cand ${tier}" style="--i:${i}"><span class="pos num">${pos}</span><span class="nm">${esc(n)}</span></li>`;
    };
    if (!list.length) return '<p class="muted">אין נתונים.</p>';
    const legend = `<div class="legend small">
      <span><i class="dot in"></i>נכנסים לפי ממוצע הסקרים (1–${likely || 0})</span>
      <span><i class="dot edge"></i>תלוי בתוצאה (עד ${max}, השיא בסקרים)</span>
      <span><i class="dot out"></i>מעבר לטווח הסקרים</span></div>`;
    return legend + `<ol class="cands">${list.map(row).join("")}</ol>
      <p class="small muted">השמות כפי שמופיעים בפרסום ועדת הבחירות, שם משפחה תחילה.</p>`;
  }
  let dlg;
  function openCandidates(id) {
    const p = byId[id];
    if (!p) return;
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "cand-dialog";
      dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
      document.body.appendChild(dlg);
    }
    const t = candidateTiers(id);
    dlg.style.setProperty("--pc", p.color);
    dlg.innerHTML = `<div class="dlg-head">${photo(p)}<div><div class="eyebrow">מועמדים במקום ריאלי</div><h2>${esc(p.short)}</h2>
      <div class="small muted">ממוצע ${t.avg.toFixed(1)} מנדטים · שיא בסקרים ${t.max}</div></div>
      <button class="close" type="button" aria-label="סגירה">✕</button></div>
      <div class="dlg-body">${candidateListHtml(id)}</div>
      <div class="dlg-foot"><a class="btn solid" href="party.html#${p.id}">לדף המפלגה</a> <a class="small" href="${esc(p.listPdf)}" target="_blank" rel="noopener">הרשימה המלאה (PDF)</a></div>`;
    dlg.querySelector(".close").addEventListener("click", () => dlg.close());
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }

  // תמה: מתג בהיר/כהה/מערכת, נשמר בדפדפן אם אפשר
  function initTheme() {
    const btn = document.getElementById("themeBtn");
    const order = ["system", "light", "dark"], label = { system: "◐ אוטומטי", light: "☀ בהיר", dark: "☾ כהה" };
    let cur = "system";
    try { cur = localStorage.getItem("theme") || "system"; } catch (e) {}
    const apply = () => {
      if (cur === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", cur);
      if (btn) { btn.textContent = label[cur]; btn.setAttribute("aria-label", "מצב תצוגה: " + label[cur]); }
    };
    apply();
    if (btn) btn.addEventListener("click", () => {
      cur = order[(order.indexOf(cur) + 1) % 3];
      try { localStorage.setItem("theme", cur); } catch (e) {}
      apply();
    });
  }

  // אנימציית כניסה לאלמנטים כשהם נכנסים למסך (רק מוסיפה תנועה; התוכן גלוי גם בלעדיה)
  function initReveal() {
    const els = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(ents => ents.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("revealed"); io.unobserve(en.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("pre-reveal"); io.observe(el); } });
  }

  window.EG = { E, P, C, byId, esc, srcOf, srcLink, fmtDate, daysBetween, todayIso, pollAverage, allTimeMax, surplusPartner, slip, photo, photoCredit, openCandidates, candidateListHtml, candidateTiers, initTheme, initReveal };
})();
