import { Logger } from '@nestjs/common';
import type { MailSender, SendMailInput } from './mail.types';

/** Dev default: log mail to the console (no SMTP). */
export class ConsoleMailSender implements MailSender {
  readonly driver = 'console' as const;
  private readonly log = new Logger(ConsoleMailSender.name);

  async send(input: SendMailInput): Promise<void> {
    this.log.log(
      `[mail] to=${input.to} subject=${JSON.stringify(input.subject)}\n${input.text}`,
    );
  }
}
