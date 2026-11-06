# Google sign-in

Jacob Estate supports "Continue with Google" alongside email and password. It
uses Google's OpenID Connect authorization-code flow with PKCE and a random
`state` value, implemented with Node's built-in `fetch`. No new npm package is
required.

## Required configuration

Set these in the deployment environment (for Render: Environment settings). Do
not commit them.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (keep private) |
| `APP_URL` | Public URL of the app (already required in production) |
| `GOOGLE_CALLBACK_URL` | Optional. Defaults to `APP_URL` + `/auth/google/callback` |

If the client ID or secret is missing, the Google buttons stay hidden and
password sign-in keeps working.

## Google Cloud Console setup

1. Open Google Cloud Console, create or choose a project, and configure the
   OAuth consent screen (external, with your app name and support email).
2. Create credentials > OAuth client ID > Web application.
3. Add these Authorized redirect URIs (they must match exactly):
   - `https://YOUR-RENDER-SERVICE.onrender.com/auth/google/callback`
   - `http://localhost:5000/auth/google/callback` (local development)
4. Copy the client ID and secret into the environment variables above.

## Behaviour

- **Registration:** the home seeker and property owner registration pages each
  have a Google button that creates a student or landlord account. Google can
  never create an administrator. The role is chosen from a fixed allow-list on
  the server.
- **Login:** the login page signs in people who already use Google. If no
  account exists for that email, no account is created silently; the person is
  sent to the registration page to choose an account type.
- **Duplicate email protection:** only Google accounts with a verified email are
  accepted, emails are unique, and a Google sign-in never creates a second
  account for an email that already exists.
- **Account linking:** if a password account already uses the Google email, the
  person must enter that account's password once before Google is linked. This
  stops someone from taking over an account just by controlling a matching
  email. Roles and existing data are never changed by linking.
- **Administrators:** administrator accounts cannot sign in or link through
  Google; they must use email and password.
- **Passwords:** accounts created through Google receive a random password the
  person does not know. They can set their own with "Forgot your password?".
- **Failures:** cancelled sign-ins, expired or tampered sessions, unverified
  Google emails and Google outages show a clear message on the login page.
