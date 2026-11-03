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
| `jerm747.dev/#/sites` | Sites in development (the gold **Sites** button, first in the menu) |
| `jerm747.dev/#/sites/<address>/<code>` | A site's private review link: preview, comments, shared doc, files, slides |
| `jerm747.dev/#/about` | About page |
| `jerm747.dev/#/admin` | Your admin page: Projects, Sites and Traffic tabs (not linked on the public site) |

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

## Sites in development

A place to show sites while you build them and collect feedback in one spot.

1. Admin → **Sites** → **New site**. Pick a web address (like `bellas-bakery`).
2. Upload that site's build into `sites/bellas-bakery/` on the server (next to `index.html` of this
   site). The preview shows it right away, with Desktop / Tablet / Phone sizes. For a Vite site build
   with `npx vite build --base=/sites/bellas-bakery/` so its links work from that folder.
3. Copy the **client review link** at the top of the site page and send it to the client.

Each site page has:

- **Preview**: the live build in a frame, plus "open in a new tab".
- **Comments**: a permanent history. Clients can tag which page they mean. You can mark comments
  resolved or hide them. You get an email for every client comment.
- **Shared doc**: one document everyone with the review link can edit. Shows who edited it last
  and when, keeps the last 15 versions (view or restore), and won't let two people overwrite each
  other: if someone saved first, you're told and can load their version.
- **Files**: shared both ways, 25 MB each.
- **Slides**: the first PDF shared becomes the slide deck (switch with "Use as slides"). View 1, 2 or
  4 slides at a time, arrow keys, full screen. For PowerPoint, use File → Save As → PDF and share
  that; the .pptx can sit in Files for download.

**Private or public.** New sites are private: only the review link opens them. Tick "Show on the
public Sites page" to list it at `#/sites` for anyone to see and comment on. Public visitors never
see the shared files, the review link or your notes, and can't edit the doc. "Make a new link"
replaces the review link if one gets passed around.

When a site launches on its own domain, upload the same build there. The comments and doc stay
here as the project record. Build folders are marked noindex so search engines skip them.

Data: `api/data/sites/<address>.json` and `api/data/site-files/<address>/` (keep `api/data/`
when uploading new builds, same as always). The slide viewer uses pdf.js, stored in `vendor/pdfjs/`.

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
sites/<address>.json           one file per site in development
site-files/<address>/          files shared on a site
admin.json                     your password hash (delete this file to reset the password)
ratelimit/                     temporary counters
```

## Later

- Client logins (email + password or magic link) on top of the same project keys.
- Move storage to MySQL (GoDaddy includes it) once there are many projects.
- Invoices and signed proposals attached to a project.

## Returnity Site Admin

The music site in `public/sites/nige-hood/` now has an integrated admin prototype for songs, albums/playlists, explicit/listening choices, separate administrator accounts, and scheduled site-update reports. See [RETURNITY-ADMIN.md](RETURNITY-ADMIN.md) for deployment, first sign-in, Nige account activation, and cPanel scheduling.
