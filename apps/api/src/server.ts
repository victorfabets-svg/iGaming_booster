/**
 * HTTP Server
 * Express-based API server
 */

import express, { Request, Response, NextFunction } from 'express';
import { config, initializeEnvironment } from '../shared/config';
import { pool, closePool } from '../lib/database';
import { handleSubmitProof } from '../domains/validation/controllers/submit-proof.controller';
import { getMetrics } from '../shared/observability/metrics.controller';
import { logger } from '../shared/observability/logger';

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      'http_request',
      'http',
      `${req.method} ${req.path} ${res.statusCode} (${duration}ms)`,
      undefined,
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
      }
    );
  });
  
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /proofs - Submit proof for validation
app.post('/proofs', async (req: Request, res: Response) => {
  try {
    const { user_id, file_url } = req.body;
    
    if (!user_id || !file_url) {
      res.status(400).json({ error: 'user_id and file_url are required' });
      return;
    }
    
    const result = await handleSubmitProof({ user_id, file_url });
    res.status(201).json(result);
  } catch (error) {
    logger.error('proof_submission_error', 'http', `Error submitting proof: ${error}`, undefined, { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /metrics - Get system metrics
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('metrics_error', 'http', `Error fetching metrics: ${error}`, undefined, { error: String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('unhandled_error', 'http', `Unhandled error: ${err.message}`, undefined, { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  // Initialize environment
  initializeEnvironment();
  
  // Test database connection
  try {
    const client = await pool.connect();
    client.release();
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }
  
  // Start listening
  const port = config.apiPort;
  const host = config.apiHost;
  
  app.listen(port, host, () => {
    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📋 Available routes:`);
    console.log(`   GET  /health   - Health check`);
    console.log(`   POST /proofs   - Submit proof`);
    console.log(`   GET  /metrics  - Get metrics`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await closePool();
  process.exit(0);
});

// Export for testing
export { app };

// Start if this is the main module
if (require.main === module) {
  startServer();
}