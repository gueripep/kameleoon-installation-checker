import puppeteer from 'puppeteer';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Engine vs Kameleoon Checker
 *
 * This script takes a JSON file containing a list of URLs, visits each URL using
 * Puppeteer, and checks whether the site loads `engine.js` or `kameleoon.js`
 * (or neither).
 *
 * Usage:
 *   node src/engine-checker/engine-checker.mjs <optional/path/to/urls.json> [username] [password]
 *   [if the file path is omitted, it defaults to urls.example.json in the project root]
 *
 * Environment variables:
 *   STAGING_USERNAME - HTTP Basic Auth username
 *   STAGING_PASSWORD - HTTP Basic Auth password
 *
 * The JSON file should contain a single array of URL strings.
 */

// Parse CLI argument for the URL file path or use a default
const args = process.argv.slice(2);
const defaultFilePath = 'urls.example.json';
const urlFilePath = args.length > 0 && !args[0].startsWith('-') ? args[0] : defaultFilePath;
const absoluteFilePath = resolve(process.cwd(), urlFilePath);

// Check for credentials in environment variables or command line args
// Using args[1] and args[2] assuming args[0] is the urlFilePath or its default
const credentials = {
    username: process.env.STAGING_USERNAME || (args.length > 1 ? args[1] : undefined),
    password: process.env.STAGING_PASSWORD || (args.length > 2 ? args[2] : undefined)
};

// Validate that the JSON file exists
if (!existsSync(absoluteFilePath)) {
    console.error(`❌ Error: File not found at ${absoluteFilePath}`);
    console.error(`Please provide a valid JSON file path.`);
    process.exit(1);
}

// Read and parse the JSON file
let urls = [];
try {
    const fileContent = readFileSync(absoluteFilePath, 'utf8');
    urls = JSON.parse(fileContent);

    if (!Array.isArray(urls)) {
        throw new Error('The JSON file should contain an array of URLs.');
    }
} catch (error) {
    console.error(`❌ Error parsing JSON file: ${error.message}`);
    process.exit(1);
}

if (urls.length === 0) {
    console.log('ℹ️  No URLs found in the JSON file. Exiting.');
    process.exit(0);
}

console.log(`\n🔍 Checking ${urls.length} URL(s) from ${urlFilePath}\n`);

// Helper function to wait and format URLs properly before testing
function normalizeUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
}

(async () => {
    // Launch the browser once
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const results = [];

    for (let rawUrl of urls) {
        const targetUrl = normalizeUrl(rawUrl);
        console.log(`⏳ Testing: ${targetUrl}...`);

        let engineFound = false;
        let kameleoonFound = false;

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Authenticate if credentials are provided
            if (credentials.password || credentials.username) {
                await page.authenticate({
                    username: credentials.username || '',
                    password: credentials.password || ''
                });
            }

            // Listen for network requests to detect the scripts
            page.on('request', request => {
                const reqUrl = request.url();
                if (reqUrl.includes('kameleoon.js')) {
                    kameleoonFound = true;
                } else if (reqUrl.includes('engine.js')) {
                    // Additional check: Make sure it's likely a Kameleoon engine
                    // Typically served from static-*.kameleoon.com or similar, but
                    // looking for 'engine.js' specifically as requested.
                    engineFound = true;
                }
            });

            // Navigate to the target URL, wait for network idle to ensure scripts load
            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Additional small wait to catch late-firing scripts
            await new Promise(resolve => setTimeout(resolve, 2000));

            await page.close();

        } catch (error) {
            console.log(`   ❌ Error loading ${targetUrl}: ${error.message}`);
            results.push({
                URL: targetUrl,
                Result: 'ERROR',
                Details: error.message.substring(0, 50) + '...'
            });
            continue;
        }

        // Determine the result state for this URL
        let state = 'NONE';
        if (kameleoonFound && engineFound) {
            state = 'BOTH (Unexpected)';
        } else if (kameleoonFound) {
            state = 'kameleoon.js';
        } else if (engineFound) {
            state = 'engine.js';
        }

        if (state === 'kameleoon.js') {
            console.log(`   ✅ Found: kameleoon.js`);
        } else if (state === 'engine.js') {
            console.log(`   ✅ Found: engine.js`);
        } else {
            console.log(`   ⚠️  Found: ${state}`);
        }

        results.push({
            URL: targetUrl,
            Result: state
        });
    }

    await browser.close();

    // Print final results table
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FINAL RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.table(results);

})();
