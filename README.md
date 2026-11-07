# B+T Judging

Mobile web app for judging B+T competitions (starting with JAM Finals). Judges open the link on their phone.

Built one feature at a time:

1. Landing page: judge enters their name (saved on their phone)
2. Home screen: list of teams (starts at Team 1–5), + to add more teams
3. Scoring: tap a team to score Category 1–5 (each out of 5)
4. Feedback prompts (all optional): quick-tap "Keep doing" / "Work on" notes, plus "What worked" and "What to improve" boxes
5. Gut check (required): Standout / Solid / Needs work, at the bottom of the scoring sheet; shown with the score on each team card
6. Google Sheet connection: every Save is sent to a Google Sheet (one row per judge per team), with automatic retry if Wi-Fi drops
7. Restore by name: entering the same judge name on any phone or browser loads that judge's scores back from the Sheet
8. Panel view (Judge | Panel toggle, password protected): live ranking by z-score with each judge's total and gut check, standout votes,, and per-team category averages, quick notes (with how many judges tapped each) and judge comments. Password is `PANEL_PASSWORD` in `index.html`.

## Google Sheet setup

The script that receives scores is in `apps-script/Code.gs`. Paste it into the Sheet's Extensions > Apps Script,
deploy it as a Web app (Execute as: Me, Who has access: Anyone), and put the Web app URL in `API_URL` in `index.html`.
9. Reset all data (Panel): clears the Sheet (after copying it to a backup tab) and every judge's phone. Needs the updated `apps-script/Code.gs` deployed, with the same `PANEL_PASSWORD` as `index.html`.
