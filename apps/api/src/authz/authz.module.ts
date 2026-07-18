import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session.module';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [SessionModule],
  providers: [AuthenticatedGuard, RolesGuard],
  exports: [AuthenticatedGuard, RolesGuard],
})
export class AuthzModule {}
