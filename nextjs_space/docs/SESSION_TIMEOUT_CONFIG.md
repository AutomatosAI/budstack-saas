# Session Timeout Configuration

This document explains how to configure session timeouts for the BudStack application using Clerk.

## Problem

Previously, user sessions would never expire, which caused issues:
- Users couldn't navigate to the sign-in page when already logged in
- Sessions persisted indefinitely, creating security concerns
- No automatic logout after periods of inactivity

## Solution

We've implemented automatic session expiration checking that works in conjunction with Clerk's session timeout settings.

## Configuration Steps

### 1. Configure Session Timeout in Clerk Dashboard

Session timeout must be configured in the Clerk Dashboard (not in code):

1. Navigate to your Clerk Dashboard: https://dashboard.clerk.com
2. Select your application
3. Go to **Sessions** in the left sidebar
4. Configure the following settings:

   **Inactivity Timeout:**
   - Toggle **ON** "Inactivity timeout"
   - Set the duration (e.g., 1 hour, 24 hours, 7 days)
   - This logs users out after a period of inactivity

   **Maximum Lifetime:**
   - Toggle **ON** "Maximum lifetime"
   - Set the maximum duration (e.g., 7 days, 30 days)
   - This sets an absolute maximum session duration regardless of activity

   **Important:** At least one of these settings must be enabled. You cannot disable both.

### 2. Application-Level Session Checking

The application includes a `SessionExpirationChecker` component that:
- Monitors session expiration times
- Automatically signs out users when their session expires
- Redirects to the login page after expiration

This component is automatically included in the root layout and requires no additional configuration.

### 3. Login Page Access

The login page has been updated to allow authenticated users to:
- View their current session status
- Sign out and sign in as a different user
- Navigate to their dashboard

This resolves the issue where authenticated users couldn't access the login page.

## Recommended Settings

For a medical cannabis SaaS platform, we recommend:

- **Inactivity Timeout:** 24 hours
  - Balances security with user convenience
  - Prevents unauthorized access if a user leaves their device unattended

- **Maximum Lifetime:** 7 days
  - Ensures sessions don't persist indefinitely
  - Forces periodic re-authentication for security

## Testing

To test session expiration:

1. Configure a short inactivity timeout (e.g., 5 minutes) in Clerk Dashboard
2. Log in to the application
3. Wait for the timeout period
4. Try to navigate to a protected route
5. You should be automatically redirected to the login page

## Troubleshooting

### Sessions Still Not Expiring

- Verify that session timeout is enabled in Clerk Dashboard
- Check that the `SessionExpirationChecker` component is included in your layout
- Check browser console for any errors related to session checking

### Users Can't Access Login Page

- The login page now allows authenticated users to sign out
- If issues persist, clear browser cookies and try again

### Session Expires Too Quickly

- Adjust the inactivity timeout in Clerk Dashboard
- Consider increasing the maximum lifetime if needed

## Code References

- `components/session-expiration-checker.tsx` - Session expiration monitoring
- `app/auth/login/[[...rest]]/page.tsx` - Updated login page with sign-out option
- `app/layout.tsx` - Root layout with SessionExpirationChecker
