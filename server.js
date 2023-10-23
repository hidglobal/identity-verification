const express = require('express');
const path = require('path');
const ua_parser = require('ua-parser-js');
const qr = require('qrcode');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.post('/register', (req, res) => {
  console.log('Starting registration for ' + JSON.stringify(req.body));
  const accountCode = req.body.account || '9999';
  console.log(accountCode);
  fetch(process.env.IDV_ENDPOINT + '/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: accountCode === '9999' ? process.env.IDV_CLIENT_ID : process.env.IDV_TCUSTF_ID,
      password: accountCode === '9999' ? process.env.IDV_CLIENT_SECRET : process.env.IDV_TCUSTF_SECRET
    })
  })
    .then((response) => response.json())
    .then((data) => {
      let access_token = data.jwt;
      if (typeof(access_token) === 'undefined') {
        console.log('Error: ' + JSON.stringify(data));
        res.status(500).send('Server is not configured correctly');
        return;
      }
      fetch(process.env.IDV_ENDPOINT + '/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + access_token
        },
        body: JSON.stringify({
          channel: 'URL',
          channelConfiguration: {
            requestExpiryTimeInMin: 1440,
            transactionExpiryTimeInIm: 1440,
            transactionAttempts: 3,
            frontCaptureAttempt: 3,
            backCaptureAttempt: 3,
            frontCaptureMode: 'Auto',
            backCaptureMode: 'Auto',
            backOverlayTextAuto: 'Align the back of your ID with the frame&#10;and wait for the scan to complete.',
            selfieCaptureMode: 'Auto',
            enableSelfieCapture: true,
            enableFarSelfie: false,
            enableLocationDetection: true,
            backIsBarcodeDetectedEnabled: false,
            customColor: '#FF0000'
          },
          channelResponse: [
            'DQL_Classification_DocumentIssuerCountryCode',
            'DQL_Classification_DocumentName',
            'DQL_Final_DocumentNumber_Result',
            'DQL_Final_ExpirationDate_Result',
            'DQL_Final_FirstName_Result',
            'DQL_Final_Surname_Result',
            'ImageSelfie',
            'HideTransactionDetails',
            'HidePassIDEThreshold',
            'HideFailIDEThreshold',
            'HideUncertainIDEThreshold'
          ],
          transactionDetails: {
            accountCode: accountCode
          },
          postbackURL: process.env.BASE_URL + '/postback',
          redirectURL: process.env.BASE_URL + '/continue'
        })
      })
        .then((response) => response.json())
        .then((data) => {
          console.log(`Redirecting request ${data.requestID}`)
          let ua = ua_parser(req.headers['user-agent']);
          if (ua.device.type !== 'mobile') {
            qr.toDataURL(data.url, { errorCorrectionLevel: 'H' }, (err, url) => {
              res.send(`<html><head><link rel="stylesheet" href="/css/styles.css"></head><body><h2>Register</h2><p>Scan the QR code with your mobile device to continue</p><img src="${url}"></body></html>`);
            });
          } else {
            res.redirect(302, data.url);
          }
        })
    });
});

app.post('/postback', (req, res) => {
  console.log('Update for request ' + req.body.requestID + ' (' + req.body.requestStatus + ')');
  req.body.transactions.forEach((transaction) => {
    console.log(`  Seq: ${transaction.sequenceNumber} - ${transaction.transactionStatus}`);
    console.log(`  pii: ${JSON.stringify(Object.keys(transaction.pii))}`);
  });
  res.send('OK');
});

app.get('/continue', (req, res) => {
  console.log('Continue after IDV');
  console.log(req.body);
  res.send('<html><head><link rel="stylesheet" href="/css/styles.css"></head><body><h2>Complete</h2><p>Thanks for your submission</p></body></html>')
});

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/index.html'));
});

app.listen(port, () => console.log(`Customer Journey listening on port ${port}!`));