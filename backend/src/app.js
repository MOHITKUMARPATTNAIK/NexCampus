import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { checkConnection } from './config/db.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import academicRoutes from './routes/academic.routes.js';
import securityRoutes from './routes/security.routes.js';
import feesRoutes from './routes/fees.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import complaintsRoutes from './routes/complaints.routes.js';
import communicationsRoutes from './routes/communications.routes.js';
import coursesRoutes from './routes/courses.routes.js';

import path from 'path';
import fs from 'fs';

const app = express();

// Ensure uploads directories exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const certsDir = path.join(uploadsDir, 'certificates');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}
const docsDir = path.join(uploadsDir, 'documents');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Security & utility middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin === '*' ? true : [corsOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(uploadsDir));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health & Persistence Verification Endpoint
app.get('/api/health', async (req, res) => {
  const dbHealth = await checkConnection();
  return res.json({
    status: 'online',
    system: 'NexCampus Smart Campus Management Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: {
      status: dbHealth.connected ? 'connected' : 'disconnected',
      details: dbHealth
    }
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api', communicationsRoutes);

// 404 Handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

export default app;
