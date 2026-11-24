"""End-to-end test of the Rubys portal against local copies of both admins.

    (in C:/WhisperingWillows)  npm run local        -> http://127.0.0.1:8090
    (in C:/TeakTownAdmin)      npm run local        -> http://127.0.0.1:8091
    (in C:/Rubys)              npm run dev          -> http://localhost:5190
    python tests/test_portal.py

Signs in with the local test accounts in each project's .localrun/secrets.json,
so it only ever runs against the local copies. Read-only: it creates no records.
Screenshots go to tests/screenshots/.
"""
import glob
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

PORTAL = os.environ.get("RUBYS_URL", "http://localhost:5190")
APPS = {
    "ww": {"name": "Whispering Willows", "origin": "http://127.0.0.1:8090", "root": Path("C:/WhisperingWillows"),
           "token": "whispering-willows.token", "prefix": "WW-"},
    "tt": {"name": "TeakTown", "origin": "http://127.0.0.1:8091", "root": Path("C:/TeakTownAdmin"),
           "token": "teaktown-admin.token", "prefix": "TT-"},
}
SHOTS = Path(__file__).resolve().parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

for a in APPS.values():
    accounts = json.loads((a["root"] / ".localrun" / "secrets.json").read_text())["accounts"]
    a["accounts"] = {acc[4]: acc for acc in accounts}  # by role: [id, name, email, password, role]

failures = []


def check(ok, label):
    print(f"{'ok  ' if ok else 'FAIL'} {label}")
    if not ok:
        failures.append(label)


def api(app, path, method="GET", body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(APPS[app]["origin"] + "/api" + path, method=method, data=data, headers=headers)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read() or b"{}")


def launch(p):
    try:
        return p.chromium.launch()
    except Exception:
        base = os.path.join(os.environ.get("LOCALAPPDATA", ""), "ms-playwright")
        found = sorted(glob.glob(os.path.join(base, "chromium_headless_shell-*", "*", "*.exe")))
        if not found:
            raise
        return p.chromium.launch(executable_path=found[-1])


def frame(page, app):
    return page.frame_locator(f'iframe[title="{APPS[app]["name"]} admin"]')


def frame_obj(page, app):
    return next(f for f in page.frames if f.url.startswith(APPS[app]["origin"]))


def sign_in(page, app, role="Administrator"):
    acc = APPS[app]["accounts"][role]
    f = frame(page, app)
    f.locator("#email").fill(acc[2])
    f.locator("#password").fill(acc[3])
    f.locator('button[type="submit"]').click()
    expect(page.locator("header")).to_contain_text(acc[1], timeout=15000)


def switch_to(page, name):
    page.get_by_role("button", name="Switch Admin Panel").click()
    page.get_by_role("menuitemradio", name=name).click()


with sync_playwright() as p:
    browser = launch(p)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    # 1. Default panel, empty storage -> Whispering Willows
    page.goto(PORTAL + "/")
    expect(page).to_have_url(re.compile(re.escape(PORTAL) + r"/ww(/login)?$"), timeout=10000)
    check(page.title() == "Whispering Willows · Rubys Admin", "default panel is Whispering Willows")
    expect(frame(page, "ww").locator("#email")).to_be_visible(timeout=15000)
    check(True, "WW admin loads in the portal (sign-in page)")
    expect(page.locator("header")).to_contain_text("Not signed in", timeout=10000)
    check(True, "portal sees WW's state through the bridge")

    # 2. Existing sign-in, inside the frame
    sign_in(page, "ww")
    check(True, "WW sign-in works inside the portal")
    expect(frame(page, "ww").get_by_role("heading", level=1).first).to_be_visible()
    page.screenshot(path=str(SHOTS / "desktop-ww-dashboard.png"))

    # 3. Navigating inside the admin updates the portal address
    frame(page, "ww").get_by_role("link", name="Bookings").first.click()
    expect(page).to_have_url(PORTAL + "/ww/bookings", timeout=10000)
    check(True, "admin navigation is mirrored in the portal address (/ww/bookings)")
    frame_obj(page, "ww").evaluate("window.__rubysMarker = 'still-here'")

    # 4. Switch to TeakTown
    switch_to(page, "TeakTown")
    expect(page).to_have_url(re.compile(re.escape(PORTAL) + r"/tt(/login)?$"), timeout=10000)
    expect(frame(page, "tt").locator("#email")).to_be_visible(timeout=15000)
    check(page.title() == "TeakTown · Rubys Admin", "switching to TeakTown shows its admin")
    check(page.locator('section[aria-label="Whispering Willows admin"]').get_attribute("inert") is not None,
          "hidden WW panel is inert")
    sign_in(page, "tt")
    check(True, "TT sign-in works inside the portal")
    page.screenshot(path=str(SHOTS / "desktop-tt-dashboard.png"))

    # 5. Switch back: no reload, same page
    switch_to(page, "Whispering Willows")
    expect(page).to_have_url(PORTAL + "/ww/bookings", timeout=10000)
    marker = frame_obj(page, "ww").evaluate("window.__rubysMarker")
    check(marker == "still-here", "switching back is instant: WW was not reloaded and kept its page")

    # 6. Isolation: each admin keeps its own token; the portal holds none
    ww_keys = frame_obj(page, "ww").evaluate("Object.keys(localStorage)")
    tt_keys = frame_obj(page, "tt").evaluate("Object.keys(localStorage)")
    portal_keys = page.evaluate("Object.keys(localStorage)")
    check(ww_keys == [APPS["ww"]["token"]], f"WW frame storage holds only its own token ({ww_keys})")
    check(tt_keys == [APPS["tt"]["token"]], f"TT frame storage holds only its own token ({tt_keys})")
    check(portal_keys == ["rubys.lastApp"], f"portal storage holds no tokens ({portal_keys})")
    ww_token = frame_obj(page, "ww").evaluate(f"localStorage.getItem('{APPS['ww']['token']}')")
    tt_token = frame_obj(page, "tt").evaluate(f"localStorage.getItem('{APPS['tt']['token']}')")
    try:
        api("tt", "/me", token=ww_token)
        check(False, "WW token rejected by the TT API")
    except urllib.error.HTTPError as e:
        check(e.code == 401, "WW token rejected by the TT API")
    try:
        api("ww", "/me", token=tt_token)
        check(False, "TT token rejected by the WW API")
    except urllib.error.HTTPError as e:
        check(e.code == 401, "TT token rejected by the WW API")
    ww_refs = [b["ref"] for b in api("ww", "/bootstrap", token=ww_token).get("bookings", [])]
    tt_refs = [b["ref"] for b in api("tt", "/bootstrap", token=tt_token).get("bookings", [])]
    # (Local WW data uses demo references, so compare the two sets rather than one prefix.)
    check(not set(ww_refs) & set(tt_refs), f"no booking appears in both admins ({len(ww_refs)} WW, {len(tt_refs)} TT)")
    check(not any(r.startswith("TT-") for r in ww_refs), "no TeakTown booking in Whispering Willows' data")
    check(not any(r.startswith("WW-") for r in tt_refs), "no Whispering Willows booking in TeakTown's data")

    # 7. Each frame calls only its own API (reload: both admins fetch /me and /bootstrap)
    requests = []
    page.on("request", lambda r: requests.append((r.frame.url if r.frame else "", r.url)))
    page.reload()
    page.wait_for_timeout(5000)
    api_calls = [(f, u) for f, u in requests if "/api/" in u]
    cross = [(f, u) for f, u in api_calls if not f.startswith(u.split("/api/")[0])]
    portal_api = [u for f, u in api_calls if f.startswith(PORTAL)]
    origins = sorted({u.split("/api/")[0] for f, u in api_calls})
    check(len(origins) == 2 and not cross and not portal_api,
          f"each frame calls only its own API; the portal calls none ({len(api_calls)} calls, {origins})")

    # 8. A forged message from the TT frame cannot change WW's state
    frame_obj(page, "tt").evaluate(
        "window.parent.postMessage({source:'rubys-admin', type:'state', path:'/bookings', user:{name:'Spoof', role:'x'}}, '*')")
    page.wait_for_timeout(300)
    switch_to(page, "Whispering Willows")
    header = page.locator("header").inner_text()
    check("Spoof" not in header, "a message from one admin's frame cannot change the other's state")

    # 9. Refresh keeps the panel and page
    switch_to(page, "TeakTown")
    expect(page).to_have_url(PORTAL + "/tt/bookings", timeout=10000)
    page.reload()
    expect(page).to_have_url(PORTAL + "/tt/bookings", timeout=10000)
    expect(frame(page, "tt").get_by_role("heading", name="Bookings").first).to_be_visible(timeout=15000)
    check(page.title() == "TeakTown · Rubys Admin", "refresh reopens TeakTown on the same page")
    page.goto(PORTAL + "/")
    expect(page).to_have_url(PORTAL + "/tt", timeout=10000)
    check(True, "'/' reopens the last panel (TeakTown)")

    # 10. Rights still apply inside the portal: Front Desk cannot open Accounting
    ctx2 = browser.new_context(viewport={"width": 1440, "height": 900})
    p2 = ctx2.new_page()
    p2.goto(PORTAL + "/ww")
    expect(frame(p2, "ww").locator("#email")).to_be_visible(timeout=15000)
    sign_in(p2, "ww", "Front Desk")
    links = frame(p2, "ww").locator("nav a").all_inner_texts()
    check("Accounting" not in links and "Reports" not in links, f"Front Desk sidebar has no Accounting/Reports ({links})")
    p2.goto(PORTAL + "/ww/accounting")
    expect(frame(p2, "ww").locator("main")).to_be_visible(timeout=15000)
    p2.wait_for_timeout(1500)
    body = frame(p2, "ww").locator("main").inner_text()
    check("Revenue" not in body, "Front Desk is blocked from /ww/accounting inside the portal")
    ctx2.close()

    # 11. A site that is not the portal gets no embed mode
    other = ctx.new_page()
    other.goto(APPS["tt"]["origin"] + "/admin/login")
    other.set_viewport_size({"width": 400, "height": 800})
    other.evaluate(f"""document.body.innerHTML = '<iframe id=x style="width:380px;height:700px" src="{APPS['ww']['origin']}/admin/login?embed=rubys"></iframe>'""")
    other.wait_for_timeout(2500)
    wf = next(f for f in other.frames if f.url.startswith(APPS["ww"]["origin"]))
    check(wf.evaluate("document.body.innerText.includes('Whispering Willows')"), "WW framed by a non-portal site stays in normal mode")
    other.close()

    # 12. Sign out of all
    page.get_by_role("button", name="Profile and sign out").click()
    page.get_by_role("menuitem", name="Sign out of all").click()
    expect(frame(page, "tt").locator("#email")).to_be_visible(timeout=15000)
    expect(frame(page, "ww").locator("#email")).to_be_visible(timeout=15000)
    try:
        api("ww", "/me", token=ww_token)
        check(False, "sign out of all ended the WW session on the server")
    except urllib.error.HTTPError as e:
        check(e.code == 401, "sign out of all ended the WW session on the server")
    try:
        api("tt", "/me", token=tt_token)
        check(False, "sign out of all ended the TT session on the server")
    except urllib.error.HTTPError as e:
        check(e.code == 401, "sign out of all ended the TT session on the server")

    # 13. Tablet and phone
    for label, size in (("tablet", (768, 1024)), ("mobile", (375, 812))):
        c = browser.new_context(viewport={"width": size[0], "height": size[1]}, is_mobile=label == "mobile", has_touch=True)
        pg = c.new_page()
        pg.goto(PORTAL + "/tt")
        expect(frame(pg, "tt").locator("#email")).to_be_visible(timeout=15000)
        sign_in(pg, "tt")
        overflow = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        check(not overflow, f"{label}: no sideways scrolling")
        check(pg.locator("header").get_by_text("TeakTown").first.is_visible(), f"{label}: panel name visible")
        pg.screenshot(path=str(SHOTS / f"{label}-tt-dashboard.png"))
        frame(pg, "tt").get_by_role("button", name="Open menu").click()
        pg.wait_for_timeout(400)
        pg.screenshot(path=str(SHOTS / f"{label}-tt-menu.png"))
        frame(pg, "tt").get_by_role("button", name="Close menu").click()
        pg.get_by_role("button", name="Switch Admin Panel").click()
        pg.wait_for_timeout(200)
        pg.screenshot(path=str(SHOTS / f"{label}-switcher.png"))
        api("tt", "/logout", method="POST", token=frame_obj(pg, "tt").evaluate(f"localStorage.getItem('{APPS['tt']['token']}')"))
        c.close()

    real_errors = [e for e in console_errors if "401" not in e and "Unauthorized" not in e]
    check(not real_errors, f"no console errors in the portal ({real_errors[:3]})")
    browser.close()

print()
if failures:
    print(f"{len(failures)} failed")
    sys.exit(1)
print("All portal checks passed.")
