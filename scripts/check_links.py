from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, _tag, attrs):
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.values.append(value)


missing = []
for page in ROOT.rglob("*.html"):
    if any(part in {"dist", "node_modules"} for part in page.parts):
        continue
    parser = References()
    parser.feed(page.read_text(encoding="utf-8"))
    for reference in parser.values:
        parsed = urlsplit(reference)
        if parsed.scheme or reference.startswith(("#", "mailto:", "tel:")):
            continue
        target = (ROOT / parsed.path.lstrip("/")) if parsed.path.startswith("/") else (page.parent / parsed.path)
        if parsed.path.endswith("/"):
            target = target / "index.html"
        if not target.exists():
            missing.append(f"{page.relative_to(ROOT)} -> {reference}")

if missing:
    raise SystemExit("Broken local references:\n" + "\n".join(missing))
print("No broken local references.")
