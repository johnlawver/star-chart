import type { Email, Mailer } from "../../src/server/email.js";

/** Keeps every email the server "sends", so tests can read them. */
export class FakeMailer implements Mailer {
  readonly sent: Email[] = [];

  async send(email: Email): Promise<void> {
    this.sent.push(email);
  }

  /** The most recent email to an address, or undefined if none was sent. */
  lastTo(address: string): Email | undefined {
    return this.sent.filter((email) => email.to === address).at(-1);
  }

  /** The value of a "#name=…" part in the link inside an email, such as an invitation's token. */
  static linkParameter(email: Email, name: string): string {
    const match = email.text.match(new RegExp(`#${name}=([^\\s]+)`));
    if (!match?.[1]) throw new Error(`no ${name} link in: ${email.text}`);
    return decodeURIComponent(match[1]);
  }
}
