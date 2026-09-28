import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.routes.js';
import departmentRoutes from './routes/departments.routes.js';
import employeeRoutes from './routes/employees.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'web-hr-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/departments', requireAuth, departmentRoutes);
app.use('/api/employees', requireAuth, employeeRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  const status = error.status || (error.name === 'ZodError' ? 400 : 500);
  const message = error.name === 'ZodError' ? 'Validation error' : error.message || 'Internal server error';

  res.status(status).json({
    message,
    details: error.errors || undefined
  });
});

app.listen(config.port, () => {
  console.log(`Web HR API listening on http://localhost:${config.port}`);
});
