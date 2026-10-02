import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthzModule } from '../authz/authz.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionModule } from './session.module';
import { GoogleAuthService } from './google-auth.service';
import { GoogleAuthController } from './google-auth.controller';

@Module({
  imports: [AuditModule, SessionModule, AuthzModule],
  controllers: [AuthController, GoogleAuthController],
  providers: [AuthService, PasswordService, GoogleAuthService],
  exports: [AuthService, PasswordService, SessionModule],
})
export class AuthModule {}
