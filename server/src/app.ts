import './config/env';
import database from './config/database';
import express from 'express';
import path from 'path';
import authRoutes from './routes/auth';
import catalogRoutes from './routes/catalog';
import diaryRoutes from './routes/diary';
import discoveryRoutes from './routes/discovery';
import pathRoutes from './routes/paths';
import libraryRoutes from './routes/library';
import safetyRoutes from './routes/safety';
import recommendationRoutes from './routes/recommendations';
import suggestionRoutes from './routes/suggestions';
import devRoutes from './routes/dev';

const app = express();

app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (_req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
// Cross-origin forms cannot supply this header. CORS is deliberately not enabled.
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (req.get('X-Moodie-Request') !== '1' || req.get('Sec-Fetch-Site') === 'cross-site')) {
    return res.status(403).json({ error: 'Reload Moodie and try again.' });
  }
  next();
});
app.use(express.json({ limit: '3mb' }));

app.get('/api/health', async (_req, res) => {
  try { await database.query('SELECT 1'); } catch { return res.status(503).json({ status: 'unavailable', error: 'Database is unavailable' }); }
  res.json({
    status: 'OK',
    scope: process.env.MOODIE_DATA_SCOPE === 'verification' ? 'verification' : 'application',
    release: process.env.MOODIE_RELEASE || 'local',
    message: 'Moodie diary API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/discovery', pathRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/suggestions', suggestionRoutes);
// Previews for people building Moodie. Never registered in production.
if (process.env.NODE_ENV !== 'production') app.use('/api/dev', devRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const webRoot = path.resolve(__dirname, '../../dist');
  app.use(express.static(webRoot));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(webRoot, 'index.html'));
  });
}

app.use((error: { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error.status === 413 ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  if (status === 500) console.error('Request failed:', error);
  res.status(status).json({ error: status === 413 ? 'That upload is too large.' : status === 400 ? 'Invalid request body.' : 'The request could not be completed. Try again.' });
});

export default app;
