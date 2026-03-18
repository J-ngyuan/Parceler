import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { notifyWarning } from '../services/notifications.js';

async function runExpiryCheck() {
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  // Send warning for parcels expiring within 2 days
  const expiringSoon = await prisma.parcel.findMany({
    where: {
      status: 'PENDING',
      warningSent: false,
      expiresAt: { lte: twoDaysFromNow },
    },
    include: { resident: true },
  });

  for (const parcel of expiringSoon) {
    await notifyWarning(parcel, parcel.resident);
    await prisma.parcel.update({
      where: { id: parcel.id },
      data: { warningSent: true },
    });
  }

  // Mark overdue parcels as expired
  await prisma.parcel.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  });

  console.log(`Expiry check: ${expiringSoon.length} warnings sent`);
}

export function scheduleExpiryCheck() {
  // Run once on startup
  runExpiryCheck().catch(console.error);

  // Then every day at 9am
  cron.schedule('0 9 * * *', () => {
    runExpiryCheck().catch(console.error);
  });

  console.log('Expiry check scheduled (daily 9am)');
}
