import { Router } from 'express';
import multer from 'multer';
import { extname } from 'path';
import prisma from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { notifyArrival } from '../services/notifications.js';

const router = Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /parcels — driver logs a new parcel
router.post('/', authenticate, requireRole('DRIVER', 'ADMIN'), upload.single('photo'), async (req, res) => {
  const { residentId, trackingNumber } = req.body;
  if (!residentId || !trackingNumber) {
    return res.status(400).json({ error: 'residentId and trackingNumber are required' });
  }
  try {
    const resident = await prisma.user.findUnique({ where: { id: residentId } });
    if (!resident || resident.role !== 'RESIDENT') {
      return res.status(404).json({ error: 'Resident not found' });
    }

    const deliveredAt = new Date();
    const expiresAt = new Date(deliveredAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const parcel = await prisma.parcel.create({
      data: { trackingNumber, residentId, driverId: req.userId, deliveredAt, expiresAt, photoUrl },
      include: { resident: true, driver: true },
    });

    req.io.emit('parcel:new', parcel);
    notifyArrival(parcel, resident).catch(console.error);

    res.status(201).json(parcel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /parcels — residents see own, admins see all
router.get('/', authenticate, async (req, res) => {
  const { status } = req.query;
  try {
    const where = {
      ...(req.userRole === 'RESIDENT' ? { residentId: req.userId } : {}),
      ...(status ? { status } : {}),
    };
    const parcels = await prisma.parcel.findMany({
      where,
      include: { resident: { select: { id: true, name: true, email: true } }, driver: { select: { id: true, name: true } } },
      orderBy: { deliveredAt: 'desc' },
    });
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /parcels/:id/collect — mark as collected
router.patch('/:id/collect', authenticate, async (req, res) => {
  try {
    const parcel = await prisma.parcel.findUnique({ where: { id: req.params.id } });
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });

    if (req.userRole === 'RESIDENT' && parcel.residentId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (parcel.status === 'COLLECTED') {
      return res.status(400).json({ error: 'Parcel already collected' });
    }

    const updated = await prisma.parcel.update({
      where: { id: req.params.id },
      data: { status: 'COLLECTED', collectedAt: new Date() },
      include: { resident: { select: { id: true, name: true, email: true } } },
    });

    req.io.emit('parcel:collected', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /parcels/:id/extend — admin extends expiry
router.patch('/:id/extend', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { days } = req.body;
  if (!days || typeof days !== 'number') {
    return res.status(400).json({ error: 'days (number) is required' });
  }
  try {
    const parcel = await prisma.parcel.findUnique({ where: { id: req.params.id } });
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });

    const newExpiry = new Date(parcel.expiresAt.getTime() + days * 24 * 60 * 60 * 1000);
    const updated = await prisma.parcel.update({
      where: { id: req.params.id },
      data: { expiresAt: newExpiry, status: 'PENDING', warningSent: false },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /parcels/:id — admin only
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.parcel.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
