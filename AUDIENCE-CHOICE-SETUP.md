# Audience Choice: setup guide

## The Audience Choice files in this repo

| File | What it is |
| --- | --- |
| `audience.html` | The page people reach by scanning a booth's QR code. |
| `organizer.html` | The PIN-protected page for results, team names, the voting switch and printable QR signs. |
| `audience-config.js` | Holds the Google web app URL for Audience Choice. |
| `vendor/qrcode.js` | Draws the QR codes (MIT-licensed library). |
| `apps-script/AudienceChoice.gs` | The backend. Paste it into the Apps Script of the Audience Choice Google Sheet (a separate Sheet from the judges' one). |

The organizer PIN is set in the deployed Apps Script (`ORGANIZER_PIN`), never in the page code. This repo is public, so the copy of the script here has a placeholder: set the real PIN when you paste it into Apps Script, and don't commit it.

## 1. Set up the Google Sheet (about 5 minutes)

1. Sign in to the Google account that should own the votes (a B+T account if possible), then create a blank Sheet named **JAM Audience Choice**.
2. Click **Extensions → Apps Script**. Delete the sample code, paste in all of `apps-script/AudienceChoice.gs`, and click **Save**.
3. Click **Deploy → New deployment**. Click the gear icon, choose **Web app**, and set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, then **Authorize access**. If Google shows "Google hasn't verified this app," click **Advanced → Go to (project name)**. That's normal for your own script.
5. Copy the **Web app URL**. It ends in `/exec`.

If "Anyone" isn't available in step 3, the account's organization is blocking public apps. This is common for school accounts. Use a personal or B+T Gmail instead.

You don't need to create any tabs. The Sheet sets up **Teams, Ratings, Visits** and **Settings** the first time the app is used, with Team A to Team J.

## 2. Point the pages at the Sheet

1. Open `audience-config.js` and paste the web app URL between the quotes.
2. Commit the change. After about a minute, the pages are live:
   - Audience: `https://<account>.github.io/bt-judging/audience.html`
   - Organizer: `https://<account>.github.io/bt-judging/organizer.html`

**Move the repo to the B+T GitHub organization before printing QR codes.** The QR codes point to the address the organizer page is opened from, so they need to be printed from the final address.

## 3. Test (about 10 minutes)

1. Open the organizer page and enter the organizer PIN.
2. Scan 2 or 3 of the QR codes on screen with a few phones, using a mix of iPhone and Android. Rate some teams, and change one answer.
3. Click **Refresh** on the organizer page and check that the ratings show up. They also appear in the Sheet's Ratings tab.
4. Turn voting off, scan a code, and check that the phone says voting is closed. Then turn voting back on.
5. Click **Reset all votes**. Phones used for testing forget their old ratings the next time they scan.

## 4. Before the event

- **Rename the teams** on the organizer page once you have the finalists. The QR codes don't change. Remove any extra teams; with 10 placeholders you'll probably have extras.
- Click **Print QR signs** to print one page per team: team name, QR code, "Scan to rate this team."
- Click **Reset all votes** one last time after testing.

## During the event

- Keep the organizer page open on a laptop. It refreshes every 15 seconds.
- Turn **voting off** when the expo ends. Votes sent after that are rejected.
- The two highlighted teams are the winners. If 2nd and 3rd place are tied, the page says so, and the tie is yours to decide.

## How scoring works

- Each answer counts 1 to 3 points, left to right. A rating is the average of the two questions.
- Each phone gets one rating per team and can change it until voting closes.
- Teams are ranked by an **adjusted average**: each team's ratings are blended with 5 "typical" ratings at the overall average. Teams with only a few ratings are pulled toward the middle, so a handful of friends can't carry a team, and a quiet booth isn't penalized for low traffic.

## Changing things later

- **Questions or answer labels:** edit `QUESTIONS` near the top of the script in `audience.html`.
- **PIN:** change `ORGANIZER_PIN` in the script. After any change to the script, click **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**. The URL stays the same.
