# Rubys Admin portal: deployment

| Site | Address | cPanel account | What runs there |
| --- | --- | --- | --- |
| Portal | https://ruby.dranzo.com | `rubydranzo` | static shell (`public_html`: `index.html`, `assets/`, `apps/`, `.htaccess`) |
| Whispering Willows | https://whisperingwillows.dranzo.com/admin/ | `whisperingwillow` | admin + PHP API + MySQL (unchanged apart from `admin/`) |
| Teak Town | https://theteaktown.com/admin/ | `teaktown` | website + admin + PHP API + MySQL (unchanged apart from `admin/`) |

Server: WHM `vmi2490137.contaboserver.net` (167.86.105.17). DNS: Cloudflare, proxied.

## First deployment (2026-11-24)

1. **Cloudflare** (zone dranzo.com): added `A ruby → 167.86.105.17`, Proxied.
2. **WHM**: created account `rubydranzo`, domain `ruby.dranzo.com`, package `default`.
3. **Portal**: `npm run release` → `release/rubys-portal-*.zip`, uploaded to `/home/rubydranzo`,
   extracted into `public_html`, zip deleted.
4. **Whispering Willows admin**: backed up `public_html/admin` and `public_html/.htaccess` to
   `/home/whisperingwillow/rubys-backups-20261124/`; built with `npm run build`, packaged with
   `node scripts/package-admin.mjs C:/WhisperingWillows whispering-willows`, uploaded, extracted
   into `public_html`, zip deleted. This also shipped the Nov 19 responsive-tables change that had
   never been deployed (approved).
5. **Teak Town admin**: same, backup in `/home/teaktown/rubys-backups-20261124/`, package
   `node scripts/package-admin.mjs C:/TeakTownAdmin teaktown`. The website, API and `config.php`
   were not touched.
6. **SSL**: AutoSSL (Let's Encrypt) for `rubydranzo`.

Uploads were checked against their SHA-256 before extracting.

## Later releases

**Portal**:
```
npm run release
```
Upload `release/rubys-portal-*.zip` to `/home/rubydranzo`, extract into `public_html`, delete the zip.

**An admin** (after changing its code): in that project run `npm run build`, then in `C:\Rubys`:
```
node scripts/package-admin.mjs C:/TeakTownAdmin teaktown
```
Upload to the account's home folder, extract into `public_html`, delete the zip. Each project's own
`release` / `release:whm` flow also still works and now includes the portal support.

## Rollback

| To undo | Do |
| --- | --- |
| Portal framing of an admin | Copy `~/rubys-backups-20261124/admin/.htaccess` back over `public_html/admin/.htaccess` |
| An admin build | Copy `~/rubys-backups-20261124/admin/` back over `public_html/admin/` (the old `assets/index-*.js` files are still there too) |
| The portal | Delete the `ruby` DNS record in Cloudflare, or empty `/home/rubydranzo/public_html` |

## Checks after a deploy
```
python tests/test_portal.py          # local copies (see the file's header)
curl -I https://ruby.dranzo.com/     # 200, CSP with frame-src for both admins
curl -I https://theteaktown.com/admin/   # CSP frame-ancestors 'self' https://ruby.dranzo.com
curl -I https://whisperingwillows.dranzo.com/admin/
```
