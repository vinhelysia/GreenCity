import { Controller, Get } from '@nestjs/common';
import type { ChatwootIdentity } from '@greencity/shared';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { ChatwootService } from './chatwoot.service';

@Controller('chatwoot')
export class ChatwootController {
  constructor(private readonly chatwoot: ChatwootService) {}

  /**
   * Verified identity for the *calling* user.
   *
   * Deliberately takes no id parameter. The subject is read from the session
   * the global AuthenticatedGuard already resolved, so there is no request
   * shape that asks for somebody else's hash — anonymous callers get 401 before
   * this method runs.
   */
  @Get('identity')
  identity(@CurrentUser() auth: AuthContext): ChatwootIdentity {
    return this.chatwoot.identityFor(auth.user.id);
  }
}
