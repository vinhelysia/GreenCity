# GreenCity — Narration only

Just the words. Nothing to read but what you say out loud.
Bracketed lines are cues — do not read them.

---

## 1 · 0:00

*[tagline on screen]*

A kilo of cardboard in your house has a price.

But the person selling it does not know that price. The scrap dealer does not
know where the material is. And a pile of illegally dumped waste on the street
is not recorded anywhere at all.

Three things, all disconnected. GreenCity joins them into one loop — and more
importantly, a loop you can trace.

Let us say one thing first. This product runs, but it has no real users yet.
Everything you are about to see is a working feature in the code. None of it is
a mockup.

*[slow down on that last line]*

---

## 2 · 0:30

*[five-block diagram]*

The loop has five steps.

The seller picks a material, takes one photo, and enters an estimated weight.

The admin sends a quote — and the price must fall inside the price band we
publish for that material. If the seller accepts, the lot goes on the market.

A buyer with an active Buyer Pass can reserve it. Each lot has exactly one
successful reservation. The second person to click is rejected by the system.

The admin confirms the deal is complete, and points are written to the ledger.

There is a second source of points. A resident reports an illegal dumping site,
the admin verifies it, and the reporter receives fifty points.

---

## 3 · 1:05 — live demo

I am running this on a dedicated demo database. It is not anyone's real data.

*[buyer tab → marketplace]*
This is the marketplace. Every lot here has an approved price. You can see the
material, the weight, and the unit price.

*[click Reserve]*
This buyer has an active Pass, so the reservation goes through. The lot is now
held.

*[admin tab → transactions]*
On the admin side, that deal has just entered the confirmation queue.

*[click Confirm completed]*
This is the decisive action. Points are created after this step — never before
it.

*[seller tab → points, refresh]*
And the points are in the seller's ledger, with the exact transaction that
produced them.

*[if the network fails]*
The connection is slow, so I am using screenshots taken from this same system.

---

## 4 · 1:50

*[account page, seller then buyer]*

The account page is where everything comes together. The points balance, the
recent sell requests, the lots this buyer has reserved, the Buyer Pass status,
and the dumping reports.

You will notice the payment history is empty. We left it empty on purpose. No
real payment has happened yet. Inventing a row there would have been easy — but
then this page would stop being evidence.

And one line right on this page: no cash withdrawal. Points are not money.

---

## 5 · 2:35

*[architecture diagram]*

Three engineering decisions we would like to be judged on.

One — the server owns the state. The browser sends commands, never a status.
There is no endpoint that lets a client mark its own order as completed.

Two — the race is settled in the database. One reservation per lot is not a
disabled button in the interface. It is a unique constraint in the database,
plus a conditional update. If two people click in the same millisecond, exactly
one wins.

Three — the points ledger only ever appends. The points table has no balance
column. A balance is the sum of the rows. That means there is no field anyone
can edit by hand, and every point traces back to the event that created it. One
event can only grant points once — and that rule lives in the database, not only
in the code.

Two more. The exact coordinates of a dumping report are visible only to the
reporter and the admin; the public sees the district, nothing finer. And every
admin action goes into an audit log.

---

## 6 · 3:20

*[CURRENT / DEMO / ROADMAP table]*

This slide matters as much as the demo.

The rewards catalogue — Starbucks, Highlands, the electricity bill, the water
bill — is a prototype. The code it shows is demo only. Clicking it deducts
nothing, and we have no relationship with any of those brands. It is there to
illustrate the idea of a partnership, not to claim one.

The Buyer Pass in this demo was granted by an admin, with a reason recorded in
the audit log. That is an access grant, not a transaction. The system did not
record any money.

And the field work — collection, real weighing, cleaning the site — we do not
coordinate that yet. That is the next piece of work, not finished work.

---

## 7 · 3:55

*[evidence and roadmap table]*

Three things next, in this order.

First, complete one real payment round trip with a payOS merchant account. The
code is written. The webhook is signed and verified on the server. But it has
never run for real, so we will not say that it works.

Second, add the real weighing step and the payment to the seller.

Third, sign the first agreement with a collection partner, so the cleanup part
stops sitting outside the system.

---

## 8 · 4:30

We are not asking you to judge us on user numbers, because we do not have any.

We are asking you to judge two things. A loop that runs from end to end, and can
be traced at every step. And the discipline to be clear about what already
works, what is a simulation, and what is still ahead of us.

Thank you. We are happy to take questions.

---

*Q&A answers, the do-not-say list and the pre-show checklist are in
`presentation-script-en.md`.*
