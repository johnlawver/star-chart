import nodemailer from "nodemailer";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/** The only way the server sends email (invitations, password resets), so tests can read what was sent instead. */
export interface Mailer {
  send(email: Email): Promise<void>;
}

/**
 * Sends through any SMTP server. In development that's Mailpit (see docker-compose.yml), which catches every
 * email locally; in production, a real provider. Both come from the SMTP_URL setting.
 */
export function smtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(email) {
      await transport.sendMail({ from, ...email });
    },
  };
}
