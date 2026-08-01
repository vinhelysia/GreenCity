import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { ChatwootController } from './chatwoot.controller';
import { ChatwootService } from './chatwoot.service';

@Module({
  imports: [AuthzModule],
  controllers: [ChatwootController],
  providers: [ChatwootService],
})
export class ChatwootModule {}
