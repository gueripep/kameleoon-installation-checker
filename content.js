// This script runs in the isolated world of the webpage.
// We communicate with an injected script to get access to `window.Kameleoon`

function injectScript(file_path, node) {
    const th = document.getElementsByTagName(node)[0];
    const s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file_path);
    th.appendChild(s);
}

let finalReport = {
    timestamp: null,
    url: window.location.href,
    apiData: [],
    domData: [],
    performanceData: null,
    cspData: null,
    consentData: null,
    itpData: null
};

let currentTabId = null;

// Logic to run on page load
let checkTimeout = null;
chrome.runtime.sendMessage({ action: 'get_tab_status' }, (response) => {
    if (response && response.pending && response.pending === window.location.origin) {
        currentTabId = response.tabId;
        
        // Use ITP data from the response if available
        if (response.itpData) {
            updateItpData(response.itpData);
        }

        // Inject script to extract data from window.Kameleoon
        injectScript(chrome.runtime.getURL('inject.js'), 'body');

        // Set a timeout to finalize if not found after 60 seconds
        checkTimeout = setTimeout(() => {
            if (chrome.runtime.id) {
                if (!finalReport.apiData || finalReport.apiData.length === 0) {
                    finalReport.timestamp = Date.now();
                    finalReport.domData = runDomTests();
                    finalReport.performanceData = runPerformanceTests();
                    saveReport();
                }
            }
        }, 60000); 
    }
});

// Setup a listener for messages from the injected script
window.addEventListener('message', async function(event) {
    if (event.source !== window || !event.data) {
        return;
    }

    if (event.data.type === 'KAMELEOON_CONSENT_DATA') {
        finalReport.consentData = event.data.payload;
        await checkItp(); // Refresh ITP status with latest consent info
        saveReport();
    } else if (event.data.type === 'KAMELEOON_API_DATA') {
        if (checkTimeout) clearTimeout(checkTimeout);

        finalReport.apiData = event.data.payload;
        finalReport.domData = runDomTests(event.data.antiFlickerRuntime);
        finalReport.performanceData = runPerformanceTests();
        finalReport.cspData = await runCspTests();
        
        await checkItp();

        finalReport.timestamp = Date.now();
        saveReport();
    }
});

function saveReport() {
    chrome.runtime.sendMessage({ action: 'save_results', results: finalReport });
}

async function checkItp() {
    if (!currentTabId) return;
    const itpKey = `itpWorkaround_${currentTabId}`;
    const storageData = await new Promise(resolve => chrome.storage.local.get([itpKey], resolve));
    const detections = storageData[itpKey];
    
    if (detections) {
        updateItpData(detections);
    }
}

function updateItpData(detections) {
    const wasTrueOnLoad = finalReport.consentData ? (finalReport.consentData.wasTrueOnLoad.experiment || finalReport.consentData.wasTrueOnLoad.personalization || finalReport.consentData.wasTrueOnLoad.recommendation) : false;
    
    const tooEarly = detections.some(d => d.type === 'main_frame' && !wasTrueOnLoad);
    
    finalReport.itpData = {
        detections: detections,
        status: tooEarly ? 'privacy_risk' : 'compliant'
    };
}

// Monitor storage for new ITP detections for this specific tab
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && currentTabId && changes[`itpWorkaround_${currentTabId}`]) {
        updateItpData(changes[`itpWorkaround_${currentTabId}`].newValue);
        saveReport();
    }
});


function runDomTests(antiFlickerRuntime) {
    const kameleoonSnippet = document.querySelector('script[src*="engine.js"]') || document.querySelector('script[src*="kameleoon.js"]');
    const isExecutableScript = tag => {
        const type = tag.type ? tag.type.toLowerCase() : '';
        return !type || type === 'text/javascript' || type === 'module' || type === 'application/javascript';
    };

    const containsRealIdentifier = (code, identifier) => {
        try {
            // Remove JS comments and string literals to avoid matching stringified payload data
            const cleanCode = code.replace(/\/\/.*|\/\*[\s\S]*?\*\/|(["'`])(?:(?!\1)[^\\]|\\[\s\S])*\1/g, '');
            return cleanCode.includes(identifier);
        } catch (e) {
            return code.includes(identifier); // Fallback
        }
    };

    const antiFlickerSnippets = [...document.querySelectorAll('script:not([src])')].filter(tag =>
        isExecutableScript(tag) && containsRealIdentifier(tag.textContent, 'kameleoonLoadingTimeout')
    );
    const iframeSnippet = [...document.querySelectorAll('script:not([src])')].find(tag =>
        isExecutableScript(tag) && containsRealIdentifier(tag.textContent, 'kameleoonIframeURL')
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

    const antiFlickerRuntimeDetected = !!antiFlickerRuntime && (
        antiFlickerRuntime.hasStartLoadTime ||
        antiFlickerRuntime.hasQueue ||
        antiFlickerRuntime.hasDisplayPageFn ||
        antiFlickerRuntime.hasTimeoutHandle
    );

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
                test: antiFlickerSnippets.length !== 0 || antiFlickerRuntimeDetected,
                pass: antiFlickerSnippets.length !== 0
                    ? `Anti-flicker snippet is present on page`
                    : `Anti-flicker mechanism detected at runtime (kameleoonQueue/kameleoonDisplayPage globals found), but not as an inline script — likely a bundled/hydration-sensitive implementation (e.g. Next.js) where kameleoonLoadingTimeout lives in a compiled JS chunk rather than inline HTML`,
                fail: `Anti-flicker snippet is not present on page`,
                warning: antiFlickerSnippets.length === 0 && antiFlickerRuntimeDetected
            }
        );

        if (antiFlickerSnippets.length !== 0) {
            const timeoutMatch = antiFlickerSnippets[0]?.textContent.match(/kameleoonLoadingTimeout\s*=\s*([\d.eE+-]+)/);
            const rawTimeout = timeoutMatch ? timeoutMatch[1] : null;
            const parsedTimeout = rawTimeout ? Number(rawTimeout) : NaN;

            tests.push(
                {
                    id: 'antiflicker-unique',
                    test: antiFlickerSnippets.length === 1,
                    pass: `Anti-flicker snippet is present only once`,
                    fail: `Anti-flicker snippet is not present only once`
                },
                {
                    id: 'antiflicker-timeout',
                    test: !isNaN(parsedTimeout) && parsedTimeout <= 1000,
                    pass: `Anti-flicker timeout is under or equal to 1000ms`,
                    fail: isNaN(parsedTimeout) ? `Anti-flicker timeout value could not be parsed` : `Anti-flicker timeout is too high (> 1000ms)`,
                    debug: rawTimeout ? `Detected value: ${rawTimeout}${rawTimeout !== String(parsedTimeout) && !isNaN(parsedTimeout) ? ` (${parsedTimeout}ms)` : 'ms'}` : ''
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
            if (antiFlickerSnippets.length !== 0) {
                tests.push({
                    id: 'iframe-order-1',
                    test: antiFlickerSnippets[0]?.compareDocumentPosition(iframeSnippet) === 4,
                    pass: `Iframe snippet appears after Anti-flicker snippet`,
                    fail: `Iframe snippet does not appear after Anti-flicker snippet`
                });
            }
            tests.push({
                id: 'iframe-order-2',
                test: iframeSnippet?.compareDocumentPosition(kameleoonSnippet) === 4,
                pass: `Iframe snippet appears before ${scriptName}`,
                fail: `Iframe snippet does not appear before ${scriptName}`,
                warning: false
            });
        }
    }

    return tests;
}

async function runCspTests() {
    const rules = {
        'script-src': [
            'static.kameleoon.com', 'graphical-editor.kameleoon.com', 
            'simulation.kameleoon.com', 'client-config.kameleoon.com', 'sdk-config.kameleoon.eu', 
            'electra.kameleoon.com', 'aibuilder.kameleoon.com', 'static.experimentation.dev', "'unsafe-eval'"
        ],
        'style-src': [
            'static.kameleoon.com', 'static.products.kameleoon.com', 'graphical-editor.kameleoon.com', 
            'simulation.kameleoon.com', 'electra.kameleoon.com', 'aibuilder.kameleoon.com', 
            'static.experimentation.dev', "'unsafe-inline'"
        ],
        'connect-src': [
            'static.kameleoon.com', 'eu-data.kameleoon.io', 
            'eu-data.kameleoon.eu', 'na-data.kameleoon.io', 'na-data.kameleoon.eu', 'editor.kameleoon.com', 
            'graphical-editor.kameleoon.com', 'simulation.kameleoon.com', 'api.kameleoon.com', 
            'customers.kameleoon.com', 'logger.kameleoon.io', 'client-config.kameleoon.com', 
            'sdk-config.kameleoon.eu', 'api.products.kameleoon.com', 'static.experimentation.dev', 
            'sdk-config.experimentation.dev', 'eu-data.experimentation.dev'
        ],
        'img-src': [
            'storage.kameleoon.eu', 'storage.kameleoon.io', 'graphical-editor.kameleoon.com', 
            'simulation.kameleoon.com', 'static.kameleoon.com', 'images.products.kameleoon.com', 
            'static.experimentation.dev'
        ],
        'frame-src': [
            'graphical-editor.kameleoon.com', 'static.experimentation.dev'
        ]
    };

    // Get CSP from meta tags
    let cspString = '';
    const metaCsp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (metaCsp) {
        cspString = metaCsp.getAttribute('content');
    }

    // Attempt to get CSP from headers via HEAD request
    try {
        const response = await fetch(window.location.href, { method: 'HEAD' });
        const headerCsp = response.headers.get('content-security-policy');
        if (headerCsp) {
            cspString = cspString ? `${cspString}; ${headerCsp}` : headerCsp;
        }
    } catch (e) {
        console.warn('Kameleoon Checker: Could not fetch CSP headers', e);
    }

    if (!cspString) {
        return { noCsp: true };
    }

    const parsedCsp = parseCsp(cspString);
    const results = [];

    // Extract exact engine host if possible (e.g. d8j4om1fqg.kameleoon.io)
    const kameleoonSnippet = document.querySelector('script[src*="engine.js"]') || document.querySelector('script[src*="kameleoon.js"]');
    let engineHost = '';
    if (kameleoonSnippet && kameleoonSnippet.src) {
        try {
            const url = new URL(kameleoonSnippet.src);
            engineHost = url.hostname;
            rules['script-src'].unshift(engineHost);
            rules['connect-src'].unshift(engineHost);
            rules['img-src'].unshift(engineHost);
        } catch (e) {}
    }

    Object.keys(rules).forEach(directive => {
        const required = rules[directive];
        const missing = required.filter(domain => {
            // Check if domain is allowed by this directive or default-src
            return !isAllowed(domain, directive, parsedCsp);
        }).map(domain => {
            return {
                domain: domain,
                description: getDomainDescription(domain, engineHost)
            };
        });

        results.push({
            directive,
            pass: missing.length === 0,
            missing: missing
        });
    });

    return { noCsp: false, results };
}

function getDomainDescription(domain, engineHost) {
    if (domain === engineHost && engineHost !== '') {
        return 'Used to load the core engine.js script';
    }

    const descriptions = {
        'static.kameleoon.com': 'Used to load static and internal resources',
        'graphical-editor.kameleoon.com': 'Used by the graphic editor',
        'simulation.kameleoon.com': 'Used by the new simulation tool',
        'client-config.kameleoon.com': 'Required for older Feature Experimentation SDKs',
        'sdk-config.kameleoon.eu': 'Required for current Feature Experimentation SDKs',
        'electra.kameleoon.com': 'Used by the prompt-based editor',
        'aibuilder.kameleoon.com': 'Used by the prompt-based editor (PBX)',
        'static.experimentation.dev': 'Used to load internal resources',
        'static.products.kameleoon.com': 'Used for the Product Recommendation module',
        'eu-data.kameleoon.io': 'Used for tracking purposes',
        'eu-data.kameleoon.eu': 'Used for tracking purposes',
        'na-data.kameleoon.io': 'Used for tracking purposes',
        'na-data.kameleoon.eu': 'Used for tracking purposes',
        'editor.kameleoon.com': 'Used by the old graphic editor',
        'api.kameleoon.com': 'Used for Automation API, account info, and old simulation',
        'customers.kameleoon.com': 'Required for SDK API and custom integrations',
        'logger.kameleoon.io': 'Used for tracking and logging data',
        'api.products.kameleoon.com': 'API used by the Product Recommendation module',
        'sdk-config.experimentation.dev': 'Controls Kameleoon feature flags activated in the product',
        'eu-data.experimentation.dev': 'Used to send tracking data for logging',
        'storage.kameleoon.eu': 'Used to load images in experiments/editors',
        'storage.kameleoon.io': 'Used to load images in experiments/editors',
        'images.products.kameleoon.com': 'Used to load product images for recommendations',
        "'unsafe-eval'": 'Required for Kameleoon’s engine evaluation logic',
        "'unsafe-inline'": 'Required to apply Kameleoon experiment styles'
    };

    return descriptions[domain] || 'Required Kameleoon resource';
}

function parseCsp(cspString) {
    const policies = cspString.split(';').map(p => p.trim()).filter(p => p.length > 0);
    const parsed = {};

    policies.forEach(policy => {
        const parts = policy.split(/\s+/);
        const directive = parts[0].toLowerCase();
        const sources = parts.slice(1);
        
        if (!parsed[directive]) {
            parsed[directive] = [];
        }
        parsed[directive] = [...parsed[directive], ...sources];
    });

    return parsed;
}

function isAllowed(domain, directive, parsedCsp) {
    // If the specific directive is missing AND default-src is missing,
    // the browser implicitly allows everything for this directive.
    if (!parsedCsp[directive] && !parsedCsp['default-src']) {
        return true;
    }

    const sources = parsedCsp[directive] || parsedCsp['default-src'] || [];
    
    if (sources.includes('*')) return true;
    if (sources.includes('https:*')) return true;
    if (sources.includes('https:')) return true;

    return sources.some(source => {
        // Handle 'unsafe-eval' and 'unsafe-inline'
        if (domain.startsWith("'") && source === domain) return true;
        
        // Handle wildcards and specific domains
        let normalizedSource = source.replace(/^https?:\/\//, '').replace(/\/$/, '');
        let normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

        if (normalizedSource === normalizedDomain) return true;
        if (normalizedSource.startsWith('*.') && normalizedDomain.endsWith(normalizedSource.substring(2))) return true;
        
        return false;
    });
}

function runPerformanceTests() {
    const resourceTiming = window.performance.getEntriesByType('resource').find(resource =>
        resource.initiatorType === 'script' && (resource.name.includes('engine.js') || resource.name.includes('kameleoon.js'))
    );

    if (!resourceTiming) return null;

    return {
        duration: Math.round(resourceTiming.duration || 0),
        responseEnd: Math.round(resourceTiming.responseEnd || 0),
        startTime: Math.round(resourceTiming.startTime || 0),
        requestStart: Math.round(resourceTiming.requestStart || 0),
        responseStart: Math.round(resourceTiming.responseStart || 0),
        fetchStart: Math.round(resourceTiming.fetchStart || 0)
    };
}
