# Email Configuration

SEAL sends email through the notification/email service. If SMTP is not configured, development mode logs the attempted email and returns a skipped delivery result so the main business flow is not broken.

## Local SMTP

```env
EMAIL_FROM="SEAL Hackathon <noreply@example.com>"
EMAIL_DEV_MODE=console
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
```

For Gmail app passwords, either use SMTP settings:

```env
EMAIL_FROM="SEAL Hackathon <your_gmail_address@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_gmail_address@gmail.com
SMTP_PASSWORD=your_gmail_app_password
```

or the legacy aliases already supported by the project:

```env
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
```

The project also accepts the existing two-field local setup:

```env
EMAIL_HOST=your_gmail_address@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
```

When `EMAIL_HOST` contains an email address, the backend treats it as the sender/login email. If `EMAIL_HOST` contains an SMTP server such as `smtp.gmail.com`, you must also provide `SMTP_USER` or `EMAIL_USER` because a password alone is not enough to authenticate.

## Current Email Triggers

- Account approval sends an in-app notification and an account-approved email.
- Account rejection sends an in-app notification and an account-rejected email.
- Event invitations send invitation emails through `POST /api/events/:id/invitations`.

Other documented notification categories, such as scheduled timeline reminders, workshop reminders, feedback reminders, judging assignment messages, and result publication emails, are prepared at the notification-service level but should be connected when their owning backend modules exist.
