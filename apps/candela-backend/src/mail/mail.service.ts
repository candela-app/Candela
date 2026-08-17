import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Thin mail sender. Callers never talk to SMTP or SendGrid directly.
 * MAIL_TRANSPORT=smtp now; switch to sendgrid later without changing DocID logic.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(payload: MailPayload): Promise<boolean> {
    const transport = (this.config.get<string>('MAIL_TRANSPORT') || 'log').trim().toLowerCase();
    if (transport === 'log') {
      this.logger.log(`Mail skipped (MAIL_TRANSPORT=log). subject="${payload.subject}"`);
      return false;
    }
    if (transport === 'sendgrid') {
      throw new ServiceUnavailableException(
        'SendGrid is not wired yet. Keep MAIL_TRANSPORT=smtp until a domain is configured.',
      );
    }
    if (transport !== 'smtp') {
      throw new ServiceUnavailableException(`Unknown MAIL_TRANSPORT "${transport}"`);
    }

    const transporter = this.getSmtpTransporter();
    try {
      await transporter.sendMail({
        from: this.fromAddress(),
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      return true;
    } catch (err) {
      this.logger.warn(`SMTP send failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      return false;
    }
  }

  private fromAddress(): string {
    const from = this.config.get<string>('MAIL_FROM')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    return from || user || 'noreply@localhost';
  }

  private getSmtpTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !user || !pass) {
      throw new ServiceUnavailableException(
        'SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (or MAIL_TRANSPORT=log for local testing).',
      );
    }
    const port = Number(this.config.get<string>('SMTP_PORT') || '587');
    const secure =
      (this.config.get<string>('SMTP_SECURE') || '').trim().toLowerCase() === 'true' || port === 465;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    return this.transporter;
  }
}
