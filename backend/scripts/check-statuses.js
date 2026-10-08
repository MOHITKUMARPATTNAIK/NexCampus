import { pool } from '../src/config/db.js';

async function checkCurrentStatuses() {
  const p = await pool.query('SELECT DISTINCT status FROM payments');
  console.log('payments statuses:', p.rows);
  const o = await pool.query('SELECT DISTINCT status FROM payment_orders');
  console.log('payment_orders statuses:', o.rows);
  await pool.end();
}

checkCurrentStatuses();
