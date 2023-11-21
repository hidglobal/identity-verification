# HID Identity Verification

This is a minimal demonstration to integrate HID Identity Verification into a web application.

You will need to define some variables either in your environment or in an `.env` file. Note that you must replace `${env}` with the environment you are using (e.g. `PRESALES`, `TEST`, `TCUSTOMERF`).

```
BASE_URL= The URL where your application is running
IDV_ENDPOINT= The endpoint for the HID Identity Verification API
IDV_${env}_ID= Your client ID (your IDV user account)
IDV_${env}_SECRET= Your client secret
```