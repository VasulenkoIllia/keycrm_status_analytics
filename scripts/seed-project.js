#!/usr/bin/env node
// Wrapper to seed a new project with a given statuses file.
// Usage:
//   node scripts/seed-project.js --name "gal-industries" --status-file /path/statuses.json --token TOKEN --base-url https://openapi.keycrm.app/v1
// or positional:
//   node scripts/seed-project.js "gal-industries" /path/statuses.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function usage() {
  console.log(`Usage:
  node scripts/seed-project.js --name "project-name" --status-file /path/statuses.json [--token TOKEN] [--base-url URL]
  node scripts/seed-project.js "project-name" /path/statuses.json
`);
}

const args = process.argv.slice(2);
let name = '';
let statusFile = '';
let token = '';
let baseUrl = '';

for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--name' || a === '-n') {
    name = args[i + 1] || '';
    i += 1;
    continue;
  }
  if (a === '--status-file' || a === '-s') {
    statusFile = args[i + 1] || '';
    i += 1;
    continue;
  }
  if (a === '--token' || a === '-t') {
    token = args[i + 1] || '';
    i += 1;
    continue;
  }
  if (a === '--base-url' || a === '-b') {
    baseUrl = args[i + 1] || '';
    i += 1;
    continue;
  }
  if (!name) {
    name = a;
    continue;
  }
  if (!statusFile) {
    statusFile = a;
    continue;
  }
}

if (!name || !statusFile) {
  usage();
  process.exit(1);
}

const resolvedFile = path.isAbsolute(statusFile)
  ? statusFile
  : path.resolve(process.cwd(), statusFile);

if (!fs.existsSync(resolvedFile)) {
  console.error(`Status file not found: ${resolvedFile}`);
  process.exit(1);
}

process.env.PROJECT_NAME = name;
process.env.STATUS_FILE = resolvedFile;
if (token) process.env.KEYCRM_API_TOKEN = token;
if (baseUrl) process.env.KEYCRM_BASE_URL = baseUrl;

await import(path.join(__dirname, 'seed-custom.js'));
