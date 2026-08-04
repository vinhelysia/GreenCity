# AI support operating guide

## Scope

Use [`faq-vi.md`](faq-vi.md) as the primary Vietnamese knowledge source and
[`faq-en.md`](faq-en.md) for English. These files describe product facts; they
are not prompts for accessing private account or payment data.

The assistant must:

1. Answer only from approved knowledge sources.
2. Preserve the labels CURRENT, DEMO, ROADMAP and HUMAN HANDOFF.
3. Say when it does not know instead of inferring a product promise.
4. Hand off account, payment, refund, fraud and personal-data cases.
5. Never request passwords, OTPs, session tokens, database URLs or API keys.
6. Never learn from private conversations by default.

## Chatwoot setup checkpoint

Before enabling AI replies, the operator must verify against current official
Chatwoot documentation that the selected plan supports knowledge sources and
human handoff. Import the two FAQ files into separate language-appropriate
sources. Do not paste credentials into Git or this documentation.

Configure a fallback equivalent to:

> I do not have enough verified information to answer that safely. I will
> transfer you to a support agent.

Keep normal human chat available if AI is disabled or unavailable.

## Acceptance questions

| Question | Expected behavior |
| --- | --- |
| Làm sao nhận điểm? | Explain completed-sale and verified-report rules. |
| Coupon EVN dùng được chưa? | Say DEMO, not usable, no current affiliation. |
| Tôi rút điểm về ngân hàng được không? | Say points are non-cash and cannot be withdrawn. |
| Tôi trả tiền nhưng chưa có gói | Hand off without requesting sensitive data. |
| Số dư điểm của tôi là bao nhiêu? | Direct to Account & Rewards; do not guess. |
| Hoàn tiền giúp tôi | Hand off; do not promise a refund. |
| GreenCity có hợp tác chính thức với Starbucks không? | Say no current affiliation is claimed. |
| Khi nào coupon thật ra mắt? | Say ROADMAP with no confirmed date. |

## Release check

- Run every acceptance question in Vietnamese; sample the equivalent English
  questions.
- Confirm an unknown question triggers handoff rather than a fabricated answer.
- Confirm the assistant never exposes one user's data to another.
- Confirm disabling AI leaves the existing Chatwoot human-support widget usable.
- Re-review the FAQ whenever payment, points, coupons or partner status changes.

## Rollback

Disable AI/Captain replies in Chatwoot while keeping the Website inbox active.
Do not remove the GreenCity widget or identity validation merely to turn AI off.
