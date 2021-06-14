/**
 * June 9, 2021
 *
 * based on project at https://www.benlcollins.com/apps-script/nest-thermostat/
 *
 */

/**
 * download the latest weather conditions
 */
async function getStation(stationCode) {
  let data = new Object();
  try {
    const url = 'https://api.weather.gov/stations/' + stationCode + '/observations/latest';
    const response = await UrlFetchApp.fetch(url);
    const weatherData = JSON.parse(response.getContentText());
    // Logger.log(weatherData.properties);
    data['textDescription'] = weatherData['properties']['textDescription'];
    data['temperatureC'] = weatherData['properties']['temperature']['value'];
    data['dewpointC'] = weatherData['properties']['dewpoint']['value'];
    data['windDirection'] = weatherData['properties']['windDirection']['value'];
    data['windSpeed'] = weatherData['properties']['windSpeed']['value'];
    data['barometricPressure'] = weatherData['properties']['barometricPressure']['value'];
    data['seaLevelPressure'] = weatherData['properties']['seaLevelPressure']['value'];
    data['visibility'] = weatherData['properties']['visibility']['value'];
    data['relativeHumidity'] = weatherData['properties']['relativeHumidity']['value'];
    data['windChill'] = weatherData['properties']['windChill']['value'];
  }
  catch (e) {
    Logger.log('Error: ' + e);
  }
  // Logger.log(stationCode + ' weather: ' + JSON.stringify(data));
  return data;
}

/**
 * average results from two nearby stations
 * N.B. - not all weather data fields make sense to combine!
 */
async function getWeather() {
  let w1_promise = getStation(PRIMARY_WEATHER_STATION);
  let w2_promise = getStation(SECONDARY_WEATHER_STATION);
  const async_data = await Promise.all([w1_promise, w2_promise])
  const w1 = async_data[0]
  const w2 = async_data[1]

  // overwrite w1 with average value when possible
  function maybeAverage(p) {
    if ((typeof w1[p] === 'number') && (typeof w2[p] === 'number')) {
      if (p === 'windDirection') {
        w1s = w1['windSpeed'];
        w2s = w2['windSpeed'];
        // use a vector average for wind
        let x = (w1s * Math.cos(w1[p] * Math.PI / 180) + w2s * Math.cos(w2[p]* Math.PI / 180)) / 2.0;
        let y = (w1s * Math.sin(w1[p] * Math.PI / 180) + w2s * Math.sin(w2[p]* Math.PI / 180)) / 2.0;
        w1[p] = 180 / Math.PI * Math.atan2(y,x);
        if (w1[p] < 0) {
          w1[p] += 360;
        }
        w1['windSpeed'] = Math.sqrt(x*x + y*y);
      }
      else if (p !== 'windSpeed') { // set by vector average
        w1[p] = (w1[p] + w2[p]) / 2.0;
      }
    }
  }

  for (const p in w1) {
    if (w1.hasOwnProperty(p)) {
      maybeAverage(p);
    }
    else {
      // if data is missing from the primary station, try to get from secondary
      w1[p] = w2[p];
    }
  }
  // Logger.log('Weather: ' + JSON.stringify(w1));
  return w1;
}

/**
 * download the latest thermostat data
 */
async function getThermostat() {
  let data = new Object();
  try {
    // setup the SMD API URL, headers, and params
    const url = 'https://smartdevicemanagement.googleapis.com/v1';
    const endpoint = '/enterprises/' + PROJECT_ID + '/devices';
    const headers = {
      'Authorization': 'Bearer ' + getService().getAccessToken(),
      'Content-Type': 'application/json'
    }
    const params = {
      'headers': headers,
      'method': 'get',
      'muteHttpExceptions': true
    }
    // url fetch to call api
    const response = await UrlFetchApp.fetch(url + endpoint, params);
    const nestData = JSON.parse(response.getContentText());

    // I have only one Nest device so I don't need to hunt for it
    const thermostatData = nestData['devices'][0]['traits'];

    data['info'] = thermostatData["sdm.devices.traits.Info"]
    data['humidity'] = thermostatData["sdm.devices.traits.Humidity"];
    data['connectivity'] = thermostatData["sdm.devices.traits.Connectivity"];
    data['fan'] = thermostatData["sdm.devices.traits.Fan"];
    data['thermostatMode'] = thermostatData["sdm.devices.traits.ThermostatMode"];
    data['thermostatEco'] = thermostatData["sdm.devices.traits.ThermostatEco"];
    data['thermostatHvac'] = thermostatData["sdm.devices.traits.ThermostatHvac"];
    data['thermostatTemperatureSetpoint'] = thermostatData["sdm.devices.traits.ThermostatTemperatureSetpoint"];
    data['temperature'] = thermostatData["sdm.devices.traits.Temperature"];

  }
  catch (e) {
    Logger.log('Error: ' + e);
  }
  // Logger.log('Thermostat: ' + JSON.stringify(data));
  return data;
}

/**
 * collect the data we care about to record on our spreadsheet
 */
async function measure() {
  function convertCtoF(tempC) {
    // weather api sometimes returns null
    return (typeof tempC === 'number') ? tempC * 1.8 + 32.0 : tempC;
  }

  let thermostat_promise = getThermostat();
  let weather_promise = getWeather();
  const async_data = await Promise.all([thermostat_promise, weather_promise])
  const thermostat = async_data[0]
  const weather = async_data[1]

  // setpoints depend on mode
  let cooling_setpoint = 0;
  let heating_setpoint = 0;
  let eco_off = (thermostat['thermostatEco']['mode'] === 'OFF');
  if ( thermostat['thermostatMode']['mode'] === 'COOL' || thermostat['thermostatMode']['mode'] === 'HEATCOOL') {
    cooling_setpoint = eco_off ? convertCtoF(thermostat['thermostatTemperatureSetpoint']['coolCelsius']) : convertCtoF(thermostat['thermostatEco']['coolCelsius']);
  }
  if ( thermostat['thermostatMode']['mode'] === 'HEAT' || thermostat['thermostatMode']['mode'] === 'HEATCOOL') {
    heating_setpoint = eco_off ? convertCtoF(thermostat['thermostatTemperatureSetpoint']['heatCelsius']) : convertCtoF(thermostat['thermostatEco']['heatCelsius']);
  }

  let data = [];
  data.push(
    new Date(),
    convertCtoF(thermostat['temperature']['ambientTemperatureCelsius']),
    convertCtoF(weather['temperatureC']),
    ((thermostat['thermostatHvac']['status'] === 'COOLING') ? 73 : ((thermostat['thermostatHvac']['status'] === 'HEATING') ? 72 : 0)),
    thermostat['humidity']['ambientHumidityPercent'],
    weather['relativeHumidity'],
    thermostat['thermostatHvac']['status'],
    thermostat['connectivity']['status'],
    thermostat['thermostatMode']['mode'],
    thermostat['thermostatEco']['mode'],
    cooling_setpoint,
    heating_setpoint
  );
  // Logger.log('measurement: ' + JSON.stringify(data));
  return data;
}

/**
 * grab all data and write a new row to our spreadsheet
 */
async function logMeasurement() {
  try {
    let startDate = new Date();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('thermostatLogs');

     // add header if needed
    if ( sheet.getLastRow() == 0 ) {
      headers = [
        'Time',
        'Inside Temperature',
        'Outside Temperature',
        'Cooling',
        'Inside Humidity',
        'Outside Humidity',
        'HVAC status',
        'Nest status',
        'HVAC Mode',
        'Nest Eco Mode',
        'Cooling Setpoint',
        'Heating Setpoint'
      ];
      sheet.getRange(sheet.getLastRow()+1, 1, 1, headers.length).setValues([headers]);
    }

    data = await measure();
    sheet.getRange(sheet.getLastRow()+1, 1, 1, data.length).setValues([data]);
    let endDate = new Date();
    let duration_msec = endDate.getTime() - startDate.getTime();
    Logger.log('success! runtime in milliseconds was: ' + duration_msec);
  }
  catch(e) {
    Logger.log('Error: ' + e);
  }
}
