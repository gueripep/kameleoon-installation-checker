// This script is injected into the main world to access `window.Kameleoon`
(function() {
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

    // Send the data back to the content script
    window.postMessage({
        type: 'KAMELEOON_API_DATA',
        payload: results
    }, '*');
})();
