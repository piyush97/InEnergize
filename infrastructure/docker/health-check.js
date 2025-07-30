#!/usr/bin/env node

/**
 * Universal Health Check Script for InErgize Services
 * Implements secure health checking with timeout and error handling
 */

const http = require('http');
const process = require('process');

const PORT = process.env.PORT || 3000;
const HEALTH_ENDPOINT = process.env.HEALTH_ENDPOINT || '/health';
const TIMEOUT = parseInt(process.env.HEALTH_TIMEOUT || '5000');

function healthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: HEALTH_ENDPOINT,
      method: 'GET',
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'InErgize-HealthCheck/1.0',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const healthData = JSON.parse(data);
            if (healthData.status === 'healthy' || healthData.status === 'ok') {
              resolve({ status: 'healthy', data: healthData });
            } else {
              reject(new Error(`Service unhealthy: ${healthData.status}`));
            }
          } catch (error) {
            // If response is not JSON, check if status is 200
            resolve({ status: 'healthy', data: { status: 'ok' } });
          }
        } else {
          reject(new Error(`Health check failed with status: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Health check request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Health check timed out after ${TIMEOUT}ms`));
    });

    req.end();
  });
}

// Execute health check
healthCheck()
  .then((result) => {
    console.log(`Health check passed: ${JSON.stringify(result)}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Health check failed: ${error.message}`);
    process.exit(1);
  });