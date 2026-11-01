# Paystack payments and landlord payouts

The app uses Paystack-hosted checkout and split payments. A student can pay the property's listed monthly price in NGN directly from an available, verified property page; no landlord booking approval is needed first. Paystack sends 99% of a successful payment to the landlord's verified subaccount and 1% to the platform account.

## Configure

1. Local development always uses test mode and requires a Paystack test secret beginning with `sk_test_`. A live key cannot be enabled outside production.
2. For production, set `NODE_ENV=production`, `PAYSTACK_MODE=live`, and configure the live secret beginning with `sk_live_` as `PAYSTACK_SECRET_KEY` in the hosting provider's environment settings.
3. Set `APP_URL` to the app's public HTTPS URL in production. For local testing, use `http://localhost:5000` and keep the browser on that same machine.
4. Configure `MONGODB_URI` and a random `SESSION_SECRET` of at least 32 characters in the host environment, then restart/redeploy.
5. In the Paystack dashboard, configure the webhook URL as `https://<your-app>/payments/paystack/webhook`. The app validates Paystack's HMAC SHA512 signature over the raw request body and independently verifies successful transactions before recording them.
6. Configure password reset and seller inquiry email by setting `RESEND_API_KEY` and `EMAIL_FROM` in Render. Verify the sender domain with Resend and use a sender address on that domain (for example, `Jacob Estate <noreply@your-domain>`). Email is optional in development; when it is not configured, a development-only reset link is shown on the page. Production password resets return service unavailable until email is configured.

Never commit `.env` or paste secret keys into chat. `.env.example` contains placeholders only.

## Landlord payout setup

1. Sign in as a landlord and open **Profile**.
2. Choose a bank and enter the 10-digit account number, then verify the account name returned by Paystack.
3. Save the verified account. Paystack creates or updates the landlord subaccount. The app stores the subaccount code and masked bank details; it does not store the full account number.
4. Complete any additional business or identity verification Paystack requests for the subaccount.

Test and live subaccounts are separate. A landlord must set up the payout account again after switching payment environments. Students cannot start checkout for a listing until its landlord has set up a payout account in the active environment.

The platform share is 1% of the transaction amount. Paystack transaction fees are assigned to the landlord's 99% share; Paystack may still apply settlement timing, account verification, or other account-level requirements. Split settlement is handled by Paystack and is not necessarily an instant bank transfer.

Each listing is atomically reserved while a checkout is active, so two renters cannot start payment for the same home at once. After a reservation expires, the app verifies the old Paystack reference and only releases the listing when that transaction is terminal. If Paystack still reports a pending transaction, checkout stays blocked to prevent a second charge.

## Admin balance withdrawals

The admin dashboard reads the platform's available NGN balance from Paystack. This is not the gross value of all payments: landlord shares are settled to landlord subaccounts, and only the platform share is held in the platform balance. Admins can verify a bank account and request a transfer up to the currently available balance. Paystack may require an OTP or additional transfer permissions. The app stores the Paystack transfer-recipient code and masked bank details, not the full account number.

## Low-storage media policy

The app does not accept property video or image uploads, avoiding media-hosting charges and large uploads. Existing static assets and listing image URLs remain supported. Property listing fields have size limits, and each listing accepts at most 20 short amenity labels. Older video links may remain in MongoDB for compatibility but are no longer requested by the app.

Property discovery uses a weighted MongoDB text index on listing titles, areas, and addresses, and serves 12 results per page. Bedroom and bathroom counts are optional owner-provided details; existing listings remain valid and never display guessed counts.

## Test before launch

1. Sign in as a student and open an available, verified property.
2. Ensure the landlord has saved a test-mode payout account. Choose **Pay with Paystack**. The app creates an awaiting-payment booking record and sends the listed price to Paystack in kobo with the landlord subaccount.
3. Complete checkout with a test payment method from Paystack's test-mode documentation. The app verifies the transaction with Paystack before recording it as paid and marking the property rented.

Do not test live payments with real student accounts. Confirm a small controlled live transaction and the settlement split in the Paystack dashboard before opening checkout to students.

The student dashboard and **My Bookings** page show each paid home, its photo, and its expiry date. A booking expires one calendar month after the verified payment date, clamping to the last day of shorter months. Students can cancel an active booking; cancellation does not issue an automatic refund. If no other active stay exists, the home is released. Expired or cancelled stays can be rebooked when the home is available, starting a fresh monthly period after the next successful payment.

Expired stays are synchronized when students load the dashboard, browse properties, or open a property, so a home becomes available again as its monthly period ends.