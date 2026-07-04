import 'dotenv/config';

export const config = {
  port:                parseInt(process.env.PORT || '3001', 10),
  nodeEnv:             process.env.NODE_ENV || 'development',
  corsOrigin:          process.env.CORS_ORIGIN || 'http://localhost:5173',
  roomCleanupInterval: parseInt(process.env.ROOM_CLEANUP_INTERVAL_MS || '60000', 10),
  logLevel:            process.env.LOG_LEVEL || 'info',
  isDev:               (process.env.NODE_ENV || 'development') === 'development',

  // TURN configuration
  turn: {
    url:        process.env.TURN_URL        || '',
    username:   process.env.TURN_USERNAME   || '',
    credential: process.env.TURN_CREDENTIAL || '',
    secret:     process.env.TURN_SECRET     || '',       // for HMAC auth
    ttlSeconds: parseInt(process.env.TURN_TTL_SECONDS || '86400', 10),
  },
};
