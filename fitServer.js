const { google } = require('google-auth-library');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const http = require('http');
const url = require('url');

const CLIENT_ID = '';
const CLIENT_SECRET = '';
const REDIRECT_URI = 'http://localhost:8080/redirect';


const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read'
  ],
});
console.log('Authorize this app by visiting this url:', authUrl);

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/redirect')) {
    const queryObject = url.parse(req.url, true).query;
    const code = queryObject.code;
    if (code) {
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        try {
          const response = await axios.get('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
            },
          });

          // 현재 시간 및 1일 전의 시간을 밀리초로 얻기
          const currentTimeMillis = new Date().getTime();
          const oneDayInMillis = 86400000; // 24 * 60 * 60 * 1000
          const startTimeMillis = currentTimeMillis - oneDayInMillis;
          const endTimeMillis = currentTimeMillis;

          // 심박수 데이터 요청
          const heartRateResponse = await axios.post(
            'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
            {
              aggregateBy: [
                {
                  dataTypeName: 'com.google.heart_rate.bpm',
                },
              ],
              bucketByTime: { durationMillis: oneDayInMillis },
              startTimeMillis: startTimeMillis,
              endTimeMillis: endTimeMillis,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokens.access_token}`,
              },
            }
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ fitnessData: response.data, heartRateData: heartRateResponse.data }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error fetching fitness data: ' + (error.response ? error.response.data : error.message));
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error getting tokens: ' + error.message);
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('No code provided in redirect URI');
    }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World!\n');
  }
});

server.listen(8080, () => {
  console.log('Server running at http://localhost:8080/');
});
