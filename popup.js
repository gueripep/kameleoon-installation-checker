document.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('runCheckBtn');
    const placeholder = document.getElementById('placeholder');
    const loading = document.getElementById('loading');
    const resultsContainer = document.getElementById('results');
    const testUrl = document.getElementById('testUrl');
    const sectionsContainer = document.getElementById('sectionsContainer');
    const searchingStatus = document.getElementById('searchingStatus');
    const loadingText = document.getElementById('loadingText');

    let currentTabId = null;

    function checkState() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (!currentTab) return;
            
            currentTabId = currentTab.id;
            let currentOrigin = null;
            if (currentTab?.url) {
                try {
                    currentOrigin = new URL(currentTab.url).origin;
                } catch (e) {}
            }

            const pendingKey = `pending_${currentTabId}`;
            const timestampKey = `timestamp_${currentTabId}`;
            const resultsKey = `results_${currentTabId}`;

            chrome.storage.local.get([pendingKey, timestampKey, resultsKey], (data) => {
                const now = Date.now();
                const pendingCheck = data[pendingKey];
                const checkTimestamp = data[timestampKey];
                const lastTestResults = data[resultsKey];

                // Consider a check stale if it's older than 2 minutes
                const isStale = checkTimestamp && (now - checkTimestamp) > 120000;

                if (pendingCheck && !isStale && pendingCheck === currentOrigin) {
                    showLoading(checkTimestamp);
                } else {
                    // If we were showing a pending check but it's stale or mismatched, clear it
                    if (pendingCheck && (isStale || pendingCheck !== currentOrigin)) {
                        chrome.storage.local.remove([pendingKey, timestampKey]);
                    }
                    
                    if (lastTestResults) {
                        showResults(lastTestResults);
                    } else {
                        showPlaceholder();
                    }
                }
            });
        });
    }

    // Listen for storage changes to update UI in real-time
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && currentTabId) {
            const resultsKey = `results_${currentTabId}`;
            const pendingKey = `pending_${currentTabId}`;

            if (changes[resultsKey] && changes[resultsKey].newValue) {
                showResults(changes[resultsKey].newValue);
            }
            if (changes[pendingKey] && !changes[pendingKey].newValue && !resultsContainer.classList.contains('hidden')) {
                // Pending finished
            }
        }
    });


    let loadingInterval = null;
    function showLoading(startTime) {
        placeholder.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        loading.classList.remove('hidden');
        runBtn.disabled = true;

        if (loadingInterval) clearInterval(loadingInterval);

        loadingInterval = setInterval(() => {
            const now = Date.now();
            const start = startTime || now;
            const elapsed = Math.floor((now - start) / 1000);

            if (elapsed > 1.5) {
                loadingText.textContent = "Scanning page...";
                searchingStatus.textContent = `Searching for Kameleoon engine (${elapsed}s elapsed)...`;
            } else {
                loadingText.textContent = "Clearing data & reloading...";
                searchingStatus.textContent = "";
            }

            // Safety check: if pendingCheck is gone, stop interval
            if (currentTabId) {
                const pendingKey = `pending_${currentTabId}`;
                chrome.storage.local.get([pendingKey], (data) => {
                    if (!data[pendingKey]) {
                        clearInterval(loadingInterval);
                    }
                });
            }
        }, 1000);
    }

    function showPlaceholder() {
        if (loadingInterval) clearInterval(loadingInterval);
        loading.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
        runBtn.disabled = false;
    }

    function showResults(data) {
        if (!data) return;

        if (loadingInterval) clearInterval(loadingInterval);
        loading.classList.add('hidden');
        placeholder.classList.add('hidden');
        resultsContainer.classList.remove('hidden');
        runBtn.disabled = false;

        testUrl.textContent = data.url;

        sectionsContainer.innerHTML = ''; // Clear previous

        // 1. Legal Consent (Now at the top)
        if (data.consentData) {
            const consentTests = [
                {
                    key: 'experiment',
                    text: 'Experiment Legal Consent'
                },
                {
                    key: 'personalization',
                    text: 'Personalization Legal Consent'
                },
                {
                    key: 'recommendation',
                    text: 'Product Recommendation Legal Consent'
                }
            ].map(test => {
                const isCurrentlyTrue = data.consentData.current[test.key];
                const wasTrueOnLoad = data.consentData.wasTrueOnLoad[test.key];
                const timeTaken = data.consentData.consentTimes[test.key];

                let status = test.key === 'recommendation' ? 'neutral' : 'warning';
                let debug = test.key === 'recommendation'
                    ? 'Waiting for consent... (optional module, only relevant if you use Product Recommendation)'
                    : 'Waiting for consent...';

                let docs = null;

                if (wasTrueOnLoad) {
                    status = 'warning';
                    debug = 'Consent was already granted on load (GDPR risk in opt-in jurisdictions; legal in opt-out ones like the US)';
                    docs = 'https://docs.kameleoon.com/developer-docs/privacy-and-compliance/consent-management';
                } else if (isCurrentlyTrue) {
                    status = 'pass';
                    debug = `Consent granted correctly after ${timeTaken}s`;
                }


                return {
                    status,
                    text: test.text,
                    debug,
                    docs
                };
            });

            sectionsContainer.appendChild(createSection('Legal Consent Check', consentTests, item => item.text, item => item.status, item => item.debug, item => item.docs));
        }

        // 2. ITP Workaround (Moved up)
        let itpStatus = 'warning';
        let itpDebug = 'The kameleoonVisitorCode was NOT detected in any Set-Cookie headers. This may cause cookie expiration issues in Safari.';

        const isFreshReport = (Date.now() - data.timestamp) < 10000;

        if (data.itpData) {
            if (data.itpData.status === 'privacy_risk') {
                itpStatus = 'fail';
                itpDebug = 'Privacy Risk: The cookie was set on the initial page load BEFORE consent was provided. This is a GDPR/Privacy compliance issue.';
            } else if (data.itpData.status === 'compliant') {
                itpStatus = 'pass';
                itpDebug = 'The kameleoonVisitorCode was successfully detected in Set-Cookie headers and is compliant with consent requirements.';
            }
        } else if (isFreshReport) {
            itpDebug = 'Checking for a server-set kameleoonVisitorCode cookie (Set-Cookie header)...';
        }

        const itpTests = [
            {
                status: itpStatus,
                text: 'ITP Workaround (Set-Cookie)',
                debug: itpDebug,
                docs: 'https://docs.kameleoon.com/developer-docs/web-experimentation/technical-concepts/itp-management'
            }
        ];

        // Add JS Cookie Access check
        if (data.consentData?.cookieData) {
            const wasTrueOnLoad = data.consentData.wasTrueOnLoad || {};
            const anyConsentGrantedOnLoad = wasTrueOnLoad.experiment || wasTrueOnLoad.personalization || wasTrueOnLoad.recommendation;

            if (!anyConsentGrantedOnLoad) {
                const cookieData = data.consentData.cookieData;
                const anyConsentNow = data.consentData.current.experiment || data.consentData.current.personalization || data.consentData.current.recommendation;
                let cookieStatus = 'warning';
                let cookieDebug = 'Waiting for consent...';

                // Once the cookie becomes accessible, give consent a 2s grace
                // window to show up before treating the lack of it as a real
                // privacy risk — this avoids flagging normal banner/init timing.
                const WAIT_MS = 2000;

                if (cookieData.currentlyFound) {
                    const timeSinceCookieFound = cookieData.foundAtTimestamp ? (Date.now() - cookieData.foundAtTimestamp) : Infinity;

                    if (timeSinceCookieFound < WAIT_MS) {
                        cookieStatus = 'warning';
                        cookieDebug = 'Cookie is accessible — confirming consent timing...';
                        // Re-render once the 2s grace window has passed
                        setTimeout(() => {
                            if (currentTabId) {
                                const resultsKey = `results_${currentTabId}`;
                                chrome.storage.local.get([resultsKey], (res) => {
                                    if (res[resultsKey]) showResults(res[resultsKey]);
                                });
                            }
                        }, WAIT_MS - timeSinceCookieFound + 100);
                    } else if (!anyConsentNow) {
                        cookieStatus = 'fail';
                        cookieDebug = `Privacy Risk: Cookie is accessible in JS with no consent granted for Experiment, Personalization, or Product Recommendation — the backend is very likely sending the cookie before consent.`;
                    } else {
                        cookieStatus = 'pass';
                        cookieDebug = `Cookie became accessible in JS after ${cookieData.foundAtTime}s (Compliant)`;
                    }
                } else if (anyConsentNow) {
                    cookieStatus = 'pass';
                    cookieDebug = 'No kameleoonVisitorCode cookies accessible in JavaScript (Expected if using HttpOnly ITP workaround)';
                }

                itpTests.push({
                    status: cookieStatus,
                    text: 'Cookie Access',
                    debug: cookieDebug,
                    docs: cookieStatus !== 'pass'
                        ? 'https://docs.kameleoon.com/developer-docs/web-experimentation/technical-concepts/itp-management'
                        : null
                });
            }
        }

        // Only show Single Cookie Check after consent and ITP compliance
        if (data.consentData?.current?.experiment && data.itpData?.status === 'compliant') {
            const consentTimestamp = data.consentData.consentTimestamps?.experiment;
            const now = Date.now();
            const timeSinceConsent = consentTimestamp ? (now - consentTimestamp) : Infinity;

            let cookieCountStatus = 'pass';
            let cookieCountDebug = 'Only one kameleoonVisitorCode cookie detected.';

            if (timeSinceConsent < 2000) {
                cookieCountStatus = 'warning';
                cookieCountDebug = 'Waiting for cookies to stabilize...';
                // Trigger a re-render once the delay has passed
                setTimeout(() => {
                    if (currentTabId) {
                        const resultsKey = `results_${currentTabId}`;
                        chrome.storage.local.get([resultsKey], (res) => {
                            if (res[resultsKey]) showResults(res[resultsKey]);
                        });
                    }
                }, 2000 - timeSinceConsent + 100);
            } else {
                const cookieCount = data.consentData.cookieData?.count || 0;
                if (cookieCount > 1) {
                    cookieCountStatus = 'fail';
                    cookieCountDebug = `Found ${cookieCount} kameleoonVisitorCode cookies! This creates a conflict and is usually caused by incorrect Set-Cookie Domain flags across subdomains.`;
                } else if (cookieCount === 0) {
                    cookieCountStatus = 'warning';
                    cookieCountDebug = 'No kameleoonVisitorCode cookies found in JavaScript. This is normal if the cookie is set with the HttpOnly flag.';
                }
            }

            itpTests.push({
                status: cookieCountStatus,
                text: 'Single Cookie Check',
                debug: cookieCountDebug
            });
        }

        sectionsContainer.appendChild(createSection('ITP Workaround', itpTests, item => item.text, item => item.status, item => item.debug, item => item.docs || null));

        // 3. API Data
        if (data.apiData && data.apiData.length > 0) {
            sectionsContainer.appendChild(createSection('Kameleoon API', data.apiData, item => item.message, item => item.pass ? 'pass' : 'fail', item => ''));
        }

        // 4. DOM Tests
        if (data.domData && data.domData.length > 0) {
            sectionsContainer.appendChild(createSection('DOM Implementation', data.domData,
                item => item.test ? item.pass : item.fail,
                item => item.test ? 'pass' : (item.warning ? 'warning' : 'fail'),
                item => item.debug || '',
                item => item.docs || null
            ));
        }

        // 5. Performance
        if (data.performanceData) {
            const perf = data.performanceData;
            const startedAt = perf.requestStart || perf.fetchStart || perf.startTime;
            const totalTime = Math.round(perf.responseEnd);
            const isFast = totalTime < 1000;

            const perfTests = [
                {
                    pass: isFast,
                    text: `engine.js ready at ${totalTime}ms`,
                    debug: `Started at ${startedAt}ms, Network duration: ${perf.duration}ms. ${!isFast ? 'Warning: Engine loaded too late (>1000ms).' : 'Fast engine initialization.'}`
                }
            ];

            if (perf.hasFetchPriority === false) {
                perfTests.push({
                    pass: isFast,
                    text: `${perf.scriptName} does not have fetchpriority="high" attribute`,
                    debug: isFast
                        ? `Non-issue: engine.js already loads in ${totalTime}ms (under 1s), so fetchpriority wouldn't meaningfully speed this up further.`
                        : `Adding fetchpriority="high" can help ${perf.scriptName} load faster given the current ${totalTime}ms load time.`,
                    docs: 'https://docs.kameleoon.com/developer-docs/web-experimentation/implementation-and-deployment/standard-implementation'
                });
            }

            sectionsContainer.appendChild(createSection('Performance', perfTests, item => item.text, item => item.pass ? 'pass' : 'warning', item => item.debug, item => item.docs || null));
        }

        // 6. CSP
        const CSP_DOCS_URL = 'https://docs.kameleoon.com/developer-docs/web-experimentation/faq#what-are-the-kameleoon-domains-that-i-need-to-whitelist';
        if (data.cspData) {
            if (data.cspData.noCsp) {
                const cspTests = [{ pass: true, text: 'No CSP detected on this page', debug: 'Site is not restricting resources via CSP.' }];
                sectionsContainer.appendChild(createSection('CSP Configuration', cspTests, item => item.text, item => item.pass ? 'pass' : 'fail', item => item.debug));
            } else if (data.cspData.results) {
                const cspTests = data.cspData.results.map(res => {
                    let debugMsg = 'All required domains whitelisted';
                    if (!res.pass && res.missing && res.missing.length > 0) {
                        const missingHtml = res.missing.map(m => `<li><strong>${m.domain}</strong>: ${m.description}</li>`).join('');
                        debugMsg = `Missing Rules:<ul class="csp-missing-list">${missingHtml}</ul>`;
                    }
                    return {
                        pass: res.pass,
                        text: `${res.directive}`,
                        docs: !res.pass ? CSP_DOCS_URL : null,
                        debug: debugMsg
                    };
                });
                sectionsContainer.appendChild(createSection('CSP Configuration', cspTests, item => item.text, item => item.pass ? 'pass' : 'fail', item => item.debug, item => item.docs || null));
            }
        }



    }

    function getPassIcon() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    }

    function getFailIcon() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    }

    function getWarningIcon() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"></path></svg>`;
    }

    function getNeutralIcon() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle></svg>`;
    }

    function createSection(title, items, getText, getStatus, getDebug, getDocs) {
        const section = document.createElement('div');
        section.className = 'section';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.textContent = title;
        section.appendChild(header);

        const list = document.createElement('div');
        list.className = 'test-list';

        items.forEach(item => {
            const status = getStatus(item); // Expects 'pass', 'fail', 'warning', or 'neutral'
            const testDiv = document.createElement('div');
            testDiv.className = 'test-item';

            let icon = '';
            if (status === 'pass') icon = getPassIcon();
            else if (status === 'fail') icon = getFailIcon();
            else if (status === 'warning') icon = getWarningIcon();
            else if (status === 'neutral') icon = getNeutralIcon();

            // Only surface a docs link when there's actually an issue to act on
            const docsUrl = getDocs && status !== 'pass' ? getDocs(item) : null;

            testDiv.innerHTML = `
                <div class="test-icon ${status}">
                    ${icon}
                </div>
                <div class="test-content">
                    <div class="test-title">${getText(item)}</div>
                    ${getDebug(item) ? `<div class="test-debug">${getDebug(item)}</div>` : ''}
                    ${docsUrl ? `<a class="test-doclink" href="${docsUrl}" target="_blank" rel="noopener noreferrer">View documentation →</a>` : ''}
                </div>
            `;
            list.appendChild(testDiv);
        });

        section.appendChild(list);
        return section;
    }


    runBtn.addEventListener('click', () => {
        showLoading();
        chrome.runtime.sendMessage({ action: 'run_clean_check' }, (response) => {
            if (!response || !response.success) {
                alert('Error starting check: ' + (response?.error || 'Unknown error'));
                showPlaceholder();
            } else {
                // The page will reload and the content script will handle the rest.
                // Popup might close automatically on reload if it's the active tab but to be safe:
                window.close();
            }
        });
    });

    // Check state every second while loading to auto-update when results hit storage
    setInterval(() => {
        if (!loading.classList.contains('hidden') && currentTabId) {
            const pendingKey = `pending_${currentTabId}`;
            const resultsKey = `results_${currentTabId}`;
            chrome.storage.local.get([pendingKey, resultsKey], (data) => {
                if (!data[pendingKey] && data[resultsKey]) {
                    showResults(data[resultsKey]);
                }
            });
        }
    }, 1000);

    // Initial check
    checkState();
});
