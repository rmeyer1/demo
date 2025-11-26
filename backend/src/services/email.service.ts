import nodemailer from 'nodemailer';
import { env } from '../config/env';

// A helper function to create a Nodemailer transporter.
// It will use Ethereal for testing if no real SMTP credentials are provided.
async function createTransporter() {
  if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS) {
    // Use a real SMTP service if configured
    return nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    });
  } else {
    // Fallback to Ethereal for development/testing
    console.warn("EMAIL_HOST not found, using Ethereal. Emails will not be actually sent.");
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
}

/**
 * Sends a game invitation email.
 * @param to - Recipient's email address.
 * @param tableName - The name of the table to invite the user to.
 * @param inviteCode - The invite code for the table.
 * @param hostDisplayName - The name of the person who is inviting.
 */
async function sendInviteEmail(
  to: string,
  tableName: string,
  inviteCode: string,
  hostDisplayName: string
) {
  const transporter = await createTransporter();
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const joinUrl = `${appUrl}/join?inviteCode=${inviteCode}`;

  const mailOptions = {
    from: env.EMAIL_FROM || '"PokerNook" <noreply@pokernook.com>',
    to,
    subject: `You're invited to a game on PokerNook!`,
    text: `Hello,\n\n${hostDisplayName} has invited you to join their poker game "${tableName}".\n\nUse this invite code to join: ${inviteCode}\n\nOr click this link: ${joinUrl}\n\nSee you at the table!\n- The PokerNook Team`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Hello!</h2>
        <p><strong>${hostDisplayName}</strong> has invited you to join their poker game: <strong>${tableName}</strong>.</p>
        <p>You can join the table by entering the following invite code:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center;">${inviteCode}</p>
        <p>Or by clicking the button below:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${joinUrl}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join the Game</a>
        </div>
        <p>See you at the table!</p>
        <p><em>- The PokerNook Team</em></p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export const emailService = {
  sendInviteEmail,
};
