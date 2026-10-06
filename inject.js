// This script is injected into the main world to access `window.Kameleoon`
(function() {
    const results = [];

    // Bundled/hydration-sensitive implementations (e.g. Next.js) declare
    // `kameleoonLoadingTimeout` inside a compiled JS chunk rather than an inline
    // <script> tag, so it can't be found by scanning the DOM's script text.
    // These globals are set by the anti-flicker snippet regardless of where it
    // lives, and are left in place even after the timeout fires, so they act as
    // a runtime fallback signal that anti-flicker ran.
    const antiFlickerRuntime = {
        hasStartLoadTime: typeof window.kameleoonStartLoadTime !== 'undefined',
        hasQueue: Array.isArray(window.kameleoonQueue),
        hasDisplayPageFn: typeof window.kameleoonDisplayPage !== 'undefined',
        hasTimeoutHandle: typeof window.kameleoonDisplayPageTimeOut !== 'undefined'
    };

    function checkKameleoonApi() {
        if (!window.Kameleoon?.API?.Visitor?.code || !window.Kameleoon?.Internals?.configuration) {
            return false;
        }

        const apiResults = [];
        
        // Check if Kameleoon.API.Visitor.code is defined
        apiResults.push({ 
            pass: true, 
            message: 'Kameleoon.API.Visitor.code is defined' 
        });
        
        // Check if Kameleoon.Internals has configuration
        apiResults.push({ 
            pass: true, 
            message: 'Kameleoon.Internals.configuration is present' 
        });
        
        // Check if Kameleoon.Internals has runtime
        if (window.Kameleoon?.Internals?.runtime) {
            apiResults.push({ pass: true, message: 'Kameleoon.Internals.runtime is present' });
        } else if (window.Kameleoon?.Internals?.runtime === null) {
            apiResults.push({ pass: false, message: 'Kameleoon.Internals.runtime is null (check if project is activated in BO)' });
        } else {
            apiResults.push({ pass: false, message: 'Kameleoon.Internals.runtime is missing' });
        }

        return apiResults;
    }

    // An engine that loads but never finishes initializing (no visitor code, no
    // runtime) used to leave this poll running forever, so no KAMELEOON_API_DATA
    // ever reached the content script and the popup span its spinner with no
    // report. After STALL_TIMEOUT_MS we publish whatever state we can see, and
    // keep polling so a genuinely late initialization still overwrites it.
    // Kept below the content script's own 8s fallback so the richer report wins.
    const STALL_TIMEOUT_MS = 7000;
    const scriptStart = Date.now();
    let apiDataSent = false;
    let stalledReportSent = false;

    function registrableDomain(hostname) {
        const parts = hostname.split('.');
        return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
    }

    function buildStalledReport() {
        const visitor = window.Kameleoon?.API?.Visitor;
        const internals = window.Kameleoon?.Internals;
        const results = [];

        results.push(visitor?.code
            ? { pass: true, message: 'Kameleoon.API.Visitor.code is defined' }
            : { pass: false, message: 'Kameleoon.API.Visitor.code is never assigned - the engine loaded but did not finish initializing' });

        results.push(internals?.configuration
            ? { pass: true, message: 'Kameleoon.Internals.configuration is present' }
            : { pass: false, message: 'Kameleoon.Internals.configuration is missing' });

        results.push(internals?.runtime
            ? { pass: true, message: 'Kameleoon.Internals.runtime is present' }
            : { pass: false, message: 'Kameleoon.Internals.runtime is missing (the engine never reached the targeting stage)' });

        // Wide domain support hands the visitor code over through an iframe. When
        // that iframe is hosted on a different registrable domain than the page
        // (a staging/preview host, typically), the handshake can't complete and
        // the engine stalls in exactly this state.
        const iframeURL = window.kameleoonIframeURL;
        if (!visitor?.code && internals?.configuration?.useWideDomainSupport && iframeURL) {
            try {
                const iframeDomain = registrableDomain(new URL(iframeURL, location.href).hostname);
                if (iframeDomain !== registrableDomain(location.hostname)) {
                    results.push({
                        pass: false,
                        message: `Wide domain support iframe (${iframeURL}) is hosted on a different domain than this page - the visitor code handshake cannot complete here`
                    });
                }
            } catch (e) {}
        }

        return results;
    }

    function publishApiData(payload) {
        window.postMessage({ type: 'KAMELEOON_API_DATA', payload, antiFlickerRuntime }, '*');
    }

    function pollKameleoonApi() {
        if (apiDataSent) return;

        const apiResults = checkKameleoonApi();
        if (apiResults) {
            publishApiData(apiResults);
            apiDataSent = true;
            return;
        }

        // Only report a stall once the engine is actually on the page - a page
        // with no Kameleoon at all is the content script fallback's job.
        if (!stalledReportSent && window.Kameleoon && (Date.now() - scriptStart) >= STALL_TIMEOUT_MS) {
            stalledReportSent = true;
            publishApiData(buildStalledReport());
        }
    }

    // Consent monitoring logic
    let firstCheck = true;
    const loadTime = Date.now();
    let lastConsent = {
        experiment: null,
        personalization: null,
        recommendation: null,
        cookieFound: false,
        cookieCount: null,
        initialized: false
    };
    let wasTrueOnLoad = {
        experiment: false,
        personalization: false,
        recommendation: false
    };
    let consentTimes = {
        experiment: null,
        personalization: null,
        recommendation: null
    };
    let consentTimestamps = {
        experiment: null,
        personalization: null,
        recommendation: null
    };

    let cookieFoundOnLoad = false;
    let cookieCurrentlyFound = false;
    let cookieFoundAtTime = null;
    let cookieFoundAtTimestamp = null;
    let cookieCount = 0;

    function checkCookie() {
        const cookies = document.cookie.split(';');
        const visitorCookies = cookies.filter(c => c.trim().startsWith('kameleoonVisitorCode='));
        const found = visitorCookies.length > 0;
        cookieCount = visitorCookies.length;

        if (firstCheck) {
            cookieFoundOnLoad = found;
        }
        if (found && !cookieCurrentlyFound) {
            cookieFoundAtTime = Math.round((Date.now() - loadTime) / 1000);
            cookieFoundAtTimestamp = Date.now();
        }
        cookieCurrentlyFound = found;
        return found;
    }

    function getConsentData() {
        const visitor = window.Kameleoon?.API?.Visitor;
        const current = {
            experiment: !!visitor?.experimentLegalConsent,
            personalization: !!visitor?.personalizationLegalConsent,
            recommendation: !!visitor?.productRecommendationLegalConsent
        };

        if (firstCheck && visitor) {
            wasTrueOnLoad.experiment = current.experiment;
            wasTrueOnLoad.personalization = current.personalization;
            wasTrueOnLoad.recommendation = current.recommendation;
            // No need to set firstCheck = false here yet, we'll do it at the end of the loop iteration if needed
        }
        
        // Also check cookie
        checkCookie();

        if (firstCheck) {
            firstCheck = false;
        }

        // Record time if newly granted
        ['experiment', 'personalization', 'recommendation'].forEach(key => {
            if (current[key] && !lastConsent[key] && !wasTrueOnLoad[key]) {
                consentTimes[key] = Math.round((Date.now() - loadTime) / 1000);
                consentTimestamps[key] = Date.now();
            }
        });

        return current;
    }

    function sendConsentUpdate() {
        const currentConsent = getConsentData();
        
        // Only send if changed OR it's a cookie detection OR it's the very first report
        const consentChanged = currentConsent.experiment !== lastConsent.experiment || 
                              currentConsent.personalization !== lastConsent.personalization || 
                              currentConsent.recommendation !== lastConsent.recommendation ||
                              cookieCount !== lastConsent.cookieCount;
        
        // We always send the first one, then only on changes
        if (consentChanged || (cookieCurrentlyFound && !lastConsent.cookieFound) || !lastConsent.initialized) {
            
            lastConsent = { 
                ...currentConsent, 
                cookieFound: cookieCurrentlyFound,
                cookieCount: cookieCount,
                initialized: true
            };
            
            window.postMessage({
                type: 'KAMELEOON_CONSENT_DATA',
                payload: {
                    current: currentConsent,
                    wasTrueOnLoad: wasTrueOnLoad,
                    consentTimes: consentTimes,
                    consentTimestamps: consentTimestamps,
                    cookieData: {
                        foundOnLoad: cookieFoundOnLoad,
                        currentlyFound: cookieCurrentlyFound,
                        foundAtTime: cookieFoundAtTime,
                        foundAtTimestamp: cookieFoundAtTimestamp,
                        count: cookieCount
                    }
                }
            }, '*');
        }
    }

    // Initial check
    pollKameleoonApi();
    sendConsentUpdate();

    // Start polling
    setInterval(() => {
        pollKameleoonApi();
        sendConsentUpdate();
    }, 500);
})();

