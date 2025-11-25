import { env } from "../config/env";
import { logger } from "../config/logger";

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  from?: string;
}

// Placeholder for a generic email sending utility
// In a real application, this would integrate with a service like SendGrid, Mailgun, or AWS SES
async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    // TODO: Implement actual email sending logic using a third-party service
    // For now, we'll just log the email content
    logger.info(`Sending email to: ${options.to}`);
    logger.info(`Subject: ${options.subject}`);
    logger.info(`Body: ${options.htmlBody}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${options.to}:`, error);
    return false;
  }
}

export async function sendTableInviteEmail(
  toEmail: string,
  tableName: string,
  inviteCode: string,
  hostDisplayName: string
): Promise<boolean> {
  const subject = `You're invited to play poker at ${tableName}!`;
  const htmlBody = `
    <p>Hello,</p>
    <p>${hostDisplayName} has invited you to join a poker table: <strong>${tableName}</strong>!</p>
    <p>Your invite code is: <strong>${inviteCode}</strong></p>
    <p>Click <a href="${env.APP_URL}/join?code=${inviteCode}">here to join the table</a> or open the app and enter the invite code.</p>
    <p>Good luck and have fun!</p>
  `;

  return sendEmail({
    to: toEmail,
    subject,
    htmlBody,
    from: `Poker App <noreply@${new URL(env.APP_URL).hostname}>`, // Assuming APP_URL is set in env
  });
}
