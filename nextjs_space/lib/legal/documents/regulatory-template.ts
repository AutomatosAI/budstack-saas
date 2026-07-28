/**
 * Operator regulatory statement.
 *
 * Licensing is specific to the operator and its jurisdiction, so a shared page
 * can only ever be wrong. Where an operator has not supplied licence details the
 * document does not render at all — an unsubstantiated regulatory claim is worse
 * than no page, both for the operator and for the patient reading it.
 */

export const REGULATORY_TEMPLATE_VERSION = "1.0.0";

export const REGULATORY_REQUIRED_TOKENS = [
  "controllerLegalName",
  "regulatorName",
  "supportContactEmail",
] as const;

export const REGULATORY_TEMPLATE = `
## Regulatory position

This service is operated by **{{controllerLegalName}}**.

{{#licenceNumber}}
Our licence number is **{{licenceNumber}}**, issued by {{regulatorName}}.
{{/licenceNumber}}
{{^licenceNumber}}
Our activities are regulated by {{regulatorName}}.
{{/licenceNumber}}

## What this service is

We supply medicinal cannabis products against a prescription. We are not a prescriber. Prescribing decisions are made by the clinical service following an assessment, and no product is supplied without a valid prescription.

Completing a consultation does not guarantee that a prescription will be issued. That is a clinical judgement, and it may be that cannabis-based medicine is not appropriate for you.

## What we do not do

We do not advertise prescription-only medicines to the public, make claims that any product treats, cures or prevents disease, offer medical advice, or supply anyone without a prescription.

If you have seen anything on this site that appears inconsistent with that, please tell us at **{{supportContactEmail}}** so we can correct it.

## Your prescriber

Clinical questions — about your treatment, dosage, side effects, or interactions with other medicines — should go to the prescribing service, not to us. We can help you reach them.

If you are unwell and need urgent help, contact your local emergency service or your own doctor.

## Safety

Keep prescribed products in their original packaging, out of reach of children and animals. Do not share them with anyone: a medicine prescribed for you may be unsafe for someone else, and supplying it onward is a criminal offence.

Do not drive or operate machinery if your medicine affects you. Driving while impaired is an offence regardless of whether the medicine was prescribed.

## Concerns

To raise a concern about this service, contact **{{supportContactEmail}}**. You may also raise concerns directly with {{regulatorName}}.
`.trim();
