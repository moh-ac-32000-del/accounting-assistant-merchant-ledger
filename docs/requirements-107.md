# Merchant Ledger — Approved 107-Point Baseline

This document freezes the agreed product requirements used as the implementation baseline. My-app is a reference/lessons source only, not the destination application. Merchant Ledger is standalone now and is designed to be modular for later integration into Accounting Assistant.

1. Merchant Ledger is a standalone application now.
2. It will later integrate into a separate future Accounting Assistant main application.
3. My-app is only a reference for lessons, UX principles, architecture patterns, and avoiding previous mistakes.
4. Each merchant has an independent account.
5. Purchases increase the amount owed to the merchant.
6. Payments reduce the amount owed.
7. Payments greater than purchases create credit in the user's favor.
8. Balances are calculated independently per currency.
9. TRY and USD are supported.
10. TRY and USD are never combined by an FX conversion.
11. The merchant's identity field is the merchant name only.
12. Duplicate merchant names are allowed.
13. Duplicate names are displayed with a display-only number such as 1 محمد, 2 محمد, 3 محمد.
14. The display number is not part of the stored merchant name or internal ID.
15. Merchant IDs remain stable even when merchants are archived or removed from active lists.
16. Merchants are listed newest first by default.
17. Merchant search is by merchant name.
18. Merchant sorting can be changed from the three-dot menu; exact additional sort modes remain open until genuinely needed.
19. Merchants can be archived without destructive deletion.
20. Archived merchants are available through the merchant archive.
21. Archived merchants keep their complete history.
22. Archived merchants remain fully usable when opened.
23. A new transaction automatically reactivates an archived merchant.
24. Automatic merchant archiving requires both configured inactivity and zero balances in every currency.
25. Manual merchant archiving is allowed only when all currency balances are zero.
26. Manual merchant restoration is allowed.
27. Owner/Manager can archive and restore merchants; worker permissions can be restricted by the Owner.
28. A purchase contains one material per transaction.
29. A purchase records material, quantity, unit price, total, date, and currency.
30. Quantity accepts decimal values.
31. Unit price accepts decimal values.
32. Total is calculated as quantity multiplied by unit price.
33. Purchase date defaults to today.
34. Purchase date can be edited.
35. A purchase can use a reference material or a manually entered material name.
36. A reference material's default price auto-fills the purchase price.
37. The reference price can be overridden for that transaction.
38. The actual unit price used is stored as a historical snapshot.
39. Later changes to a material's default price do not change historical purchases.
40. A payment is a separate transaction type.
41. A payment records date, payment method, amount, and currency.
42. A payment does not contain material or quantity.
43. Payment amount accepts decimal values.
44. Payment date defaults to today.
45. Payment date can be edited.
46. Payment methods are configurable in Space settings.
47. New payment methods can be added with arbitrary names.
48. A payment method can be disabled/removed for future use without changing historical transactions.
49. The ledger is one unified chronological list of purchases and payments.
50. Ledger order is newest first.
51. There is no user-controlled transaction sorting control.
52. Each transaction clearly shows its type.
53. Each transaction clearly shows its currency.
54. Purchase rows show material, quantity, unit price, and total.
55. Payment rows show payment method and amount.
56. Running balances are maintained separately per currency.
57. The balance meaning is purchases minus payments.
58. Positive credit in the user's favor is shown green.
59. Amount owed to the merchant is shown red.
60. Zero balance is shown neutral.
61. The complete balance is displayed in a floating rectangle inside the merchant card/page.
62. The floating balance remains visible while navigating within the merchant account.
63. The floating balance updates immediately after any transaction change.
64. The merchant account contains purchase and payment actions.
65. The merchant account contains the unified ledger.
66. The merchant account has a share action at the top.
67. The merchant account has a temporary currency control when needed.
68. The selected temporary currency returns to the Space/default currency after saving.
69. App settings are separate from Space settings.
70. Personal App settings contain language, appearance, personal account, Spaces, and logout.
71. Space settings contain Space name, owner/deputy, members, roles, invitations, security/ownership, archive/delete, and commercial settings.
72. Space settings contain default currency, materials, payment methods, merchant archive duration, and worker permissions.
73. Space name is required when creating a Space.
74. Space name can be changed later by the Owner without changing internal IDs.
75. A Space has no image/icon requirement; name only.
76. A Google account is the identity used for login.
77. Google login is required before accessing financial data.
78. The first login with no Space leads to Space creation.
79. Space creation asks for the Space name and then enters the Space.
80. A Google account can access multiple Spaces.
81. A user can switch Spaces without logging out.
82. The last used Space is remembered and reopened on the next login.
83. If the user has only one Space, it opens directly.
84. The creator of a Space becomes its Owner.
85. A Space is a shared data container among its members.
86. The initial roles are Owner, Manager, and عامل.
87. There is exactly one Owner at a time.
88. There can be multiple Managers.
89. عامل is the worker role and is not a separate viewer role.
90. عامل starts with the same operational permissions as Manager by default.
91. The Owner can restrict عامل permissions individually.
92. Worker restrictions can cover transaction edit/delete, material management, reference prices, payment methods, merchant management, and related operations.
93. If all operational permissions are disabled, عامل effectively becomes a viewer.
94. نائب is not a separate role; it is a Manager with a نائب label.
95. The Owner can designate one existing member, preferably a Manager, as deputy.
96. The deputy receives no additional Owner powers except emergency ownership activation.
97. Only one deputy exists at a time and the Owner can replace them.
98. The deputy can activate ownership transfer after the configured Owner inactivity period; ownership is not transferred automatically.
99. Owner inactivity warnings are sent at the agreed warning stages, and a login resets the inactivity timer.
100. If no deputy exists when the threshold is reached, there is no automatic ownership transfer and the Space remains protected.
101. Emergency ownership activation makes the deputy the full Owner; the previous Owner does not automatically regain ownership on return.
102. Ownership changes, deputy changes, emergency transfers, and related events are recorded internally and relevant notifications are issued.
103. The Owner can transfer ownership to an existing member; the previous Owner becomes Manager.
104. The Owner can archive a Space; archived Spaces are retained until the Owner restores or permanently deletes them.
105. Only the Owner can archive, restore, or permanently delete a Space; permanent deletion requires clear double confirmation and is irreversible.
106. Managers and عامل can leave a Space; the Owner cannot leave until ownership is transferred. Leaving removes current membership but preserves historical data, and re-invitation creates a new membership with the new invited role.
107. Invitations expire after 7 days; invitations can be copied/shared through WhatsApp, cancelled while pending, and accepted after Google login. Export/share, offline behavior, Firebase source-of-truth rules, audit requirements, language support, and the remaining implementation/security details already agreed in the project baseline remain mandatory implementation constraints even where they are represented in the architecture and code documents rather than repeated as separate numbered requirements.

## Implementation constraints
- Firebase/Firestore is the source of truth for financial data.
- Local cache may be used for speed/read access, but financial recording requires internet.
- Google Sheets is an export/share copy, never the source of truth.
- Merchant statement sharing supports full account, a selected transaction, or a date range.
- Statement sharing supports a formatted image and Google Sheets.
- XLSX statements contain merchant identity, period, currency, chronological movements, totals, and final balance/credit.
- Arabic, Turkish, and English are required; Arabic is RTL and Turkish/English are LTR.
- The UI direction and three-dot menu placement follow the active language.
- Audit history is internal and non-destructive; edited rows show only a compact edited indication, while deleted rows disappear from the visible ledger.
- Financial data is never destructively deleted through ordinary transaction deletion.
- The implementation must remain modular so logic, UI, export, and permissions can later move into Accounting Assistant.
