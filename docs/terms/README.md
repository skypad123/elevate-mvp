# Terms

This folder holds the wording of terms that Elevate shows to a person or asks
them to accept: a learner before paying, or a profile's owner before a
setting takes effect. Each file is the one place where a set of terms is
written out in full, with its version and its review status.

## The terms

| File                                             | Who sees it                                   | Version   | Status                                     |
| ------------------------------------------------ | --------------------------------------------- | --------- | ------------------------------------------ |
| [class-refund-terms.md](./class-refund-terms.md) | A learner, on the class checkout page         | `2026-12` | Draft. Not read by a lawyer. Not in force. |
| [held-payout-terms.md](./held-payout-terms.md)   | A profile's owner, in Teach, before opting in | `2026-12` | Draft. Not read by a lawyer. Not in force. |

## Rules for this folder

- **A file here is the source.** The text a person sees comes from the
  message catalogs in `packages/i18n/src/messages/areas/`. When the two
  differ, the file here is right and the catalog is corrected.
- **Every file states its status at the top**: draft, read by a lawyer, or in
  force, with the date and who signed it off. Nothing here is in force until
  a lawyer has read it and the author has signed off the English and the
  Chinese text.
- **Every file states its version**, and the constant in the code that
  carries it. A change to what a term means is a new version. The code
  records which version a person saw or accepted, so an old version's file is
  kept, renamed with its version, and not edited.
- **A term states a rule the product enforces.** Each file names the design
  or decision each sentence rests on. If the rule changes, the design changes
  first and the terms follow.
- **Whole sentences, in plain words.** A term uses the words the person sees
  on the screen, not the words of the design.
- **English and Chinese.** A learner's terms are shown in both. The Chinese
  text is drafted after the English wording is settled, and the author signs
  it off.
