const https = require('https');

https.get('https://www.vakantiediscounter.nl/', (res) => {
  console.log('Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
