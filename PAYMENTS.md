# Paystack payments and landlord payouts

The app uses Paystack-hosted checkout and split payments. A student can pay the property's listed monthly price in NGN directly from an available, verified property page; no landlord booking approval is needed first. Paystack sends 99% of a successful payment to the landlord's verified subaccount and 1% to the platform account.

## Configure

1. For local development, use `PAYSTACK_MODE=test` and a Paystack test secret beginning with `sk_test_`. Test mode is the default outside production.
2. To intentionally use a live key during local development, set `PAYSTACK_MODE=live` and provide a live secret beginning with `sk_live_`. This can charge real money; use a controlled transaction and never commit the key.
3. For production, set `NODE_ENV=production`, `PAYSTACK_MODE=live`, and configure the live secret as `PAYSTACK_SECRET_KEY` in the hosting provider's environment settings.
4. Set `APP_URL` to the app's public HTTPS URL in production. For local testing, use `http://localhost:5000` and keep the browser on that same machine.
5. Configure `MONGODB_URI` and a strong `SESSION_SECRET` in the host environment, then restart/redeploy.

Never commit `.env` or paste secret keys into chat. `.env.example` contains placeholders only.

## Landlord payout setup

1. Sign in as a landlord and open **Profile**.
2. Choose a bank and enter the 10-digit account number, then verify the account name returned by Paystack.
3. Save the verified account. Paystack creates or updates the landlord subaccount. The app stores the subaccount code and masked bank details; it does not store the full account number.
4. Complete any additional business or identity verification Paystack requests for the subaccount.

Test and live subaccounts are separate. A landlord must set up the payout account again after switching payment environments. Students cannot start checkout for a listing until its landlord has set up a payout account in the active environment.

The platform share is 1% of the transaction amount. Paystack transaction fees are assigned to the landlord's 99% share; Paystack may still apply settlement timing, account verification, or other account-level requirements. Split settlement is handled by Paystack and is not necessarily an instant bank transfer.

## Admin balance withdrawals

The admin dashboard reads the platform's available NGN balance from Paystack. This is not the gross value of all payments: landlord shares are settled to landlord subaccounts, and only the platform share is held in the platform balance. Admins can verify a bank account and request a transfer up to the currently available balance. Paystack may require an OTP or additional transfer permissions. The app stores the Paystack transfer-recipient code and masked bank details, not the full account number.

## Property videos

Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the host environment. New property videos are uploaded to Cloudinary; MongoDB stores the optimized video URL and a 640x360 poster URL. Listing cards load only the poster, and the native video player requests video data only after a visitor presses play. Cloudinary automatically selects a delivery format and compression quality. Uploads accept one MP4, MOV, or WEBM video up to 50 MB. Existing photo-backed listings remain viewable.

## Test before launch

1. Sign in as a student and open an available, verified property.
2. Ensure the landlord has saved a test-mode payout account. Choose **Pay with Paystack**. The app creates an awaiting-payment booking record and sends the listed price to Paystack in kobo with the landlord subaccount.
3. Complete checkout with a test payment method from Paystack's test-mode documentation. The app verifies the transaction with Paystack before recording it as paid and marking the property rented.

Do not test live payments with real student accounts. Confirm a small controlled live transaction and the settlement split in the Paystack dashboard before opening checkout to students.

The student dashboard and **My Bookings** page show each paid home, its photo, and its expiry date. A booking expires one calendar month after the verified payment date, clamping to the last day of shorter months. Students can cancel an active booking; cancellation does not issue an automatic refund. If no other active stay exists, the home is released. Expired or cancelled stays can be rebooked when the home is available, starting a fresh monthly period after the next successful payment.

Expired stays are synchronized when students load the dashboard, browse properties, or open a property, so a home becomes available again as its monthly period ends.