/**
 * BudStacks-managed privacy notice template.
 *
 * ONE document, reviewed once by counsel, inherited by every operator. Tenants
 * supply the merge values in `tenant_legal_profiles`; they cannot edit the body.
 * That is deliberate — most operators have no legal support, and a free-text
 * editor would produce N separate liabilities.
 *
 * Reflects the agreed position that Dr Green is an INDEPENDENT CONTROLLER, not a
 * BudStacks sub-processor: the patient's clinical relationship is with Dr Green
 * under the operator's licence, and the handover is controller-to-controller.
 * If that position changes, this template and the sub-processor register must
 * change together.
 *
 * Bump PRIVACY_TEMPLATE_VERSION on any substantive edit. The version in force at
 * publish time is stamped onto the tenant's profile, so we can always say which
 * text a given operator published.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-007).
 */

/** Semver. Bump on any substantive change; patch for typos and formatting. */
export const PRIVACY_TEMPLATE_VERSION = "1.0.0";

/** Tokens that must be present, or rendering throws. */
export const PRIVACY_REQUIRED_TOKENS = [
  "controllerLegalName",
  "registeredAddress",
  "privacyContactEmail",
] as const;

export const PRIVACY_TEMPLATE = `
## Who we are

This website is operated by **{{controllerLegalName}}** ("we", "us"), of {{registeredAddress}}.

We are the data controller for the personal data described in this notice. That means we decide why and how your information is used, and we are responsible to you for it.

You can reach us about anything in this notice at **{{privacyContactEmail}}**.
{{#icoRegistrationNumber}}
Our data protection registration number is {{icoRegistrationNumber}}.
{{/icoRegistrationNumber}}
{{#dpoName}}
Our Data Protection Officer is {{dpoName}}{{#dpoContact}}, contactable at {{dpoContact}}{{/dpoContact}}.
{{/dpoName}}
{{#ukRepresentative}}
Our UK representative, appointed under Article 27 UK GDPR, is {{ukRepresentative}}.
{{/ukRepresentative}}

## What we collect

**When you browse.** Pages visited and general technical information about your device. Non-essential cookies are only set if you agree to them.

**When you contact us or create an account.** Your name, email address, telephone number and delivery address.

**When you complete a consultation.** Identity and contact details, date of birth, address, and health information — the conditions you report, medication you take, and answers to clinical screening questions.

Health information is *special category data* under Article 9 UK/EU GDPR. It gets the highest level of protection in law, and we treat it accordingly.

## Why we use it, and our legal basis

| What we do | Legal basis |
| --- | --- |
| Create and manage your account | Performance of a contract with you |
| Take and fulfil your order | Performance of a contract with you |
| Pass your consultation to the prescribing service | Explicit consent (Art. 9(2)(a)), given when you submit the consultation |
| Verify your identity and age | Legal obligation, and our legitimate interest in preventing supply to those not entitled to it |
| Keep our website secure and working | Our legitimate interest in operating a safe service |
| Send you service messages about your order | Performance of a contract with you |
| Send you marketing, where you have asked for it | Consent, which you can withdraw at any time |

You are not obliged to give us health information. If you choose not to, we will not be able to process a consultation or supply a prescribed product.

## Who your information is shared with

**The prescribing service.** When you submit a consultation, the information you provide is transmitted to **Dr Green**, who operates the clinical and prescribing service. Dr Green is a **separate, independent data controller** for your clinical record — not a supplier acting on our behalf. Once your information reaches them, their own privacy notice governs how they use it, and you should read it alongside this one. We do not retain your health answers after passing them on.

**Our platform provider.** This website runs on BudStacks, which hosts the site and processes personal data strictly on our instructions under a written agreement meeting Article 28 UK/EU GDPR. BudStacks publishes the list of vendors it uses at budstacks.io/legal/subprocessors.

**Payment providers,** who handle your payment details directly. We never see or store your full card number.

**Delivery partners,** who receive only what they need to bring your order to you.

**Regulators, law enforcement or professional advisers,** where we are legally required or permitted to share information.

We do not sell your personal data, and we do not share it for anyone else's marketing.

## Sending information outside the UK and EEA

Some of the services above operate outside the UK and the European Economic Area. Where information is transferred, it is protected by an approved safeguard — most often the UK International Data Transfer Addendum or the EU Standard Contractual Clauses, together with an assessment of the destination country. You can ask us for details of the safeguard applying to any particular transfer.

## How long we keep it

We keep account and order records for as long as you have an account with us, and afterwards for as long as we must to meet tax, accounting and regulatory obligations — usually six years.

We do not retain your consultation health answers once they have been passed to the prescribing service. Your clinical record is held by Dr Green under their own retention policy.

Website and security logs are kept for a short period and then deleted.

## Your rights

You have the right to:

- **be told** how your information is used — that is what this notice is for;
- **get a copy** of the information we hold about you;
- **have mistakes corrected**;
- **have information deleted**, in some circumstances;
- **limit how we use it** while a concern is looked into;
- **object** to us using it where we rely on legitimate interests, and to object to direct marketing at any time;
- **receive it in a portable format**, where we rely on consent or contract;
- **withdraw consent** at any time, including consent to process your health information. Withdrawing consent does not affect anything done before you withdrew it.

To exercise any of these, email **{{privacyContactEmail}}**. We will respond within one month. We will not charge you, and we will not treat you differently for asking.

Because your clinical record sits with Dr Green as a separate controller, requests about that record may need to go to them. Ask us and we will point you in the right direction.

## Complaints

If you are unhappy with how we have handled your information, please tell us first at **{{privacyContactEmail}}** so we can try to put it right.

You also have the right to complain to a supervisory authority. In the UK that is the Information Commissioner's Office (ico.org.uk); in the EU it is the authority in the country where you live or work.

## Cookies

We use cookies that are strictly necessary for the site to function. Anything beyond that — analytics or preferences — is only set once you agree, and you can change your choice at any time through the cookie settings link in our footer.

## Automated decisions

We do not make decisions about you by automated means alone, and we do not profile you in any way that produces legal or similarly significant effects.

## Changes to this notice

If we make a significant change we will update this page and change the date shown at the top. Where the change affects your rights, we will tell you directly.
`.trim();
