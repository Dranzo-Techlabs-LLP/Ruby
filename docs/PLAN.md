# Rubys Admin Portal (ruby.dranzo.com): architecture and plan

Status: **approved and deployed** (2026-11-24). Kept as the original plan.

> **Changed after approval:** sign-in. Instead of a Cloudflare Access gate plus each admin's own
> login, the portal now has **one sign-in page** (Admin ID + password) that signs in to each admin
> through that admin's own login, and the switcher appears only after it. Cloudflare Access was
> dropped because it would add a second login page. See [CHANGES.md](CHANGES.md).

Date: 2026-11-24

## 1. What exists today (Phase 1 findings)

| | Whispering Willows | Teak Town |
| --- | --- | --- |
| Source | `C:\WhisperingWillows` (no git) | `C:\TeakTownAdmin` (local git) |
| Release zip checked | `whispering-willows-deploy-20261119-1030.zip`, identical to the local build | `teaktown-admin-only-20261124.zip`, identical to the local build |
| Frontend | React 18, Vite 6, Tailwind v4, React Router 7, served at `/admin/` | same |
| Backend | PHP 8 API at `/api/` (`index.php` router, `lib.php` helpers) | same, plus `POST /api/enquiry` for the website |
| Database | MySQL, own schema and DB user | MySQL `<prefix>tt`, user `<prefix>ttapp` |
| Sign-in | `POST /api/login` → random 64-hex token in the `sessions` table; token kept in `localStorage["whispering-willows.token"]`, sent as `Authorization: Bearer` | same, key `teaktown-admin.token` |
| Roles | Administrator, Manager, Front Desk, B2B, Owner; rights checked in the app and again in the API | same |
| Modules | Dashboard, Calendar, Bookings (+ new/edit/detail/invoice), Accounting, Expenses, Cash Deposit (attachments), Reports (CSV/Excel), Rooms, Users, Roles & Rights, Invoice settings | same |
| Uploads | `~/whispering_willows_uploads` | `~/teaktown_admin_uploads` |
| Hosting | cPanel account `whisperingwillow` on the WHM server. **Production domain: unknown** | cPanel account `teaktown`, **live at https://theteaktown.com/admin/** |
| Server | WHM/cPanel at Contabo, `167.86.105.17` | same server |
| DNS | ? | Cloudflare, proxied |
| Framing | admin sends no frame headers | admin sends `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` (cannot be embedded by another site today) |

`dranzo.com` is on Cloudflare (proxied). `ruby.dranzo.com` does not exist yet.

The Teak Town admin was cloned from Whispering Willows on 2026-11-23, so the two codebases are the
same apart from branding, rooms and prefixes.

Weaknesses that already exist (not changed by this plan; listed so the decision is informed):
- Sessions never expire (no `expires_at` on `sessions`).
- `/api/login` has no rate limit or lockout.

## 2. Recommended architecture: portal shell + each live admin in its own frame

```
https://ruby.dranzo.com            (Cloudflare Access sign-in in front)
┌───────────────────────────────────────────────────────────────────────┐
│ Rubys Admin │  ● Whispering Willows       [Switch Admin Panel ▾] [You ▾]│  ← portal top bar
├───────────────────────────────────────────────────────────────────────┤
│  <iframe src="https://<ww-domain>/admin/?embed=rubys">                 │  ← shown when WW selected
│  <iframe src="https://theteaktown.com/admin/?embed=rubys"> (hidden)    │  ← kept loaded, so switching is instant
│      each frame = the original admin: its own sidebar, pages, API, DB  │
└───────────────────────────────────────────────────────────────────────┘
```

- **The portal is a small static app** (top bar, switcher, user menu, frame host). It holds no
  business data, no API keys and no database access.
- **Each admin is the real, already-deployed app** on its own domain, shown in a frame. It keeps
  its own sidebar (the "original sidebar navigation"), pages, roles, API, database, uploads and
  reports. Fixes deployed to either admin appear in the portal at once, with no second copy to keep
  in sync.
- **Isolation is enforced by the browser.** The two admins run on different origins, so neither
  can read the other's token, storage, memory or responses. Inside the portal, each frame's storage
  is also kept apart from the same admin opened directly (browser storage partitioning), so the
  sessions don't leak in or out either.
- **Switching** shows one frame and hides the other, so there is no reload and each admin keeps
  its page and any half-filled form. The choice is kept in the address (`/ww`, `/tt`) and in local
  storage, so a refresh reopens the same panel. The default is Whispering Willows.

### Why not the alternatives

| Option | Why not (for now) |
| --- | --- |
| Rebuild both admins into one React app | Duplicate business logic, highest risk of breaking features, two codebases to merge forever |
| Host copies of both admin builds under ruby.dranzo.com, calling each API through CORS or a proxy | Both apps on one origin share `localStorage`, so a bug in one could expose the other's token; plus a second copy of each admin to rebuild on every release |
| Reverse-proxy both apps under one origin | Same shared-origin problem; needs Apache proxy modules on cPanel |

### Sign-in and security

1. **Portal gate: Cloudflare Access** (Zero Trust, free for up to 50 users) on `ruby.dranzo.com`.
   Only emails you list can open the portal (one-time email code, or Google sign-in). This adds a
   layer and bypasses nothing.
2. **Each admin keeps its own sign-in** inside its frame. That covers roles, rights and inactive
   accounts, unchanged. A person with no account in Teak Town's database cannot use Teak Town in
   the portal. You sign in to each admin once per device, and its token is remembered as it is today.
3. **Portal sign-out** ends the Cloudflare Access session and tells both frames to sign out.
4. **Headers on the portal:** strict CSP (`script-src 'self'`, `frame-src` only the two admin
   origins), HSTS, `frame-ancestors 'none'` (the portal itself cannot be framed), `nosniff`.
5. **Messages between portal and admin** (`postMessage`) are accepted only from exact origins:
   the admin only from `https://ruby.dranzo.com`, the portal only from the two admin origins.
   No token ever crosses between frames.

A single sign-in shared by both admins (SSO) is possible later. It needs a new trusted endpoint in
both PHP APIs and a mapping of users across the two databases, so it is a bigger and riskier change.
I don't recommend it in this phase.

## 3. Changes to the existing admins (small and additive)

Each change is the same in both projects. With none of them, the admins behave exactly as they do today.

| # | File | Change | Production impact |
| --- | --- | --- | --- |
| A1 | `public/.htaccess` (→ `admin/.htaccess`) | CSP `frame-ancestors 'self' https://ruby.dranzo.com`; `Header always unset X-Frame-Options` for `/admin/` only | Lets only the portal frame the admin. Clickjacking protection stays for every other site |
| A2 | new `src/lib/embed.ts` + 3 lines in `main.tsx` | When opened with `?embed=rubys` **and** framed by `https://ruby.dranzo.com`: report the current page and the signed-in user's name to the portal, and accept "sign out" / "go to page" from it | Inactive outside the portal |
| A3 | `Topbar.tsx` | In embed mode only, hide the mobile brand bar's duplicate name; keep the menu button | None outside the portal |

No API, database, `config.php`, role or business-logic change. The `api/` folder is not touched.

A1 to A3 ship through each project's normal `release:whm` / `release` flow. Every run backs up
`public_html` first (`~/tt-backups`, `~/ww-backups`).

## 4. New portal project (`C:\Rubys`)

- Vite + React + TypeScript + Tailwind v4, the same toolchain as the admins.
- `src/apps.ts`: the registry (id, name, origin, `/admin/` URL, accent colour, logo).
- Top bar: Rubys Admin wordmark (left); the current admin's name and logo as a coloured badge
  (always visible); **Switch Admin Panel** dropdown (keyboard accessible); user menu with the
  Access email and **Sign out of all**.
- Responsive: on phones the top bar collapses to logo + switcher + menu, and the admin's own mobile
  drawer works inside the frame.
- Smooth switch: cross-fade between frames (150–200 ms; none if the user prefers reduced motion).
- Output: static files plus `.htaccess` (security headers, SPA fallback), and a
  `release:whm` script like the other two.

## 5. Cloudflare and hosting

Recommended: a new cPanel account **`rubys`** on the same WHM server, domain `ruby.dranzo.com`.

| Step | Where | What | Touches existing records? |
| --- | --- | --- | --- |
| C1 | WHM | Create account `rubys`, primary domain `ruby.dranzo.com` | No |
| C2 | Cloudflare → dranzo.com → DNS | **Add** `A rubys → 167.86.105.17`, Proxied | Adds one record only |
| C3 | cPanel `rubys` → SSL/TLS Status | Run AutoSSL (or install a Cloudflare Origin Certificate) | No |
| C4 | Cloudflare → Rules → Configuration Rule for `ruby.dranzo.com` | SSL mode **Full (strict)** for this hostname only, so the zone's mode for other `dranzo.com` sites is untouched | No |
| C5 | Cloudflare Zero Trust → Access → Applications | Self-hosted app `ruby.dranzo.com`, policy: allow the emails you name | No |
| C6 | Cloudflare → SSL/TLS → Edge | Always Use HTTPS is zone-wide, so I'll only **check** it, not change it; the portal's own `.htaccess` forces HTTPS | No |

I don't see Cloudflare or WHM credentials in this session. Unless you give me access, I'll give
you each step as exact click-through instructions, and you run them.

Alternative: host the portal on Cloudflare Pages. It's purely static, so this works too and needs
no server account. I suggest cPanel so all three sites deploy the same way.

## 6. Test plan (Phase 7)

Locally first, with both admins' `npm run local` (ports 8090 and 8091) and the portal dev server.
Then on production after you approve. The local admin URLs go in the registry only in development builds.

| # | Check | How |
| --- | --- | --- |
| 1–2 | Each admin loads in the portal | Playwright: sign in to each frame, dashboard renders |
| 3 | Switching works and keeps state | Open a booking in WW, switch to TT and back: same page, no reload |
| 4 | All features | Run each project's `tests/test_smoke.py` against the framed app; also print an invoice and download Excel inside the frame |
| 5 | Existing sign-in | Wrong password, inactive user, role without a right → same results as on the direct domain |
| 6 | Data isolation | Create a booking in TT through the portal; it is absent from WW's API and database |
| 7 | No endpoint conflicts | The portal serves no `/api`; each frame calls only its own origin (network log) |
| 8 | Existing domains | Before/after check of `theteaktown.com` (site + `/admin` + `/api`) and the WW domain |
| 9 | HTTPS | `curl -I` on the portal: 200 over TLS, HSTS, http→https redirect |
| 10 | Refresh keeps the panel | Reload on `/tt` → TT opens; clear storage → WW by default |
| 11 | Unauthorised access | No Access session → Cloudflare sign-in page; an email not on the list → denied; a random site framing the admin → blocked by `frame-ancestors` |
| 12 | Desktop / tablet / mobile | Screenshots at 1440, 768 and 375 px |

## 7. Order of work

1. ✅ Phase 1–2: inspection (this document).
2. ⏸ **Phase 3: your approval** of this plan and the decisions in section 8.
3. Phase 4: build the portal in `C:\Rubys` (local only).
4. Phase 5: A1–A3 in both admins (commit in TeakTownAdmin; WW has no git, so I'd run `git init`
   first with your OK, or back up the folder); test locally.
5. Phase 6: you run (or I guide) C1–C5. Nothing existing is deleted or overwritten.
6. Phase 7: full test pass.
7. Phase 8: deploy, in this order: the portal, then the WW admin, then the TT admin. The website and
   API are unchanged.
8. Hand-off: `docs/DEPLOY.md` and `docs/CHANGES.md` with every change and how to roll it back.

**Rollback:** restoring the previous `admin/.htaccess` removes portal framing from an admin. The
portal can be switched off by pausing its Access app or deleting the one DNS record.

## 8. Decisions needed from you

1. **Whispering Willows production domain.** Is WW live, and at what address? (Needed for its frame
   URL and for A1.) If it isn't live yet, it must be deployed to a domain before the portal can show it.
2. **Portal sign-in:** Cloudflare Access gate + each admin's own sign-in (recommended), or something else?
3. **Who may open the portal:** the email addresses for the Access policy.
4. **Portal hosting:** new cPanel account `rubys` on the same server (recommended) or Cloudflare Pages.
5. **Infrastructure access:** will you run the Cloudflare/WHM steps yourself from my instructions, or
   give me access in the browser?
