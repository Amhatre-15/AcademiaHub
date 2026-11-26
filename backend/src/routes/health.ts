import { Router } from 'express';
import { prisma } from '../config/prisma';

const router = Router();

/**
 * GET /health
 * Health check endpoint — returns server status and DB connectivity
 */
router.get('/', async (req, res) => {
  try {
    // Quick DB ping
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'AcademiaHub API',
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'AcademiaHub API',
      database: 'disconnected',
    });
  }
});

export default router;
