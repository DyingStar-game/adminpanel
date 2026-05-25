/**
 * DyingStar Admin API entrypoint — Express app, middleware, and HTTP listener.
 */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logActivity } from './services/activityLog.js';

const app = express();

app.use(morgan('dev'));
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));

/** Root discovery endpoint (API only; UI is served separately). */
app.get('/', (_req, res) => {
  res.json({
    name: 'DyingStar Admin API',
    hint: "L'interface web est sur http://localhost:5173 — ce port sert uniquement l'API (/api/*).",
    health: '/api/health',
  });
});

app.use('/api', apiRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`DyingStar Admin API listening on http://localhost:${env.port}`);
  logActivity('server_started', 'system', `port ${env.port}`);
});
