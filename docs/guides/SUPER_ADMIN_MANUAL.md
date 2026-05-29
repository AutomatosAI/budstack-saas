
# BudStack Super Admin Manual

**Platform Management & Operations Guide**

---

## Table of Contents
1. [Overview](#overview)
2. [Dashboard](#dashboard)
3. [Tenant Management](#tenant-management)
4. [Onboarding New Tenants](#onboarding-new-tenants)
5. [Analytics & Reporting](#analytics--reporting)
6. [Platform Configuration](#platform-configuration)
7. [Domain Management](#domain-management)
8. [API Management](#api-management)
9. [System Monitoring](#system-monitoring)
10. [Security & Compliance](#security--compliance)

---

## Overview

### Role & Responsibilities

As a Super Admin, you are responsible for:
- Onboarding new tenants (dispensaries)
- Managing platform-wide settings
- Monitoring system health
- Ensuring compliance
- Managing tenant provisioning
- Configuring domains and subdomains
- Overseeing all tenant operations

### Access Credentials

**Login URL**: `https://budstack.to/super-admin`  
**Credentials**: Provided securely during setup

---

## Dashboard

### Main Dashboard Components

**Platform Overview**
- Total tenants
- Active tenants
- Pending onboarding
- Total revenue (if billing is enabled)

**Recent Activity**
- New tenant signups
- Recent orders across platform
- System alerts
- API status

**Quick Actions**
- Onboard new tenant
- View all tenants
- Check analytics
- System settings

### Navigation

- **Dashboard**: Overview and quick stats
- **Tenants**: Manage all tenant accounts
- **Onboarding**: Process new tenant applications
- **Analytics**: Platform-wide metrics
- **Settings**: System configuration
- **API Management**: Doctor Green API settings

---

## Tenant Management

### Viewing All Tenants

Navigate to **Tenants** to see:
- Tenant list with key information
- Status (active, pending, suspended)
- Subdomain
- Date joined
- Last activity
- Quick actions

### Tenant Information

For each tenant, view:
- **Business Details**: Name, contact, licenses
- **Store URL**: Subdomain and custom domain
- **Subscription**: Plan, billing status
- **Statistics**: Orders, revenue, customers
- **Configuration**: API keys, settings

### Tenant Actions

**Available Actions:**
- View tenant details
- Edit tenant information
- Suspend/reactivate tenant
- View tenant's store
- Access tenant analytics
- Reset tenant credentials
- Delete tenant (with caution)

### Tenant Statuses

- **Active**: Fully operational
- **Pending**: Onboarding in progress
- **Suspended**: Temporarily disabled
- **Inactive**: Not currently operating

---

## Onboarding New Tenants

### The Onboarding Process

**Step 1: Initial Application**
- Tenant fills out onboarding form
- Submits business information
- Provides licensing documentation

**Step 2: Review & Verification**
1. Navigate to **Onboarding** tab
2. Review pending applications
3. Verify:
   - Business licenses
   - Regulatory compliance
   - Contact information
   - Account/activation status

**Step 3: Approval**
1. Click on pending application
2. Review all submitted information
3. Options:
   - **Approve**: Create tenant account
   - **Request More Info**: Send message to applicant
   - **Reject**: Decline with reason

**Step 4: Account Creation**
Upon approval, the system automatically:
- Creates tenant admin account
- Generates unique subdomain
- Configures DNS (CNAME record via Namecheap)
- Activates the tenant account
- Sends welcome email with credentials

**Step 5: Initial Setup Support**
- Contact tenant to confirm receipt
- Provide onboarding materials
- Schedule training call (optional)
- Monitor initial setup progress

### Onboarding Form Fields

**Business Information**
- Business name
- Legal entity name
- Business type
- Years in operation

**Contact Information**
- Primary contact name
- Email address
- Phone number
- Business address

**Licensing & Compliance**
- Medical cannabis license number
- License expiration date
- Regulatory authority
- Additional certifications

**Technical Requirements**
- Desired subdomain
- Custom domain (if any)
- Expected order volume
- Integration needs

### Tenant Provisioning & Activation

**Manual Provisioning Model**
- Tenants are created and activated manually by a super-admin
- Activate a tenant by setting `isActive` on the tenant record
- Assign the tenant's template and configure its domain/subdomain
- No purchase gate controls platform access

**Activating a Tenant**
1. Create or approve the tenant record
2. Set `isActive` to enable the account
3. Assign a template to the tenant
4. Configure the domain/subdomain

> **Note:** `tenants.nftTokenId` is an optional legacy field on the tenant record. It does not gate access or activation and can be left empty.

---

## Analytics & Reporting

### Platform Analytics

Navigate to **Analytics** for:

**Tenant Metrics**
- Total tenants
- Growth rate
- Churn rate
- Geographic distribution

**Order Metrics**
- Total orders across platform
- Average order value
- Order trends over time
- Top-selling products

**Revenue Metrics**
- Platform revenue (if applicable)
- Revenue per tenant
- Growth trends
- Forecasting

**User Metrics**
- Total end-users
- Active users
- User acquisition
- User retention

### Generating Reports

**Available Reports:**
- Monthly platform summary
- Tenant performance report
- Revenue report
- Compliance report
- API usage report

**Report Options:**
- Select date range
- Choose metrics
- Filter by tenant or region
- Export as PDF or CSV

### Custom Analytics

**Create Custom Views:**
1. Select metrics to track
2. Set filters and parameters
3. Save custom dashboard
4. Schedule automated reports

---

## Platform Configuration

### General Settings

**Platform Information**
- Platform name
- Default branding
- Contact information
- Support email

**Feature Toggles**
- Enable/disable features platform-wide
- Beta features
- Maintenance mode

**Regional Settings**
- Supported regions
- Currency options
- Language options
- Tax configurations

### Email Configuration

**Email Settings**
- SMTP server configuration
- From address and name
- Email templates
- Notification settings

**Email Templates**
- Welcome email
- Order confirmations
- Password resets
- Onboarding emails
- System notifications

### Default Tenant Settings

**Branding Defaults**
- Default color scheme
- Default fonts
- Template layouts

**Product Settings**
- Default product visibility
- Price markup rules
- Inventory sync frequency

**Order Settings**
- Default order statuses
- Processing workflows
- Notification triggers

---

## Domain Management

### Subdomain Management

**Automated Subdomain Creation**
- System automatically creates subdomains via Namecheap API
- Format: `[tenant-slug].budstack.to`
- CNAME record points to main platform

**Managing Subdomains**
1. View all subdomains
2. Check DNS status
3. Troubleshoot connection issues
4. Update DNS records if needed

**Subdomain Requirements**
- Unique identifier
- 3-50 characters
- Lowercase letters, numbers, hyphens
- Must start with letter

### Custom Domain Setup

**Process:**
1. Tenant requests custom domain
2. Verify domain ownership
3. Provide DNS configuration instructions
4. Update tenant settings to use custom domain
5. Configure SSL certificate
6. Test and verify connection

**DNS Configuration**
Tenant must add DNS records:
```
Type: A
Host: @
Value: [Platform IP address]

Type: CNAME
Host: www
Value: [tenant-slug].budstack.to
```

**SSL Certificates**
- Auto-generated via Let's Encrypt
- Automatic renewal
- Monitor expiration dates

### Namecheap API Integration

**Configuration**
- API User: Stored in environment variables
- API Key: Securely stored
- Whitelisted IP: Server IP address

**API Functions**
- Create CNAME records
- Update DNS settings
- Verify domain status
- Troubleshoot DNS issues

**Troubleshooting**
- Verify API credentials
- Check IP whitelist
- Review error logs
- Test API connectivity

---

## API Management

### Doctor Green API

**Configuration**
- API URL: Stored in environment variables
- Authentication: Two-layer system
- Endpoints: Products, orders, inventory

**Monitoring API Status**
- Connection status
- Response times
- Error rates
- Last sync time

**API Settings**
- Sync frequency
- Timeout settings
- Retry logic
- Fallback options

### Managing API Credentials

**Per-Tenant Configuration**
- Each tenant can have unique API credentials
- Stored securely in database
- Can override platform defaults

**Updating Credentials**
1. Navigate to tenant settings
2. Update API credentials
3. Test connection
4. Save changes

### API Usage Analytics

**Track Usage:**
- API calls per tenant
- Response times
- Error rates
- Popular endpoints

**Usage Limits**
- Set rate limits per tenant
- Monitor quota usage
- Alert on excessive usage

---

## System Monitoring

### System Health

**Key Metrics**
- Server uptime
- Response times
- Error rates
- Database performance
- API connectivity

**Monitoring Dashboard**
- Real-time status
- Recent errors
- Performance graphs
- Alert history

### Logs & Debugging

**Log Types**
- Application logs
- Error logs
- API logs
- Security logs

**Viewing Logs**
1. Navigate to System Logs
2. Filter by type, date, severity
3. Search for specific errors
4. Export logs for analysis

### Alerts & Notifications

**Alert Types**
- System errors
- API failures
- Security incidents
- High traffic
- Resource limits

**Alert Configuration**
- Set thresholds
- Configure notification channels (email, SMS, Slack)
- Define escalation procedures

---

## Security & Compliance

### User Management

**Super Admin Accounts**
- Limit number of super admins
- Use strong authentication
- Enable two-factor authentication
- Monitor admin activity

**Role-Based Access**
- Super Admin: Full platform access
- Support Admin: Limited support functions
- Analytics Admin: View-only analytics

### Security Best Practices

**Password Policies**
- Minimum length: 12 characters
- Require complexity
- Enforce regular changes
- Prevent password reuse

**Session Management**
- Automatic timeout
- Secure session storage
- Monitor active sessions
- Force logout on suspicious activity

**Data Protection**
- Encryption at rest
- Encryption in transit (SSL/TLS)
- Regular backups
- Secure API keys

### Compliance Management

**Regulatory Requirements**
- Cannabis regulations vary by region
- Maintain audit trails
- Age verification
- License verification
- Data retention policies

**Compliance Checks**
- Verify tenant licenses
- Monitor expired licenses
- Track compliance documentation
- Generate compliance reports

**Audit Trail**
- All administrative actions logged
- User activity tracking
- Data access logs
- Change history

### Data Privacy

**GDPR/Privacy Compliance**
- Data processing agreements
- User consent management
- Right to access data
- Right to deletion
- Data portability

**Sensitive Data**
- Medical information (HIPAA)
- Payment information (PCI-DSS)
- Personal identification
- Secure storage and transmission

---

## Troubleshooting

### Common Issues

**Tenant Can't Access Store**
- Verify account is active
- Check subdomain configuration
- Test DNS resolution
- Review error logs

**Products Not Syncing**
- Check Doctor Green API status
- Verify API credentials
- Review sync logs
- Manual sync trigger

**Email Not Sending**
- Verify SMTP configuration
- Check email queue
- Review bounce logs
- Test email connectivity

**Performance Issues**
- Check server resources
- Review database performance
- Analyze slow queries
- Check CDN status

### Getting Support

**Internal Escalation**
- Document the issue
- Gather relevant logs
- Identify affected tenants
- Escalate to development team

**External Vendor Support**
- Namecheap API issues
- Doctor Green API issues
- Hosting provider issues
- Third-party integrations

---

## Maintenance & Updates

### Scheduled Maintenance

**Planning Maintenance**
1. Schedule during low-traffic periods
2. Notify all tenants in advance (48-72 hours)
3. Enable maintenance mode
4. Perform updates
5. Test thoroughly
6. Disable maintenance mode
7. Confirm all systems operational

**Maintenance Mode**
- Display maintenance page to users
- Admin access still available
- Notify tenants of expected duration

### System Updates

**Update Process**
1. Review update notes
2. Backup database and files
3. Test in staging environment
4. Schedule maintenance window
5. Apply updates
6. Run post-update tests
7. Monitor for issues

**Rollback Plan**
- Always have a rollback strategy
- Keep previous version backups
- Document rollback procedures
- Test rollback in staging

---

## Best Practices

### Daily Tasks
- Review system health dashboard
- Check pending onboarding applications
- Monitor API status
- Review support tickets
- Check error logs

### Weekly Tasks
- Review platform analytics
- Audit new tenant setups
- Update system documentation
- Review security logs
- Backup verification

### Monthly Tasks
- Generate platform reports
- Review and update policies
- Audit user access
- Performance optimization
- Capacity planning

---

## Emergency Procedures

### System Downtime

1. **Identify Issue**: Check monitoring dashboard
2. **Assess Impact**: Determine affected tenants
3. **Notify**: Alert tenants and users
4. **Troubleshoot**: Review logs and metrics
5. **Escalate**: Contact technical team if needed
6. **Resolve**: Apply fix and test
7. **Communicate**: Update tenants on resolution

### Security Incidents

1. **Contain**: Isolate affected systems
2. **Assess**: Determine scope and impact
3. **Investigate**: Review logs and activity
4. **Remediate**: Apply security patches
5. **Notify**: Inform affected parties
6. **Document**: Record incident details
7. **Review**: Post-incident analysis

### Data Loss

1. **Stop Operations**: Prevent further data loss
2. **Assess**: Determine what was lost
3. **Restore**: Use latest backup
4. **Verify**: Confirm data integrity
5. **Notify**: Inform affected tenants
6. **Document**: Record incident and response
7. **Improve**: Update backup procedures

---

## Quick Reference

### Key URLs
- Super Admin Dashboard: `/super-admin`
- Tenant Management: `/super-admin/tenants`
- Onboarding: `/super-admin/onboarding`
- Analytics: `/super-admin/analytics`

### Important Credentials
- Stored in secure password manager
- Never share via insecure channels
- Rotate regularly
- Use strong, unique passwords

### Contact Information
- Development Team: dev@budstack.to
- Security Team: security@budstack.to
- Emergency Hotline: [Number]

---

**End of Super Admin Manual**

*This is a living document. Updates and improvements are made regularly. Always refer to the latest version.*
