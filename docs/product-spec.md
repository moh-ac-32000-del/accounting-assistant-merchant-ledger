# Product Specification v0.1

## Merchant account
Each merchant has an independent account with:
- total purchases
- total payments
- current balance/credit
- chronological transactions, newest first

balanceDue = purchases - payments.
Positive means owed to merchant. Negative is shown as a positive credit in the user's favor.

## Purchase
- material autocomplete
- current date by default, manually editable
- decimal quantity and price
- material default price can prefill, but user may override it
- actual used price is stored in the transaction

## Payment
- current date by default, manually editable
- decimal amount
- payment method

## Audit UX
After an edit, show a compact WhatsApp-style notice: "تم تعديل العملية" (localized).
A View action opens before/after details.

## Export and sharing
Generate a real XLSX merchant statement containing merchant identity, statement period, currency, chronological movements, totals and final balance/credit. Share through the platform share mechanism where supported.

## Languages
Arabic RTL, Turkish, English.
