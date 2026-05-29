import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load throwaway test env only (NEVER the real .env / .env.local / Railway vars).
const rootDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(rootDir, '.env.test') });
