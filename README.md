# B+T Judging

Mobile web app for judging B+T competitions (starting with JAM Finals). Judges open the link on their phone.

Built one feature at a time:

1. Landing page: judge enters their name (saved on their phone)
2. Home screen: list of teams in presenting order (set in the Admin tab)
3. Scoring: tap a team to score each rubric category (names and points set in the Admin tab)
4. Feedback prompts (all optional): quick-tap "Keep doing" / "Work on" notes, plus "What worked" and "What to improve" boxes
5. Gut check (required): Standout / Solid / Needs work, at the bottom of the scoring sheet; shown with the score on each team card
6. Google Sheet connection: every Save is sent to a Google Sheet (one row per judge per team), with automatic retry if Wi-Fi drops
7. Restore by name: entering the same judge name on any phone or browser loads that judge's scores back from the Sheet
8. Panel view (Judge | Panel toggle, password protected): live ranking by z-score with each judge's total and gut check, standout votes,, and per-team category averages, quick notes (with how many judges tapped each) and judge comments. Password is `PANEL_PASSWORD` in `index.html`.

## Google Sheet setup

The script that receives scores is in `apps-script/Code.gs`. Paste it into the Sheet's Extensions > Apps Script,
deploy it as a Web app (Execute as: Me, Who has access: Anyone), and put the Web app URL in `API_URL` in `index.html`.
9. Reset all data (Panel): clears the Sheet (after copying it to a backup tab) and every judge's phone. Needs the updated `apps-script/Code.gs` deployed, with the same `PANEL_PASSWORD` as `index.html`.
10. Admin view (password `ADMIN_PASSWORD`): set rubric categories (name, points 1–10, order) and teams (name, order). Saved in the Google Sheet script; judges' phones pick it up within 30 seconds. Teams and categories have permanent IDs, so reordering or renaming never moves scores. Reset keeps the admin setup.
11. Tracks and Impact Prize: Admin sets each team's track (HealthTech, FinTech, EdTech, GeneralTech) and "Include Impact Prize". Impact Prize categories are a separate list in Admin; judges see them only for Impact Prize teams, labeled "Impact Prize: [name]" (or just "Impact Prize"), scored separately from the main total. Panel has a view selector (All teams or one track) and a separate Impact Prize table.
12. Starting setup: Category 1-3 plus Category 4 as the Impact Prize; teams can be added in bulk (up to 75).
13. Sheet columns: Last updated, Judge, Team, Track, Gut check, Total, Max total, Impact Prize total, Impact Prize max, then 10 score columns titled with the category names from Admin (rubric first, then "Impact Prize: [name]"; unused ones say "(unused)"), then Keep doing, Work on, What worked, What to improve, Team ID, Device ID, Scores JSON. Up to 10 categories in all. A Sheet in the older layout is moved over automatically the first time the new script runs; the old tab is kept as "Scores (old layout) [date]".
14. Criteria: each category can have criteria in Admin (one per line). Judges open them with a small "Criteria ▾" button on the score screen. Text from "e.g." onward shows in smaller grey type. Comment boxes have no length limit and grow as you type.
