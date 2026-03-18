import { Router } from 'express';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /users/link-code — resident gets/regenerates their Telegram link code
router.get('/link-code', authenticate, requireRole('RESIDENT'), async (req, res) => {
  try {
    const code = randomBytes(6).toString('hex'); // 12-char hex code
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { linkCode: code },
      select: { linkCode: true, telegramChatId: true },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users?role=RESIDENT&search=foo — driver autocomplete search
router.get('/', authenticate, requireRole('DRIVER', 'ADMIN'), async (req, res) => {
  const { role, search } = req.query;
  try {
    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      take: 10,
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /users — admin creates driver/admin accounts
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  if (!['DRIVER', 'ADMIN', 'RESIDENT'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true },
    });
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
