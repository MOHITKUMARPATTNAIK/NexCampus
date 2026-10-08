import pool from './src/config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations/006_notifications_and_audit_columns.sql'), 'utf8');
  console.log('Applying Migration 006...');
  await pool.query(sql);
  console.log('Migration 006 applied successfully!');
  
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications'`);
  console.log('Updated notifications columns:', cols.rows.map(c => c.column_name));
  await pool.end();
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
