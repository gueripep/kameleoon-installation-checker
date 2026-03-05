import puppeteer from 'puppeteer'
import urlBuilder from '../utils/url-builder.mjs'
import testRunner from './test-runner.mjs'

/**
 * Main entry point for the Kameleoon Installation Checker
 * 
 * Usage:
 *   node installation-checker.mjs <url> [username] [password]
 * 
 * Environment variables:
 *   STAGING_USERNAME - HTTP Basic Auth username
 *   STAGING_PASSWORD - HTTP Basic Auth password
 * 
 * Examples:
 *   node installation-checker.mjs https://www.example.com
 *   node installation-checker.mjs https://staging.example.com myuser mypass
 *   STAGING_USERNAME=myuser STAGING_PASSWORD=mypass node installation-checker.mjs https://staging.example.com
 */

let url = urlBuilder(process.argv[2])

if (url !== undefined) {
  // Launch browser with stealth settings to avoid bot detection
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  })
  const page = await browser.newPage()
  
  // Set realistic viewport and user agent to avoid detection
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
  
  // Remove webdriver property
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    })
  })
  
  // Check for credentials in environment variables or command line args
  const credentials = {
    username: process.env.STAGING_USERNAME || process.argv[3],
    password: process.env.STAGING_PASSWORD || process.argv[4]
  }
  
  // Only pass credentials if at least password is provided
  const creds = credentials.password ? credentials : null
  
  await testRunner(browser, page, url, creds)
  
  // Close the browser after all checks are complete
  await browser.close()
  process.exit()
} else {
  process.exit()
}
