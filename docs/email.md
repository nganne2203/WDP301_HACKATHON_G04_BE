# Email Configuration

SEAL sends email through `src/modules/notifications/email.service.js`, backed by a centralized Gmail SMTP transporter in `src/configs/mail.js`.

## Gmail SMTP Setup

Required environment variables:

```env
GMAIL_USER=your.gmail.account@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
MAIL_FROM="SEAL Hackathon <your.gmail.account@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_DEV_MODE=silent
```

- `GMAIL_USER`: Gmail account used for SMTP authentication.
- `GMAIL_APP_PASSWORD`: Gmail app password for the account. Use the app password value, not the normal account password.
- `MAIL_FROM`: Sender shown to recipients. For Gmail SMTP, keep the email address aligned with `GMAIL_USER` unless the Gmail account is configured to send as another address.
- `SMTP_HOST`: Optional. Defaults to `smtp.gmail.com`.
- `SMTP_PORT`: Optional. Defaults to `587`, Gmail's STARTTLS submission port.
- `SMTP_SECURE`: Optional. Defaults to `false` for port `587`. Use `true` only for implicit TLS on port `465`.
- `EMAIL_DEV_MODE`: Optional. In local development/test, `console` logs skipped emails when SMTP is not configured. In production, use `silent`.

## Startup Verification

On API startup, the backend calls:

```js
await transporter.verify()
```

Successful verification logs:

```text
[2026-06-25T00:00:00.000Z] INFO SMTP Ready {"provider":"gmail-smtp","host":"smtp.gmail.com","port":587,"secure":false,"family":4,"user":"yo***l@gmail.com","from":"SEAL Hackathon <your.gmail.account@gmail.com>"}
```

If verification fails, startup logs structured diagnostics and keeps the API process available:

```text
[2026-06-25T00:00:00.000Z] ERROR SMTP verification failed {"provider":"gmail-smtp","error":{"name":"Error","message":"Invalid login","code":"EAUTH","responseCode":535,"response":"535-5.7.8 Username and Password not accepted"},"probableCauses":["Invalid Gmail App Password","Gmail account is not configured to allow app passwords"]}
```

Probable causes include:

- Invalid Gmail App Password.
- Missing `GMAIL_USER`, `GMAIL_APP_PASSWORD`, or `MAIL_FROM`.
- Gmail account not configured for app passwords.
- SMTP connectivity issue between Railway and `smtp.gmail.com:587`.
- Railway container IPv6 routing failure, shown as `ENETUNREACH ... :465`. The backend forces Gmail SMTP sockets over IPv4 to avoid this.
- Railway timeout on `smtp.gmail.com:465`. The backend defaults to port `587` with STARTTLS because it is usually the safer SMTP submission path in hosted containers.

## Railway Setup

1. Open the Railway project and select the backend service.
2. Open `Variables`.
3. Add:

```env
GMAIL_USER=your.gmail.account@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
MAIL_FROM="SEAL Hackathon <your.gmail.account@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_DEV_MODE=silent
```

4. Remove any old legacy email-provider API key variables.
5. Redeploy the backend service.
6. Check Railway logs for `SMTP Ready`.
7. Send a test email with `POST /api/test-email`.

## Test Endpoint

```http
POST /api/test-email
Content-Type: application/json

{
  "to": "participant@example.com"
}
```

The endpoint sends a fixed test email through the same `EMAIL_SERVICE` used by production flows.

## Current Email Triggers

- Account approval sends an in-app notification and an account-approved email.
- Account rejection sends an in-app notification and an account-rejected email.
- Event invitations send invitation emails through `POST /api/events/:id/invitations`.
- Team creation/invitation sends team invitation links through `POST /api/teams` and `POST /api/teams/:id/invitations`.
- If a team invitation email does not belong to an existing user, the backend creates an approved temporary account, emails the temporary password, and marks the account with `mustChangePassword`.
- Team invitation acceptance sends a confirmation success email.
- Team auto-rejection sends a rejection notification/email when the confirmed team limit is reached.
- Team invitation decline notifies the team leader.

Team invitation links use:

```env
FRONTEND_URL=http://localhost:5173
TEAM_INVITATION_EXPIRES_HOURS=72
TEAM_INVITATION_TEMP_PASSWORD=test
```

Other documented notification categories, such as scheduled timeline reminders, workshop reminders, feedback reminders, judging assignment messages, and result publication emails, are prepared at the notification-service level but should be connected when their owning backend modules exist.

## Testing Checklist

- `npm test`
- Start the API and confirm logs include `SMTP Ready`.
- `POST /api/test-email` to a non-owner recipient.
- Approve a pending participant and confirm account-approved email.
- Reject a pending participant and confirm account-rejected email.
- Send event invitations from coordinator event management.
- Create a team with a new invited member and confirm temporary-account plus team-invitation emails.
- Accept a team invitation and confirm membership email.
- Decline a team invitation and confirm leader notification email.

## References

- Railway variables: https://docs.railway.com/variables
- Railway logs: https://docs.railway.com/observability/logs
- Gmail app passwords: https://support.google.com/accounts/answer/185833
- Nodemailer SMTP transport: https://nodemailer.com/smtp
