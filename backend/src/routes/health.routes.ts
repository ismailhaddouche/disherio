import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { isConnected, getConnectionState } from '../config/db';
import { logger } from '../config/logger';
import { cache } from '../services/cache.service';
import os from 'os';
import fs from 'fs';

const router = Router();

// Version from package.json
const VERSION = process.env.npm_package_version || '1.0.0';

/**
 * Health check status types
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual check result interface
 */
interface CheckResult {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
  free?: string;
  usage?: string;
  total?: string;
  percentage?: string;
}

/**
 * Complete health status response
 */
interface HealthStatusResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  service: string;
  uptime: number;
  checks: {
    database: CheckResult;
    redis?: CheckResult;
    diskSpace: CheckResult;
    memory: CheckResult;
  };
}

/**
 * Readiness probe response
 */
interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    dependencies: boolean;
  };
  message?: string;
}

/**
 * Liveness probe response
 */
interface LivenessResponse {
  alive: boolean;
  timestamp: string;
  uptime: number;
  pid: number;
  memory: {
    used: string;
    total: string;
    percentage: string;
  };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check Redis connection with response time
 */
async function checkRedis(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    const isReady = cache.isReady();
    const responseTime = Date.now() - startTime;
    
    if (isReady) {
      return {
        status: 'up',
        responseTime,
        message: 'Redis is connected'
      };
    }
    
    return {
      status: 'degraded',
      responseTime,
      message: 'Redis is not connected - app running without cache'
    };
  } catch (error) {
    return {
      status: 'degraded',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Redis error'
    };
  }
}

/**
 * Check MongoDB connection with response time
 */
async function checkDatabase(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    if (!isConnected()) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        message: `MongoDB is ${getConnectionState()}`
      };
    }

    // Perform a lightweight ping operation
    await mongoose.connection.db?.admin().ping();
    const responseTime = Date.now() - startTime;

    return {
      status: responseTime > 1000 ? 'degraded' : 'up',
      responseTime,
      message: `MongoDB is ${getConnectionState()}`
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check disk space
 */
function checkDiskSpace(): CheckResult {
  try {
    // Get temp directory path for checking disk space
    const tempDir = os.tmpdir();
    const stats = fs.statfsSync(tempDir);
    
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bfree;
    const used = total - free;
    const percentage = ((used / total) * 100).toFixed(1);
    
    // Degraded if less than 10% free, down if less than 5%
    let status: 'up' | 'down' | 'degraded' = 'up';
    const freePercentage = (parseFloat(free.toString()) / parseFloat(total.toString())) * 100;
    
    if (freePercentage < 5) {
      status = 'down';
    } else if (freePercentage < 10) {
      status = 'degraded';
    }

    return {
      status,
      free: formatBytes(free),
      total: formatBytes(total),
      percentage: `${percentage}%`
    };
  } catch (error) {
    logger.warn({ error }, 'Failed to check disk space');
    return {
      status: 'degraded',
      free: 'unknown',
      message: 'Unable to check disk space'
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): CheckResult {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percentage = ((used / total) * 100).toFixed(1);
  
  // Degraded if more than 85% used, down if more than 95%
  let status: 'up' | 'down' | 'degraded' = 'up';
  const usedPercentage = parseFloat(percentage);
  
  if (usedPercentage > 95) {
    status = 'down';
  } else if (usedPercentage > 85) {
    status = 'degraded';
  }

  return {
    status,
    usage: formatBytes(used),
    total: formatBytes(total),
    percentage: `${percentage}%`
  };
}

/**
 * Calculate overall health status
 */
function calculateOverallHealth(checks: HealthStatusResponse['checks']): HealthStatus {
  const checkStatuses = Object.values(checks).map(c => c.status);
  
  // If any critical check is down, status is unhealthy
  if (checkStatuses.includes('down')) {
    return 'unhealthy';
  }
  
  // If any check is degraded, status is degraded
  if (checkStatuses.includes('degraded')) {
    return 'degraded';
  }
  
  return 'healthy';
}

/**
 * @route   GET /health
 * @desc    Comprehensive health check endpoint
 * @access  Public
 * 
 * Returns detailed health status including:
 * - Database connectivity and response time
 * - Disk space availability
 * - Memory usage
 * - Service uptime and version
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const [dbCheck, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis()
  ]);
  const diskCheck = checkDiskSpace();
  const memoryCheck = checkMemory();
  
  const checks: HealthStatusResponse['checks'] = {
    database: dbCheck,
    redis: redisCheck,
    diskSpace: diskCheck,
    memory: memoryCheck
  };
  
  const overallStatus = calculateOverallHealth(checks);
  
  // Determine HTTP status code based on health
  let statusCode = 200;
  if (overallStatus === 'unhealthy') {
    statusCode = 503; // Service Unavailable
  } else if (overallStatus === 'degraded') {
    statusCode = 200; // Still return 200 but with degraded status
  }
  
  const response: HealthStatusResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: VERSION,
    service: 'disherio-backend',
    uptime: process.uptime(),
    checks
  };
  
  res.status(statusCode).json(response);
  return;
});

/**
 * @route   GET /health/ready
 * @desc    Readiness probe - checks if service is ready to receive traffic
 * @access  Public
 * 
 * Used by Kubernetes and Docker to determine if the container
 * is ready to accept requests. Returns 200 only when all
 * dependencies are available.
 */
router.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  const [dbCheck, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis()
  ]);
  
  const isReady = dbCheck.status === 'up' || dbCheck.status === 'degraded';
  
  const response: ReadinessResponse = {
    ready: isReady,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbCheck.status === 'up' || dbCheck.status === 'degraded',
      dependencies: redisCheck.status === 'up' || redisCheck.status === 'degraded'
    }
  };
  
  if (!isReady) {
    response.message = 'Service is not ready: database unavailable';
    res.status(503).json(response);
    return;
  }
  
  res.status(200).json(response);
  return;
});

/**
 * @route   GET /health/live
 * @desc    Liveness probe - checks if the process is running and not deadlocked
 * @access  Public
 * 
 * Used by Kubernetes and Docker to determine if the container
 * should be restarted. Returns 200 as long as the process is running.
 */
router.get('/live', (_req: Request, res: Response): void => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  
  const response: LivenessResponse = {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
    memory: {
      used: formatBytes(used),
      total: formatBytes(total),
      percentage: `${((used / total) * 100).toFixed(1)}%`
    }
  };
  
  res.status(200).json(response);
  return;
});

/**
 * @route   GET /health/simple
 * @desc    Simple health check for load balancers
 * @access  Public
 * 
 * Lightweight endpoint that returns only status.
 * Suitable for frequent health checks from load balancers.
 */
router.get('/simple', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
  return;
});

export default router;
