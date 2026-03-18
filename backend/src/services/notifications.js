import { sendParcelArrivalEmail, sendParcelWarningEmail } from './email.js';
import { sendTelegramMessage } from './telegram.js';

export async function notifyArrival(parcel, resident) {
  const promises = [];

  // Email
  promises.push(
    sendParcelArrivalEmail({
      to: resident.email,
      name: resident.name,
      trackingNumber: parcel.trackingNumber,
      expiresAt: parcel.expiresAt,
    }).catch((err) => console.error('Arrival email error:', err))
  );

  // Telegram
  if (resident.telegramChatId) {
    const expiry = new Date(parcel.expiresAt).toLocaleDateString('en-GB');
    promises.push(
      sendTelegramMessage(
        resident.telegramChatId,
        `📦 Your parcel has arrived!\nTracking: ${parcel.trackingNumber}\nCollect by: ${expiry}`
      ).catch((err) => console.error('Arrival telegram error:', err))
    );
  }

  await Promise.allSettled(promises);
}

export async function notifyWarning(parcel, resident) {
  const promises = [];

  promises.push(
    sendParcelWarningEmail({
      to: resident.email,
      name: resident.name,
      trackingNumber: parcel.trackingNumber,
      expiresAt: parcel.expiresAt,
    }).catch((err) => console.error('Warning email error:', err))
  );

  if (resident.telegramChatId) {
    const expiry = new Date(parcel.expiresAt).toLocaleDateString('en-GB');
    promises.push(
      sendTelegramMessage(
        resident.telegramChatId,
        `⚠️ Reminder: Your parcel expires in 2 days!\nTracking: ${parcel.trackingNumber}\nCollect by: ${expiry}`
      ).catch((err) => console.error('Warning telegram error:', err))
    );
  }

  await Promise.allSettled(promises);
}
