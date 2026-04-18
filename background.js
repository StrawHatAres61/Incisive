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

// Keyboard command: inject content, then open popup
br.commands.onCommand.addListener((command) => {
  if (command !== 'open-popup') return;
  br.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    br.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['content.js']
    }).then(() => {
      // Small delay so content script can fire and populate lastPageData
      // before popup opens and requests it
      setTimeout(() => {
        br.action.openPopup().catch(() => {});
      }, 80);
    }).catch(() => {});
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
