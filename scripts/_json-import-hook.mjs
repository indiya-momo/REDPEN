import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
register(
  pathToFileURL(join(here, '_json-import-loader.mjs')).href,
  pathToFileURL(join(here, '..') + '/'),
);
