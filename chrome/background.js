'use strict';

const br = typeof browser !== 'undefined' ? browser : chrome;

let lastPageData = null;

// Install: context menu
br.runtime.onInstalled.addListener(() => {
  br.contextMenus.create({
    id: 'cut-card',
    title: 'Cut as Debate Card',
    contexts: ['selection']
  });
});

// Context menu click: inject content script to parse + grab selection
br.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'cut-card') return;
  br.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).catch(() => {});
});

// Keyboard command: capture page data (including selection) BEFORE popup opens,
// then open popup so GET_PAGE_DATA returns fresh data with no race condition.
br.commands.onCommand.addListener((command) => {
  if (command !== 'open-popup') return;
  br.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    br.scripting.executeScript({
      target: { tabId: tabs[0].id },
      // Runs in MAIN world — page still has focus, selection is intact
      func: () => {
        const get = n => { const e = document.querySelector(`meta[property="${n}"],meta[name="${n}"]`); return e ? e.getAttribute('content') : null; };
        let author = get('article:author') || get('og:author');
        let title  = get('og:title');
        let pub    = get('og:site_name');
        let date   = get('article:published_time') || get('og:updated_time');
        // JSON-LD
        if (!author || !title) {
          for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
            try {
              const items = [].concat(JSON.parse(s.textContent));
              for (const item of items) {
                const t = item['@type'];
                if (t === 'Article' || t === 'NewsArticle' || t === 'BlogPosting') {
                  if (!title) title = item.headline;
                  if (!date)  date  = item.datePublished;
                  if (!pub && item.publisher) pub = item.publisher.name;
                  if (!author) { const a = item.author; author = Array.isArray(a) ? a[0] && a[0].name : (a && (a.name || a)); }
                  break;
                }
              }
            } catch (_) {}
          }
        }
        // DOM fallbacks
        if (!title) title = document.title.replace(/\s*[|–\-]\s*.+$/, '').trim();
        if (!author) { const e = document.querySelector('.author,[rel=author],.byline,.contributor,[itemprop=author]'); if (e) author = e.textContent.trim(); }
        if (!date)   { const e = document.querySelector('time[datetime],.date,.published,[itemprop=datePublished]'); if (e) date = e.getAttribute('datetime') || e.textContent.trim(); }
        if (!pub)    pub = location.hostname.replace(/^www\./, '');
        const year   = ((date || '').match(/(\d{4})/) || [])[1] || '';
        const tokens = (author || '').trim().split(/[\s,]+/).filter(Boolean);
        return {
          author:      author || '',
          lastName:    tokens[tokens.length - 1] || '',
          year:        year.slice(-2),
          title:       title || '',
          publication: pub   || '',
          date:        date  || '',
          url:         location.href,
          selectedText: ((window.getSelection() || {}).toString() || '').trim()
        };
      }
    }).then(results => {
      if (results && results[0] && results[0].result) lastPageData = results[0].result;
      br.action.openPopup().catch(() => {});
    }).catch(() => {
      br.action.openPopup().catch(() => {});
    });
  });
});

// Message handler
br.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PAGE_DATA') {
    lastPageData = msg.data;
    // Forward to popup if it's open — ignore errors if it's not
    br.runtime.sendMessage({ type: 'PAGE_DATA', data: msg.data }).catch(() => {});
    return false;
  }

  if (msg.type === 'GET_PAGE_DATA') {
    sendResponse({ type: 'PAGE_DATA', data: lastPageData });
    return false;
  }

  // Popup requests a fresh parse from the active tab's content script
  if (msg.type === 'REFRESH_PAGE_DATA') {
    br.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      br.tabs.sendMessage(tabs[0].id, { type: 'PARSE_PAGE' }).catch(() => {});
    });
    return false;
  }
});
