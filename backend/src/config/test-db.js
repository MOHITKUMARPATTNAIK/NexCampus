import { pool, checkConnection } from './db.js';

async function test() {
  console.log('--- NexCampus Database Persistence Test ---');
  const res = await checkConnection();
  if (!res.connected) {
    console.error('❌ Connection Failed:', res.message);
    console.log('\nTo configure your persistent Supabase PostgreSQL database:');
    console.log('1. Open backend/.env');
    console.log('2. Set DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
    console.log('3. Re-run `npm run migrate` in backend/');
    process.exit(1);
  }

  console.log('✅ Connection Success!');
  console.log(`- Database: ${res.database}`);
  console.log(`- Database Server Time: ${res.timestamp}`);

  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`\nFound ${tablesRes.rows.length} public tables in database:`);
  tablesRes.rows.forEach(t => console.log(`  • ${t.table_name}`));

  process.exit(0);
}

test().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
