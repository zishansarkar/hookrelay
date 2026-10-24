import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const ENV_SEARCH_DEPTH = 6;

let directory = MODULE_DIRECTORY;
let loadedEnvironmentFile: string | undefined;

for (let depth = 0; depth < ENV_SEARCH_DEPTH; depth += 1) {
  const candidate = resolve(directory, '.env');
  if (existsSync(candidate)) {
    loadedEnvironmentFile = candidate;
    break;
  }
  const parent = dirname(directory);
  if (parent === directory) break;
  directory = parent;
}

if (loadedEnvironmentFile) {
  dotenv.config({ path: loadedEnvironmentFile, quiet: true });
}

export const environmentFile = loadedEnvironmentFile;
