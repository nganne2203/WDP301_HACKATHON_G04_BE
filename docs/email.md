# Email Configuration

SEAL sends email through the notification/email service using the Resend API. The previous network mail transport is no longer used by the backend, so hosted environments such as Railway and Render only need HTTPS access to Resend.

## Resend Setup

```env
RESEND_API_KEY=re_your_resend_api_key
EMAIL_DEV_MODE=silent
```

The sender is fixed in code as:

```text
SEAL Hackathon <onboarding@resend.dev>
```

This sender is used because the project does not currently own a verified custom email domain.

If `RESEND_API_KEY` is missing, startup logs a warning and the application continues running. Email sends return a skipped result instead of breaking the business flow.

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
