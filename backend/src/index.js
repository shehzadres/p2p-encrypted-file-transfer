import http from 'http';
import express from 'express';
import { config } from '../config/index.js';
import { applyMiddleware } from './middleware/index.js';
import { createSignalingServer } from './signaling/signalingServer.js';
import { createRoutes } from './routes.js';
import { logger } from './utils/logger.js';

const app = express();
applyMiddleware(app);
app.use(express.json({ limit: '16kb' }));

const httpServer = http.createServer(app);
const { wss, rooms } = createSignalingServer(httpServer, config);

// REST routes
app.use('/api', createRoutes(rooms));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler — must be registered last, after all routes.
// Without this, a thrown error in any route handler crashes the process.
app.use((err, _req, res, _next) => {
  // express.json() throws a SyntaxError with a `body` property for malformed
  // JSON payloads — that's a client mistake (400), not a server fault (500).
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  logger.error('Unhandled request error', { message: err.message, stack: config.isDev ? err.stack : undefined });
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

httpServer.listen(config.port, () => {
  logger.info('Server running', {
    port: config.port,
    env:  config.nodeEnv,
    cors: config.corsOrigin,
  });
});

// ── Graceful shutdown ────────────────────────────────────────────────────────

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop accepting new WebSocket connections and close existing ones cleanly
  wss.clients.forEach((ws) => {
    try { ws.close(1001, 'Server shutting down'); } catch {}
  });

  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force-exit if connections don't close within 5s
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Process-level safety nets ────────────────────────────────────────────────
// These prevent a single unexpected error from silently killing the server
// without any log trail, which would otherwise look like a mysterious outage.

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  // Uncaught exceptions leave the process in an undefined state — exit after logging
  // so the process manager (pm2/systemd/docker) can restart it cleanly.
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
  });
  // Unlike uncaughtException, an unhandled rejection doesn't necessarily mean
  // the process is in a bad state — log but don't exit.
});
