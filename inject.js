// This script is injected into the main world to access `window.Kameleoon`
(function() {
    const results = [];
    
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

    let apiDataSent = false;
    function pollKameleoonApi() {
        if (apiDataSent) return;

        const apiResults = checkKameleoonApi();
        if (apiResults) {
            window.postMessage({
                type: 'KAMELEOON_API_DATA',
                payload: apiResults
            }, '*');
            apiDataSent = true;
        }
    }

    // Consent monitoring logic
    let firstCheck = true;
    const loadTime = Date.now();
    let lastConsent = {
        experiment: null,
        personalization: null,
        recommendation: null
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
            firstCheck = false;
        }

        // Record time if newly granted
        ['experiment', 'personalization', 'recommendation'].forEach(key => {
            if (current[key] && !lastConsent[key] && !wasTrueOnLoad[key]) {
                consentTimes[key] = Math.round((Date.now() - loadTime) / 1000);
            }
        });

        return current;
    }

    function sendConsentUpdate() {
        const currentConsent = getConsentData();
        
        // Only send if changed or it's the first check
        if (currentConsent.experiment !== lastConsent.experiment || 
            currentConsent.personalization !== lastConsent.personalization || 
            currentConsent.recommendation !== lastConsent.recommendation) {
            
            lastConsent = { ...currentConsent };
            
            window.postMessage({
                type: 'KAMELEOON_CONSENT_DATA',
                payload: {
                    current: currentConsent,
                    wasTrueOnLoad: wasTrueOnLoad,
                    consentTimes: consentTimes
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

