# jerm747.dev

Contract and freelance site for Jeremy Currence: landing page, quote engine, project requests with
project keys, a client project portal (messages, updates, deliverables, files) and an admin page.

React (Vite) front end + a small PHP back end that stores projects as JSON files. Runs on regular
GoDaddy/cPanel hosting with no database or extra services.

## Pages

| Address | What it is |
|---|---|
| `jerm747.dev` | Landing page, packages, quote engine, contact form |
| `jerm747.dev/#/project` | Clients type their project key to open their project page |
| `jerm747.dev/#/project/J747-XXXX-XXXX` | A project page directly (linked from every email) |
| `jerm747.dev/#/about` | About page |
| `jerm747.dev/#/admin` | Your admin page: Projects and Traffic tabs (not linked on the public site) |

## Build

```bash
npm install
npm test          # quote engine + project key checks
npm run build     # outputs dist/
```

Local development with the API working:

```bash
php -S localhost:8000 -t public     # terminal 1: API
npm run dev                          # terminal 2: site at localhost:5173 (calls /api through Vite)
```

## Deploy to GoDaddy (cPanel File Manager)

1. `npm run build`.
2. Upload **everything inside `dist/`** (including the hidden `.htaccess` files) into the folder
   your jerm747.dev domain points to. In cPanel → Domains you can see that folder; because the
   domain shares hosting with jerm747.com it's usually something like `public_html/jerm747.dev/`.
3. Visit `https://jerm747.dev/#/admin` **right away** and set your admin password (12+ characters).
   The first person to open that page sets it, so do this before sharing the site.
4. Send yourself a test request from the contact form. You should get two emails: the request
   (to admin@jerm747.dev) and the client confirmation with the project key.
5. Add a photo: upload `jeremy.jpg` (portrait, about 4:5) next to `index.html`. Until then the
   about section shows your initials.

**When you upload a new build later, never delete or replace `api/data/`.** That folder holds every
project, message and file. Upload over the top of the old files instead of deleting the folder.
Back it up now and then (download `api/data` from File Manager).

### If emails don't arrive

GoDaddy's PHP `mail()` sends from the server. Make sure the `admin@jerm747.dev` mailbox exists in
cPanel → Email Accounts, since emails are sent *from* that address. If they land in spam, ask
GoDaddy to turn on SPF/DKIM for jerm747.dev (cPanel → Email Deliverability → Repair).

## Games

Games moved to their own site, jerm747.games (separate project, `jerm747-games`). This site has no
links to them on purpose. If an earlier upload left a `sandbox` folder on the server, delete it in
File Manager; old jerm747.dev/sandbox links already forward to jerm747.games.

## Traffic and email reports

The admin Traffic tab shows visitors and page views per day, traffic by hour for the last 24 hours,
top pages, where visitors came from, devices and browsers. No
cookies: visitors are counted by a hash that resets every day, and project keys never show up.

Email reports go to admin@jerm747.dev every 12 or 24 hours (pick in the Traffic tab, or turn off).
They go out on the first visit after one is due. For exact timing add an hourly cPanel cron job; the
Traffic tab shows the exact command. Tick "Don't count my own visits from this device" on each
device you use.

## Change prices and wording

All pricing lives in `src/quote.js`:

- `YEAR_VALUE` (120000): one full working year. Every estimate is shown as a share of this.
- `RATE` (95): hourly contract rate used for estimates.
- `PROJECT_TYPES` and `FEATURES`: hour ranges per item.
- `PACES`: hours per week and the premium for faster timelines.

Package cards, services and "Work I don't take" are at the top of `src/pages/Home.jsx`.

## Project keys and the portal

- Every request gets a key like `J747-7KQ4-M2XD` (no look-alike characters). It's shown on screen,
  emailed to the client, and included in your notification.
- Clients open their project with the key: stage tracker, message thread, updates, deliverables
  and files. They can reply and attach files (10 MB each).
- In admin you reply, post updates, set the stage, edit deliverables, keep private notes, and open
  projects yourself for phone or in-person leads. Replies and updates email the client a link back.
- Private notes are never sent to the client's browser.
- Lookups are rate-limited per visitor so keys can't be guessed.

Data layout on the server (`api/data/`, blocked from the web):

```
projects/J747-XXXX-XXXX.json   one file per project
analytics/YYYY-MM-DD.jsonl     visit counts, one file per day
settings.json                  report schedule
files/J747-XXXX-XXXX/          uploaded files
admin.json                     your password hash (delete this file to reset the password)
ratelimit/                     temporary counters
```

## Later

- Client logins (email + password or magic link) on top of the same project keys.
- Move storage to MySQL (GoDaddy includes it) once there are many projects.
- Invoices and signed proposals attached to a project.
