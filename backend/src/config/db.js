import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory or project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const isRemote = connectionString && (
  connectionString.includes('supabase.co') ||
  connectionString.includes('supabase.com') ||
  connectionString.includes('aws') ||
  connectionString.includes('neon.tech') ||
  process.env.DB_SSL === 'true'
);

const poolConfig = {
  connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/nexcampus',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
};

if (isRemote) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[Database Pool Error]: Unexpected error on idle client', err.message);
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`[Slow Query] (${duration}ms): ${text.substring(0, 80)}...`);
    }
    return res;
  } catch (error) {
    console.error(`[Database Query Error]: ${error.message} \nQuery: ${text.substring(0, 100)}`);
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

export const checkConnection = async () => {
  if (!process.env.DATABASE_URL) {
    return {
      connected: false,
      message: 'DATABASE_URL environment variable is missing. Set a valid PostgreSQL connection string in .env'
    };
  }
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
    return {
      connected: true,
      timestamp: res.rows[0].current_time,
      database: res.rows[0].db_name,
      message: 'Successfully connected to PostgreSQL database'
    };
  } catch (err) {
    return {
      connected: false,
      message: `Database connection failed: ${err.message}`
    };
  }
};

pool.getClient = getClient;
pool.checkConnection = checkConnection;
pool.pool = pool;

export default pool;
