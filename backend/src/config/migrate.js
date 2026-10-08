import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, checkConnection } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../migrations');

export const runMigrations = async () => {
  console.log('[Migration] Checking database connectivity...');
  const connStatus = await checkConnection();
  if (!connStatus.connected) {
    console.error(`[Migration Error]: ${connStatus.message}`);
    throw new Error(connStatus.message);
  }

  console.log(`[Migration] Connected to database: ${connStatus.database}`);

  const client = await pool.connect();
  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch applied migrations
    const { rows: applied } = await client.query('SELECT migration_name FROM schema_migrations');
    const appliedSet = new Set(applied.map(r => r.migration_name));

    // 3. Scan migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!appliedSet.has(file)) {
        console.log(`[Migration] Applying ${file}...`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sqlContent);
          await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`[Migration] Successfully applied ${file}`);
        } catch (migErr) {
          await client.query('ROLLBACK');
          console.error(`[Migration Error] Failed in ${file}:`, migErr.message);
          throw migErr;
        }
      } else {
        console.log(`[Migration] Skipping ${file} (already applied)`);
      }
    }

    console.log('[Migration] All migrations are up to date.');
  } finally {
    client.release();
  }
};

// If run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log('[Migration CLI] Completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration CLI] Failed:', err.message);
      process.exit(1);
    });
}
