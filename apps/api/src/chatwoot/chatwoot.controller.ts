import { Controller, Get, Header } from '@nestjs/common';
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
  /**
   * Never cached. Express ETags an identical body into a 304, which is correct
   * but leaves a per-user identity sitting in the browser's disk cache, and
   * makes the response indistinguishable from a stale one while debugging.
   * The answer is cheap to recompute — an HMAC — so there is nothing to gain
   * by storing it.
   */
  @Get('identity')
  @Header('Cache-Control', 'no-store')
  identity(@CurrentUser() auth: AuthContext): ChatwootIdentity {
    return this.chatwoot.identityFor(auth.user.id);
  }
}
