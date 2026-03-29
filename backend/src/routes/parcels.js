import { Router } from 'express';
import multer from 'multer';
import { extname } from 'path';
import crypto from 'crypto';
import QRCode from 'qrcode';
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
    const qrToken = crypto.randomBytes(32).toString('hex');

    const parcel = await prisma.parcel.create({
      data: { trackingNumber, residentId, driverId: req.userId, deliveredAt, expiresAt, photoUrl, qrToken },
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
      include: {
        resident: { select: { id: true, name: true, email: true } },
        driver: { select: { id: true, name: true } },
        extensionRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { deliveredAt: 'desc' },
    });
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /parcels/extension-requests — admin sees all extension requests
router.get('/extension-requests', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const requests = await prisma.extensionRequest.findMany({
      include: {
        resident: { select: { id: true, name: true, email: true } },
        parcel: { select: { id: true, trackingNumber: true, expiresAt: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /parcels/collect-qr/:token — resident collects by scanning QR code
router.post('/collect-qr/:token', authenticate, async (req, res) => {
  try {
    const parcel = await prisma.parcel.findUnique({ where: { qrToken: req.params.token } });
    if (!parcel) return res.status(404).json({ error: 'Invalid QR code' });

    if (req.userRole === 'RESIDENT' && parcel.residentId !== req.userId) {
      return res.status(403).json({ error: 'This parcel does not belong to you' });
    }
    if (parcel.status === 'COLLECTED') {
      return res.status(400).json({ error: 'Parcel already collected' });
    }
    if (parcel.status === 'EXPIRED') {
      return res.status(400).json({ error: 'Parcel has expired' });
    }

    const updated = await prisma.parcel.update({
      where: { id: parcel.id },
      data: { status: 'COLLECTED', collectedAt: new Date() },
      include: { resident: { select: { id: true, name: true, email: true } } },
    });

    req.io.emit('parcel:collected', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /extension-requests/:requestId/approve — admin approves extension
router.patch('/extension-requests/:requestId/approve', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const request = await prisma.extensionRequest.findUnique({
      where: { id: req.params.requestId },
      include: { parcel: true },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already reviewed' });
    }

    const newExpiry = new Date(
      request.parcel.expiresAt.getTime() + request.requestedDays * 24 * 60 * 60 * 1000
    );

    const [updatedRequest] = await prisma.$transaction([
      prisma.extensionRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', reviewedAt: new Date() },
      }),
      prisma.parcel.update({
        where: { id: request.parcelId },
        data: { expiresAt: newExpiry, status: 'PENDING', warningSent: false },
      }),
    ]);

    res.json(updatedRequest);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /extension-requests/:requestId/reject — admin rejects extension
router.patch('/extension-requests/:requestId/reject', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { adminNote } = req.body;
  try {
    const request = await prisma.extensionRequest.findUnique({ where: { id: req.params.requestId } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already reviewed' });
    }

    const updated = await prisma.extensionRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED', reviewedAt: new Date(), adminNote: adminNote || null },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /parcels/:id/qr — get QR code image for a parcel (admin/driver use to print)
router.get('/:id/qr', authenticate, requireRole('ADMIN', 'DRIVER'), async (req, res) => {
  try {
    const parcel = await prisma.parcel.findUnique({ where: { id: req.params.id } });
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });
    if (!parcel.qrToken) return res.status(404).json({ error: 'No QR token for this parcel' });

    const dataUrl = await QRCode.toDataURL(parcel.qrToken, { width: 300, margin: 2 });
    res.json({ qrDataUrl: dataUrl, trackingNumber: parcel.trackingNumber });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /parcels/:id/collect — mark as collected (admin override)
router.patch('/:id/collect', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const parcel = await prisma.parcel.findUnique({ where: { id: req.params.id } });
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });
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

// POST /parcels/:id/extension-request — resident requests an extension
router.post('/:id/extension-request', authenticate, requireRole('RESIDENT'), async (req, res) => {
  const { reason, requestedDays } = req.body;
  if (!reason || !requestedDays || typeof requestedDays !== 'number' || requestedDays < 1) {
    return res.status(400).json({ error: 'reason and requestedDays (number ≥ 1) are required' });
  }
  try {
    const parcel = await prisma.parcel.findUnique({ where: { id: req.params.id } });
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });
    if (parcel.residentId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    if (parcel.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only request extension for pending parcels' });
    }

    const existing = await prisma.extensionRequest.findFirst({
      where: { parcelId: parcel.id, status: 'PENDING' },
    });
    if (existing) {
      return res.status(400).json({ error: 'An extension request is already pending for this parcel' });
    }

    const request = await prisma.extensionRequest.create({
      data: { parcelId: parcel.id, residentId: req.userId, reason, requestedDays },
    });

    res.status(201).json(request);
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
