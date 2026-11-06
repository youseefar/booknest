# Revenue architecture

Platform income today is the 1% platform share of rental payments (unchanged; see
`PAYMENTS.md`). This page records what is built for future revenue and what is
deliberately not built yet. Nothing here touches the Paystack split.

## Built

- **Featured properties.** `Property.featuredUntil` (Date). An administrator sets
  7, 30 or 90 days, or removes it, from the admin listing manager. Only verified
  listings can be featured. Featured cards show a "Featured" badge, and the
  Advertising Disclosure page promises clear labelling. There is no payment
  attached: featuring is a manual admin action until a billing flow exists.
  Logic lives in `services/listing-promotion.js` (tested).
- **Landlord analytics (first step).** `Property.viewCount` counts detail-page
  views by visitors other than the owner or an admin. It shows next to each
  listing on the landlord dashboard. Counts are approximate (bots and repeat
  views are not filtered).

## Not built (needs a decision before building)

| Feature | Suggested design when ready |
| --- | --- |
| Paid featured / sponsored listings | Reuse `featuredUntil`. Add a `Promotion` collection (property, plan, amount, Paystack reference, start/end) and set `featuredUntil` only after server-side Paystack verification. Add a separate `sponsored` label rather than reusing "Featured". |
| Premium landlord subscriptions | `User.plan` + `planExpiresAt`, charged through Paystack plans; gate extras such as more featured slots or analytics. Needs a pricing decision first. |
| Verified agent profiles | A new `agent` role or `User.agentVerification` status with an admin review queue, and a public profile page. Needs verification criteria and legal wording first. |
| Advertising placements | Only after the Advertising Disclosure page is updated; avoid third-party ad scripts without a cookie/consent review. |
| Richer analytics | Per-day views, inquiry-to-booking conversion, saved counts. Add an events collection rather than counters if this grows. |
