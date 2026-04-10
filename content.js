// This script runs in the isolated world of the webpage.
// We communicate with an injected script to get access to `window.Kameleoon`

function injectScript(file_path, node) {
    const th = document.getElementsByTagName(node)[0];
    const s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file_path);
    th.appendChild(s);
}

// Setup a listener for messages from the injected script
window.addEventListener('message', function(event) {
    // We only accept messages from ourselves
    if (event.source !== window || !event.data || event.data.type !== 'KAMELEOON_API_DATA') {
        return;
    }
    
    const apiData = event.data.payload;
    const domData = runDomTests();
    const performanceData = runPerformanceTests();

    // Package everything and store it
    const finalReport = {
        timestamp: Date.now(),
        url: window.location.href,
        apiData,
        domData,
        performanceData
    };

    chrome.storage.local.set({ lastTestResults: finalReport }, () => {
        // Clear pending check if exists
        chrome.storage.local.get(['pendingCheck'], (data) => {
            if (data.pendingCheck && data.pendingCheck === window.location.origin) {
                chrome.storage.local.remove(['pendingCheck', 'checkTimestamp']);
            }
        });
    });
});

function runDomTests() {
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
                    pass: `Anti-flicker timeout is set to 1000ms`,
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
                }
            );
        }
    }

    return tests;
}

function runPerformanceTests() {
    const resourceTiming = window.performance.getEntriesByType('resource').find(resource =>
        resource.initiatorType === 'script' && (resource.name.includes('engine.js') || resource.name.includes('kameleoon.js'))
    );

    if (!resourceTiming) return null;

    return {
        duration: Math.round(resourceTiming.duration || 0),
        responseEnd: Math.round(resourceTiming.responseEnd || 0),
        startTime: Math.round(resourceTiming.startTime || 0)
    };
}

// Logic to run on page load
chrome.storage.local.get(['pendingCheck'], (data) => {
    if (data.pendingCheck && data.pendingCheck === window.location.origin) {
        // Delay slightly for SPAs to render DOM and load scripts if not SSR
        setTimeout(() => {
            // Inject script to extract data from window.Kameleoon
            injectScript(chrome.runtime.getURL('inject.js'), 'body');
        }, 1500);
    }
});
