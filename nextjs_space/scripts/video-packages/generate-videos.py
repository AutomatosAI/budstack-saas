#!/usr/bin/env python
"""Queue NotebookLM video overviews for the BudStacks guide library.

    <uvpy> generate-videos.py            # queue every V*.md not already built
    <uvpy> generate-videos.py V3 V7      # queue only these
    <uvpy> generate-videos.py --status   # report render status, queue nothing

where <uvpy> is the notebooklm-mcp tool's interpreter:
    /Users/gkavanagh/.local/share/uv/tools/notebooklm-mcp-server/bin/python

Auth comes from ~/.notebooklm-mcp/auth.json — refresh it with:
    notebooklm-mcp-auth --file /path/to/cookie.txt

NOTE: api_client.py hardcodes the retired notebooklm.google.com host; this script
pins the live one. A `uv tool upgrade` reverts the library patch, not this.
"""
import os, sys, re, glob, time

os.environ.setdefault("NOTEBOOKLM_BL", "boq_labs-tailwind-frontend_20260813.13_p0")

from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp import constants
from notebooklm_mcp.auth import load_cached_tokens

HOST = "https://notebook.google.com"
NotebookLMClient.BASE_URL = HOST
NotebookLMClient.BATCHEXECUTE_URL = f"{HOST}/_/LabsTailwindUi/data/batchexecute"

VISUAL_STYLE = "heritage"
VIDEO_FORMAT = "explainer"
PKGDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "packages")


def vnum(path):
    m = re.search(r'/V(\d+)-', path)
    return int(m.group(1)) if m else 999


def parse(path):
    """Package layout: title / ==== / customize block / ==== / source material."""
    raw = open(path).read()
    parts = re.split(r'={20,}', raw)
    if len(parts) < 3:
        raise ValueError(f"unexpected layout: {len(parts)} sections")
    prompt = re.sub(r'^\s*PASTE INTO[^\n]*\n', '', parts[1]).strip()
    sources = re.sub(r'^\s*SOURCE MATERIAL[^\n]*\n', '', parts[2]).strip()
    head = raw.splitlines()[0]
    label = head.split('—')[-1].split('(')[0].strip()
    tag = os.path.basename(path).split('-')[0]
    return f"BudStacks {tag} — {label}", prompt, sources


def client():
    tok = load_cached_tokens()
    if not tok:
        sys.exit("no cached auth — run: notebooklm-mcp-auth --file <cookie.txt>")
    return NotebookLMClient(
        cookies=tok.cookies, csrf_token=tok.csrf_token, session_id=tok.session_id
    )


def status(c):
    nbs = [n for n in c.list_notebooks() if n.title.startswith("BudStacks V")]
    print(f"{len(nbs)} BudStacks video notebooks\n")
    def order(n):
        bits = n.title.split()
        return vnum("/" + bits[1] + "-") if len(bits) > 1 else 999

    for nb in sorted(nbs, key=order):
        try:
            arts = c.poll_studio_status(nb.id)
        except Exception as e:
            print(f"{nb.title:<46} ERR {type(e).__name__}")
            continue
        if not arts:
            print(f"{nb.title:<46} queued / no artifact yet")
        for a in arts:
            st = a.get("status") or a.get("state") or "?"
            # The library has no name for the in-flight state and reports it as
            # "unknown" - that means still rendering, not failed.
            note = "  (still rendering)" if str(st).lower() in ("unknown", "?", "") else ""
            print(f"{nb.title:<46} {st}{note}")
    print(f"\nOpen: https://notebook.google.com/")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    c = client()

    if "--status" in sys.argv:
        return status(c)

    pkgs = sorted(glob.glob(f"{PKGDIR}/V*.md"), key=vnum)
    if args:
        want = {a.upper() for a in args}
        pkgs = [p for p in pkgs if os.path.basename(p).split('-')[0].upper() in want]
    if not pkgs:
        sys.exit("no packages matched")

    existing = {n.title: n for n in c.list_notebooks()}
    style = constants.VIDEO_STYLES.get_code(VISUAL_STYLE)
    fmt = constants.VIDEO_FORMATS.get_code(VIDEO_FORMAT)
    print(f"{len(pkgs)} to process — style={VISUAL_STYLE} format={VIDEO_FORMAT}\n")

    ok, failed = [], []
    for p in pkgs:
        name = os.path.basename(p).replace(".md", "")
        try:
            title, prompt, sources = parse(p)
            if title in existing:
                nb = existing[title]
                # Already has a video? Leave it alone - re-running must not duplicate.
                if c.poll_studio_status(nb.id) and "--force" not in sys.argv:
                    print(f"{name:<30} SKIP     already built ({nb.id})")
                    continue
                print(f"{name:<30} reusing  {nb.id}")
            else:
                nb = c.create_notebook(title)
                if not nb:
                    raise RuntimeError("create_notebook returned None")
                print(f"{name:<30} created  {nb.id}")

            if not c.get_notebook_sources_with_types(nb.id):
                c.add_text_source(nb.id, sources, title=f"{name} sources")

            sids = [s["id"] for s in c.get_notebook_sources_with_types(nb.id) if s.get("id")]
            if not sids:
                raise RuntimeError("no sources resolved")

            res = c.create_video_overview(
                notebook_id=nb.id, source_ids=sids,
                format_code=fmt, visual_style_code=style,
                language="en", focus_prompt=prompt,
            )
            if not res:
                raise RuntimeError("create_video_overview returned None")
            ok.append((name, nb.id))
            print(f"{'':<30} QUEUED   {len(prompt)} char prompt / {len(sources)} char src")
            time.sleep(3)
        except Exception as e:
            failed.append((name, f"{type(e).__name__}: {e}"))
            print(f"{name:<30} ERROR    {type(e).__name__}: {e}")
            # Auth death is terminal - every later item fails identically. Stop
            # and say so, rather than printing the same error a dozen times.
            if "Authentication" in type(e).__name__ or "Authentication expired" in str(e):
                print(f"\n!! auth died after {len(ok)} queued this run.")
                print("   Re-auth, then re-run - already-built videos are skipped:")
                print("     notebooklm-mcp-auth --file "
                      "/Users/gkavanagh/Development/Dr-Green-Cannexis/cookie.txt")
                print("   If --status still works but queuing keeps failing after a few,")
                print("   it is a NotebookLM daily video quota, not auth.")
                break

    print(f"\n{'=' * 60}\nQUEUED {len(ok)}/{len(pkgs)}")
    for n, i in ok:
        print(f"  {n:<30} {i}")
    if failed:
        print(f"\nFAILED {len(failed)}:")
        for n, e in failed:
            print(f"  {n:<30} {e}")
    print("\nRender status later with:  --status")


if __name__ == "__main__":
    main()
