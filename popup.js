document.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('runCheckBtn');
    const placeholder = document.getElementById('placeholder');
    const loading = document.getElementById('loading');
    const resultsContainer = document.getElementById('results');
    const testUrl = document.getElementById('testUrl');
    const sectionsContainer = document.getElementById('sectionsContainer');

    function checkState() {
        chrome.storage.local.get(['pendingCheck', 'lastTestResults'], (data) => {
            if (data.pendingCheck) {
                showLoading();
            } else if (data.lastTestResults) {
                showResults(data.lastTestResults);
            } else {
                showPlaceholder();
            }
        });
    }

    // Listen for storage changes to update UI in real-time
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.lastTestResults) {
            showResults(changes.lastTestResults.newValue);
        }
    });


    function showLoading() {
        placeholder.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        loading.classList.remove('hidden');
        runBtn.disabled = true;
    }

    function showPlaceholder() {
        loading.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
        runBtn.disabled = false;
    }

    function showResults(data) {
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
                
                let status = 'warning';
                let debug = 'Waiting for consent...';
                
                if (wasTrueOnLoad) {
                    status = 'fail';
                    debug = 'Consent was already granted on load (GDPR risk)';
                } else if (isCurrentlyTrue) {
                    status = 'pass';
                    debug = `Consent granted correctly after ${timeTaken}s`;
                }

                
                return {
                    status,
                    text: test.text,
                    debug
                };
            });
            
            sectionsContainer.appendChild(createSection('Legal Consent Check', consentTests, item => item.text, item => item.status, item => item.debug));
        }


        // 2. API Data
        if (data.apiData && data.apiData.length > 0) {
            sectionsContainer.appendChild(createSection('Kameleoon API', data.apiData, item => item.message, item => item.pass ? 'pass' : 'fail', item => ''));
        }

        // 3. DOM Tests
        if (data.domData && data.domData.length > 0) {
            sectionsContainer.appendChild(createSection('DOM Implementation', data.domData, 
                item => item.pass ? item.pass : item.fail, 
                item => item.test ? 'pass' : (item.warning ? 'warning' : 'fail'), 
                item => item.debug || ''
            ));
        }

        // 4. Performance
        if (data.performanceData) {
            const perfTests = [
                {
                    pass: data.performanceData.duration < 1000,
                    text: `engine.js loaded in ${data.performanceData.duration}ms`,
                    debug: data.performanceData.duration >= 1000 ? 'Performance is suboptimal (>1000ms)' : ''
                }
            ];
            sectionsContainer.appendChild(createSection('Performance', perfTests, item => item.text, item => item.pass ? 'pass' : 'warning', item => item.debug));
        }

        // 5. CSP
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
                        debug: debugMsg
                    };
                });
                sectionsContainer.appendChild(createSection('CSP Configuration', cspTests, item => item.text, item => item.pass ? 'pass' : 'fail', item => item.debug));
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

    function createSection(title, items, getText, getStatus, getDebug) {
        const section = document.createElement('div');
        section.className = 'section';
        
        const header = document.createElement('div');
        header.className = 'section-header';
        header.textContent = title;
        section.appendChild(header);

        const list = document.createElement('div');
        list.className = 'test-list';

        items.forEach(item => {
            const status = getStatus(item); // Expects 'pass', 'fail', or 'warning'
            const testDiv = document.createElement('div');
            testDiv.className = 'test-item';

            let icon = '';
            if (status === 'pass') icon = getPassIcon();
            else if (status === 'fail') icon = getFailIcon();
            else if (status === 'warning') icon = getWarningIcon();

            testDiv.innerHTML = `
                <div class="test-icon ${status}">
                    ${icon}
                </div>
                <div class="test-content">
                    <div class="test-title">${getText(item)}</div>
                    ${getDebug(item) ? `<div class="test-debug">${getDebug(item)}</div>` : ''}
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
        if (!loading.classList.contains('hidden')) {
            chrome.storage.local.get(['pendingCheck', 'lastTestResults'], (data) => {
                if (!data.pendingCheck && data.lastTestResults) {
                    showResults(data.lastTestResults);
                }
            });
        }
    }, 1000);

    // Initial check
    checkState();
});
