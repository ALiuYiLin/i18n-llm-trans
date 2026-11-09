---
"@10coding/i18n-trans": patch
---

Treat missing or empty target locale files as empty locales. `check --add-target` / `fix`
now creates the missing file, and `trans` creates it before translating.
