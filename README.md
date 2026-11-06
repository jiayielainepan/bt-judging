# B+T Judging

Mobile web app for judging B+T competitions (starting with JAM Finals). Judges open the link on their phone.

Built one feature at a time:

1. Landing page: judge enters their name (saved on their phone)
2. Home screen: list of teams (starts at Team 1–5), + to add more teams
3. Scoring: tap a team to score Category 1–5 (each out of 5)
4. Feedback prompts (all optional): quick-tap "Keep doing" / "Work on" notes, plus "What worked" and "What to improve" boxes
5. Gut check (required): Standout / Solid / Needs work, at the bottom of the scoring sheet; shown with the score on each team card
6. Google Sheet connection: every Save is sent to a Google Sheet (one row per judge per team), with automatic retry if Wi-Fi drops

## Google Sheet setup

The script that receives scores is in `apps-script/Code.gs`. Paste it into the Sheet's Extensions > Apps Script,
deploy it as a Web app (Execute as: Me, Who has access: Anyone), and put the Web app URL in `API_URL` in `index.html`.
