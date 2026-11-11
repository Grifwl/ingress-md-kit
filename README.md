# Ingress MD Kit

Languages: **English** · [Català](README.ca.md) · [Español](README.es.md)

Plan an **Ingress Mission Day** from idea to application: candidate missions and routes, partner proposals, mission images with the partner overlay, and the exports you need for the Niantic application and the Mission Authoring Tool.

Self-hosted on **Cloudflare** (Workers + D1 + R2 + Access). Everything fits in the free tier. Clone it, deploy it under your own (sub)domain and plan your own city.

> Unofficial community tool. Not affiliated with or endorsed by Niantic Spatial.
> The rules below come from the **Ingress Mission Day Handbook 2026** (last edit: September 2025). Always check the current handbook and https://ingress.com/news before applying — deadlines and rules change.

---

## What it does

One instance can host **several Mission Days** (e.g. `/example-2027`, `/sample-town-2028`), each with its own team of organisers. Other communities can use your instance or deploy their own.

### URLs

| Path | What |
|---|---|
| `/` | Home page: what the tool does, the published Mission Days and a contact to ask for access |
| `/<md-slug>` | Mission Day page (participant view, once published) |
| `/<md-slug>/proposta-<token>` | Proposal for one candidate partner (unlisted). The word follows the letter language: `proposta`, `propuesta`, `proposal` — all three work |
| `/<md-slug>/sample` | The single logo/medal picture linked from the Niantic application, generated from Exports. It only shows a partner's logo with its signed permission |
| `/admin` | Private area (Cloudflare Access) |

### Public side (no login)
- **Home page** — explains what a Mission Day is and what the tool does, in the same neutral words for every community, and links to every Mission Day whose participant view is published: upcoming ones first, then past ones. It ends with a contact, set by the instance administrators, for anyone who would like to use the tool. Partners are never listed there.
- **Partner proposals** — one page per candidate partner (city council, university, tourism board, museum…), reachable only through an unguessable link. It contains:
  - a cover letter: who we are, what Ingress is, what a Mission Day is, why this city, why this partner;
  - the full mission proposal: every mission with name, description, photo and route;
  - a **6-column mosaic** of the 18 or 24 mission images, with the partner's logo already applied as an example;
  - the map of all missions and the route of each one — straight lines between its portals, never between missions (interactive map + static image + link to the shared Google My Maps);
  - the request for permission to use the partner's logo and photos: a default text every new partner inherits and that can be adapted to each one.
  - what a Biocard is, with the Mission Day's own card when the organisers choose to show it, and a request asking the partner whether it wants to appear on the cards and offering it a card of its own; the block to sign has a box to tick for each answer.
  - A print stylesheet so the page can be saved as PDF and attached to an email.
- **Participant view** (once an owner publishes it, usually after approval) — what agents need to play, laid out for phones: a presentation in the organisers' own words (one text per language, set in Settings, where `{missions}` and `{medal}` stand for the number of missions and the minimum that earns the medal; in a language left empty, a default sentence is shown instead), the selected missions in recommended order, the mosaic, the map with each route, the My Maps link, and for every mission its description in the visitor's language, its start portal and its portals with Intel links. Until it is published, its address only says that the Mission Day is not published yet. Its images carry the default overlay, or the overlay of one partner chosen by an owner among those that accepted with a signed permission; if that permission lapses, the default overlay comes back by itself. When the organisers choose so, it also shows the Mission Day's own Biocard.

All public pages except the home page are `noindex`. Proposal pages are also unlisted, because they show logos you do not have permission to use yet; the participant view is meant to be shared wherever you choose, such as your agents' channels.

### Private side (admin, behind Cloudflare Access)
- **Mission Days** — create several; each has its slug, city, year, date, format (18 / 24, or 6 for Lite), team (both ENL and RES Points of Contact), default overlay (no partner) and shared letter texts.
- **Instance settings** — the contact shown on the home page (a text such as `@codename` and the link it points to, `https:` or `mailto:`), editable by instance administrators.
- **Default letter texts** — instance-wide texts (who we are, what Ingress is…) that every new Mission Day copies when it is created and can then adapt.
- **Organisers** — each Mission Day has its own team, managed in its Organisers tab. Owners add people by the email they sign in with, change their role and remove them; editors can change everything else, but cannot manage the team or delete things. A Mission Day always keeps at least one owner, and anyone can leave a team. An organiser only sees the Mission Days they belong to, except that instance administrators can manage the team of any of them. Each organiser has a profile (codename, faction) that the team list and the partner history show.
- **Mission manager** — create *as many candidate missions as you want* (more than 24): name, description, landmark/theme, photo, portals (waypoints) and route.
- **Selection and order** — choose which 18 or 24 candidates make the final set, drag to set the recommended order, see the 6-column mosaic live.
- **Partner manager** — candidate partners with contact info, logo, overlay PNG, the "why you" text, status (not contacted → contacted → in talks → accepted / declined) and the signed permission document.
- **Image composer** — builds each 512×512 PNG: the mission photo (cropped to a square, by default its centre, and reduced to 512×512; a copy of up to 2048 px is also kept for printing Biocards) with an overlay PNG on top (512×512, transparent where the photo must show). The overlay is prepared outside the tool from the official Mission Day template: one per partner, plus a default one without partner. Preview for every partner before you ask any of them.
- **Biocards** — printed cards to remember the event, 63 × 88 mm: one for the Mission Day as a whole and one for any mission you choose. Upload a front and a back template prepared outside the tool (city and any partner logo included): the front is a PNG transparent where the picture must show, usually a square at the top. The size of the template sets the print size, so a cut margin is read from its proportions (for example 69 × 94 mm is a 3 mm margin per side). The tool adds the dynamic part only: the photo (for the Mission Day's card, a photo of its own or a collage of the selected missions' photos), the name on the front (the landmark, or a shorter name written for the card) and the description on the back, in one language or followed by English. Drag a box over each side to place the texts, which shrink by themselves to fit; they use Coda, a free font, unless you upload your own. The cards download as a ZIP of PNG files that state their print resolution. Partners record whether they agree to appear on the cards.
- **Validation** — checks the set against the handbook rules (see below) and flags problems before you export.
- **Exports**
  - ZIP with the final 512×512 PNG of every selected mission, for the chosen partner;
  - **UMM file** to pre-fill every mission in the Mission Authoring Tool with the Ultimate Mission Maker plugin;
  - mission sheet (CSV): names, descriptions, portals with coordinates and Intel links, as a checklist;
  - KML to import into Google My Maps;
  - application helper: the texts and lists the Niantic application form asks for.
- **Portal picking in IITC** — with Ultimate Mission Maker: export the candidates as a UMM file, draw or fix the routes in IITC, export from UMM and import the file back.

---

## Mission Day rules the tool checks

| Rule | Value |
|---|---|
| Missions in the final set | 18 or 24 (Mission Day Lite: 6, towns ≤ 2,500 inhabitants) |
| Mission type | ANY ORDER (never sequential) |
| Mission name | `MD <YEAR>: <City>, <Landmark or theme>`, max 50 characters |
| Mission description | max 200 characters (local language + English if it fits) |
| Portals per mission | 6 to 10 |
| Actions | Portal hack only — no passphrases, no Field Trip markers |
| Image | 512×512 px, PNG, photos you are allowed to use commercially |
| Design | Same Mission Day overlay on every mission; **never designed as a banner set** |
| Pathing | Missions must not lead to the next one; any 6 should be doable in under 2 hours |
| Application | ENL + RES Points of Contact, attraction list, map link, **one** logo/medal design |
| Partner logo | Written proof of the partner's approval is required |

Notes:
- The **recommended order** is only a suggestion for agents who want to chain missions. It never appears inside the missions themselves.
- The **mosaic** is just a way to display the set as agents see it in the scanner. Each image must work on its own: the tool warns you if images look like they form one picture.
- For the application, Niantic asks for **only one** finished logo/medal. The tool generates all of them because the partner proposal shows them, but submit just one until the overlay is approved.

---

## Architecture

```
Browser (public + admin SPA)  ─┬─►  Cloudflare Worker (API + static assets)
                               │       ├─ D1  (missions, portals, partners, texts)
                               │       └─ R2  (photos, overlays, generated PNGs, documents)
Cloudflare Access ─────────────┘  protects /admin and /api/admin
```

- **Worker**: TypeScript + Hono, serves the API and the built frontend.
- **Frontend**: Vite + TypeScript, Leaflet + OpenStreetMap for maps.
- **Images**: composed in the browser with `<canvas>` (no image service needed), uploaded to R2.
- **i18n**: Catalan, Spanish and English for the UI; letters can be written in any language per partner.

---

## Deploy your own

Requirements: Node.js 20+, a Cloudflare account, a domain on Cloudflare, `wrangler` logged in.

```bash
git clone https://github.com/<you>/ingress-md-kit.git
cd ingress-md-kit
npm install

# Create the storage
npx wrangler d1 create ingress-md-kit
npx wrangler r2 bucket create ingress-md-kit

# Configure
cp wrangler.example.toml wrangler.toml   # fill in the D1 id, bucket and route

# Database
npm run db:migrate          # remote
npm run db:migrate:local    # local dev

# Run and deploy
npm run dev
npm run deploy
```

Then, in the Cloudflare dashboard:
1. **Custom domain**: attach the Worker to your subdomain (e.g. `md.example.org`).
2. **Zero Trust → Settings → Authentication**: add the **One-time PIN** login method. Whoever signs in types their email and Cloudflare sends them a code; no mail server or password is needed.
3. **Zero Trust → Access → Applications**: create a self-hosted application for `md.example.org/admin*` and `md.example.org/api/admin*`, with an *Allow* policy that includes **Everyone**. Access then only proves who someone is, and the tool decides what they see: a person who belongs to no Mission Day gets an empty list, and owners can add organisers without touching Cloudflare. If you prefer to vet every person yourself, include only their emails instead, and add each new organiser there too.
4. Everything else (Mission Day pages and proposals) stays outside Access.

The Zero Trust free plan covers up to 50 people, counted as they sign in; you can remove inactive ones under Zero Trust → Users.

`wrangler.toml` is git-ignored: your domain, IDs and data never end up in the repository.

Before the first deploy, set `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and `INSTANCE_ADMINS` (comma-separated emails of those who can create Mission Days) in `wrangler.toml`. The admin area refuses everyone until they are set.

### Local development

```bash
cp wrangler.example.toml wrangler.toml
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run seed:local          # fictional demo Mission Day
npm run dev                 # then open /admin
```

`.dev.vars` sets `ENVIRONMENT=dev`, the only mode in which the admin area skips Cloudflare Access. In that mode, the profile page (the name at the top right) can also switch to another test identity, to try what owners and editors see.

---

## Typical workflow

1. Create the Mission Day (city, year, format 18/24) and the shared letter texts, and add the other organisers in its Organisers tab.
2. Draft candidate missions; pick portals in IITC with Ultimate Mission Maker; upload a photo for each.
3. Add candidate partners with their logo and overlay PNG.
4. Select the final 18 or 24 missions and their recommended order. Fix validation warnings.
5. Export the KML, import it into Google My Maps, paste the link and upload a screenshot.
6. Send each partner its proposal link (or the PDF). Track the answers.
7. When a partner says yes: upload their written approval, generate the final PNGs and the mission sheet, and fill in the Niantic application with the application helper.
8. After approval: create the missions in the Mission Authoring Tool with the UMM file and the PNG ZIP, publish the participant view in Settings and share its address with the agents.
9. Prepare the Biocard templates, place the texts in the Biocards tab and download the cards for printing.

---

## Picking portals in IITC

Ingress MD Kit doesn't ship its own IITC plugin (for now); it works with **Ultimate Mission Maker**:

1. **Admin → Exports → UMM file to edit in IITC**: all candidate missions (or only the selected ones) in one UMM file.
2. In IITC with UMM: *UMM Opt → Import*, then draw or edit routes ("mission mode", next/previous mission, undo).
3. *UMM Opt → Export* and upload the file in **Admin → Exports → Import from UMM**. The tool shows the changes per mission (portals added/removed/reordered) before saving.

Tips:
- Missions are matched by position in the file, and the names and descriptions stored in the tool always win, so it doesn't matter if UMM rewrites titles when you edit its "banner details".
- UMM warns when the "banner length" isn't a multiple of 6: harmless here.

A dedicated plugin (live sync, 6–10 counter) may come later if the round trip proves annoying.

---

## Google My Maps

Google offers no API to create My Maps, so the tool exports a **KML** you import by hand (My Maps → Create map → Import). My Maps allows **10 layers** per map, so the KML uses one layer for portals and one for routes (one line per mission, nothing joining missions), with one colour per mission. Paste the resulting share link and a screenshot in the admin; both appear in the proposals.

---

## Mission Authoring Tool (via Ultimate Mission Maker)

The Mission Authoring Tool (missions.ingress.com) has no import of its own, but the community plugin **[Ultimate Mission Maker](https://umm.vashiru.tech/)** (UMM) adds one: install it in Tampermonkey, open MAT, load a UMM JSON file, and for each new mission pick it from the list — title, description and portals are pre-filled. You still upload the image and finish each mission by hand.

Ingress MD Kit exports the selected missions as a **UMM file (format version 2)**, in the recommended order, with the final `MD <YEAR>: <City>, <Landmark>` names and descriptions. Unless the chosen language is English, each description is followed by a blank line and its English text, provided that fits in the 200 characters for every mission; if one mission cannot do it, they all stay in the chosen language only. Then, in MAT, for every mission:
1. New mission → choose it from the UMM list → Import;
2. set the type to **ANY ORDER** (check it every time);
3. upload its PNG from the ZIP (files are numbered in the same order);
4. check the portals (all "Hack portal") and submit.

The mission sheet (CSV) is still there as a printable checklist.

---

## Roadmap

- [x] v0.1 — Mission Day settings, mission manager, map, selection/order, mosaic
- [x] v0.2 — Partners, overlay composer, public proposal page, PDF print
- [x] v0.3 — UMM import/export, other exports (PNG ZIP, mission sheet, KML, application helper)
- [ ] v0.4 — (optional) own IITC plugin with live sync
- [x] v0.5 — Participant view, several organisers per Mission Day
- [x] v0.6 — Biocards

## License

MIT. Ingress, its logos and the Mission Day templates belong to Niantic Spatial; partner logos belong to their owners. The default Biocard font, Coda, is under the SIL Open Font License (`src/web/fonts/Coda-OFL.txt`).
