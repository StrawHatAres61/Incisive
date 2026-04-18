'use strict';

if (window.__incisiveLoaded) { /* already injected — skip re-registration */ }
else {
window.__incisiveLoaded = true;

const br = typeof browser !== 'undefined' ? browser : chrome;

function parsePage() {
  const getMeta = (name) => {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return el ? el.getAttribute('content') : null;
  };

  let author = null, title = null, publication = null, date = null;

  // 1. Open Graph
  author      = getMeta('article:author') || getMeta('og:author');
  title       = getMeta('og:title');
  publication = getMeta('og:site_name');
  date        = getMeta('article:published_time') || getMeta('og:updated_time');

  // 2. JSON-LD
  if (!author || !title) {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const obj = JSON.parse(s.textContent);
        const items = Array.isArray(obj) ? obj : [obj];
        for (const item of items) {
          const t = item['@type'];
          if (t === 'Article' || t === 'NewsArticle' || t === 'BlogPosting') {
            if (!title       && item.headline)   title = item.headline;
            if (!date        && item.datePublished) date = item.datePublished;
            if (!publication && item.publisher)  publication = item.publisher.name || null;
            if (!author) {
              const a = item.author;
              if (Array.isArray(a)) author = a[0]?.name || null;
              else if (a) author = a.name || a;
            }
            break;
          }
        }
      } catch (_) {}
    }
  }

  // 3. DOM heuristics fallback
  if (!title) {
    let t = document.title || '';
    // strip " | SiteName" suffix
    t = t.replace(/\s*[\|–\-]\s*.+$/, '').trim();
    title = t || null;
  }
  if (!author) {
    const sel = '.author, [rel=author], .byline, .contributor, [itemprop=author]';
    const el = document.querySelector(sel);
    author = el ? el.textContent.trim() : null;
  }
  if (!date) {
    const el = document.querySelector('time[datetime], .date, .published, [itemprop=datePublished]');
    if (el) date = el.getAttribute('datetime') || el.textContent.trim();
  }
  if (!publication) {
    const host = window.location.hostname.replace(/^www\./, '');
    publication = host || null;
  }

  // Derived fields
  const yearMatch = (date || '').match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1].slice(-2) : '';

  const authorClean = (author || '').trim();
  const tokens = authorClean.split(/[\s,]+/).filter(Boolean);
  const lastName = tokens.length > 0 ? tokens[tokens.length - 1] : (authorClean || '');

  return {
    author: authorClean || '',
    lastName,
    year,
    title:       title       || '',
    publication: publication || '',
    date:        date        || '',
    url:         window.location.href
  };
}

function sendPageData() {
  const meta = parsePage();
  const selectedText = window.getSelection().toString().trim();
  br.runtime.sendMessage({
    type: 'PAGE_DATA',
    data: { ...meta, selectedText }
  });
}

// Alt+C keyboard trigger
document.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'c' || e.key === 'C')) {
    sendPageData();
  }
});

// Message trigger from background
br.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PARSE_PAGE') {
    sendPageData();
  }
});

} // end __incisiveLoaded guard
