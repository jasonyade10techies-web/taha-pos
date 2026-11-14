import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function resolvePostgresTool(name, {platform=process.platform, bin=process.env.TAHA_TEST_POSTGRES_BIN}={}) {
  if (!['pg_dump', 'pg_restore'].includes(name)) throw Error('Unsupported PostgreSQL test tool.');
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const directory = bin || (platform === 'win32' ? paths.join(root, '.test-postgres', 'pgsql', 'bin') : '');
  const executable = name + (platform === 'win32' ? '.exe' : '');
  return directory ? paths.join(directory, executable) : executable;
}
