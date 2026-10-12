#!/usr/bin/env python3
"""
עדכון הסקרים מאתר ועדת הבחירות המרכזית.

מה הסקריפט עושה:
  1. שולף את רשימת הסקרים שדווחו לוועדה (אותו מקור שמאחורי הדף
     https://www.gov.il/he/Departments/DynamicCollectors/knesset_election_polls_26 ).
  2. מוריד רק קובצי PDF של סקרים שעוד אין ב-polls.json.
  3. מחלץ את מספר המנדטים לכל מפלגה, ובודק שהסכום הוא 120.
  4. סקר שלא הצליח להתפענח (סקר אחוזים בלבד, סקר מגזרי, פורמט חדש) מדווח ולא נכנס.
  5. כותב מחדש את polls.json ואת polls.js.

הרצה (מתוך התיקייה):
    pip install requests pypdf
    python3 update_polls.py            # עדכון
    python3 update_polls.py --dry-run  # רק להראות מה היה נכנס

אם הפענוח של סקר מסוים נכשל, אפשר להוסיף אותו ידנית ל-polls.json (אותו מבנה כמו שאר הרשומות)
ואז להריץ:  python3 update_polls.py --rebuild-js
"""
import argparse, io, json, re, sys, datetime as dt
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = "https://www.gov.il/he/api/DynamicCollector"
TEMPLATE_ID = "b043127d-d79d-472e-ac10-5567bc9e8d3d"   # סקרי בחירות לכנסת ה-26
BLOB = "https://www.gov.il/BlobFolder/dynamiccollectorresultitem/{url_name}/he/{file}"
HEADERS = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json;charset=UTF-8",
           "Accept": "application/json", "Origin": "https://www.gov.il",
           "Referer": "https://www.gov.il/he/Departments/DynamicCollectors/knesset_election_polls_26"}

# שמות קצרים לגופים המפרסמים
OUTLETS = {"תאגיד השידור": "כאן 11", "חדשות המזרח התיכון": "i24NEWS", "ישראל היום": "ישראל היום",
           "מעריב": "מעריב", "וואלה": "וואלה", "ערוץ 13": "חדשות 13", "חדשות 13": "חדשות 13",
           "חדשות 12": "חדשות 12", "ערוץ 14": "ערוץ 14", "ערוץ 16": "ערוץ 16", "ידיעות": "ידיעות אחרונות",
           "עצמאי": "עצמאי"}
POLLSTERS = {"קנטאר": "קנטאר", "דיירקט פולס": "דיירקט פולס", "מנחם לזר": "מנחם לזר",
             "שמואל רוזנר": "שמואל רוזנר (מדגם)", "מדגם": "מדגם", "נקסט דאטה": "נקסט דאטה",
             "מאגר מוחות": "מאגר מוחות", "די אר איי": "מכון די אר איי"}

# זיהוי המפלגות בטקסט של הסקר (אחרי הסרת גרשיים). חלק מהקבצים מגיעים בסדר מילים הפוך.
ALIASES = {
    "likud": r"(^|\s)ה?ליכוד(\s|$)",
    "yashar": r"(^|\s)ישר(!|\s)",
    "together": r"(^|\s)ב?יחד(\s|$)",
    "dems": r"הדמוקרטים",
    "yb": r"ישראל ביתנו|ביתנו ישראל",
    "utj": r"יהדות התורה|התורה יהדות",
    "shas": r"(^|\s)שס(\s)|התאחדות הספרדים|(^|\s)ס ש(\s)",
    "otzma": r"עוצמה יהודית|יהודית עוצמה",
    "rzp": r"הציונות הדתית|הדתית הציונות",
    "joint": r"הרשימה המשותפת|המשותפת הרשימה|רשימה ערבית משותפת|חדש\s?-?\s?תעל",
    "raam": r"(^|\s)רעם|(^|\s)רעמ|(^|\s)רע מ(\s)|(^|\s)ם רע(\s)|הרשימה הערבית המאוחדת",
    "amcha": r"עמך ישראל|ישראל עמך",
    "reservists": r"המילואימניקים",
    "bw": r"כחול לבן|לבן כחול|המחנה הממלכתי",
    "haredi": r"הציבור החרדי|החרדי הציבור",
}
MIN_REF = 4134  # סקרים מלפני סגירת הרשימות (8.9.2026) לא נכללים
EXCLUDE = {"4163": "כפילות של 4137", "4166": "סקר מגזרי ללא מנדטים", "4183": "אחוזים בלבד, ללא מנדטים", "4198": "סקר צעירים (18-22), אחוזים בלבד"}
NUM = re.compile(r"^[\d.]+%?$")


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[״\"׳'`]", "", text))


def parse_seats(raw: str):
    """מחזיר dict של מנדטים, או None אם לא נמצאה טבלת מנדטים."""
    t = normalize(raw)
    start = -1
    for m in re.finditer(r"מצביע|רשימה מנדטים|מנדטים", t):
        if re.search(ALIASES["likud"], t[m.start():m.start() + 700]):
            start = m.start()
            break
    if start < 0:
        return None
    t = t[start:start + 2600]
    out = {}
    for key, pat in ALIASES.items():
        m = re.search(pat, t)
        if not m:
            out[key] = None
            continue
        toks = t[m.end():].strip().split(" ")
        i = skipped = 0
        while i < len(toks) and not NUM.match(toks[i]) and skipped < 14:
            i += 1; skipped += 1
        run = []
        while i < len(toks) and toks[i] and re.match(r"^[\d.]*%?$", toks[i]):
            run.append(toks[i]); i += 1
        if not run:
            out[key] = None
            continue
        first = next((x for x in run if not x.endswith("%") and x != "."), None)
        out[key] = int(first) if first and re.fullmatch(r"\d{1,2}", first) else 0
    return out


def local_date(iso_utc: str) -> dt.date:
    d = dt.datetime.fromisoformat(iso_utc.replace("Z", "+00:00")) + dt.timedelta(hours=3)
    return d.date()


def short(name, table):
    for k, v in table.items():
        if k in name:
            return v
    return name.strip()


def fetch_index(session):
    items, start = [], 0
    while True:
        body = {"DynamicTemplateID": TEMPLATE_ID, "QueryFilters": {"skip": {"Query": start}}, "From": start}
        r = session.post(API, json=body, headers=HEADERS, timeout=30)
        r.raise_for_status()
        res = r.json().get("Results", [])
        items += res
        if len(res) < 10:
            return items
        start += 10


def write_js(polls):
    polls.sort(key=lambda x: (x["date"], x["ref"]), reverse=True)
    (HERE / "polls.json").write_text(json.dumps(polls, ensure_ascii=False, indent=1), encoding="utf-8")
    (HERE / "polls.js").write_text(
        "// נוצר אוטומטית מתוך polls.json — אפשר לערוך ידנית או להריץ update_polls.py\n"
        "window.POLLS = " + json.dumps(polls, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--rebuild-js", action="store_true", help="רק לבנות את polls.js מתוך polls.json")
    args = ap.parse_args()

    polls = json.loads((HERE / "polls.json").read_text(encoding="utf-8"))
    if args.rebuild_js:
        write_js(polls); print("polls.js נבנה מחדש"); return

    import requests
    from pypdf import PdfReader
    known = {p["ref"] for p in polls}
    s = requests.Session()
    s.get(HEADERS["Referer"], headers={"User-Agent": HEADERS["User-Agent"]}, timeout=30)
    index = fetch_index(s)
    print(f"בוועדה: {len(index)} סקרים. כבר אצלנו: {len(known)}.")
    added, skipped = [], []
    for it in index:
        d = it["Data"]
        ref = str(d.get("reference_number") or "")
        if not ref or ref in known or ref in EXCLUDE or not ref.isdigit() or int(ref) < MIN_REF or not d.get("file_PDF"):
            continue
        f = d["file_PDF"][0]["FileName"]
        url = BLOB.format(url_name=it["UrlName"], file=f)
        try:
            pdf = s.get(url, timeout=60, headers={"User-Agent": HEADERS["User-Agent"]})
            pdf.raise_for_status()
            reader = PdfReader(io.BytesIO(pdf.content))
            text = " ".join((pg.extract_text() or "") for pg in reader.pages[:3])
        except Exception as e:  # noqa
            skipped.append((ref, f"שגיאת הורדה/קריאה: {e}")); continue
        seats = parse_seats(text)
        total = sum(v or 0 for v in (seats or {}).values())
        if not seats or total != 120:
            skipped.append((ref, f"לא פוענח (סכום {total}) — {url}")); continue
        fw, pub = local_date(d["date_the_survey"]), local_date(d["public_to_cec"])
        note = ""
        if fw > pub:
            fw, note = pub, "תאריך הביצוע שדווח מאוחר ממועד הפרסום; הוצג מועד הפרסום."
        added.append({"ref": ref, "date": fw.isoformat(), "published": pub.isoformat(),
                      "pollster": short(d.get("survey_editor", ""), POLLSTERS),
                      "outlet": short(d.get("survey_publisher", ""), OUTLETS),
                      "url": url, "seats": seats, "note": note})
    for a in added:
        print("נוסף:", a["ref"], a["date"], a["pollster"], a["outlet"], a["seats"])
    for ref, why in skipped:
        print("דולג:", ref, why)
    if added and not args.dry_run:
        write_js(polls + added)
        print(f"נשמר. סה\"כ {len(polls) + len(added)} סקרים.")
    elif not added:
        print("אין סקרים חדשים.")


if __name__ == "__main__":
    sys.exit(main())
