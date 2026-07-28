# Response to Data Protection Queries — BudStacks

**Date:** 28 July 2026
**Re:** Items (a)–(e) raised ahead of resuming template work

---

## Summary

Four of the five items are now closed or materially advanced, and two are backed by working mechanisms rather than statements of intent. Where something is still open, it is named as open with what it depends on — including one item where our own documents were inconsistent, which we found while doing this work and have corrected.

We also found and fixed a defect you did not raise, described at the end. We would rather you heard it from us.

---

## (a) Creating and modifying a domain-specific privacy policy

**Position before:** there was no way to do this, and the situation was worse than "missing". Every storefront domain served the BudStacks corporate privacy policy — so a visitor to an operator's own domain was told that **BudStacks** was their data controller, with BudStacks' contact details. That does not discharge an operator's Article 13 duty, because the operator is the controller.

**Now:** each operator has a Legal section in their dashboard where they enter their own controller identity — registered legal entity, registered address, privacy contact, and optionally their ICO registration number, DPO and Article 27 representative. They preview the result and publish it, and it is served on their own domain.

**How the policy body is handled, and why.** The wording is a single document maintained by us and inherited by every operator; operators supply their identifying details, not the text. This is deliberate. A free-text editor would produce one separately-drafted policy per operator, most written without legal input, and no way to keep any of them current. One document can be reviewed once and updated for everyone. The template is versioned, and the version an operator published is recorded, so we can always say which wording a given storefront is serving.

**Where an operator has not published:** the storefront states plainly that no privacy policy has been published yet and directs the visitor to the operator. It does **not** fall back to our policy — that is the defect being fixed, and falling back would reinstate it at the exact moment it matters.

**Also built:** a control that prevents a storefront taking a consultation while it has no published policy. It is currently in reporting mode so that enabling it cannot interrupt live stores; we are working through the storefronts that would be affected before switching it on.

---

## (b) CannExpert subscriber agreement — licence holder eligibility

This is a contractual matter rather than a platform one, and we want to check a premise before answering.

The eligibility clause you refer to sits in the CannExpert subscriber agreement. Before we commit to varying it, please confirm **who issues that agreement** — CannExpert, Dr Green, or BudStacks. Our understanding is that it is not ours to vary, in which case the request needs to route to whoever holds the paper, and we will help make that introduction.

The substantive point is well taken regardless: if non-clinical operators are to be onboarded, an agreement whose eligibility clause assumes a licence holder puts those subscribers in breach from the day they sign.

One platform consequence, now resolved either way: a non-clinical operator would previously have had access to customer health information through our administrative interface. That is no longer the case for any operator, clinical or not — see the final section.

---

## (c) Upcann SW FZCO and the Article 46 transfer mechanism

**We have no relationship with Upcann SW FZCO.** No BudStacks data flow reaches them and they are not a BudStacks sub-processor.

We think the question arose because of an inconsistency in our own documents, which we have corrected. Our sub-processor list described Dr Green as a BudStacks sub-processor. That was wrong, and it implied we sat above Dr Green's onward transfer chain — which is presumably where Upcann enters the picture.

**The correct position:** Dr Green is an independent data controller, not our sub-processor. The patient's clinical relationship is with Dr Green under the operator's licence; our involvement ends when the consultation is transmitted. We are updating the register accordingly, and the patient-facing privacy notice now discloses that hand-over at the point of collection, naming Dr Green as a separate controller with its own notice.

If data does reach Upcann SW FZCO, it does so within the Dr Green chain, and the Article 46 question belongs there. We are seeking written confirmation from Dr Green of the controller-to-controller position and will share it.

**One point of substance to flag.** Adding a vendor to a sub-processor list is an Article 28 transparency measure. It is not, by itself, an Article 46 safeguard. Where a genuine gap exists, closing it requires executed Standard Contractual Clauses with the UK Addendum plus a transfer risk assessment — listing alone would leave the gap open while creating the appearance of having addressed it. We mention it only because "add it to the list to mitigate the transfer mechanism" would not achieve what it sets out to.

---

## (d) LHI Consulting and the UK GDPR representative

We cannot confirm this yet and would rather say so than guess. Two things are being established:

1. Whether BudStacks is UK-established. If it is, Article 27 does not apply and no representative is required — we will document that conclusion rather than leave it ambiguous.
2. Whether LHI Consulting is engaged as an Article 27 representative, as DPO, or as a data protection adviser. These are materially different roles and we do not want to name a party in a binding document in a capacity they have not accepted.

Once both are settled, the representative — if one is required — will be named with full contact details in the BudStacks DPA and in the privacy notice, and the field already exists in the operator legal profile for operators who appoint their own.

**On the DRG Investor Portal privacy policy:** that is a separate property under different ownership. We have raised it there and it is not something we can change from here.

---

## (e) Notifying subscribers of sub-processor changes

**Position before:** the DPA promised 30 days' notice and a 14-day objection window, while the sub-processor page asked operators to *subscribe by email* if they wanted to hear about changes. Notice that has to be opted into is not notice, and the list itself could only be changed by a developer deploying code.

**Now:**

- The register is a live record rather than a hardcoded page.
- Adding or replacing a vendor emails **every active operator** — there is no subscriber list. The email names the vendor, what it does, where it processes, the transfer safeguard, the date processing begins, and the objection deadline as a date.
- Operators see upcoming changes in their dashboard during the notice period and can object there, recorded against that specific vendor rather than landing in a shared inbox.
- The system refuses to announce a change that does not carry the full 30 days. Going sooner requires a deliberate override with a recorded reason. Sending a "30 days' notice" email five days before a change would be worse than sending none, because it manufactures a record of compliance that did not happen.
- Late objections are accepted and flagged rather than refused. Declining to record a controller's objection because they were slow would leave us processing over a live, unanswered concern.

The public register at `/legal/subprocessors` shows pending entries during their notice period, so a change is visible before it takes effect rather than after.

---

## Not raised by you: special-category data we should not have held

While reviewing the above we found that our database retained Article 9 special-category health data for every patient who completed a consultation — reported conditions, prescribed medication, and contraindication screening covering cardiac, oncology, hepatic, immunosuppressant and psychiatric history, along with alcohol and drug-services history.

It had **no purpose**. The clinical record belongs to Dr Green, and the information was transmitted to them directly from the submitted form rather than from our copy — so retention was not required for anything to function. Nothing in the platform read it, other than an administrative endpoint that returned it to operators and which no screen displayed.

Retaining it had no lawful basis and breached the data minimisation principle, Article 5(1)(c).

**Actions taken, 27 July 2026:**

- The fields are no longer collected into our database. Consultation answers are transmitted to Dr Green and discarded with the request.
- The administrative endpoint no longer returns health data to any operator.
- The stored columns were destroyed by database migration, with the affected record counts captured immediately beforehand so the remediation is evidenced rather than asserted.
- An automated check now fails our build if any of those fields is reintroduced, at either the schema or the application layer.

**Residual matters, stated for completeness:**

- Backups taken before 27 July still contain the data. Consistent with ICO guidance we are not editing backups; they are beyond normal use and expire on the existing retention schedule. We will confirm the date after which no copy remains.
- Where a consultation had failed before reaching Dr Green, our copy was the only one, and it was destroyed. Those patients re-enter the form, which was already the behaviour on failure. The count is recorded.

We would rather disclose this than have it found. The remediation record is available on request.

---

## Open items

| Item | Depends on |
|---|---|
| (b) Who issues the CannExpert agreement | Your confirmation |
| (c) Written confirmation of the Dr Green controller position | Dr Green |
| (d) BudStacks establishment status and LHI's engaged role | Internal, in progress |
| Backup expiry date | Hosting provider retention window |

We do not consider template work blocked by any of these. (a) and (e) are in place and demonstrable, and (c) is resolved on our side pending a countersignature.
