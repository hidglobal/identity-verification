const express = require('express');
const { access } = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded());
app.use(express.json());
app.use(express.static('public'));

app.post('/register', (req, res) => {
  console.log('Starting registration for ' + JSON.stringify(req.body));
  fetch(process.env.IDV_ENDPOINT + '/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: process.env.IDV_CLIENT_ID,
      password: process.env.IDV_CLIENT_SECRET
    })
  })
    .then((response) => response.json())
    .then((data) => {
      let access_token = data.jwt;
      console.log('We have an access token: ' + (access_token !== undefined))
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
            frontOverlayTextAuto: 'Alinéa tu credential y sosténla en el recuadro',
            backCaptureMode: 'Auto',
            selfieCaptureMode: 'Auto',
            enableSelfieCapture: true,
            enableFarSelfie: false,
            enableLocationDetection: true,
            backIsBarcodeDetectedEnabled: false,
            customColor: '#FF0000'
          },
          channelResponse: [
            'AddressCity',
            'AddressPostalCode',
            'BirthDate',
            'DocumentNumber',
            'PIISource',
            'SELFIE_MATCHSCORE',
            'IMAGE_SELFIE',
            'HideTransactionDetails',
            'HidePassIDEThreshold',
            'HideFailIDEThreshold',
            'HideUncertainIDEThreshold'
          ],
          transactionDetails: {
            accountCode: '123456'
          },
          postbackURL: process.env.BASE_URL + '/postback',
          redirectURL: process.env.BASE_URL + '/continue'
        })
      })
        .then((response) => response.json())
        .then((data) => {
          res.redirect(301, data.url)
        })
    });
});

app.post('/postback', (req, res) => {
  console.log('Posted back:\n' + JSON.stringify(req.body, null, 2));
  res.status(200).send('Welcome');
});

app.get('/continue', (req, res) => {
  console.log('Continue after IDV');
  res.send('<h1>Great</h1><p>Thanks for your submission</p>')
});

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/index.html'));
});

app.listen(port, () => console.log(`Customer Journey listening on port ${port}!`));