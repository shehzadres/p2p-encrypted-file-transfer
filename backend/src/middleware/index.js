import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';

export function applyMiddleware(app) {
  // ── Security headers ─────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'wss:', 'ws:'],
      },
    },
  }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  // POST is required for room creation (/api/rooms) and self-destruct
  // completion (/api/rooms/:id/done) — GET-only CORS was a functional bug.
  app.use(cors({
    origin:      config.corsOrigin,
    methods:     ['GET', 'POST', 'OPTIONS'],
    credentials: false,
  }));

  // ── Request logging ──────────────────────────────────────────────────────
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });

  // ── Body size limit — server never receives file data ───────────────────
  app.use((req, res, next) => {
    if (req.headers['content-length'] > 64 * 1024) {
      return res.status(413).json({ error: 'Payload too large — server only handles signaling' });
    }
    next();
  });

  // ── REST rate limiting ────────────────────────────────────────────────────
  // Prevents abuse of room creation (memory exhaustion via empty rooms) and
  // general API scraping. WebSocket messages have their own separate limiter
  // in signalingServer.js since they bypass Express entirely.
  app.use('/api/rooms', rateLimit({
    windowMs: 60_000,
    limit:    30, // 30 room-related requests per IP per minute
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Too many requests — please slow down' },
  }));

  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit:    120, // generous ceiling for health checks / ice-config polling
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Too many requests — please slow down' },
  }));
}
