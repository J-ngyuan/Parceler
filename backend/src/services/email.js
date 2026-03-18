import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendParcelArrivalEmail({ to, name, trackingNumber, expiresAt }) {
  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Your parcel has arrived!',
    html: `
      <h2>Hi ${name},</h2>
      <p>A parcel has arrived for you at the college drop-off point.</p>
      <p><strong>Tracking number:</strong> ${trackingNumber}</p>
      <p><strong>Collect by:</strong> ${expiry}</p>
      <p>Please collect it within 14 days to avoid it being returned or disposed of.</p>
    `,
  });
}

export async function sendParcelWarningEmail({ to, name, trackingNumber, expiresAt }) {
  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Reminder: Your parcel expires soon!',
    html: `
      <h2>Hi ${name},</h2>
      <p>This is a reminder that your parcel is expiring soon.</p>
      <p><strong>Tracking number:</strong> ${trackingNumber}</p>
      <p><strong>Collect by:</strong> ${expiry}</p>
      <p>Please collect it before the deadline to avoid it being returned or disposed of.</p>
    `,
  });
}
