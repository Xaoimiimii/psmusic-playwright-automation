# PSMusic - Documented Business Rules

Documentation reviewed: D1 `README.md`, D2-D5 (see `documentation-overview.md`).

**Result: no explicit business rules are documented.** The README states capabilities and technology choices, not rules. The table lists the only statements that could be construed as rules/constraints, each labelled honestly; anything else asked for by the task template is recorded as UNKNOWN.

## 1. Documented statements that behave like rules or constraints
| ID | Statement | Affected feature | Documented expected behavior | Label | Source |
|---|---|---|---|---|---|
| DBR-01 | The token-protected profile request requires a token ("cần token") | Profile retrieval / authentication | A request to the user-profile endpoint must carry a token to succeed; behavior without a token is not stated | DOCUMENTED (failure behavior UNKNOWN) | D1-AUTH |
| DBR-02 | Passwords are hashed with BCrypt | Registration/login | Passwords are not stored in plain text ("Mã hóa mật khẩu") | DOCUMENTED (intent; wording says "encrypt") | D1-TECH |
| DBR-03 | Authentication is JWT-based | Authentication | Access is authenticated with JWT bearer tokens | DOCUMENTED | D1-AUTH, D1-TECH |
| DBR-04 | Music is classified by genre | Catalog | Each song belongs to a genre classification (multiplicity, hierarchy, naming unknown) | DOCUMENTED (INFERRED reading of "phân loại theo thể loại"; cardinality UNKNOWN) | D1-FEATURES |
| DBR-05 | Connections are secured with HTTPS | Transport | Intent stated, no requirement level (mandatory vs recommended) | DOCUMENTED (weak) | D1-TECH |

## 2. Requested rule categories - documentation status
| Category | Status |
|---|---|
| Cart, quantity, pricing, availability, order creation/lifecycle, payment, cancellation | Not applicable to the documented product (no such domain described) |
| Registration constraints (uniqueness, password policy, required fields) | UNKNOWN |
| Login/lockout/session expiry | UNKNOWN |
| Streaming rules (quality levels, access for guests, licensing, limits, listen counting) | UNKNOWN - only "high-quality streaming" |
| Genre rules (list, assignment, ordering) | UNKNOWN |
| Search, filtering, sorting, pagination | UNKNOWN |
| Favorites / ratings / reviews (constraints, duplicates, ranges) | UNKNOWN (not mentioned) |
| Role and permission rules | UNKNOWN |
| Validation rules and error messages | UNKNOWN |
| Localization rules | UNKNOWN |

## 3. Traceability
DBR-01, DBR-03: D1 `D1-AUTH`; DBR-02, DBR-03, DBR-05: D1 `D1-TECH`; DBR-04: D1 `D1-FEATURES`.
