const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Import all evasions statically to satisfy Turbopack/Webpack
const evasions = [
    require('puppeteer-extra-plugin-stealth/evasions/chrome.app'),
    require('puppeteer-extra-plugin-stealth/evasions/chrome.csi'),
    require('puppeteer-extra-plugin-stealth/evasions/chrome.loadTimes'),
    require('puppeteer-extra-plugin-stealth/evasions/chrome.runtime'),
    require('puppeteer-extra-plugin-stealth/evasions/defaultArgs'),
    require('puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow'),
    require('puppeteer-extra-plugin-stealth/evasions/media.codecs'),
    require('puppeteer-extra-plugin-stealth/evasions/navigator.hardwareConcurrency'),
    require('puppeteer-extra-plugin-stealth/evasions/navigator.languages'),
    require('puppeteer-extra-plugin-stealth/evasions/navigator.permissions'),
    require('puppeteer-extra-plugin-stealth/evasions/navigator.plugins'),
    require('puppeteer-extra-plugin-stealth/evasions/navigator.webdriver'),
    require('puppeteer-extra-plugin-stealth/evasions/sourceurl'),
    require('puppeteer-extra-plugin-stealth/evasions/user-agent-override'),
    require('puppeteer-extra-plugin-stealth/evasions/webgl.vendor'),
    require('puppeteer-extra-plugin-stealth/evasions/window.outerdimensions'),
    require('puppeteer-extra-plugin-user-preferences'),
];

/**
 * A Turbopack-compatible way to use the stealth plugin.
 * Instead of letting puppeteer-extra dynamically require the evasions,
 * we manually register them.
 */
module.exports = function useStealth(puppeteerInstance) {
    // 1. Use the main stealth plugin (with evasions disabled to avoid dynamic require in puppeteer-extra)
    // We pass it in the options so it's set BEFORE puppeteer-extra checks dependencies
    const stealth = StealthPlugin({
        enabledEvasions: new Set([])
    });
    puppeteerInstance.use(stealth);

    // 2. Manually register all evasions
    for (const evasion of evasions) {
        puppeteerInstance.use(evasion());
    }
};
