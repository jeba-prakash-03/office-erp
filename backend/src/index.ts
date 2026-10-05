import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Import Routes
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import rolesRoutes from './modules/roles/roles.routes';
import companyRoutes from './modules/company/company.routes';
import employeesRoutes from './modules/employees/employees.routes';
import departmentsRoutes from './modules/departments/departments.routes';
import clientsRoutes from './modules/clients/clients.routes';
import leadsRoutes from './modules/leads/leads.routes';
import projectsRoutes from './modules/projects/projects.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import leaveRoutes from './modules/leave/leave.routes';
import payrollRoutes from './modules/payroll/payroll.routes';
import loansRoutes from './modules/loans/loans.routes';
import performanceRoutes from './modules/performance/performance.routes';
import timesheetsRoutes from './modules/timesheets/timesheets.routes';
import financeRoutes from './modules/finance/finance.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import assetsRoutes from './modules/assets/assets.routes';
import documentsRoutes from './modules/documents/documents.routes';
import announcementsRoutes from './modules/announcements/announcements.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import meetingsRoutes from './modules/meetings/meetings.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import reportsRoutes from './modules/reports/reports.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import auditRoutes from './modules/audit/audit.routes';
import searchRoutes from './modules/search/search.routes';
import approvalsRoutes from './modules/approvals/approvals.routes';

const app = express();

// Security and Logging Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: config.corsOrigin === '*' ? true : [config.corsOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static file uploads directory
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Office Management & Company ERP API',
    version: '1.0.0',
  });
});

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/timesheets', timesheetsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/approvals', approvalsRoutes);

// Catch 404 for unhandled API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Centralized Error Handling
app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`========================================================`);
  logger.info(` Office Management & ERP Backend Server Running`);
  logger.info(` Port: ${PORT}`);
  logger.info(` Environment: ${config.nodeEnv}`);
  logger.info(` Database: ${config.db.database} on ${config.db.host}:${config.db.port}`);
  logger.info(`========================================================`);
});

export default app;
