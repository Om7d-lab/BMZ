import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

/**
 * Global so any module can send mail without re-importing this one. The
 * transport is created lazily on first send, so nothing connects at boot.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
