# Incisive

A browser extension for competitive debate. Open on any article, press **Alt+C**, and get a fully formatted Kankee/Verbatim card ready to paste — author tag, citation, body text, and all formatting preserved.

---

## Install

### Chrome

**Chrome Web Store (recommended):**
Search "Incisive" on the [Chrome Web Store](https://chromewebstore.google.com) and click **Add to Chrome**.

**Developer mode (unpacked):**
1. Download or clone this repo
2. Open Chrome → `chrome://extensions` → enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `chrome/` folder

### Firefox

**Developer mode (temporary):**
1. Download or clone this repo
2. Open Firefox → `about:debugging` → **This Firefox** → **Load Temporary Add-on**
3. Select `firefox/manifest.json`

**Permanent sideload:**
Package `firefox/` as a `.zip` and submit to [addons.mozilla.org](https://addons.mozilla.org), or disable signature enforcement via `about:config` → `xpinstall.signatures.required = false`.

---

## Workflow

1. Navigate to any article or source you want to cut from
2. Select the text you want in the card body
3. Press **Alt+C** — the popup opens with author, citation, and selected text pre-filled
4. Add a tag line at the top of the card (optional)
5. Select text in the body and use the toolbar to apply formatting (bold, underline, shrink, highlight)
6. Click **✂ Cut card** — the card is copied to clipboard in both rich HTML and plain text
7. Paste directly into Verbatim, Word, or Google Docs — formatting survives

You can also right-click any selected text and choose **Cut as Debate Card** from the context menu.

---

## Keybinds and Toolbar

| Action | Result |
|---|---|
| **Alt+C** on a page | Opens popup, auto-parses author/title/date/URL, loads selected text into body |
| **Alt+C** inside popup | Re-parses the active tab and refreshes the card |
| **B** button | Bold + underline the selection (or bold only — configurable in settings) |
| **U** button | Underline the selection |
| **S** button | Shrink selection to 8pt (for analytics/throw-away text) |
| **H** button | Highlight selection in the active color |
| **↩** button | Undo last format operation |
| **✕ fmt** button | Strip all formatting from the card body |
| **✂ Cut card** | Copy card to clipboard (rich HTML + plain text simultaneously) |
| **↺** button | Reset card to blank |

---

## Card Format

Cards are output in Kankee/Verbatim format:

```
Tag line

Begin card: LastName YY
{} First Last, "Title," Publication, Month Day, Year URL

Body text with bold, underline, shrink, and highlight formatting preserved.

End card:
```

**Author tag** (e.g. `Smith 24`) is auto-generated from the article metadata. The `{}` at the start of the citation is the Verbatim block placeholder.

Rich HTML is copied alongside plain text so bold, underline, and highlight survive paste into Word, Google Docs, and Verbatim. Plain text is the fallback when the destination doesn't accept HTML.

---

## Citation Parsing

Incisive extracts metadata in priority order:

1. **Open Graph tags** (`og:author`, `og:title`, `og:site_name`, `article:published_time`)
2. **JSON-LD structured data** (`Article`, `NewsArticle`, `BlogPosting` types)
3. **DOM heuristics** (`.author`, `[rel=author]`, `.byline`, `time[datetime]`, page title, hostname)

Most major news sites and journals are covered. If a field is missing, edit it directly in the popup before cutting.

---

## Settings

Click **⚙** to open the settings panel:

| Setting | Options |
|---|---|
| **Bold + Underline** | Toggle whether B applies bold+underline (debate standard) or bold only |
| **Light mode** | Switch between dark (default) and light themes |
| **Card text font** | Georgia (default), Times New Roman, JetBrains Nerd Mono |

Highlight color is selected from the swatch row in the toolbar. Settings and card state persist across popup sessions.

---

## Repo Structure

```
chrome/         — Chrome MV3 extension
  manifest.json
  background.js
  content.js
  popup.html
  popup.css
  popup.js
  icons/

firefox/        — Firefox MV3 extension
  manifest.json
  background.js
  content.js
  popup.html
  popup.css
  popup.js
  icons/

mark-*.svg      — Logomark variants
wordmark-*.svg  — Wordmark variants
icon-*.svg      — Extension icon source files (SVG)
icon-*.png      — Extension icon exports (PNG)
build.sh        — Build script (produces browser-specific zips in dist/)
```
