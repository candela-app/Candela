import { existsSync } from 'fs';
import { config } from 'dotenv';
import { join } from 'path';

/**
 * Resolve apps/candela-backend/.env whether this file is compiled to
 * dist/common or run from src/common, and whether cwd is the repo root.
 */
const ENV_CANDIDATES = [
  join(__dirname, '..', '..', '.env'),
  join(__dirname, '..', '.env'),
  join(process.cwd(), '.env'),
  join(process.cwd(), 'apps', 'candela-backend', '.env'),
];

export const BACKEND_ENV_PATH =
  ENV_CANDIDATES.find((filePath) => existsSync(filePath)) ?? ENV_CANDIDATES[0]!;

export function loadBackendEnv(): void {
  config({ path: BACKEND_ENV_PATH, override: true });
}
