import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];

if (!version) {
  console.error('Usage: pnpm bump <version>');
  console.error('Example: pnpm bump 1.6.7');
  process.exit(1);
}

const packages = [
  'package.json',
  'server/package.json',
  'client/package.json',
];

packages.forEach((pkg) => {
  const path = join(__dirname, '..', pkg);
  const json = JSON.parse(readFileSync(path, 'utf-8'));
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  console.log(`Updated ${pkg} → ${version}`);
});