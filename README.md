# Incisive

A browser extension for competitive debate. Open on any article, press **Alt+C**, and get a fully formatted Kankee/Verbatim card in your clipboard — author, citation, body text, and all.

---

## Install (Firefox)

1. Download or clone this repo
2. Open Firefox → `about:debugging` → **This Firefox** → **Load Temporary Add-on**
3. Select `firefox/manifest.json`

Permanent install (no developer mode required): package `firefox/` as a `.zip` and submit to [addons.mozilla.org](https://addons.mozilla.org), or sideload via `about:config` with `xpinstall.signatures.required = false`.

---

## Usage

| Action | Result |
|---|---|
| **Alt+C** on any article | Opens popup, auto-parses author/title/date/URL, loads selected text into card body |
| **Alt+C** inside popup | Re-parses the active tab and refreshes card |
| **B** | Bold + underline (or bold only — toggle in settings) |
| **U** | Underline |
| **S** | Shrink to 8pt |
| **H** | Highlight in selected color |
| **↩** | Undo last format operation |
| **✕ fmt** | Clear all formatting from card |
| **✂ Cut card** | Copy card to clipboard (rich HTML + plain text) |
| **↺** | Reset card |

---

## Card Format

Cards are copied in Kankee/Verbatim format:

```
Tag line

Begin card: LastName YY
{} First Last, "Title," Publication, Month Day, Year URL

Body text with bold, underline, shrink, and highlight formatting preserved.

End card:
```

Rich HTML is copied alongside plain text so formatting survives paste into Word, Google Docs, or Verbatim.

---

## Settings

Accessible via the **⚙** button:

- **Bold + Underline** toggle — switch B between `bold+underline` and `bold` only
- **Light mode** toggle
- **Card text font** — Georgia (default), JetBrains Nerd Mono, Times New Roman

---

## Repo Structure

```
firefox/        — Firefox MV3 extension (tested on Firefox 128+)
  manifest.json
  background.js
  content.js
  popup.html
  popup.css
  popup.js
  icons/

mark-*.svg      — Logomark variants
wordmark-*.svg  — Wordmark variants
icon-*.svg      — Extension icon source files
build.sh        — Build script (produces browser-specific zips)
```

Chrome support coming.
