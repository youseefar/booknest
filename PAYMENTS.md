# Paystack test payments

The app uses Paystack-hosted checkout in test mode. A student can pay the property's listed monthly price in NGN directly from an available, verified property page; no landlord booking approval is needed first.

## Configure

1. In the Paystack dashboard, switch to Test Mode and copy the test **Secret Key**.
2. Add `PAYSTACK_SECRET_KEY=sk_test_...` to the local `.env` file. The server deliberately rejects live keys.
3. Set `APP_URL` to the public base URL Paystack should return to. For local testing, use `http://localhost:5000` and keep the browser on that same machine.
4. Restart the server.

Never commit `.env` or paste secret keys into chat. `.env.example` contains placeholders only.

## Test a payment

1. Sign in as a student and open an available, verified property.
2. Choose **Pay with Paystack**. The app creates an awaiting-payment booking record and sends the listed price to Paystack in kobo.
3. Complete checkout with a test payment method from Paystack's test-mode documentation. The app verifies the transaction with Paystack before recording it as paid and marking the property rented.

The student dashboard and **My Bookings** page show each paid home, its photo, and its expiry date. A booking expires one calendar month after the verified payment date, clamping to the last day of shorter months. Students can cancel an active booking; cancellation does not issue an automatic refund. If no other active stay exists, the home is released. Expired or cancelled stays can be rebooked when the home is available, starting a fresh monthly period after the next successful payment.

Expired stays are synchronized when students load the dashboard, browse properties, or open a property, so a home becomes available again as its monthly period ends.