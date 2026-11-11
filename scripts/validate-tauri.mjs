import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import Ajv from 'ajv';

const require = createRequire(import.meta.url);
const schemaPath = require.resolve('@tauri-apps/cli/config.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const config = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
// Tauri's schema contains regex escapes accepted without JavaScript's Unicode flag.
const ajv = new Ajv({ allErrors: true, strict: false, unicodeRegExp: false });
ajv.addFormat('uri', (value) => { try { new URL(value); return true; } catch { return false; } });
ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addFormat('double', { type: 'number', validate: Number.isFinite });
for (const [format, minimum, maximum] of [
  ['uint8', 0, 255], ['uint32', 0, 4294967295],
  ['int32', -2147483648, 2147483647], ['int64', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
]) ajv.addFormat(format, { type: 'number', validate: (value) => Number.isInteger(value) && value >= minimum && value <= maximum });
const validate = ajv.compile(schema);
if (!validate(config)) { console.error(validate.errors); process.exit(1); }
for (const icon of config.bundle.icon) {
  if (!existsSync(new URL(`../src-tauri/${icon}`, import.meta.url))) throw new Error(`Missing bundle icon: ${icon}`);
}
const capability = JSON.parse(readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8'));
if (!capability.windows.includes('main') || !capability.permissions.includes('core:default')) throw new Error('Main capability is incomplete.');
console.log('Tauri 2 configuration passes the installed CLI JSON schema; bundle icons and main capability are present.');
console.log('This validates configuration only. Native compilation still requires Rust and the Windows C++ toolchain.');
