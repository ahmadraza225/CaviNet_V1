"""Convert the generated CaviNet scope .docx into GitHub Markdown (headings, bullets,
tables, notes and prompt blocks), so Claude Code can read it as plain text."""
import sys
import zipfile

from lxml import etree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def run_text(r):
    t = "".join(x.text or "" for x in r.iter(W + "t"))
    if not t:
        return ""
    rpr = r.find(W + "rPr")
    bold = rpr is not None and rpr.find(W + "b") is not None
    fonts = rpr.find(W + "rFonts") if rpr is not None else None
    mono = fonts is not None and "Consolas" in (fonts.get(W + "ascii") or "")
    if mono:
        return f"`{t}`"
    if bold and t.strip():
        lead, core, trail = t[: len(t) - len(t.lstrip())], t.strip(), t[len(t.rstrip()):]
        return f"{lead}**{core}**{trail}"
    return t


def para_info(p):
    ppr = p.find(W + "pPr")
    style = shade = None
    num_lvl = None
    if ppr is not None:
        ps = ppr.find(W + "pStyle")
        style = ps.get(W + "val") if ps is not None else None
        sh = ppr.find(W + "shd")
        shade = sh.get(W + "fill") if sh is not None else None
        npr = ppr.find(W + "numPr")
        if npr is not None:
            il = npr.find(W + "ilvl")
            num_lvl = int(il.get(W + "val")) if il is not None else 0
    return style, shade, num_lvl


def para_text(p, raw=False):
    if raw:
        return "".join(x.text or "" for x in p.iter(W + "t"))
    return "".join(run_text(r) for r in p.iter(W + "r")).replace("****", "")


def table_md(tbl):
    rows = []
    for tr in tbl.findall(W + "tr"):
        cells = []
        for tc in tr.findall(W + "tc"):
            parts = [para_text(p).replace("|", "\\|").strip() for p in tc.findall(W + "p")]
            cells.append("<br>".join(x for x in parts if x))
        rows.append(cells)
    if not rows:
        return ""
    # header cells are bold-formatted in the docx; strip the ** for a cleaner header row
    header = [c.replace("**", "") for c in rows[0]]
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(r) + " |" for r in rows[1:]]
    return "\n".join(out)


def convert(path):
    body = etree.fromstring(zipfile.ZipFile(path).read("word/document.xml")).find(W + "body")
    out, in_code = [], False
    for el in body:
        tag = etree.QName(el).localname
        if tag == "p":
            style, shade, lvl = para_info(el)
            if shade == "F2F2F2":                      # prompt body line
                if not in_code:
                    out.append("```text")
                    in_code = True
                out.append(para_text(el, raw=True).rstrip())
                continue
            if in_code:
                out.append("```")
                out.append("")
                in_code = False
            text = para_text(el).strip()
            if not text:
                continue
            if style and style.startswith("Heading"):
                out += ["", "#" * int(style[-1]) + " " + text.replace("**", ""), ""]
            elif shade == "2E3B4E":                    # prompt title bar
                out += ["", f"**{text.replace('**', '')}**", ""]
            elif shade == "FFF4E5":                    # note box
                out += ["", "> " + text, ""]
            elif lvl is not None:
                out.append("  " * lvl + "- " + text)
            else:
                out += [text, ""]
        elif tag == "tbl":
            if in_code:
                out.append("```")
                in_code = False
            out += ["", table_md(el), ""]
        # sdt (table of contents) and sectPr are skipped
    if in_code:
        out.append("```")
    md = "\n".join(out)
    while "\n\n\n" in md:
        md = md.replace("\n\n\n", "\n\n")
    return md.strip() + "\n"


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    open(dst, "w", encoding="utf-8").write(convert(src))
    print("wrote", dst)
