import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthzModule } from '../authz/authz.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionModule } from './session.module';

@Module({
  imports: [AuditModule, SessionModule, AuthzModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService],
  exports: [AuthService, PasswordService, SessionModule],
})
export class AuthModule {}
