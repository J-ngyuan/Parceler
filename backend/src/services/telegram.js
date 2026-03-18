import TelegramBot from 'node-telegram-bot-api';
import prisma from '../lib/prisma.js';

let bot = null;

export function initTelegramBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not set — Telegram notifications disabled');
    return;
  }

  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `Welcome to Parceler!\n\nTo receive parcel notifications here, link your account:\n1. Log in to the web app\n2. Go to your dashboard and copy your link code\n3. Send: /link YOUR_CODE`
    );
  });

  bot.onText(/\/link (.+)/, async (msg, match) => {
    const code = match[1].trim();
    const chatId = String(msg.chat.id);
    try {
      const user = await prisma.user.findUnique({ where: { linkCode: code } });
      if (!user) {
        return bot.sendMessage(chatId, 'Invalid or expired link code. Generate a new one from the web app.');
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId, linkCode: null },
      });
      bot.sendMessage(chatId, `Linked! Hi ${user.name}, you'll now receive parcel notifications here.`);
    } catch (err) {
      console.error('Telegram link error:', err);
      bot.sendMessage(chatId, 'Something went wrong. Please try again.');
    }
  });

  console.log('Telegram bot started (polling)');
}

export async function sendTelegramMessage(chatId, text) {
  if (!bot) return;
  try {
    await bot.sendMessage(chatId, text);
  } catch (err) {
    console.error('Telegram send error:', err.message);
  }
}

export { bot };
