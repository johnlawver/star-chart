# 13: Invitations, roles and password reset

**What to build:** Email goes through an email outbox port, caught locally in development. Owners and Admins send **Invitations**, and accepting one creates the person's login in that Chart. The Owner promotes and demotes **Admins**. Pairing Observatories is limited to Admins and the Owner. Grown-ups can reset a forgotten password by email.

**Blocked by:** 03 (Pair an Observatory and fake parts)

**Status:** done

- [x] All email goes through the email outbox port. In development, emails are caught locally, and tests read the outbox.
- [x] Owners and Admins can invite by email. Accepting creates a grown-up login in that Chart (a person belongs to exactly one Chart).
- [x] Only the Owner can promote a grown-up to Admin or demote an Admin.
- [x] Only Admins and the Owner can pair or unpair Observatories. A plain grown-up on an unpaired Observatory sees "ask an admin to set this up".
- [x] Password reset by email works, and reset links are single-use and expire.
- [x] Permission tests cover every role for each of these actions.

## Notes

- Email goes through a `Mailer` port: SMTP (nodemailer) in real use, a fake outbox in tests. Development email is caught by Mailpit (added to `docker-compose.yml`; inbox on port 8025). New required settings: `APP_URL`, `SMTP_URL`, `EMAIL_FROM` (added to Doppler's `dev` config).
- Invitations: owners and admins send them; the link works once and lasts 7 days. Whether the email already has a login is checked when accepting, not when inviting, so admins can't use invitations to discover accounts.
- Password reset: always answers the same, whether or not the email exists, and sends its email in the background so the timing doesn't give it away either. The link works once and lasts an hour; completing it signs the grown-up out everywhere else.
- Passwords are now at least 8 characters, and sign-up checks all its fields.
- Pairing a printer or scanner now also needs an admin or the owner unlocked on that observatory's screen (from the same chart), not just the screen's credential. The test helper and the smoke test do this.
- Links in emails put their token after `#` and the pages remove it from the address bar, as with phone setup.
- Checked once for real: an invitation sent through SMTP, caught by Mailpit, and accepted through its link in a browser.
