export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailSender {
  readonly driver: 'console' | 'file' | 'smtp';
  send(input: SendMailInput): Promise<void>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');
