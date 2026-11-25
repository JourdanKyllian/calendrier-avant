import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const envPath = resolve(rootDir, '.env');

if (!existsSync(envPath)) {
  console.error('Missing .env file. Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

const envVars = {};
for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const eqIndex = line.indexOf('=');
  if (eqIndex === -1) continue;
  const key = line.slice(0, eqIndex).trim();
  const value = line.slice(eqIndex + 1).trim();
  envVars[key] = value;
}

const required = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'PUSH_WORKER_URL',
  'PUSH_VAPID_PUBLIC_KEY',
  'VAPID_SUBJECT',
];

for (const key of required) {
  if (!envVars[key]) {
    console.error(`Missing required variable in .env: ${key}`);
    process.exit(1);
  }
}

const renderEnvironmentTs = (production) => `export const environment = {
  production: ${production},
  firebase: {
    apiKey: '${envVars.FIREBASE_API_KEY}',
    authDomain: '${envVars.FIREBASE_AUTH_DOMAIN}',
    projectId: '${envVars.FIREBASE_PROJECT_ID}',
    storageBucket: '${envVars.FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${envVars.FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${envVars.FIREBASE_APP_ID}',
  },
  push: {
    workerUrl: '${envVars.PUSH_WORKER_URL}',
    vapidPublicKey: '${envVars.PUSH_VAPID_PUBLIC_KEY}',
  },
};
`;

const renderWranglerToml = () => `name = "chocoavent-push-worker"
main = "src/index.ts"
compatibility_date = "2025-02-14"

[vars]
FIREBASE_PROJECT_ID = "${envVars.FIREBASE_PROJECT_ID}"
FIREBASE_API_KEY = "${envVars.FIREBASE_API_KEY}"
VAPID_SUBJECT = "${envVars.VAPID_SUBJECT}"

[triggers]
crons = ["*/5 * * * *"]
`;

writeFileSync(resolve(rootDir, 'src/environments/environment.ts'), renderEnvironmentTs(false));
writeFileSync(resolve(rootDir, 'src/environments/environment.prod.ts'), renderEnvironmentTs(true));
writeFileSync(resolve(rootDir, 'cloudflare-worker/wrangler.toml'), renderWranglerToml());

console.log('Generated environment.ts, environment.prod.ts, and cloudflare-worker/wrangler.toml from .env');
