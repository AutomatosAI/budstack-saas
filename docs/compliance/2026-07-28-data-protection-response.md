# Response to Data Protection Queries — BudStacks

**Date:** 28 July 2026
**Re:** Items (a)–(e) raised ahead of resuming template work

> **Internal note — not for sending.** Needs BudStacks' legal entity details
> and LHI's engaged role filled in before this goes anywhere.

---

## Summary

Items (a) and (e) are built and demonstrable today. Item (c) is resolved on our side. Items (b) and (d) need one input each, identified below.

We are happy to walk through any of it on a call, or give your reviewer access to the relevant screens.

---

## (a) Creating and modifying a domain-specific privacy policy

Each operator now has a **Legal** section in their BudStacks dashboard where they set their own controller identity:

- Registered legal entity name
- Registered address
- Privacy contact address
- Data protection registration number (optional)
- DPO name and contact (optional)
- UK representative under Article 27 (optional)

They preview the resulting notice and publish it. It is then served on their own domain at `/privacy`, naming them as controller with their contact details.

**How the wording is handled.** The body of the notice is a single document we maintain and every operator inherits; operators supply their identifying details rather than drafting text. This is deliberate. Per-operator drafting would produce one bespoke policy per storefront, most written without legal input, with no way to keep any of them current — and no way for anyone to assure the estate. One document can be reviewed once and updated for everyone at once.

The template is versioned. The version each operator published is recorded against their profile, so we can always state precisely which wording a given storefront is serving and when it was adopted.

**Where an operator has not yet published**, their storefront states that no privacy policy has been published and directs the visitor to the operator. It does not substitute any other party's policy.

**Additional control.** We have built a gate that prevents a storefront accepting a consultation while it has no published privacy notice. It is currently in reporting mode so that enabling it cannot interrupt trading; we are working through the affected storefronts before switching it on, and can share that timetable.

---

## (b) CannExpert subscriber agreement — licence holder eligibility

We would like to confirm one point before responding substantively: **who issues the CannExpert subscriber agreement** — CannExpert, Dr Green, or BudStacks?

Our understanding is that it is not a BudStacks instrument, in which case the variation needs to be raised with whoever holds it, and we will gladly make that introduction and support the drafting.

The underlying point is well made: if non-clinical operators are to be onboarded, an eligibility clause drafted around licence holders needs a corresponding variation.

---

## (c) Upcann SW FZCO and the Article 46 transfer mechanism

**BudStacks has no relationship with Upcann SW FZCO.** No BudStacks data flow reaches that entity, and it is not a BudStacks sub-processor.

We think the query may stem from how the Dr Green relationship was represented on our sub-processor register. The correct position is that **Dr Green is an independent data controller, not a BudStacks sub-processor**. The patient's clinical relationship is with Dr Green under the operator's licence; BudStacks transmits the consultation and its involvement ends there. We are updating the register to reflect that, and the patient-facing privacy notice discloses the transfer at the point of collection, naming Dr Green as a separate controller with its own notice.

Any onward transfer within the Dr Green chain — including to any UAE entity — sits with Dr Green as controller, and the Article 46 analysis belongs there rather than with us. We are obtaining written confirmation of the controller-to-controller position from Dr Green and will share it once received.

**One technical point offered constructively.** Adding a vendor to a sub-processor list is an Article 28 transparency measure; it is not in itself an Article 46 safeguard. Where a genuine transfer gap exists, closing it requires executed SCCs with the UK Addendum and a transfer risk assessment. Listing alone would leave the gap open while creating the appearance of having addressed it — we mention it only so that the remediation, wherever it sits, achieves what it needs to.

---

## (d) LHI Consulting and the UK GDPR representative

We are confirming two points internally and would rather answer accurately than quickly:

1. **BudStacks' establishment position.** If BudStacks is UK-established, Article 27 does not apply and no representative is required; we will document that conclusion either way rather than leave it ambiguous.
2. **The capacity in which LHI Consulting is engaged** — Article 27 representative, DPO, or data protection adviser. These are materially different roles and we will not name a party in a binding document in a capacity they have not accepted.

Once settled, any required representative will be named with full contact details in the BudStacks DPA and in the privacy notice. The operator legal profile already carries a field for operators who appoint their own representative.

**DRG Investor Portal.** That is a separate property outside BudStacks' control. We have raised the point with its owners.

---

## (e) Notifying subscribers of sub-processor changes

This is now a working mechanism rather than a stated intention.

**The register is live data.** Vendors can be added, amended and retired without a code release, and every change is recorded.

**Every active operator is notified directly.** There is no subscriber list and nothing to opt into. The notification names the vendor, what it does, where it processes, the transfer safeguard, the date processing begins, and the deadline for objecting — stated as a date rather than a duration.

**Operators see and act in their dashboard.** Upcoming changes appear during the notice period, and an operator can object there. Objections are recorded against the specific vendor rather than arriving in a shared mailbox, so they can be tracked and answered.

**The 30-day period is enforced by the system.** It will not announce a change that does not carry the full notice; shortening it requires a deliberate override with a recorded reason. Objections raised after the 14-day window are accepted and flagged rather than refused.

**The public register** at `budstacks.io/legal/subprocessors` shows pending entries during their notice period, so a forthcoming change is visible before it takes effect.

---

## Data minimisation

As part of this work we completed a minimisation review of what BudStacks stores.

**BudStacks holds no Article 9 special-category data.** Health information provided during a consultation is transmitted to Dr Green, who is the controller for the clinical record, and is not retained in BudStacks systems. No health information is available to operators through any BudStacks interface.

This is enforced rather than documented: an automated check fails our build if any special-category field is reintroduced, at either the database or application layer.

---

## Open items

| Item | Awaiting |
|---|---|
| (b) Issuer of the CannExpert agreement | Your confirmation |
| (c) Written confirmation of the Dr Green position | Dr Green |
| (d) Establishment position and LHI's engaged role | Internal, in progress |

We do not consider template work dependent on any of these. (a) and (e) are in place and can be demonstrated on request.
