import { pool } from '../src/config/db.js';

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('payments', 'payment_orders', 'payment_receipts', 'course_enrollments')
      ORDER BY table_name, ordinal_position;
    `);
    console.log('Columns:');
    res.rows.forEach(r => console.log(`${r.table_name}.${r.column_name} (${r.data_type}) nullable: ${r.is_nullable}`));

    const checkCons = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid IN ('payments'::regclass, 'payment_orders'::regclass, 'payment_receipts'::regclass);
    `);
    console.log('\nPG Check / Key Constraints:');
    checkCons.rows.forEach(c => console.log(`${c.conname}: ${c.def}`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
