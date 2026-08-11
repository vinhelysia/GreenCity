# GreenCity — Presentation script (English)

**English version of `docs/presentation-script-vi.md`.** Same structure, same
facts, same limits. The lines are written to be *spoken*, not read: short
sentences, few subordinate clauses, no idioms that are hard to land.

**The one rule:** never claim users, revenue, environmental impact, a signed
partner, or a working payment. There is no evidence for any of those. The
strength of this pitch is **one loop that runs end to end and can be traced**.

**Pronunciation notes for the delivery:**

- *ledger* — LEJ-er (the points book)
- *reservation / to reserve* — the buyer holding a lot
- *audit log* — AW-dit log
- *constraint* — kun-STRAYNT (the database rule)
- Say **"the admin"**, not "administrator", every time. Shorter and safer.
- Numbers out loud: 50,000 VND → "fifty thousand dong". 50 points → "fifty points".

---

## 0. Roles (if presenting as a team)

| Role | Job |
|---|---|
| **Narrator** | Slides 1–2 and 6–8, keeps the clock |
| **Demo driver** | Slides 3–4, hands already on the keyboard, two tabs signed in |
| **Engineer** | Slide 5, and takes the architecture / security questions in Q&A |

Presenting alone: keep the same order, and open three browser tabs before you
walk up — seller, buyer, admin — so you never sign in on stage.

---

## 1. The five-minute script — 8 slides, word for word

### Slide 1 · 0:00–0:30 — The broken loop

**On screen:** the tagline — *"Scrap has a buyer. Dumping has a reporter."*

> "A kilo of cardboard in your house has a price. But the person selling it does
> not know that price. The scrap dealer does not know where the material is. And
> a pile of illegally dumped waste on the street is not recorded anywhere at all.
>
> Three things, all disconnected. GreenCity joins them into **one loop** — and
> more importantly, **a loop you can trace**.
>
> Let us say one thing first. This product runs, but it has no real users yet.
> Everything you are about to see is a working feature in the code. None of it
> is a mockup."

*(That last line is the most valuable sentence in the pitch. Say it slowly.)*

---

### Slide 2 · 0:30–1:05 — The product loop today

**On screen:** the five-block diagram

```
Seller submits a photo  →  Admin quotes inside the published price band  →  Listed
   →  Buyer with a Pass reserves (exactly one winner)  →  Admin confirms completion
   →  Points appended to an append-only ledger
                      ↑
   A verified dumping report (the second source of points)
```

> "The loop has five steps.
>
> The seller picks a material, takes one photo, and enters an estimated weight.
> The admin sends a quote — and **the price must fall inside the price band we
> publish** for that material. If the seller accepts, the lot goes on the market.
>
> A buyer with an active Buyer Pass can reserve it. **Each lot has exactly one
> successful reservation.** The second person to click is rejected by the system.
>
> The admin confirms the deal is complete, and points are written to the ledger.
>
> There is a second source of points. A resident reports an illegal dumping site,
> the admin verifies it, and the reporter receives fifty points."

---

### Slide 3 · 1:05–1:50 — Live walkthrough

**Say this before you click:**

> "I am running this on a dedicated demo database. It is not anyone's real data."

**Click order — rehearse exactly this:**

| # | Tab | Action | Say |
|---|---|---|---|
| 1 | Buyer | Open `/cho-online` | "This is the marketplace. Every lot here has an approved price. You can see the material, the weight, and the unit price." |
| 2 | Buyer | Click **Reserve** | "This buyer has an active Pass, so the reservation goes through. The lot is now held." |
| 3 | Admin | Open `/admin/giao-dich` | "On the admin side, that deal has just entered the confirmation queue." |
| 4 | Admin | Click **Confirm completed** | "This is the decisive action. Points are created *after* this step — never before it." |
| 5 | Seller | Open `/diem-thuong`, refresh | "And the points are in the seller's ledger, with the exact transaction that produced them." |

**Fallback if the network dies or the server is cold:** switch to the prepared
screenshots and say it out loud — *"The connection is slow, so I am using
screenshots taken from this same system."* **Never** let a static image pass as
a live action.

---

### Slide 4 · 1:50–2:35 — The account page is the evidence

**Action:** open `/tai-khoan` as the seller, then as the buyer.

> "The account page is where everything comes together. The points balance, the
> recent sell requests, the lots this buyer has reserved, the Buyer Pass status,
> and the dumping reports.
>
> You will notice the payment history is empty. **We left it empty on purpose.**
> No real payment has happened yet. Inventing a row there would have been easy —
> but then this page would stop being evidence.
>
> And one line right on this page: **no cash withdrawal**. Points are not money."

---

### Slide 5 · 2:35–3:20 — Architecture and the trust boundary

**On screen:** Web → API → Database / Storage

> "Three engineering decisions we would like to be judged on.
>
> **One — the server owns the state.** The browser sends *commands*, never a
> status. There is no endpoint that lets a client mark its own order as
> completed.
>
> **Two — the race is settled in the database.** One reservation per lot is not
> a disabled button in the interface. It is a unique constraint in the database,
> plus a conditional update. If two people click in the same millisecond, exactly
> one wins.
>
> **Three — the points ledger only ever appends.** The points table **has no
> balance column**. A balance is the sum of the rows. That means there is no
> field anyone can edit by hand, and every point traces back to the event that
> created it. One event can only grant points once — and that rule lives in the
> database, not only in the code.
>
> Two more. The exact coordinates of a dumping report are visible only to the
> reporter and the admin; the public sees the district, nothing finer. And every
> admin action goes into an audit log."

---

### Slide 6 · 3:20–3:55 — What we have *not* built

**On screen:** the CURRENT / DEMO / ROADMAP table

> "This slide matters as much as the demo.
>
> The rewards catalogue — Starbucks, Highlands, the electricity bill, the water
> bill — **is a prototype**. The code it shows is `DEMO-ONLY`. Clicking it
> deducts nothing, and **we have no relationship with any of those brands**. It
> is there to illustrate the idea of a partnership, not to claim one.
>
> The Buyer Pass in this demo was granted by an admin, with a reason recorded in
> the audit log. That is **an access grant, not a transaction**. The system did
> not record any money.
>
> And the field work — collection, real weighing, cleaning the site — we do not
> coordinate that yet. That is the next piece of work, not finished work."

---

### Slide 7 · 3:55–4:30 — Evidence and roadmap

| | |
|---|---|
| **Running today** | Authentication, sell requests, quoting inside the band, marketplace with one-winner reservation, deal confirmation, dumping reports and verification, the points ledger, the account dashboard, the OpenStreetMap layer, Vietnamese and English |
| **Contest prototype** | The coupon catalogue, the admin-granted Buyer Pass |
| **Not built** | Real payOS checkout, paying the seller, collection scheduling, dispatching cleanup partners, real point redemption |

> "Three things next, in this order.
>
> First, complete one real payment round trip with a payOS merchant account. The
> code is written. The webhook is HMAC-signed and verified on the server. But it
> has never run for real, so we will not say that it works.
>
> Second, add the real weighing step and the payment to the seller.
>
> Third, sign the first agreement with a collection partner, so the cleanup part
> stops sitting outside the system."

---

### Slide 8 · 4:30–5:00 — The ask

> "We are not asking you to judge us on user numbers, because we do not have any.
>
> We are asking you to judge two things. **A loop that runs from end to end, and
> can be traced at every step.** And **the discipline to be clear about what
> already works, what is a simulation, and what is still ahead of us.**
>
> Thank you. We are happy to take questions."

---

## 2. Q&A — prepared answers

**Is this a payment wallet or a loyalty wallet?**
> Neither. Points cannot be withdrawn, transferred, or traded. They are rows in
> an append-only ledger. They record what someone did. They do not store value.

**Can I use one of those coupons today?**
> No. It is a contest prototype. The code reads `DEMO-ONLY`, clicking it deducts
> no points, and we do not claim any relationship with the brands shown.

**How do you stop people farming points?**
> Three layers. First, points are only created after an admin confirms or
> verifies — there is no self-service path. Second, each event can grant points
> exactly once, and that constraint is in the database, not only in the code.
> Third, a report requires a photo and coordinates, and every admin decision is
> written to an audit log. To be honest, fraud control at scale would also need
> rate checks and duplicate detection. We have not built that.

**Is the revenue model proven?**
> No. Fifty thousand dong for thirty days is a **hypothesis**. The price and the
> access gate exist in the product. Real revenue does not.

**Why is the payment history empty?**
> Because no payment has happened. Empty is more honest than a fabricated
> transaction. The page is built to show a real status when there is one.

**How does a buyer pay for the scrap itself?**
> Not through the system yet. The only payment feature in the code is the Buyer
> Pass. After a reservation, the two sides settle it, and the admin confirms the
> deal. Real weighing and platform payment are the next piece of work.

**Only ten collection points on the map?**
> Yes — ten, and four of them are tagged as containers. That is everything the
> OpenStreetMap community has recorded inside the Ho Chi Minh City bounding box
> at the time we pulled the data. We show what actually exists and we cite the
> source, instead of inventing points to make the map look full.

**Why not microservices, or AI image recognition, or blockchain?**
> Because nothing at this scale needs them yet. The architecture is a monolith
> with clear module boundaries, so it can be split later without paying the
> operational cost today. AI classification and similar directions are
> deliberately out of scope for the MVP.

**How is this different from the waste-collection apps that already exist?**
> We do not compete on collection — we do not even do collection yet. The
> difference is **price control and traceability**: a published price band that
> not even an admin can quote outside of, exactly one buyer per lot, and every
> reward point traceable to the event behind it.

**What about user data security?**
> Passwords are hashed with Argon2id. A session is a random token stored hashed
> in the database and it can be revoked. Cookies are HttpOnly. Images are not
> public — they are served through the API. Exact coordinates live in a separate
> table and never reach a public response. We keep a register of eighteen risks
> in the repository.

---

## 3. Sentences you must **not** say

| ❌ Do not say | ✅ Say instead |
|---|---|
| "We have X users" | "We have no real users yet; this is demo data" |
| "Payment is working" | "The payment code is written, but not verified with a real merchant" |
| "Our partners are Starbucks and EVN" | "These illustrate the idea of a partnership; we have no relationship yet" |
| "This buyer bought the Pass" | "An admin granted this Pass for the demo; no money was recorded" |
| "We have collected N tonnes of waste" | (say nothing about impact — we cannot measure it) |
| "Redeem points against your electricity bill" | "Redemption against public services is at the proposal stage" |
| "The system dispatches collection teams" | "Pickup is currently arranged between the two sides" |

---

## 4. Pre-show checklist

**T-30 minutes**
- [ ] Confirm you are pointed at the **dedicated demo database**, not shared data
      (section 1 of `docs/demo-runbook.md`)
- [ ] Hit `/health` until it returns `status: ok` (the free Render tier cold-starts)
- [ ] Reset the demo data if needed — **only on the dedicated demo project**

**T-10 minutes**
- [ ] Three tabs open and signed in: seller / buyer / admin
- [ ] **At least two lots** on the marketplace, so a failure on one still leaves a demo
- [ ] Seller tab already on `/diem-thuong`, so you only refresh
- [ ] Backup screenshots sitting in a hidden slide
- [ ] Browser zoom around 125% so the back row can read it
- [ ] System notifications off, unrelated tabs closed

**T-1 minute**
- [ ] Say it once to yourself: *"no real users · payOS not verified · the catalogue
      is DEMO-ONLY · points are not money"*

---

## 5. Shorter and longer versions

**Three minutes:** drop slides 4 and 7. Run 1 (30s) → 2 (30s) → 3 demo (60s) →
5 cut down to two points (30s) → 6 honesty (20s) → 8 (10s).

**Ten minutes:** keep all eight slides and expand in three places — add the full
seller flow to the demo (submit → admin quote → seller accepts, about ninety
seconds), add an ERD / module-boundary slide after slide 5, and add a market and
revenue-model slide before slide 7, stated clearly as **an unvalidated
hypothesis**.
