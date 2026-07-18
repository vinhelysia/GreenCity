import { Global, Module } from '@nestjs/common';
import { SessionService } from './session.service';

/** Global session resolution for authz guards and auth controllers. */
@Global()
@Module({
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
