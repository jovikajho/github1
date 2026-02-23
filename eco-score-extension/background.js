/**
 * ECO-SCORE EXTENSION - background.js
 * 
 * Save this file as: eco-score-extension/background.js
 * 
 * This is the background service worker for the Chrome extension.
 * It handles extension lifecycle and permissions.
 */

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('🌱 Eco-Score Extension installed!');
        // Open settings page on first install
        chrome.runtime.openOptionsPage();
    } else if (details.reason === 'update') {
        console.log('✅ Eco-Score Extension updated!');
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Icon click opens the popup (defined in manifest.json)
    console.log('Icon clicked on tab:', tab.title);
});

// Store any error logs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'logError') {
        console.error('Extension Error:', request.error);
        sendResponse({ success: true });
    }
});

console.log('🌱 Eco-Score Background Service Worker loaded');
