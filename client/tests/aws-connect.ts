import { DebugClient } from '../src/client';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import chalk = require('chalk');

const run = async () => {
  try {
    let currentSession = null;

    try {
      currentSession = JSON.parse(fs.readFileSync(__dirname + '/session.json').toString());
    } catch (e) {}

    if (currentSession) {
      await new DebugClient({
        relayHost: 'relay1.debugmypipeline.com',
        relayPort: 5000,
        verifyHostName: true,
        clientKey: currentSession.clientKey,
        directConnectStrategies: [],
      }).connect();
    } else {
      await new Promise((resolve, reject) => {
        const result = https.request({
          method: 'POST',
          host: 'relay1.debugmypipeline.com',
          port: 443,
          path: '/sessions',
        });

        result.once('response', (response) => {
          response.on('data', (data) => {
            const payload = JSON.parse(data.toString());

            console.log(payload);

            fs.writeFileSync(__dirname + '/session.json', JSON.stringify(payload));

            new DebugClient({
              relayHost: 'relay1.debugmypipeline.com',
              relayPort: 5000,
              verifyHostName: true,
              clientKey: payload.hostKey,
              directConnectStrategies: [],
            })
              .connect()
              .finally(() => {
                fs.unlinkSync(__dirname + '/session.json');
              })
              .then(resolve).catch(reject);
          });
        });

        (result as any).end();
      });
    }

    process.exit(0);
  } catch (e) {
    console.error(chalk.red(`Unhandled error occurred: ${e.message}`));
    process.exit(1);
  }
};

run();
