import express from 'express';
import { config } from '../config';
import { suppliersRouter } from './routes/suppliers';
import { hotelsRouter } from './routes/hotels';
import { healthRouter } from './routes/health';

const app = express();
app.use(express.json());

// Lightweight request logging.
app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[api] ${req.method} ${req.originalUrl}`);
  next();
});

// Mock suppliers and health live at the root; the orchestrator under /api.
app.use('/', suppliersRouter);
app.use('/', healthRouter);
app.use('/api', hotelsRouter);

// Simple service index.
app.get('/', (_req, res) => {
  res.json({
    service: 'hotel-offer-orchestrator',
    endpoints: [
      'GET /api/hotels?city=delhi',
      'GET /api/hotels?city=delhi&minPrice=<min>&maxPrice=<max>',
      'GET /supplierA/hotels?city=delhi[&down=true]',
      'GET /supplierB/hotels?city=delhi[&down=true]',
      'GET /health',
    ],
  });
});

// 404 fallback.
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(config.apiPort, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://0.0.0.0:${config.apiPort}`);
});
