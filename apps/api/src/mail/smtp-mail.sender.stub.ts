import type { MailSender, SendMailInput } from './mail.types';

/**
 * Placeholder for production SMTP.
 * Phase 0: not implemented — use MAIL_DRIVER=console|file.
 */
export class SmtpMailSenderStub implements MailSender {
  readonly driver = 'smtp' as const;

  constructor(
    private readonly config: {
      host?: string;
      port?: number;
      user?: string;
      pass?: string;
      from?: string;
    },
  ) {
    if (!config.host || !config.port) {
      throw new Error('MAIL_DRIVER=smtp requires SMTP_HOST and SMTP_PORT');
    }
  }

  send(_input: SendMailInput): Promise<void> {
    return Promise.reject(
      new Error(
        'SMTP mail is not implemented in Phase 0. Use MAIL_DRIVER=console or file.',
      ),
    );
  }
}
