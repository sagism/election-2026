# מדריך בחירות 2026 (הכנסת ה-26)

פותחים את `index.html` בדפדפן. כל מפלגה נפתחת ב-`party.html#<id>`.

| קובץ | מה יש בו |
|---|---|
| `data.js` | המפלגות: אותיות, רשימה, עמדות, הצהרות קואליציוניות, הסכמי עודפים. לעריכה ידנית. |
| `polls.json` / `polls.js` | הסקרים. `polls.js` נבנה מ-`polls.json`. |
| `update_polls.py` | מושך סקרים חדשים מאתר ועדת הבחירות ומעדכן את שני הקבצים. |
| `index.js`, `party.js`, `common.js`, `style.css` | הקוד והעיצוב של הדפים. |

## עדכון סקרים
```
pip install requests pypdf
python3 update_polls.py --dry-run   # לבדוק מה ייכנס
python3 update_polls.py
```
הסקריפט מוריד רק קבצים חדשים, מחלץ מנדטים ובודק שהסכום 120. סקר שלא פוענח מודפס עם קישור, ואפשר להוסיף אותו ידנית ל-`polls.json` ואז `python3 update_polls.py --rebuild-js`.

הערה: הפענוח נבדק על הטקסט של קובצי הוועדה (כפי שחולץ בדפדפן). pypdf עשוי לחלץ עברית בסדר שונה; אם הרבה סקרים "לא פוענחו", זה המקום לבדוק.

## עדכון מפלגה
עורכים את האובייקט שלה ב-`data.js` ומעדכנים את `updated` בראש הקובץ. הסכמי עודפים חדשים נכנסים למערך `surplus`.

## פרסום ב-GitHub Pages
כל push ל-`main` מפרסם את האתר אוטומטית (`.github/workflows/pages.yml`).
עדכון סקרים: `python3 update_polls.py && git commit -am "עדכון סקרים" && git push`
