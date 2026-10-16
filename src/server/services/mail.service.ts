// Minimal SMTP mailer. Disabled unless SMTP_HOST (and SMTP_USER/SMTP_PASS for auth) are set,
// so previews and local dev behave safely: reset links are simply not sent.
import nodemailer from 'nodemailer';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn('[mail] SMTP_HOST not configured; password reset email not sent.');
    return false;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user || 'no-reply@restrocontrol.app';
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your RestroControl password',
    text: `We received a request to reset your RestroControl password.\n\nOpen this link within 30 minutes to choose a new password:\n${resetUrl}\n\nIf you did not ask for this, you can ignore this email - your password stays unchanged.`,
  });
  return true;
}
