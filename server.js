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
  console.log(req.body);
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
      console.log('access_token = ' + access_token);
      fetch(process.env.IDV_ENDPOINT + '/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + access_token
        },
        body: JSON.stringify({
          channel: 'URL',
          channelConfiguration: {
            frontCaptureMode: 'Auto',
            backCaptureMode: 'Auto',
            selfieCaptureMode: 'Auto',
            enableSelfieCapture: true,
            enableFarSelfie: false,
            transactionAttempts: 3,
            frontCaptureAttempt: 3,
            backCaptureAttempt: 3,
            enableLocationDetection: true,
            requestExpiryTimeInMin: 1440,
            transactionExpiryTimeInIm: 1440
          },
          transactionDetails: {
            accountCode: '123456'
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
          ]
        })
      })
        .then((response) => response.json())
        .then((data) => {
          res.redirect(301, data.url)
        })
    });
});

app.post('/onboard', (req, res) => {
  console.log(req.body);
  res.status(200).send('Welcome');
});

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/index.html'));
});

app.listen(port, () => console.log(`Customer Journey listening on port ${port}!`));