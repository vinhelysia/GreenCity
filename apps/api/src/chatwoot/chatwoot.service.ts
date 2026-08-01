import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { ChatwootIdentity } from '@greencity/shared';
import { loadEnv } from '../config/env';

/**
 * Issues the HMAC that lets a Chatwoot agent trust who they are talking to.
 *
 * Without it the widget runs anonymous: anyone can type "I am user X", so
 * agents cannot safely discuss balances, payments, or order history. The hash
 * is what turns a claim into a verified identity, and it is only trustworthy
 * because the secret never leaves this process.
 */
@Injectable()
export class ChatwootService {
  private secret(): string | null {
    return loadEnv().CHATWOOT_HMAC_TOKEN?.trim() || null;
  }

  /**
   * The caller's id comes from their session, never from a parameter — that is
   * the whole security property. Accepting an id from the request would let
   * any signed-in user mint proof of being any other user.
   */
  identityFor(userId: string): ChatwootIdentity {
    const secret = this.secret();
    if (!secret) {
      // A deployment state, not a fault: identity validation simply is not
      // switched on yet. 503 keeps it distinguishable from a real failure.
      throw new ServiceUnavailableException({
        code: 'CHATWOOT_IDENTITY_NOT_CONFIGURED',
        message: 'Chatwoot identity validation is not configured',
      });
    }

    return {
      userId,
      // Chatwoot specifies HMAC-SHA256 over the identifier, hex encoded.
      identifierHash: createHmac('sha256', secret).update(userId).digest('hex'),
    };
  }
}
