import app from './app.js';
import { checkConnection } from './config/db.js';
import { runMigrations } from './config/migrate.js';
import { seedDatabase } from './config/seed.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('\n======================================================');
  console.log('🚀 Starting NexCampus Enterprise Campus Management Server');
  console.log('======================================================');

  // Verify persistent PostgreSQL database connection
  const dbHealth = await checkConnection();
  if (dbHealth.connected) {
    console.log(`✅ PostgreSQL Connected [Database: ${dbHealth.database}]`);
    try {
      // Run migrations safely
      await runMigrations();
      // Seed roles & initial admin safely
      await seedDatabase();
    } catch (migErr) {
      console.warn('⚠️ Migration/Seed notice:', migErr.message);
    }
  } else {
    console.warn('⚠️ Database Notice:', dbHealth.message);
    console.warn('👉 Please configure DATABASE_URL in backend/.env to connect to your persistent PostgreSQL/Supabase instance.');
  }

  app.listen(PORT, () => {
    console.log(`\n📡 NexCampus Backend API is live on: http://localhost:${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health\n`);
  });
}

startServer();
