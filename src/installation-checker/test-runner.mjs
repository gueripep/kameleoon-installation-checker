import { askQuestion } from '../utils/input-helpers.mjs'

/**
 * Main test runner for Kameleoon installation validation
 * Checks for proper snippet installation, CSP issues, performance, and more
 * 
 * @param {object} browser - Puppeteer browser instance
 * @param {object} page - Puppeteer page instance
 * @param {URL} url - The URL to test
 * @param {object} credentials - Optional credentials for HTTP Basic Auth {username, password}
 */
export default async function testRunner(browser, page, url, credentials = null) {
  // Handle authentication if credentials are provided
  if (credentials && credentials.username && credentials.password) {
    // For HTTP Basic Authentication (most common for staging sites)
    await page.authenticate({
      username: credentials.username,
      password: credentials.password
    })
  }

  // Handle JavaScript prompt dialogs (fallback for custom auth)
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt' && credentials && credentials.password) {
      await dialog.accept(credentials.password)
    } else {
      await dialog.dismiss()
    }
  })

  // Load URL
  const begin = performance.now()
  const response = await page.goto(url.href, { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  }).catch(error => void 0)
  
  // Wait for the page to be fully loaded and for any dynamic content
  // This is important for React/Next.js apps that inject scripts dynamically
  await page.waitForFunction(() => document.readyState === 'complete').catch(error => void 0)
  
  // Give dynamic content more time to render (for SPAs/Next.js)
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Debug: Check what HTML we actually received
  const pageContent = await page.content()
  const hasKameleoonInHTML = pageContent.includes('kameleoon') || pageContent.includes('engine.js')

  // Check for CSP headers that might block eval
  const cspHeaders = response ? response.headers() : {}
  const cspHeader = cspHeaders['content-security-policy'] || cspHeaders['content-security-policy-report-only'] || ''
  const cspBlocksEval = cspHeader.includes('script-src') && !cspHeader.includes("'unsafe-eval'")
  
  // Test if eval actually works in the page context
  let evalWorks = false
  try {
    evalWorks = await page.evaluate(() => {
      try {
        // Try to use eval
        eval('1 + 1')
        return true
      } catch (e) {
        return false
      }
    })
  } catch (error) {
    evalWorks = false
  }

  // Evaluate tests
  const result = await page.evaluate(() => {
    const kameleoonSnippet = document.querySelector('script[src*="engine.js"]')
    const antiFlickerSnippets = [...document.querySelectorAll('script:not([src])')].filter(tag =>
      tag.textContent.includes('kameleoonLoadingTimeout')
    )
    const iframeSnippet = [...document.querySelectorAll('script:not([src])')].find(tag =>
      tag.textContent.includes('kameleoonIframeURL')
    )
    
    // Debug: Log all script tags for troubleshooting
    const allScripts = [...document.querySelectorAll('script')].map(s => ({
      src: s.src || '(inline)',
      id: s.id || '(no id)',
      hasKameleoon: (s.src && s.src.includes('kameleoon')) || s.textContent.includes('kameleoon')
    }))
    
    // Debug: Count total scripts and Kameleoon scripts
    const totalScripts = allScripts.length
    const kameleoonScripts = allScripts.filter(s => s.hasKameleoon)
    
    // Return debug info
    window.__debugInfo = {
      totalScripts,
      kameleoonScriptsCount: kameleoonScripts.length,
      kameleoonScripts: kameleoonScripts.slice(0, 5), // First 5 only
      allScriptsSample: allScripts.slice(0, 10) // First 10 only
    }

    // Basic tests
    const tests = [
      // Verify that an engine.js <script> tag is present in HTML
      {
        test: () => kameleoonSnippet !== null,
        pass: `engine.js is present on page`,
        fail: `engine.js is not present on page`,
        debug: allScripts.filter(s => s.hasKameleoon).length > 0 ? 
          `Found ${allScripts.filter(s => s.hasKameleoon).length} Kameleoon-related scripts` : 
          'No Kameleoon scripts found in DOM'
      },
      
      // Verify the engine.js tag is present only once
      {
        test: () => document.querySelectorAll('script[src*="engine.js"]').length === 1,
        pass: `engine.js is present only once`,
        fail: `engine.js is not present only once (appears ${document.querySelectorAll('script[src*="engine.js"]').length} times)`
      },
    ]

    // Kameleoon snippet related tests
    const snippetTests = [
      // Verify engine.js is located in the <head>
      {
        test: () => document.head.querySelector('script[src*="engine.js"]') !== null,
        pass: `engine.js is present in the <head> of the HTML document`,
        fail: `engine.js is not present in the <head> of the HTML document`
      },

      // Verify that the engine.js has the async attribute
      {
        test: () => kameleoonSnippet.matches('[async]'),
        pass: `engine.js has the async attribute on its <script> tag`,
        fail: `engine.js does not have the async attribute on its <script> tag`
      },

      // Verify that the engine.js has fetchpriority="high" attribute (optional but recommended)
      {
        test: () => kameleoonSnippet.matches('[fetchpriority="high"]'),
        pass: `engine.js has fetchpriority="high" attribute`,
        fail: `engine.js does not have fetchpriority="high" attribute (optional but recommended)`
      },

      // Verify if anti-flicker snippet is present
      {
        test: () => antiFlickerSnippets.length !== 0,
        pass: `Anti-flicker snippet is present on page`,
        fail: `Anti-flicker snippet is not present on page`
      },
    ]

    // Anti flicker snippet related tests
    const antiFlickerTests = [
      // Verify if anti-flicker snippet is present only once
      {
        test: () => antiFlickerSnippets.length === 1,
        pass: `Anti-flicker snippet is present only once`,
        fail: `Anti-flicker snippet is not present only once (appears ${antiFlickerSnippets.length} times)`
      },

      // Verify anti-flicker timeout is set to 1000ms (recommended)
      {
        test: () => {
          const timeoutMatch = antiFlickerSnippets[0]?.textContent.match(/kameleoonLoadingTimeout\s*=\s*(\d+)/);
          return timeoutMatch && parseInt(timeoutMatch[1]) === 1000;
        },
        pass: `Anti-flicker timeout is set to 1000ms (recommended)`,
        fail: `Anti-flicker timeout is not set to 1000ms (recommended value)`
      },

      // Verify if the anti-flicker snippet appears before engine.js, if present
      {
        test: () => antiFlickerSnippets[0]?.compareDocumentPosition(kameleoonSnippet) === 4,
        pass: `Anti-flicker snippet appears before engine.js`,
        fail: `Anti-flicker snippet does not appear before engine.js`
      },
    ]

    // Iframe tests
    const iframeTests = [
      // Verify if the iframe snippet appears after anti-flicker snippet
      {
        test: () => antiFlickerSnippets[0]?.compareDocumentPosition(
          iframeSnippet
        ) === 4,
        pass: `Iframe snippet appears after Anti-flicker snippet`,
        fail: `Iframe snippet does not appear after Anti-flicker snippet`
      },

      // Verify if the iframe snippet appears before engine.js, if present
      {
        test: () => iframeSnippet?.compareDocumentPosition(kameleoonSnippet) === 4,
        pass: `Iframe snippet appears before engine.js`,
        fail: `Iframe snippet does not appear before engine.js`
      },

      // Verify script order is correct: anti-flicker → iframe → engine
      {
        test: () => {
          if (!antiFlickerSnippets[0] || !iframeSnippet) return true;
          return antiFlickerSnippets[0].compareDocumentPosition(iframeSnippet) === 4 
                 && iframeSnippet.compareDocumentPosition(kameleoonSnippet) === 4;
        },
        pass: `Script order is correct: anti-flicker → iframe → engine`,
        fail: `Script order is incorrect (should be: anti-flicker → iframe → engine)`
      },

      // Verify that code in iframe snippet has run
      {
        test: () => 'kameleoonIframeURL' in window,
        pass: `Iframe URL is present in global object`,
        fail: `Iframe URL is not present in global object`
      },
    ]

    // Decide which tests to run
    if (kameleoonSnippet !== null) {
      tests.push(...snippetTests)

      if (antiFlickerSnippets.length !== 0) {
        tests.push(...antiFlickerTests)
      }

      if (iframeSnippet !== undefined) {
        tests.push(...iframeTests)
      }
    }

    // Run all prepared tests and return result
    return tests.map(obj => {
      obj.test = obj.test()
      return obj
    })
  })

  // Log results
  const style = `
    font-weight: bold;
    padding: .5em;
  `

  console.log('')
  console.group(`🦎 ${url.href} \n  ${new Date()}`)
  
  // Debug information
  if (!hasKameleoonInHTML) {
    console.log(
      `  ⚠️  %cKameleoon not found in HTML source - possible bot detection or script not yet loaded`,
      `color: #f90; ${style}`
    )
  }
  
  // CSP and eval check results
  if (cspBlocksEval) {
    console.error(
      `  🚫 %cContent Security Policy (CSP) may block eval (script-src without 'unsafe-eval')`,
      `color: #a00; ${style}`
    )
  } else if (cspHeader) {
    console.log(
      `  ✅ %cContent Security Policy (CSP) allows eval`,
      `color: #0a0; ${style}`
    )
  }
  
  if (!evalWorks) {
    console.error(
      `  🚫 %ceval() is blocked on this page - Kameleoon requires eval to work properly`,
      `color: #a00; ${style}`
    )
    console.log(`  ℹ️  Solution: Add 'unsafe-eval' to script-src directive in Content-Security-Policy header`)
  } else {
    console.log(
      `  ✅ %ceval() is allowed on this page`,
      `color: #0a0; ${style}`
    )
  }
  
  result.forEach(result => {
    if (result.test === true) {
      console.log(
        `  ✅ %c${result.pass}`,
        `color: #0a0; ${style}`
      )
    } else {
      console.error(
        `  🚫 %c${result.fail}`,
        `color: #a00; ${style}`
      )
      if (result.debug) {
        console.log(`      ℹ️  ${result.debug}`)
      }
    }
  })
  
  // Get and display debug information
  const debugInfo = await page.evaluate(() => window.__debugInfo)
  if (debugInfo) {
    console.log(`\n  🔍 Debug Info:`)
    console.log(`      Total scripts found: ${debugInfo.totalScripts}`)
    console.log(`      Kameleoon scripts found: ${debugInfo.kameleoonScriptsCount}`)
    if (debugInfo.kameleoonScriptsCount > 0) {
      console.log(`      Kameleoon scripts:`, debugInfo.kameleoonScripts)
    }
    if (debugInfo.totalScripts === 0) {
      console.error(`      ⚠️  NO SCRIPTS FOUND - likely bot detection blocking page load`)
      console.log(`\n  💡 Troubleshooting:`)
      console.log(`      1. Visit the site in a regular browser to confirm Kameleoon is present`)
      console.log(`      2. Site may be detecting Puppeteer as a bot`)
      console.log(`      3. Try visiting site directly to manually verify installation`)
    } else if (debugInfo.totalScripts < 5 && !hasKameleoonInHTML) {
      console.error(`      ⚠️  Very few scripts found (${debugInfo.totalScripts}) - possible bot detection`)
      console.log(`      Sample scripts:`, debugInfo.allScriptsSample)
      console.log(`\n  💡 This site may be detecting automated browsers`)
    }
  }

  // JavaScript loading and downloading measurements
  try {
    // Test for Kameleoon's object to be available globally
    const found = await page.waitForFunction(() => 'Kameleoon' in window, {timeout: 3000})

    // Grab the performance resource entry for kameleoon.js
    const resourceTiming = JSON.parse(
      await page.evaluate(() =>
        JSON.stringify(
          window.performance.getEntriesByType('resource').find(resource =>
            resource.initiatorType === 'script'
            && resource.name.includes('engine.js')
          )
        )
      ) || '{}'
    )

    console.log(`  ⏱️ engine.js fetched in ${Math.round(resourceTiming?.duration || 0)}ms`)
    console.log(`  ⏱️ engine.js downloaded ${Math.round(resourceTiming?.responseEnd || 0)}ms after page request`)
    console.log(`  ⏱️ Kameleoon JavaScript available ${(Math.round(performance.now() - begin) / 1000)}s after page request`)
    
    // Check if engine.js started in less than 1 second (recommended)
    if (resourceTiming?.startTime && resourceTiming.startTime < 1000) {
      console.log(`  ✅ %cengine.js started in less than 1 second (${Math.round(resourceTiming.startTime)}ms)`, `color: #0a0; ${style}`)
    } else if (resourceTiming?.startTime) {
      console.error(`  🚫 %cengine.js did not start in less than 1 second (${Math.round(resourceTiming.startTime)}ms)`, `color: #a00; ${style}`)
    }

    // Check Kameleoon.API and Internals
    const apiChecks = await page.evaluate(() => {
      const results = [];
      
      // Check if Kameleoon.API.Visitor.code is defined
      if (window.Kameleoon?.API?.Visitor?.code !== undefined) {
        results.push({ pass: true, message: 'Kameleoon.API.Visitor.code is defined' });
      } else {
        results.push({ pass: false, message: 'Kameleoon.API.Visitor.code is not defined' });
      }
      
      // Check if Kameleoon.Internals has configuration
      if (window.Kameleoon?.Internals?.configuration) {
        results.push({ pass: true, message: 'Kameleoon.Internals.configuration is present' });
      } else {
        results.push({ pass: false, message: 'Kameleoon.Internals.configuration is missing' });
      }
      
      // Check if Kameleoon.Internals has runtime
      if (window.Kameleoon?.Internals?.runtime) {
        results.push({ pass: true, message: 'Kameleoon.Internals.runtime is present' });
      } else if (window.Kameleoon?.Internals?.runtime === null) {
        results.push({ pass: false, message: 'Kameleoon.Internals.runtime is null (check if project is activated in BO)' });
      } else {
        results.push({ pass: false, message: 'Kameleoon.Internals.runtime is missing' });
      }
      
      return results;
    });

    apiChecks.forEach(check => {
      if (check.pass) {
        console.log(`  ✅ %c${check.message}`, `color: #0a0; ${style}`);
      } else {
        console.error(`  🚫 %c${check.message}`, `color: #a00; ${style}`);
      }
    });

  } catch (error) {
    console.error(
      `  🚫 %cengine.js did not load in <3 seconds`,
      `color: #a00; ${style}`
    )
  }

  console.groupEnd()

  // Interactive manual checks
  const hasIframe = await page.evaluate(() => 'kameleoonIframeURL' in window);
  const iframeURL = hasIframe ? await page.evaluate(() => window.kameleoonIframeURL) : null;

  console.log('\n')
  console.log('━'.repeat(80))
  console.log('📋 INTERACTIVE MANUAL CHECKS')
  console.log('ℹ️  Full documentation: https://www.notion.so/kameleoon-ext/Installation-checklist-4e0b4c4b1bc6436b8fe88fe8f35d57bb')
  console.log('━'.repeat(80))
  console.log('')

  const manualChecks = [
    {
      title: '📍 Graphic Editor - CORS Check',
      instructions: [
        '1. Open the Kameleoon graphic editor',
        '2. Check the browser console for CORS errors',
        '3. If CORS errors exist, client needs to whitelist:',
        '   → *.kameleoon.js',
        '   → *.kameleoon.eu', 
        '   → *.kameleoon.io'
      ],
      question: 'No CORS errors in graphic editor?'
    }
  ];

  if (hasIframe) {
    manualChecks.push(
      {
        title: '📍 Iframe Configuration (Sub-domain Setup)',
        instructions: [
          `1. Visit the iframe URL: ${iframeURL}`,
          '2. Right-click on the blank page → View Page Source',
          '3. Check that "allowedDomains" includes all sub-domains',
          '4. Verify "sitecode" is correct',
          '5. allowedDomains format:',
          '   → ["*.maindomain.com"] for sub-domains only',
          '   → ["*.maindomain.com", "maindomain.com"] if main domain accessible without www'
        ],
        question: 'Iframe configuration is correct?'
      },
      {
        title: '📍 Network Tab - Iframe Status',
        instructions: [
          '1. Open browser DevTools → Network tab',
          '2. Reload the page',
          '3. Check if iframe request has "blocked" status (CORS issue)',
          '4. If blocked, verify:',
          '   → allowedDomains configuration (see previous check)',
          '   → Client BO → Configure → Project → Installation: all sub-domains listed',
          '   → Test on different browsers',
          '   → Browser cookies params',
          '   → Client may need to edit CORS policy'
        ],
        question: 'Iframe loads without being blocked?'
      }
    );
  }

  manualChecks.push(
    {
      title: '📍 Consent Management (if consent is required)',
      instructions: [
        '1. Before visitor interaction with cookie popup:',
        '   → Open console and check: Kameleoon.API.Visitor.experimentLegalConsent === null',
        '2. After visitor accepts cookies:',
        '   → Check: Kameleoon.API.Visitor.experimentLegalConsent === true',
        '3. After visitor rejects cookies (test separately):',
        '   → Check: Kameleoon.API.Visitor.experimentLegalConsent === false'
      ],
      question: 'Consent management working correctly (or not applicable)?'
    },
    {
      title: '📍 SPA Mode (if Single Page Application mode is activated)',
      instructions: [
        '1. Add a console.log statement in the Kameleoon Global Script',
        '2. Navigate from one page to another within the site',
        '3. The log should print once more for each new URL',
        '4. This verifies SPA mode triggers on route changes'
      ],
      question: 'SPA mode working correctly (or not applicable)?'
    },
    {
      title: '📍 Back Office Configuration',
      instructions: [
        '1. Login to client BO: https://login.kameleoon.com/app/admin/sso',
        '2. Navigate to Admin → Projects',
        '3. Verify the project is activated',
        '4. Go to Configure → Project → Installation',
        '5. Verify all domains/sub-domains are listed correctly'
      ],
      question: 'Back office configuration is correct?'
    }
  );

  const manualResults = [];

  for (let i = 0; i < manualChecks.length; i++) {
    const check = manualChecks[i];
    
    // Special handling for Consent Management check
    if (check.title === '📍 Consent Management (if consent is required)') {
      console.log(`\n${check.title}`);
      console.log('─'.repeat(80));
      
      let wantToCheck = '';
      while (wantToCheck.toLowerCase() !== 'y' && wantToCheck.toLowerCase() !== 'n') {
        wantToCheck = await askQuestion('Do you want to check consent management? (y/n): ');
        if (wantToCheck.toLowerCase() !== 'y' && wantToCheck.toLowerCase() !== 'n') {
          console.log('Please enter "y" for yes or "n" for no');
        }
      }
      
      if (wantToCheck.toLowerCase() === 'n') {
        console.log('⏭️  Skipped\n');
        manualResults.push({
          title: check.title,
          passed: true,
          skipped: true
        });
        continue;
      }
      
      // If user wants to check, show instructions
      check.instructions.forEach(instruction => console.log(`  ${instruction}`));
      console.log('');
    } 
    // Special handling for SPA Mode check
    else if (check.title === '📍 SPA Mode (if Single Page Application mode is activated)') {
      console.log(`\n${check.title}`);
      console.log('─'.repeat(80));
      
      let wantToCheck = '';
      while (wantToCheck.toLowerCase() !== 'y' && wantToCheck.toLowerCase() !== 'n') {
        wantToCheck = await askQuestion('Do you want to check SPA implementation? (y/n): ');
        if (wantToCheck.toLowerCase() !== 'y' && wantToCheck.toLowerCase() !== 'n') {
          console.log('Please enter "y" for yes or "n" for no');
        }
      }
      
      if (wantToCheck.toLowerCase() === 'n') {
        console.log('⏭️  Skipped\n');
        manualResults.push({
          title: check.title,
          passed: true,
          skipped: true
        });
        continue;
      }
      
      // If user wants to check, show instructions
      check.instructions.forEach(instruction => console.log(`  ${instruction}`));
      console.log('');
    } else {
      console.log(`\n${check.title}`);
      console.log('─'.repeat(80));
      check.instructions.forEach(instruction => console.log(`  ${instruction}`));
      console.log('');
    }
    
    let answer = '';
    while (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'n') {
      answer = await askQuestion(`${check.question} (y/n): `);
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'n') {
        console.log('Please enter "y" for yes or "n" for no');
      }
    }
    
    manualResults.push({
      title: check.title,
      passed: answer.toLowerCase() === 'y'
    });
    
    if (answer.toLowerCase() === 'y') {
      console.log('✅ Passed\n');
    } else {
      console.log('🚫 Failed - Please review\n');
    }
  }

  // Final summary
  console.log('\n')
  console.log('━'.repeat(80))
  console.log('📊 FINAL SUMMARY')
  console.log('━'.repeat(80))
  
  const passedCount = manualResults.filter(r => r.passed && !r.skipped).length;
  const skippedCount = manualResults.filter(r => r.skipped).length;
  const failedCount = manualResults.filter(r => !r.passed && !r.skipped).length;
  
  console.log(`\nTotal checks: ${manualResults.length}`);
  console.log(`✅ Passed: ${passedCount}`);
  console.log(`🚫 Failed: ${failedCount}`);
  if (skippedCount > 0) {
    console.log(`⏭️  Skipped: ${skippedCount}`);
  }
  console.log('');
  
  if (failedCount > 0) {
    console.log('Failed checks:');
    manualResults.forEach(result => {
      if (!result.passed && !result.skipped) {
        console.log(`  🚫 ${result.title}`);
      }
    });
    console.log('');
    console.log('📖 Review documentation: https://www.notion.so/kameleoon-ext/Installation-checklist-4e0b4c4b1bc6436b8fe88fe8f35d57bb');
  } else {
    console.log('🎉 All manual checks passed! Installation looks good.');
  }
  
  console.log('━'.repeat(80));
  console.log('');
}
