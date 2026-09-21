import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Outbound email.
 *
 * In development this points at Mailpit (docker-compose), which accepts
 * anything on :1025 and shows it at :8025, so the whole reset flow can be
 * walked end to end without sending real mail.
 *
 * Nothing here ever logs a token or a reset URL: the address is the most that
 * reaches the log, and only so a failed send can be traced.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private get transport(): Transporter {
    if (this.transporter) return this.transporter;

    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');

    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      secure: this.config.get<boolean>('SMTP_SECURE') ?? false,
      // Mailpit takes no credentials; only pass auth when both are configured.
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    return this.transporter;
  }

  /**
   * Sends the password-reset link.
   *
   * Returns nothing and throws nothing: a mail outage must not change what the
   * caller responds with, because the reset endpoint answers identically for
   * registered and unregistered addresses and an error here would break that.
   */
  async sendPasswordReset(to: string, token: string): Promise<void> {
    const webUrl = this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';
    const url = `${webUrl}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await this.transport.sendMail({
        from: this.config.get<string>('MAIL_FROM'),
        to,
        subject: 'Reset your BMZ Trade Lab password',
        text: [
          'We received a request to reset your BMZ Trade Lab password.',
          '',
          'Open this link to choose a new one. It expires in one hour and can',
          'only be used once:',
          '',
          url,
          '',
          "If you didn't ask for this, you can ignore this email — your password",
          'stays as it is.',
        ].join('\n'),
        html: passwordResetHtml(url),
      });
    } catch (error) {
      this.logger.error(
        `Could not send the password reset email to ${to}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function passwordResetHtml(url: string): string {
  // Inline styles and a table-free layout: the common denominator across mail
  // clients, which strip <style> blocks and ignore most modern CSS.
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#0c1118;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e8ecf1;">
    <div style="max-width:520px;margin:0 auto;background:#141b24;border:1px solid #232c38;border-radius:14px;padding:32px;">
      <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#ffffff;">Reset your password</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#b6c0cc;">
        We received a request to reset your BMZ Trade Lab password. Choose a new
        one using the button below.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block;background:#14b88a;color:#0c1118;font-weight:600;font-size:14px;text-decoration:none;padding:12px 20px;border-radius:10px;">Choose a new password</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#8b97a6;">
        This link expires in one hour and can only be used once. If you didn't
        ask for it, you can ignore this email — your password stays as it is.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#6d7887;word-break:break-all;">
        If the button doesn't work, paste this into your browser:<br />${url}
      </p>
    </div>
  </body>
</html>`;
}
