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

// Keyboard command: open popup immediately (preserves user gesture), then trigger parse
br.commands.onCommand.addListener((command) => {
  if (command !== 'open-popup') return;
  // Must call openPopup() synchronously inside the user gesture handler
  br.action.openPopup().catch(() => {});
  // Content script is already loaded via manifest injection — just tell it to parse
  br.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    br.tabs.sendMessage(tabs[0].id, { type: 'PARSE_PAGE' }).catch(() => {});
  });
});

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

  if (msg.type === 'REFRESH_PAGE_DATA') {
    if (lastTabId) {
      br.tabs.sendMessage(lastTabId, { type: 'PARSE_PAGE' }).catch(() => {});
    } else {
      br.tabs.query({ active: true }, (tabs) => {
        const tab = (tabs || []).find(t => t.url && !t.url.startsWith('moz-extension://'));
        if (tab) br.tabs.sendMessage(tab.id, { type: 'PARSE_PAGE' }).catch(() => {});
      });
    }
    return false;
  }
});
