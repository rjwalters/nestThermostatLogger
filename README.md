# Nest Thermostat Logger

Project to log data from Google Nest thermostats into a Google Sheet, using the Smart Device Management (SDM) API and Apps Script. It also uses the weather.gov API to add local weather data.

The SDM API was launched in September 2020 ([read more](https://developers.googleblog.com/2020/09/google-nest-device-access-console.html)).

# Changes in this fork

* collects slightly different data
* assumes only one thermostat
* gets oauth token from accounts.google.com rather than nestservices.google.com
* async data collection 
* averages weather data from two local stations

# Setup

Follow the steps in this [Get Started](https://developers.google.com/nest/device-access/get-started) guide from Google to access your device(s).

**Note:** there is a one-time, non-refundable $5 charge to access the API.

The project must be created in the same Google account that owns the Nest devices.

You will need to create a project in your [Google Cloud console](https://console.cloud.google.com/), where you can get OAuth ID and secret.

This project uses the [OAuth2 Apps Script library](https://github.com/googleworkspace/apps-script-oauth2).

Tutorial setup details on [https://www.benlcollins.com/apps-script/nest-thermostat/](https://www.benlcollins.com/apps-script/nest-thermostat/)

I had trouble getting setting up permissions in oauth and managed to get it to work by running the `logRedirectUri()` function within Apps Script.

