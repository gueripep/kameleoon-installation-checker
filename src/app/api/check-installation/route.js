import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-extra';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const useStealth = require('../../../lib/puppeteer-stealth.cjs');

useStealth(puppeteer);

function normalizeUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
}

export async function POST(request) {
    let browser = null;
    try {
        const body = await request.json();
        const { url, credentials = null } = body;

        if (!url) {
            return NextResponse.json({ error: 'Please provide a URL' }, { status: 400 });
        }

        const targetUrl = new URL(normalizeUrl(url));

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (credentials && credentials.username && credentials.password) {
            await page.authenticate({
                username: credentials.username,
                password: credentials.password
            });
        }

        page.on('dialog', async dialog => {
            if (dialog.type() === 'prompt' && credentials && credentials.password) {
                await dialog.accept(credentials.password);
            } else {
                await dialog.dismiss();
            }
        });

        const itpChecks = [];
        page.on('response', response => {
            try {
                const headers = response.headers();
                const setCookie = headers['set-cookie'];
                if (setCookie && setCookie.includes('kameleoonVisitorCode')) {
                    itpChecks.push({
                        url: response.url(),
                        cookie: setCookie,
                        status: response.status()
                    });
                }
            } catch (e) {
                // Ignore errors for some responses
            }
        });

        const begin = performance.now();
        const response = await page.goto(targetUrl.href, {
            waitUntil: 'networkidle2',
            timeout: 30000
        }).catch(() => null);

        await page.waitForFunction(() => document.readyState === 'complete').catch(() => null);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pageContent = await page.content();
        const hasKameleoonInHTML = pageContent.includes('kameleoon') || pageContent.includes('engine.js');

        const cspHeaders = response ? response.headers() : {};
        const cspHeader = cspHeaders['content-security-policy'] || cspHeaders['content-security-policy-report-only'] || '';
        const cspBlocksEval = cspHeader.includes('script-src') && !cspHeader.includes("'unsafe-eval'");

        let evalWorks = false;
        try {
            evalWorks = await page.evaluate(() => {
                try {
                    eval('1 + 1');
                    return true;
                } catch (e) {
                    return false;
                }
            });
        } catch (error) {
            evalWorks = false;
        }

        const domTests = await page.evaluate(() => {
            const kameleoonSnippet = document.querySelector('script[src*="engine.js"]') || document.querySelector('script[src*="kameleoon.js"]');
            const antiFlickerSnippets = [...document.querySelectorAll('script:not([src])')].filter(tag =>
                tag.textContent.includes('kameleoonLoadingTimeout')
            );
            const iframeSnippet = [...document.querySelectorAll('script:not([src])')].find(tag =>
                tag.textContent.includes('kameleoonIframeURL')
            );

            const allScripts = [...document.querySelectorAll('script')].map(s => ({
                src: s.src || '(inline)',
                id: s.id || '(no id)',
                hasKameleoon: (s.src && s.src.includes('kameleoon')) || s.textContent.includes('kameleoon')
            }));

            const kameleoonScripts = allScripts.filter(s => s.hasKameleoon);
            const hasModernEngine = kameleoonScripts.some(s => s.src && s.src.includes('engine.js'));
            const hasLegacyEngine = kameleoonScripts.some(s => s.src && s.src.includes('kameleoon.js'));

            const debugInfo = {
                totalScripts: allScripts.length,
                kameleoonScriptsCount: kameleoonScripts.length,
                kameleoonScripts: kameleoonScripts.slice(0, 5),
                allScriptsSample: allScripts.slice(0, 10),
                hasIframe: 'kameleoonIframeURL' in window,
                iframeURL: 'kameleoonIframeURL' in window ? window.kameleoonIframeURL : null,
                hasModernEngine,
                hasLegacyEngine
            };

            const scriptsFound = document.querySelectorAll('script[src*="engine.js"], script[src*="kameleoon.js"]').length;

            const tests = [
                {
                    id: 'engine-presence',
                    test: hasModernEngine || hasLegacyEngine,
                    pass: hasModernEngine ? `Modern engine.js is present on page` : `Legacy kameleoon.js is present (Update Recommended)`,
                    fail: `Neither engine.js nor kameleoon.js is present on page`,
                    debug: kameleoonScripts.length > 0 ? `Found ${kameleoonScripts.length} Kameleoon-related scripts` : 'No Kameleoon scripts found in DOM',
                    warning: !hasModernEngine && hasLegacyEngine
                },
                {
                    id: 'engine-unique',
                    test: scriptsFound === 1,
                    pass: `Engine script is present only once`,
                    fail: `Multiple engine scripts found (appears ${scriptsFound} times)`,
                    warning: scriptsFound > 1
                }
            ];

            if (kameleoonSnippet !== null) {
                const isModern = kameleoonSnippet.src && kameleoonSnippet.src.includes('engine.js');
                const scriptName = isModern ? 'engine.js' : 'kameleoon.js';

                tests.push(
                    {
                        id: 'engine-head',
                        test: document.head.querySelector(`script[src*="${scriptName}"]`) !== null,
                        pass: `${scriptName} is present in the <head> of the HTML document`,
                        fail: `${scriptName} is not present in the <head> of the HTML document`,
                        warning: false
                    },
                    {
                        id: 'engine-async',
                        test: kameleoonSnippet.hasAttribute('async'),
                        pass: `${scriptName} has the async attribute on its <script> tag`,
                        fail: `${scriptName} does not have the async attribute on its <script> tag`,
                        warning: false
                    },
                    {
                        id: 'engine-fetchpriority',
                        test: kameleoonSnippet.getAttribute('fetchpriority') === 'high',
                        pass: `${scriptName} has fetchpriority="high" attribute`,
                        fail: `${scriptName} does not have fetchpriority="high" attribute (optional but recommended)`,
                        warning: false
                    },
                    {
                        id: 'antiflicker-presence',
                        test: antiFlickerSnippets.length !== 0,
                        pass: `Anti-flicker snippet is present on page`,
                        fail: `Anti-flicker snippet is not present on page`,
                        warning: false
                    }
                );

                if (antiFlickerSnippets.length !== 0) {
                    const timeoutMatch = antiFlickerSnippets[0]?.textContent.match(/kameleoonLoadingTimeout\s*=\s*(\d+)/);
                    tests.push(
                        {
                            id: 'antiflicker-unique',
                            test: antiFlickerSnippets.length === 1,
                            pass: `Anti-flicker snippet is present only once`,
                            fail: `Anti-flicker snippet is not present only once`
                        },
                        {
                            id: 'antiflicker-timeout',
                            test: timeoutMatch && parseInt(timeoutMatch[1]) === 1000,
                            pass: `Anti-flicker timeout is set to 1000ms (recommended)`,
                            fail: `Anti-flicker timeout is not set to 1000ms`
                        },
                        {
                            id: 'antiflicker-order',
                            test: antiFlickerSnippets[0]?.compareDocumentPosition(kameleoonSnippet) === 4,
                            pass: `Anti-flicker snippet appears before ${scriptName}`,
                            fail: `Anti-flicker snippet does not appear before ${scriptName}`,
                            warning: false
                        }
                    );
                }

                if (iframeSnippet !== undefined) {
                    tests.push(
                        {
                            id: 'iframe-order-1',
                            test: antiFlickerSnippets[0]?.compareDocumentPosition(iframeSnippet) === 4,
                            pass: `Iframe snippet appears after Anti-flicker snippet`,
                            fail: `Iframe snippet does not appear after Anti-flicker snippet`
                        },
                        {
                            id: 'iframe-order-2',
                            test: iframeSnippet?.compareDocumentPosition(kameleoonSnippet) === 4,
                            pass: `Iframe snippet appears before ${scriptName}`,
                            fail: `Iframe snippet does not appear before ${scriptName}`,
                            warning: false
                        },
                        {
                            id: 'iframe-run',
                            test: 'kameleoonIframeURL' in window,
                            pass: `Iframe URL is present in global object`,
                            fail: `Iframe URL is not present in global object`
                        }
                    );
                }
            }

            return { tests, debugInfo };
        });

        const performanceMetrics = {
            duration: 0,
            responseEnd: 0,
            startTime: 0,
            availableAfterSec: 0,
            loadedWithin3s: false
        };

        let apiChecks = [];

        try {
            await page.waitForFunction(() => 'Kameleoon' in window, { timeout: 3000 });
            const resourceTiming = JSON.parse(
                await page.evaluate(() =>
                    JSON.stringify(
                        window.performance.getEntriesByType('resource').find(resource =>
                            resource.initiatorType === 'script' && (resource.name.includes('engine.js') || resource.name.includes('kameleoon.js'))
                        ) || null
                    )
                ) || '{}'
            );

            if (resourceTiming) {
                performanceMetrics.duration = Math.round(resourceTiming.duration || 0);
                performanceMetrics.responseEnd = Math.round(resourceTiming.responseEnd || 0);
                performanceMetrics.startTime = Math.round(resourceTiming.startTime || 0);
            }
            performanceMetrics.availableAfterSec = Math.round(performance.now() - begin) / 1000;
            performanceMetrics.loadedWithin3s = true;

            apiChecks = await page.evaluate(() => {
                const results = [];
                if (window.Kameleoon?.API?.Visitor?.code !== undefined) {
                    results.push({ pass: true, message: 'Kameleoon.API.Visitor.code is defined' });
                } else {
                    results.push({ pass: false, message: 'Kameleoon.API.Visitor.code is not defined' });
                }

                if (window.Kameleoon?.Internals?.configuration) {
                    results.push({ pass: true, message: 'Kameleoon.Internals.configuration is present' });
                } else {
                    results.push({ pass: false, message: 'Kameleoon.Internals.configuration is missing' });
                }

                if (window.Kameleoon?.Internals?.runtime) {
                    results.push({ pass: true, message: 'Kameleoon.Internals.runtime is present' });
                } else if (window.Kameleoon?.Internals?.runtime === null) {
                    results.push({ pass: false, message: 'Kameleoon.Internals.runtime is null (check if project is activated in BO)' });
                } else {
                    results.push({ pass: false, message: 'Kameleoon.Internals.runtime is missing' });
                }

                return results;
            });
        } catch (error) {
            performanceMetrics.loadedWithin3s = false;
        }

        await browser.close();

        return NextResponse.json({
            success: true,
            hasKameleoonInHTML,
            cspBlocksEval,
            cspHeader,
            evalWorks,
            debugInfo: domTests.debugInfo,
            tests: domTests.tests,
            performance: performanceMetrics,
            apiChecks,
            itpCheck: {
                pass: itpChecks.length > 0,
                details: itpChecks
            }
        });

    } catch (error) {
        if (browser) await browser.close();
        console.error('Installation checker API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
