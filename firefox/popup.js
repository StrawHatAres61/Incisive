'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let boldMode  = 'bold+underline'; // 'bold+underline' | 'bold'
let cardFont  = 'Georgia,serif';
let hlColor   = '#FFFF00';
let colorMode = 'dark'; // 'dark' | 'light'

let isRestoring    = false;
let structureTimer = null;
const savedState   = { authorTag: '_____ __', cite: '' };

// ── Undo stack ─────────────────────────────────────────────────────────────
const undoStack = [];
const MAX_UNDO  = 50;

function pushUndo() {
  const cb = $('card-block');
  if (!cb) return;
  undoStack.push(cb.innerHTML);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Safe HTML setter (avoids direct innerHTML assignment on dynamic values) ─
function safeHTML(el, html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  el.replaceChildren(...Array.from(doc.body.childNodes));
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings(() => {
    restoreCardState(() => {
      requestPageData();
    });
  });

  initObserver();
  initSwatches();
  wireButtons();
  wireSettings();
  wireAutosave();

  // Live PAGE_DATA arriving after popup is open (Alt+C on page)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PAGE_DATA' && msg.data) {
      autoparse(msg.data);
    }
  });

  // Alt+C inside popup — trigger fresh parse from active tab
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'REFRESH_PAGE_DATA' });
    }
  });
});

function requestPageData() {
  // Delay so content script's PAGE_DATA message has time to reach background first
  setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'GET_PAGE_DATA' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.data) autoparse(response.data);
    });
  }, 200);
}

// ── Settings load/save ─────────────────────────────────────────────────────
function loadSettings(cb) {
  chrome.storage.local.get(['boldMode', 'cardFont', 'hlColor', 'hlSwatch', 'colorMode'], (res) => {
    if (res.boldMode)  boldMode  = res.boldMode;
    if (res.cardFont)  cardFont  = res.cardFont;
    if (res.hlColor)   hlColor   = res.hlColor;
    if (res.colorMode) colorMode = res.colorMode;
    applyBoldModeUI();
    applyCardFont();
    applyColorMode();
    if (res.hlSwatch != null) applyActiveSwatch(res.hlSwatch);
    if (cb) cb();
  });
}

function updateExistingBoldSpans() {
  const body = $('c-body');
  if (!body) return;
  body.querySelectorAll('span[style]').forEach(sp => {
    if (sp.style.fontWeight !== '700') return;
    if (boldMode === 'bold+underline') {
      sp.style.textDecoration = 'underline';
    } else {
      sp.style.textDecoration = '';
    }
  });
  saveCardState();
}

function applyBoldModeUI() {
  const toggle = $('bold-toggle');
  if (toggle) toggle.checked = boldMode === 'bold+underline';

  // Update reference table B button display
  const refB = $('ref-b');
  if (!refB) return;
  if (boldMode === 'bold+underline') {
    refB.style.fontWeight = '700';
    refB.style.textDecoration = 'underline';
  } else {
    refB.style.fontWeight = '700';
    refB.style.textDecoration = 'none';
  }

  // Update toolbar B button
  const btnB = $('btn-b');
  if (btnB) {
    if (boldMode === 'bold+underline') {
      btnB.innerHTML = '<b><u>B</u></b>';
    } else {
      btnB.innerHTML = '<b>B</b>';
    }
  }
}

function applyCardFont() {
  const body = $('c-body');
  if (body) body.style.fontFamily = cardFont;

  const radios = document.querySelectorAll('input[name="card-font"]');
  radios.forEach(r => { r.checked = r.value === cardFont; });
}

function applyColorMode() {
  document.body.classList.toggle('light', colorMode === 'light');
  const toggle = $('theme-toggle');
  if (toggle) toggle.checked = colorMode === 'light';
}

// ── Card state persist/restore ─────────────────────────────────────────────
function restoreCardState(cb) {
  chrome.storage.local.get(['cardState'], (res) => {
    const s = res.cardState;
    if (s) {
      const tag  = $('c-tag');
      const at   = $('c-author-tag');
      const ci   = $('c-cite');
      const body = $('c-body');
      if (tag  && s.tagHTML   != null) safeHTML(tag,  s.tagHTML);
      if (at   && s.authorTag != null) { at.textContent = s.authorTag; savedState.authorTag = s.authorTag; }
      if (ci   && s.cite      != null) { ci.textContent = s.cite;      savedState.cite       = s.cite; }
      if (body && s.bodyHTML  != null) safeHTML(body, s.bodyHTML);
    }
    if (cb) cb();
  });
}

function saveCardState() {
  const tag  = $('c-tag');
  const at   = $('c-author-tag');
  const ci   = $('c-cite');
  const body = $('c-body');
  chrome.storage.local.set({
    cardState: {
      tagHTML:   tag  ? tag.innerHTML   : '',
      authorTag: at   ? at.textContent  : savedState.authorTag,
      cite:      ci   ? ci.textContent  : savedState.cite,
      bodyHTML:  body ? body.innerHTML  : ''
    }
  });
}

// ── Autosave ───────────────────────────────────────────────────────────────
function wireAutosave() {
  const cb = $('card-block');
  cb.addEventListener('input', saveCardState);
}

function formatDate(str) {
  if (!str) return '';
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch (_) { return str; }
}

// ── Autoparse ─────────────────────────────────────────────────────────────
function autoparse(data) {
  const at   = $('c-author-tag');
  const ci   = $('c-cite');
  const body = $('c-body');

  // Use author last name; fall back to publication when no author is found
  const authorTag = (data.lastName || data.publication || '') + ' ' + (data.year || '');
  const dateStr   = formatDate(data.date);
  const parts     = [
    data.author     ? data.author + ',' : '',
    data.title      ? '\u201c' + data.title + ',\u201d' : '',
    data.publication|| '',
    dateStr         || '',
    data.url        || ''
  ].filter(Boolean);
  const citeText  = '{} ' + parts.join(' ');

  if (at) at.textContent = authorTag;
  if (ci) ci.textContent = citeText;

  savedState.authorTag = authorTag;
  savedState.cite      = citeText;

  if (data.selectedText && body) {
    body.textContent = data.selectedText;
  }

  saveCardState();

  // Flash status
  const st = $('parse-st');
  if (st) {
    st.textContent = '✓ parsed';
    setTimeout(() => { st.textContent = ''; }, 1800);
  }
}

// ── MutationObserver — structural persistence ──────────────────────────────
function restoreStructure() {
  if (isRestoring) return;
  const cb = $('card-block');

  const hasBegin = !!cb.querySelector('.c-begin-locked');
  const hasEnd   = !!cb.querySelector('.c-end-locked');
  const hasBody  = !!$('c-body');
  const hasTag   = !!$('c-tag');
  if (hasBegin && hasEnd && hasBody && hasTag) return;

  isRestoring = true;

  const bodyHTML = $('c-body')?.innerHTML ?? '';
  const tagHTML  = $('c-tag')?.innerHTML  ?? '';

  cb.innerHTML = '';

  const tag = document.createElement('span');
  tag.className = 'c-tag';
  tag.id = 'c-tag';
  safeHTML(tag, tagHTML);
  cb.appendChild(tag);

  const begin = document.createElement('span');
  begin.className = 'c-begin-locked';

  const at = document.createElement('span');
  at.className = 'c-author-tag';
  at.id = 'c-author-tag';
  at.textContent = savedState.authorTag;

  const ci = document.createElement('span');
  ci.className = 'c-cite-details';
  ci.id = 'c-cite';
  ci.textContent = savedState.cite;

  begin.appendChild(at);
  begin.appendChild(ci);
  cb.appendChild(begin);

  const body = document.createElement('span');
  body.className = 'c-body';
  body.id = 'c-body';
  body.style.fontFamily = cardFont;
  safeHTML(body, bodyHTML);
  cb.appendChild(body);

  const end = document.createElement('span');
  end.className = 'c-end-locked';
  end.textContent = 'End card:';
  cb.appendChild(end);

  isRestoring = false;

  // Re-wire autosave since we replaced the DOM
  wireAutosave();
}

function initObserver() {
  const cb = $('card-block');
  const obs = new MutationObserver((mutations) => {
    if (isRestoring) return;
    const removed = mutations.some(m => m.removedNodes.length > 0);
    if (!removed) return;

    // Snapshot before elements disappear
    const at = $('c-author-tag');
    const ci = $('c-cite');
    if (at) savedState.authorTag = at.textContent;
    if (ci) savedState.cite = ci.textContent;

    clearTimeout(structureTimer);
    structureTimer = setTimeout(restoreStructure, 40);
  });
  obs.observe(cb, { childList: true, subtree: false });
}

// ── Formatting functions ───────────────────────────────────────────────────
function inEditableZone(node) {
  const body = $('c-body');
  const tag  = $('c-tag');
  return (body && body.contains(node)) || (tag && tag.contains(node));
}

function applyFmt(type) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  if (!inEditableZone(sel.anchorNode) || !inEditableZone(sel.focusNode)) return;

  pushUndo();

  const range = sel.getRangeAt(0);
  const sc = range.startContainer, so = range.startOffset;
  const ec = range.endContainer,   eo = range.endOffset;

  const nodes = getTextNodes(range);
  sel.removeAllRanges();

  nodes.forEach(node => {
    // Element-level boundaries (sc/ec are Elements) → treat as full-node selection
    const s = (node === sc && sc.nodeType === Node.TEXT_NODE) ? so : 0;
    const e = (node === ec && ec.nodeType === Node.TEXT_NODE) ? eo : node.length;
    if (s >= e) return;

    const text = node.textContent;
    const sp = document.createElement('span');
    if (type === 'em') {
      sp.style.fontWeight = '700';
      if (boldMode === 'bold+underline') sp.style.textDecoration = 'underline';
    } else if (type === 'ul') {
      sp.style.textDecoration = 'underline';
    } else if (type === 'sk') {
      sp.style.fontSize = '8pt';
    }
    sp.textContent = text.slice(s, e);

    const frag = document.createDocumentFragment();
    if (s > 0) frag.appendChild(document.createTextNode(text.slice(0, s)));
    frag.appendChild(sp);
    if (e < text.length) frag.appendChild(document.createTextNode(text.slice(e)));
    node.parentNode.replaceChild(frag, node);
  });
}

function applyHL() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  if (!inEditableZone(sel.anchorNode) || !inEditableZone(sel.focusNode)) return;

  pushUndo();

  const range = sel.getRangeAt(0);
  const sc = range.startContainer, so = range.startOffset;
  const ec = range.endContainer,   eo = range.endOffset;

  const nodes = getTextNodes(range);
  sel.removeAllRanges();

  nodes.forEach(node => {
    const s = (node === sc) ? so : 0;
    const e = (node === ec) ? eo : node.length;
    if (s >= e) return;
    applyHLToNode(node, s, e);
  });
}

function applyHLToNode(tn, sOff, eOff) {
  const full = tn.textContent;
  const par  = tn.parentNode;

  const exBg = (par.tagName === 'SPAN' && par.style.background) ? par.style.background : null;
  const exFW = (par.tagName === 'SPAN' && par.style.fontWeight)       ? par.style.fontWeight       : null;
  const exTD = (par.tagName === 'SPAN' && par.style.textDecoration)   ? par.style.textDecoration   : null;
  const exFS = (par.tagName === 'SPAN' && par.style.fontSize)         ? par.style.fontSize         : null;

  // Full text node — always wrap in a new HL span (avoids in-place color mutation)
  if (sOff === 0 && eOff === full.length) {
    const sp = mkHL();
    if (exFW) sp.style.fontWeight     = exFW;
    if (exTD) sp.style.textDecoration = exTD;
    if (exFS) sp.style.fontSize       = exFS;
    par.insertBefore(sp, tn);
    sp.appendChild(tn);
    return;
  }

  // Partial — split into before / selected / after, replacing only tn (never par)
  // so sibling nodes inside par are never destroyed
  const before   = full.slice(0, sOff);
  const selected = full.slice(sOff, eOff);
  const after    = full.slice(eOff);
  const frag     = document.createDocumentFragment();

  if (before) frag.appendChild(document.createTextNode(before));

  const nsp = mkHL();
  if (exFW) nsp.style.fontWeight     = exFW;
  if (exTD) nsp.style.textDecoration = exTD;
  if (exFS) nsp.style.fontSize       = exFS;
  nsp.textContent = selected;
  frag.appendChild(nsp);

  if (after) frag.appendChild(document.createTextNode(after));

  tn.parentNode.replaceChild(frag, tn);
}

function mkHL() {
  const s = document.createElement('span');
  s.style.background = hlColor;
  return s;
}

function getTextNodes(range) {
  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    return [range.commonAncestorContainer];
  }
  const nodes  = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer, NodeFilter.SHOW_TEXT, null, false
  );
  let n;
  while ((n = walker.nextNode())) {
    if (range.intersectsNode(n)) nodes.push(n);
  }
  return nodes;
}

function clearFmt() {
  const cb = $('card-block');
  if (!cb) return;
  pushUndo();
  // Only unwrap anonymous formatting spans (no id, no class) — structural spans have both
  cb.querySelectorAll('span[style]:not([id]):not([class])').forEach(s => {
    const p = s.parentNode;
    while (s.firstChild) p.insertBefore(s.firstChild, s);
    p.removeChild(s);
  });
  saveCardState();
}

function undoLast() {
  if (undoStack.length === 0) return;
  const cb = $('card-block');
  isRestoring = true;
  safeHTML(cb, undoStack.pop());
  isRestoring = false;
  // Sync savedState from restored DOM
  const at = $('c-author-tag');
  const ci = $('c-cite');
  if (at) savedState.authorTag = at.textContent;
  if (ci) savedState.cite      = ci.textContent;
  applyCardFont();
  saveCardState();
}

// ── Cut card ───────────────────────────────────────────────────────────────
function cutCard() {
  const tagEl  = $('c-tag');
  const atagEl = $('c-author-tag');
  const citeEl = $('c-cite');
  const bodyEl = $('c-body');

  const tag  = (tagEl?.innerText  || '').trim();
  const atag = (atagEl?.innerText || '').trim();
  const cite = (citeEl?.innerText || '').trim();
  const body = (bodyEl?.innerText || '').trim();

  // Plain text — Kankee format
  const plain = (tag ? tag + '\n' : '') +
                'Begin card: ' + atag + '\n' +
                cite + '\n\n' +
                body + '\n\n' +
                'End card:';

  // HTML — preserves bold/underline/highlight spans when pasted into Word/Docs/Verbatim
  const tagHTML  = tagEl?.innerHTML  || '';
  const atagHTML = atagEl?.innerHTML || '';
  const citeHTML = citeEl?.innerHTML || '';
  const bodyHTML = bodyEl?.innerHTML || '';

  const html =
    `<div style="font-family:Georgia,serif;font-size:11pt;line-height:1.85;">` +
    (tagHTML ? `<p><strong>${tagHTML}</strong></p>` : '') +
    `<p><strong>Begin card: ${atagHTML}</strong></p>` +
    `<p style="font-size:9pt;">${citeHTML}</p>` +
    `<p style="margin:6pt 0;">${bodyHTML}</p>` +
    `<p><strong>End card:</strong></p>` +
    `</div>`;

  try {
    const item = new ClipboardItem({
      'text/plain': new Blob([plain], { type: 'text/plain' }),
      'text/html':  new Blob([html],  { type: 'text/html' })
    });
    navigator.clipboard.write([item])
      .then(() => showCutSuccess())
      .catch(() => {
        navigator.clipboard.writeText(plain)
          .then(() => showCutSuccess())
          .catch(() => { fallbackCopy(plain); showCutSuccess(); });
      });
  } catch (_) {
    // ClipboardItem not available — plain text fallback
    navigator.clipboard.writeText(plain)
      .then(() => showCutSuccess())
      .catch(() => { fallbackCopy(plain); showCutSuccess(); });
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function showCutSuccess() {
  const btn = $('btn-cut');
  const orig = btn.textContent;
  const origBg = btn.style.background;
  const origColor = btn.style.color;
  btn.textContent = '✓ Copied';
  btn.style.background = '#22cc66';
  btn.style.color = '#fff';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = origBg || '';
    btn.style.color = origColor || '';
  }, 2500);
}

// ── Reset ──────────────────────────────────────────────────────────────────
function resetCard() {
  pushUndo();
  const tag  = $('c-tag');
  const at   = $('c-author-tag');
  const ci   = $('c-cite');
  const body = $('c-body');
  if (tag)  tag.innerHTML  = '';
  if (at)   at.textContent = '_____ __';
  if (ci)   ci.textContent = '';
  if (body) body.innerHTML = '';
  savedState.authorTag = '_____ __';
  savedState.cite      = '';
  saveCardState();
}

// ── Swatches ───────────────────────────────────────────────────────────────
function applyActiveSwatch(index) {
  const swatches = document.querySelectorAll('.swatch');
  swatches.forEach(s => s.classList.remove('active'));
  const sw = swatches[index];
  if (sw) { sw.classList.add('active'); hlColor = sw.dataset.color; }
}

function initSwatches() {
  const swatches = document.querySelectorAll('.swatch');
  // Default: first swatch active (may be overridden by loadSettings)
  if (swatches[0]) swatches[0].classList.add('active');

  swatches.forEach((sw, i) => {
    sw.addEventListener('mousedown', e => e.preventDefault());
    sw.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      hlColor = sw.dataset.color;
      chrome.storage.local.set({ hlColor, hlSwatch: i });
    });
  });
}

// ── Button wiring ──────────────────────────────────────────────────────────
function noFocusSteal(el, fn) {
  el.addEventListener('mousedown', e => e.preventDefault());
  el.addEventListener('click', fn);
}

function wireButtons() {
  $('card-block').addEventListener('dragstart', e => e.preventDefault());
  noFocusSteal($('btn-b'),     () => applyFmt('em'));
  noFocusSteal($('btn-u'),     () => applyFmt('ul'));
  noFocusSteal($('btn-s'),     () => applyFmt('sk'));
  noFocusSteal($('btn-undo'),  () => undoLast());
  noFocusSteal($('btn-clear'), () => clearFmt());
  noFocusSteal($('btn-h'),     () => applyHL());
  $('btn-cut').addEventListener('click',   () => cutCard());
  $('btn-reset').addEventListener('click', () => resetCard());
}

// ── Settings wiring ────────────────────────────────────────────────────────
function wireSettings() {
  // Toggle panel visibility
  $('settings-btn').addEventListener('mousedown', e => e.preventDefault());
  $('settings-btn').addEventListener('click', () => {
    const panel = $('settings');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });

  // Prevent focus steal from all settings controls
  $('settings').addEventListener('mousedown', e => e.preventDefault());

  // Theme toggle
  $('theme-toggle').addEventListener('change', (e) => {
    colorMode = e.target.checked ? 'light' : 'dark';
    chrome.storage.local.set({ colorMode });
    applyColorMode();
  });

  // Bold mode toggle
  $('bold-toggle').addEventListener('change', (e) => {
    boldMode = e.target.checked ? 'bold+underline' : 'bold';
    chrome.storage.local.set({ boldMode });
    applyBoldModeUI();
    updateExistingBoldSpans();
  });

  // Font radios
  document.querySelectorAll('input[name="card-font"]').forEach(r => {
    r.addEventListener('change', (e) => {
      cardFont = e.target.value;
      chrome.storage.local.set({ cardFont });
      applyCardFont();
    });
  });
}
