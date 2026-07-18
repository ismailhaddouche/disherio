import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      service: 'disherio-backend',
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password', '*.password',
      'password_hash', '*.password_hash',
      'pin', '*.pin',
      'pin_code', '*.pin_code',
      'pin_code_hash', '*.pin_code_hash',
      'pin_lookup', '*.pin_lookup',
      'token', '*.token',
      'access_token', '*.access_token',
      'refresh_token', '*.refresh_token',
      'JWT_SECRET', '*.JWT_SECRET',
      'JWT_REFRESH_SECRET', '*.JWT_REFRESH_SECRET',
      'MONGO_ROOT_PASS', '*.MONGO_ROOT_PASS',
      'MONGO_APP_PASS', '*.MONGO_APP_PASS',
      'REDIS_PASSWORD', '*.REDIS_PASSWORD',
      'MONGODB_URI', '*.MONGODB_URI',
    ],
    remove: true,
  },
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export default logger;
export { logger };
