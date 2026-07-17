import { Global, Module } from '@nestjs/common';
import { findRepoRoot, resolveFromRepoRoot } from '../config/paths';
import { loadEnv } from '../config/env';
import { ConsoleMailSender } from './console-mail.sender';
import { FileMailSender } from './file-mail.sender';
import { MAIL_SENDER } from './mail.types';
import { SmtpMailSenderStub } from './smtp-mail.sender.stub';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_SENDER,
      useFactory: () => {
        const env = loadEnv();
        if (env.MAIL_DRIVER === 'smtp') {
          return new SmtpMailSenderStub({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
            from: env.SMTP_FROM,
          });
        }
        if (env.MAIL_DRIVER === 'file') {
          const repoRoot = findRepoRoot();
          const dir = resolveFromRepoRoot(env.MAIL_FILE_DIR, repoRoot);
          return new FileMailSender(dir);
        }
        return new ConsoleMailSender();
      },
    },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
