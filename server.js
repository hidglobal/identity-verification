require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const path = require('path');
const ua_parser = require('ua-parser-js');
const qr = require('qrcode');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

const onboard = new Map();

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.post('/register', (req, res) => {
  console.log('Starting registration for ' + JSON.stringify(req.body));
  console.log('Session: ' + req.cookies.sessionID);
  const accountCode = req.body.account || '9999';
  let environment = '';
  switch (accountCode.substring(0, 1)) {
    case '1':
      environment = 'TEST';
      break;
    case '9':
      environment = 'PRESALES';
      break;
    default:
      environment = 'TCUSTF';
      break;
  }
  console.log(`Using ${environment} environment`);
  fetch(process.env.IDV_ENDPOINT + '/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: process.env[`IDV_${environment}_ID`],
      password: process.env[`IDV_${environment}_SECRET`]
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
          redirectURL: process.env.BASE_URL + '/continue/' + req.cookies.sessionID
        })
      })
        .then((response) => response.json())
        .then((data) => {
          console.log(`Redirecting request ${data.requestID}`)
          onboard.set(data.requestID, {session: req.cookies.sessionID});
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
  if (req.body.requestStatus === 'EXPIRED') {
    onboard.delete(req.body.requestID);
  } else if (req.body.requestStatus === 'SUCCESS') {
    let update = onboard.get(req.body.requestID);
    update.transaction = req.body.transactions[req.body.transactions.length - 1];
    onboard.set(req.body.requestID, update);
  }
  req.body.transactions.forEach((transaction) => {
    console.log(`  Seq: ${transaction.sequenceNumber} - ${transaction.transactionStatus}`);
    console.log(`  pii: ${JSON.stringify(Object.keys(transaction.pii))}`);
  });
  res.send('OK');
});

app.get('/continue/:session', (req, res) => {
  console.log(`Continue after IDV for session ${req.params.session}`);
  onboard.forEach((value, key) => {
    if (value.session === req.params.session) {
      console.log(`  Found request ${key}`);
      let update = onboard.get(key);
      if (typeof(update.transaction) !== 'undefined') {
        let pii = update.transaction.pii;
        res.send(`<html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <link rel="stylesheet" href="/css/styles.css">
                      <title>HID Identity Verification</title>
                    </head>
                    <body>
                      <div class="page page--full-width">
                        <main class="page__content">
                          <div class="region region--content">
                            <section class="section section--layout-onecol">
                              <h2>Welcome ${pii.DQL_Final_FirstName_Result.charAt(0).toUpperCase() + pii.DQL_Final_FirstName_Result.slice(1).toLowerCase()}</h2>
                              <img width="250" height="350" src="data:image/jpeg;base64,${pii.imageSelfie}" alt="Selfie">
                              <p>Your ${pii.DQL_Classification_DocumentName} number <strong>${pii.DQL_Final_DocumentNumber_Result}</strong> from ${pii.DQL_Classification_DocumentIssuerCountryCode} has been accepted</p>
                            </section>
                          </div>
                        </main>
                      </div>
                    </body>
                  </html>`);
        onboard.delete(key);
      } else {
        res.send(`<html><head><link rel="stylesheet" href="/css/styles.css"></head><body><h2>Complete</h2><p>Thanks for your submission</p></body></html>`);
      }
    }
  });
});

app.get('/*', (req, res) => {
  res.cookie('sessionID', crypto.randomUUID());
  res.sendFile(path.join(__dirname, '/public/index.html'));
});

app.listen(port, () => console.log(`Customer Journey listening on port ${port}!`));