'use strict';

const br = typeof browser !== 'undefined' ? browser : chrome;

let lastPageData = null;
let lastTabId    = null;

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

// No onCommand handler needed — _execute_action in manifest opens popup natively.

// Message handler
br.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PAGE_DATA') {
    lastPageData = msg.data;
    if (sender.tab) lastTabId = sender.tab.id;
    br.runtime.sendMessage({ type: 'PAGE_DATA', data: msg.data }).catch(() => {});
    return false;
  }

  if (msg.type === 'GET_PAGE_DATA') {
    sendResponse({ type: 'PAGE_DATA', data: lastPageData });
    return false;
  }

  // Popup requests a fresh parse — use stored tabId, not currentWindow (popup has its own window)
  if (msg.type === 'REFRESH_PAGE_DATA') {
    if (lastTabId) {
      br.tabs.sendMessage(lastTabId, { type: 'PARSE_PAGE' }).catch(() => {});
    } else {
      br.tabs.query({ active: true }, (tabs) => {
        const tab = tabs.find(t => !t.url.startsWith('chrome-extension://'));
        if (tab) br.tabs.sendMessage(tab.id, { type: 'PARSE_PAGE' }).catch(() => {});
      });
    }
    return false;
  }
});
