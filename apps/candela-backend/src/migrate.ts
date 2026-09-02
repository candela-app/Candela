import 'reflect-metadata';
import { runPendingMigrations } from './common/run-migrations';

runPendingMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
