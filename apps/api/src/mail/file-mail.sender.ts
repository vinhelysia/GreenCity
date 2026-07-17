import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MailSender, SendMailInput } from './mail.types';

/** Dev: write each message as a JSON file under MAIL_FILE_DIR. */
export class FileMailSender implements MailSender {
  readonly driver = 'file' as const;

  constructor(private readonly dir: string) {}

  async send(input: SendMailInput): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    const full = path.join(this.dir, name);
    await writeFile(
      full,
      JSON.stringify({ ...input, createdAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
  }
}
