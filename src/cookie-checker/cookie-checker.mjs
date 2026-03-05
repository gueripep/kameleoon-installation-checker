import puppeteer from 'puppeteer'
import { askQuestion } from '../utils/input-helpers.mjs'

/**
 * Kameleoon Cookie Checker
 * 
 * This tool tests GDPR compliance and ITP (Intelligent Tracking Prevention) safety
 * for the kameleoonVisitorCode cookie by checking:
 * 
 * 1. GDPR Compliance: Cookie should NOT be set before user consent
 * 2. ITP Safety: Cookie should be set via HTTP Set-Cookie header (backend), not via JavaScript
 * 3. Cookie Persistence: Cookie should persist across page refreshes
 * 
 * Usage:
 *   node cookie-checker.mjs [username] [password]
 * 
 * Environment variables:
 *   STAGING_USERNAME - HTTP Basic Auth username
 *   STAGING_PASSWORD - HTTP Basic Auth password
 */

// Configuration - Update this URL to test your site
const targetUrl = 'https://stg.hunkemoller.at/';

// Check for credentials in environment variables or command line args
const credentials = {
  username: process.env.STAGING_USERNAME || process.argv[2],
  password: process.env.STAGING_PASSWORD || process.argv[3]
};

// Helper function to check cookie state
const checkCookieState = async (page, label) => {
  const cookies = await page.cookies();
  const kameleoonCookie = cookies.find(c => c.name === 'kameleoonVisitorCode');
  
  console.log(`\n   ${label}:`);
  if (kameleoonCookie) {
    console.log(`   ✅ Cookie found: ${kameleoonCookie.value}`);
    return { found: true, value: kameleoonCookie.value, cookie: kameleoonCookie };
  } else {
    console.log(`   ❌ Cookie not found`);
    return { found: false };
  }
};

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Authenticate if credentials are provided
  if (credentials.password) {
    console.log('🔐 Using credentials for authentication');
    await page.authenticate({
      username: credentials.username || '',
      password: credentials.password
    });
  }

  // Clear all cookies and cache for clean state
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');
  await client.send('Network.clearBrowserCache');

  console.log('🧹 Starting with clean browser state (no cookies)');
  console.log(`🔗 Testing: ${targetUrl}\n`);

  // Results tracking
  const results = {
    step1: { backend: false, javascript: false, jsCount: 0 },
    step2: { backend: false, javascript: false, jsCount: 0 },
    step3: { backend: false, javascript: false, jsCount: 0 }
  };

  // Capture ALL Set-Cookie headers
  let currentStepSuffix = 'step1';
  const setCookieHeaders = { step1: [], step2: [], step3: [] };
  
  page.on('response', async (response) => {
    const headers = response.headers();
    if (headers['set-cookie']) {
      const url = response.url();
      const setCookie = headers['set-cookie'];
      setCookieHeaders[currentStepSuffix].push({ url, setCookie });
      
      if (setCookie.includes('kameleoonVisitorCode')) {
        results[currentStepSuffix].backend = true;
        // Silent detection - will be shown in summary
      }
    }
  });

  // Monitor JavaScript setting cookies via document.cookie
  await page.evaluateOnNewDocument(() => {
    const originalCookieSetter = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie').set;
    Object.defineProperty(document, 'cookie', {
      set: function(value) {
        if (value.includes('kameleoonVisitorCode')) {
          console.log('__KAMELEOON_JS_SET__');
        }
        return originalCookieSetter.call(document, value);
      },
      get: function() {
        return Object.getOwnPropertyDescriptor(Document.prototype, 'cookie').get.call(document);
      }
    });
  });

  page.on('console', msg => {
    if (msg.text().includes('__KAMELEOON_JS_SET__')) {
      results[currentStepSuffix].javascript = true;
      results[currentStepSuffix].jsCount++;
      // Silent counting - will be shown in summary
    }
  });

  // ========== STEP 1: BEFORE CONSENT ==========
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 STEP 1: Initial Load (BEFORE consent)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  currentStepSuffix = 'step1';
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => document.readyState === 'complete').catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const step1Result = await checkCookieState(page, 'Cookie status');
  
  if (step1Result.found) {
    console.log(`   ⚠️  POTENTIAL GDPR ISSUE: Cookie set before consent!`);
  }

  // ========== STEP 2: ACCEPT CONSENT ==========
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 STEP 2: Accept Cookie Consent');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  currentStepSuffix = 'step2';
  
  try {
    // Try common cookie consent selectors
    const selectors = [
      '#onetrust-accept-btn-handler',
      '.accept-cookies',
      'button[id*="accept"]',
      'button[class*="accept"]',
      '[data-testid="accept-cookies"]',
      '.cookie-accept',
      '#acceptCookies'
    ];
    
    let foundSelector = null;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        foundSelector = selector;
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!foundSelector) {
      // Try to find any button with accept-like text
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const acceptButton = buttons.find(btn => 
          btn.textContent.toLowerCase().includes('accept') ||
          btn.textContent.toLowerCase().includes('accepteren') ||
          btn.textContent.toLowerCase().includes('akkoord')
        );
        if (acceptButton) {
          return {
            found: true,
            text: acceptButton.textContent.trim(),
            id: acceptButton.id,
            className: acceptButton.className
          };
        }
        return { found: false };
      });
      
      if (buttonInfo.found) {
        foundSelector = buttonInfo.id ? `#${buttonInfo.id}` : 
                       buttonInfo.className ? `.${buttonInfo.className.split(' ')[0]}` : 
                       null;
        if (foundSelector) {
          console.log(`\n   Found: ${foundSelector} ("${buttonInfo.text}")`);
        }
      }
    } else {
      console.log(`\n   Found: ${foundSelector}`);
    }
    
    if (foundSelector) {
      console.log(`   📋 To verify: $('${foundSelector}')`);
    }
    
    console.log(`\n❓ Press Enter to use selector above, or paste custom selector:`);
    const customSelector = await askQuestion('   Selector (or Enter): ');
    
    const selectorToUse = (customSelector && customSelector.trim()) ? customSelector.trim() : foundSelector;
    
    if (selectorToUse) {
      console.log(`\n   🎯 Clicking: ${selectorToUse}`);
      try {
        await page.waitForSelector(selectorToUse, { timeout: 3000 });
        
        const clicked = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.click();
            return true;
          }
          return false;
        }, selectorToUse);
        
        if (clicked) {
          console.log('   ✅ Clicked successfully');
        } else {
          console.log('   ❌ Element not found');
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log(`   ❌ Failed: ${e.message}`);
      }
    } else {
      console.log('   ⏭️  No selector - skipping');
    }
    
  } catch (e) {
    console.log(`   ℹ️  Error: ${e.message}`);
  }
  
  const step2Result = await checkCookieState(page, 'Cookie status after consent');

  // ========== STEP 3: REFRESH PAGE ==========
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 STEP 3: Refresh Page');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  currentStepSuffix = 'step3';
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const step3Result = await checkCookieState(page, 'Cookie status after refresh');

  // ========== FINAL RECAP ==========
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 FINAL RECAP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.table({
    'Before Consent': {
      'Cookie Present': step1Result.found ? '❌ YES (GDPR issue!)' : '✅ NO',
      'Backend Set': results.step1.backend ? '✅ YES' : '❌ NO',
      'JS Set': results.step1.javascript ? `❌ YES (${results.step1.jsCount}x)` : '✅ NO'
    },
    'After Consent': {
      'Cookie Present': step2Result.found ? '✅ YES' : '❌ NO',
      'Backend Set': results.step2.backend ? '✅ YES' : '❌ NO',
      'JS Set': results.step2.javascript ? `⚠️  YES (${results.step2.jsCount}x)` : '✅ NO'
    },
    'After Refresh': {
      'Cookie Present': step3Result.found ? '✅ YES' : '❌ NO',
      'Backend Set': results.step3.backend ? '✅ YES' : '❌ NO',
      'JS Set': results.step3.javascript ? `⚠️  YES (${results.step3.jsCount}x)` : '✅ NO'
    }
  });

  console.log('\n🔍 ANALYSIS:\n');

  // Check GDPR compliance
  if (step1Result.found) {
    console.log('❌ GDPR COMPLIANCE: FAIL');
    console.log('   Cookie was set BEFORE user consent - this violates GDPR requirements.\n');
  } else {
    console.log('✅ GDPR COMPLIANCE: PASS');
    console.log('   Cookie was NOT set before consent.\n');
  }

  // Check ITP safety
  const backendSet = results.step2.backend || results.step3.backend;
  const jsSet = results.step2.javascript || results.step3.javascript;
  
  if (backendSet && !jsSet) {
    console.log('✅ ITP SAFETY: SAFE');
    console.log('   Cookie is set via HTTP Set-Cookie header (backend).');
    console.log('   NOT affected by Safari ITP 7-day cap.\n');
  } else if (backendSet && jsSet) {
    console.log('⚠️  ITP SAFETY: MIXED (Backend + JS)');
    console.log('   Backend is setting cookie via HTTP Set-Cookie header (GOOD).');
    console.log('   BUT JavaScript is ALSO setting it via document.cookie (WHY?).');
    console.log('   If backend wins, cookie should be ITP-safe.');
    console.log('   However, this double-write pattern should be investigated.\n');
  } else if (jsSet && !backendSet) {
    console.log('❌ ITP SAFETY: VULNERABLE');
    console.log('   Cookie is ONLY set via JavaScript (document.cookie).');
    console.log('   WILL BE capped at 7 days by Safari ITP.\n');
    console.log('💡 RECOMMENDATION:');
    console.log('   Implement Kameleoon backend ITP management.');
    console.log('   Docs: https://developers.kameleoon.com/feature-management-and-experimentation/web-sdks/js-sdk/#itp-management\n');
  } else {
    console.log('⚠️  ITP SAFETY: UNCERTAIN');
    console.log('   Could not detect how cookie was set.\n');
  }

  // Cookie persistence check
  if (step2Result.found && step3Result.found) {
    console.log('✅ PERSISTENCE: Cookie persisted across page refresh\n');
  } else if (step2Result.found && !step3Result.found) {
    console.log('❌ PERSISTENCE: Cookie was LOST after refresh!\n');
  } else if (!step2Result.found && step3Result.found) {
    console.log('ℹ️  PERSISTENCE: Cookie appeared after refresh\n');
  } else {
    console.log('❌ PERSISTENCE: Cookie never appeared\n');
  }

  await page.close();
  await browser.close();
})();
