import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import parcelRoutes from './routes/parcels.js';
import userRoutes from './routes/users.js';
import { initTelegramBot } from './services/telegram.js';
import { scheduleExpiryCheck } from './jobs/parcelExpiry.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '../../uploads')));

// Attach io to every request so routes can emit events
app.use((req, _res, next) => {
  req.io = io;
  next();
});

app.use('/auth', authRoutes);
app.use('/parcels', parcelRoutes);
app.use('/users', userRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Background jobs
scheduleExpiryCheck();

// Telegram bot
initTelegramBot();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
