# Drafting notes — client data protection response

**Internal. Not for sending.**

Context for anyone editing `2026-07-28-data-protection-response.md`, and the
reasoning behind two judgement calls in it.

---

## 1. Say what is in place; do not narrate what was wrong

The first draft of this response opened each item with a "position before"
paragraph describing the previous state and drawing the legal conclusion against
BudStacks — that a storefront serving the platform's own policy "does not
discharge an operator's Article 13 duty".

That was a drafting error and it was removed.

The recipient is a data protection professional acting **for the operators**,
not for BudStacks. Volunteering an adverse legal characterisation in writing
hands them a finding, in our own words, that they did not ask for and would
otherwise have to establish. Nothing in the removed text was untrue — it was
simply not ours to argue.

The rule for this document: **state the current position factually and
completely. Do not editorialise about the past, and do not draw legal
conclusions against BudStacks.**

This is not concealment, and the distinction matters:

- If asked directly what the previous behaviour was, answer honestly.
- If a specific incident is put to us, address it.
- Do not proactively supply characterisations, or adjectives like "worse than".

Every factual claim in the response must be true and demonstrable. It is the
framing that changed, not the facts.

## 2. The Article 9 disclosure is a decision, not a default

An earlier draft disclosed in full that BudStacks had retained special-category
health data without a lawful basis, in a section headed "Not raised by you".
That has been reframed to state the outcome — BudStacks holds no Article 9 data,
and it is enforced in the build — without volunteering the history.

**This is a decision for Gerard, taken with advice, not one to bake into a
draft.** The considerations:

**Probably not an Article 33 notifiable breach.** Article 33 is triggered by a
*personal data breach* — accidental or unlawful destruction, loss, alteration,
unauthorised disclosure of, or access to personal data. Over-retention is not
itself a breach, and there is no evidence of unauthorised access or disclosure.
An endpoint returned health fields to authenticated tenant administrators; no
interface displayed them and no unauthorised access has been identified. On the
current facts this reads as a minimisation failure, now remediated, rather than
a notifiable incident. **Confirm with counsel before relying on that.**

**Arguments for disclosing anyway:**

- Operators are controllers of that data and BudStacks is their processor.
  Article 28(3)(h) requires a processor to make available the information
  necessary to demonstrate compliance with Article 28.
- The reviewer is conducting a gap assessment. Something material found later,
  that we knew and did not mention, damages credibility across every other
  answer.
- The remediation is genuinely strong — destroyed at source, enforced in CI,
  evidenced with counts. It is a better story told voluntarily than extracted.

**Arguments for not volunteering it:**

- It was found and fixed by BudStacks' own review, before any request.
- It is not, on the current analysis, a notifiable incident.
- Disclosure to a party assessing you invites scope expansion into matters
  already closed.

**If disclosing, do it separately** — a short factual note covering what was
retained, that no unauthorised access was identified, what was done, and when.
Not folded into an answer about something else, where it reads as either a
confession or a distraction.

The remediation record is at `2026-07-27-article9-purge.md` and is complete
enough to hand over as-is if that route is chosen.

## 3. Before sending

- [ ] BudStacks legal entity name and registered address — also needed for
      BudStacks' own privacy policy, which currently names no controller
- [ ] LHI's engaged role confirmed
- [ ] Dr Green position confirmed in writing (Rikki)
- [ ] Decision taken on §2 above
- [ ] Every factual claim re-checked against what is actually deployed
