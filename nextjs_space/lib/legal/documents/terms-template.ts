/**
 * Operator terms of sale.
 *
 * These are the operator's contract with their customer, so serving the
 * BudStacks platform terms on an operator domain is the more consequential
 * version of the privacy defect: it names the wrong party to the contract.
 *
 * Same model as the privacy notice — one maintained document, operator supplies
 * the commercial specifics. See docs/PRDS/prd-data-protection-remediation.md.
 */

export const TERMS_TEMPLATE_VERSION = "1.0.0";

export const TERMS_REQUIRED_TOKENS = [
  "controllerLegalName",
  "registeredAddress",
  "supportContactEmail",
  "governingLaw",
] as const;

export const TERMS_TEMPLATE = `
## Who you are buying from

These terms govern your purchase from **{{controllerLegalName}}** ("we", "us"), of {{registeredAddress}}.{{#tradingName}} We trade as {{tradingName}}.{{/tradingName}}

By placing an order you agree to these terms. Please read them before you order.

## Eligibility

You must be 18 or over to order from this website. We may ask you to verify your age and identity, and we may refuse or cancel an order where we cannot do so.

Products on this site are supplied only where a prescribing service has assessed you and issued a prescription. Completing a consultation does not guarantee that a prescription will be issued — that decision rests with the prescriber, not with us.

## How an order is formed

Adding items to your basket is not an order. Submitting the checkout is an offer to buy. A contract is formed only when we confirm that your order has been accepted and dispatched. If we cannot accept your order we will tell you and refund anything you have paid.

We may decline an order where a prescription has not been issued, where identity or age cannot be verified, where a product is unavailable, or where we reasonably suspect misuse.

## Prices and payment

Prices are shown at checkout, inclusive of applicable taxes unless stated otherwise. Delivery charges are shown separately before you commit.

Payment is taken through our payment provider. We do not see or store your full card details.

If a price is obviously wrong, we will contact you before dispatch and you may confirm at the corrected price or cancel for a full refund.

## Delivery

{{#deliveryTerms}}{{deliveryTerms}}{{/deliveryTerms}}

Delivery times are estimates. Where an item is delayed we will tell you as soon as we reasonably can. Risk in the goods passes to you on delivery.

We may require a signature or proof of identity on delivery.

## Cancellation and returns

You may cancel before dispatch for a full refund.

{{#returnsPolicy}}{{returnsPolicy}}{{/returnsPolicy}}

**Medicinal products.** For reasons of safety and applicable law, prescribed medicinal products that have been dispatched cannot be returned or resold once they have left our control, except where the product is faulty, damaged, or not what you ordered. This does not affect your statutory rights.

If something arrives faulty, damaged or incorrect, contact us at {{supportContactEmail}} and do not use the product. We will arrange a replacement or refund.

## Your responsibilities

You agree not to supply, resell or share prescribed products with anyone else, to store them safely and out of reach of children and animals, to give accurate information during consultation and checkout, and to tell the prescribing service about relevant changes to your health or medication.

## Our responsibility to you

We are responsible for loss you suffer that is a foreseeable result of us breaking these terms or failing to use reasonable care. We are not responsible for losses that were not foreseeable, or for business losses.

Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot lawfully be limited.

**Nothing in these terms affects the clinical relationship** between you and the prescribing service, or that service's own responsibilities to you.

## Complaints

If something has gone wrong, contact us at **{{supportContactEmail}}** and we will try to put it right. Clinical concerns about a prescription or your treatment should go to the prescribing service, and we will help you reach them.

## Changes

We may change these terms. The version in force when you place an order is the one that applies to that order.

## Law

These terms are governed by the law of **{{governingLaw}}**, and disputes may be brought in its courts. If you are a consumer, you keep the benefit of any mandatory protections of the country you live in.
`.trim();
