# 📜 PERMANENT APPLICATION CONTRACT & BASELINE SOURCE OF TRUTH

**Application**: Midday Meal (MDM) School Management & Daily Auto Register System  
**Applet ID**: `71a44c73-db3d-4a29-87e5-0569d0a93d24`  
**Classification**: Production Android PWA & Full-Stack Node.js / React Web Application  
**Standard**: Absolute UI/UX Protection, Color Lock, Zero Feature Removal, Data Preservation, Update Safety  

---

## 1. APPLICATION IDENTITY & METADATA

* **Application Name**: Midday Meal Management System (MDM & Daily Auto Register)
* **Target Audience**: School Headmasters, MDM Incharges, Teachers, and Education Administrators (Andhra Pradesh / Government Schools).
* **Default Benchmark School**: `M. P. P. SCHOOL R.B.R.PETA`, UDISE: `28261800503`, Mandal: `PALAKONDA`, District: `PARVATHI PURAM MANYAM`, State: `ANDHRA PRADESH`.
* **Headmaster Reference**: `V. CHIRANJEEVI`.
* **Runtime Target**: Android WebView / PWA / Web (Vite + React SPA on Express port 3000).

---

## 2. APPLICATION STRUCTURE & MODULE MAP

### 2.1 Navigation Structure (8 Primary Tabs)
All 8 primary tabs are permanently preserved:

| Tab Key | Label | Icon | Primary Responsibility |
|---|---|---|---|
| `dashboard` | **Dashboard** | `LayoutDashboard` | Quick summary of meals, monthly cooking cost, stock status alerts, and fast navigation cards. |
| `daily-entry` | **Daily Auto Register** | `Calendar` | Day-by-day attendance, menu indent alignment, meal count, commodity consumption, and daily register printouts. |
| `student-strength` | **Student Strength** | `Users` | Class-wise (Classes 1–10), category-wise (Primary, Upper Primary, High School), gender-wise rolls, and effective-date tracking. |
| `commodity-stock` | **Commodity Stock** | `Package` | Day-by-day continuous stock audit, transactions (Received/Spoiled/Adjustment), and monthly opening balance controls. |
| `monthly-summary` | **Monthly Summary** | `BarChart3` | Working days calculation, aggregate meals served, total commodity usage, and month-end reconciliation. |
| `cash-voucher` | **Cash Voucher** | `Receipt` | Generation and printing of official monthly MDM cooking cost expenditure cash vouchers with amount in words. |
| `reports` | **Reports** | `FileText` | Formats for official submission, annual roll summaries, monthly audit sheets, and JSON data backup/restore. |
| `settings` | **Settings** | `Settings` | School profile management, headmaster credentials, meal rates configuration, and automation toggles. |

### 2.2 Supporting Modals & Dialogs
* `LoginModal`: Secure authentication for Headmaster / MDM Incharge.
* `RegisterSchoolModal`: Multi-step school registration with OTP verification.
* `ForgotPasswordModal`: Registered mobile account verification, 6-digit OTP, and single-use password reset.
* `ChangeCredentialsModal`: Update username, mobile, and password with OTP or current password verification.
* `DayRegisterEditorModal`: Edit daily attendance, meals served, and commodity usage for specific dates.
* `EggsChikkiObModal`: Set explicit opening balances for Eggs and Chikki across months (preserving negative values).
* `OpeningBalanceModal` & `OpeningBalanceSettings`: Base academic year opening stock configuration.
* `PWAInstallModal`, `PWAInstallBanner`, `PWAUpdateBanner`: PWA installation and service worker update notifications.
* `OfflineIndicator`: Seamless visual feedback when working offline.

---

## 3. UI DESIGN SYSTEM & COLOR LOCK

### 3.1 Color Palette Contract (STRICTLY LOCKED)
Colors must **NEVER** be changed without explicit user instruction:

* **Primary Emerald / Green Brand Colors**:
  - Primary Base: `emerald-600` (`#059669`) / `emerald-700` (`#047857`)
  - Accent / Gradient: `from-emerald-600 to-teal-700`
  - Subtle Emerald: `emerald-50`, `emerald-100`, `emerald-900/30`
* **Surface & Backgrounds**:
  - Light Mode: Background `slate-50` (`#f8fafc`), Cards `white` (`#ffffff`), Borders `slate-200` (`#e2e8f0`).
  - Dark Mode: Background `slate-900` (`#0f172a`), Surface `slate-800` (`#1e293b`), Header/Nav `slate-950` (`#020617`), Borders `slate-700` (`#334155`).
* **Status Colors**:
  - Success: `emerald-500` / `green-500`
  - Warning / In-Progress: `amber-500` / `yellow-500`
  - Danger / Alert: `red-500` / `rose-600`
  - Informational: `blue-500` / `indigo-500`
* **Typography**:
  - Font Family: Inter / system sans-serif font stack.
  - Headings: Semibold / Bold with tight tracking.
  - Numbers: Monospace or tabular figures for financial & stock totals.

### 3.2 UI Component Guidelines
* **Zero Disruption Rule**: Keep button sizes, input heights, padding, table alignments, and card shadows identical.
* **Auto-Select on Focus**: Number inputs automatically select full text on focus (`useNumberInputSelection`) to allow rapid data entry.
* **Responsive & Print-Ready**: Full media print styles (`@media print`) format all reports and cash vouchers cleanly for physical A4 printing.

---

## 4. MDM BUSINESS LOGIC & FORMULA SPECIFICATION

### 4.1 Government MDM Norms (Per Student Per Meal)

| Commodity | Primary (Class 1–5) | Upper Primary (Class 6–8) | High School (Class 9–10) | Active Schedule |
|---|---|---|---|---|
| **Rice** | 100 grams | 150 grams | 150 grams | Every working day |
| **Dal / Pulses** | 20 grams | 30 grams | 30 grams | Every working day |
| **Cooking Oil** | 5 grams | 7.5 grams | 7.5 grams | Every working day |
| **Eggs** | 1 Unit | 1 Unit | 1 Unit | Monday to Friday (5 days/week) |
| **Chikki** | 1 Unit (25g) | 1 Unit (25g) | 1 Unit (25g) | Mon, Wed, Fri (3 days/week) |
| **Ragi** | 10 grams | 10 grams | 10 grams | Tue, Thu, Sat (3 days/week) |
| **Jaggery** | 10 grams | 10 grams | 10 grams | Tue, Thu, Sat (3 days/week) |
| **Condiments** | 2 grams | 3 grams | 3 grams | Daily |

### 4.2 Commodity Stock Continuous Carry-Forward
* **Formula**:
  $$\text{Closing Balance (CB)} = \text{Opening Balance (OB)} + \text{Received} - \text{Used} - \text{Spoiled} + \text{Adjustment}$$
* **Continuity Rule**: Today's Opening Balance equals yesterday's Closing Balance without gaps, across holidays and month boundaries.
* **CRITICAL INVARIANT — Negative OB for Eggs & Chikki**:
  - Legitimate negative balances (e.g. `-1`, `-5`, `-10`, `-25`) for **Eggs** and **Chikki** MUST BE PRESERVED.
  - Do NOT clamp with `Math.max(0, val)` or `Math.abs(val)`.
  - Non-egg commodities (Rice, Oil, Pulses) cannot physically be negative in storage.

### 4.3 Cash Voucher Cooking Cost Calculation
* **Formula**:
  $$\text{Grand Total} = (\text{Primary Meals} \times \text{Primary Rate}) + (\text{Upper Primary Meals} \times \text{Upper Primary Rate})$$
* **Rate Defaults**: Primary Rate = ₹5.45, Upper Primary Rate = ₹8.17, Egg Rate = ₹6.00, Chikki Rate = ₹5.00, Ragi Rate = ₹35/kg, Jaggery Rate = ₹60/kg.
* **Amount In Words**: Automatically converted to standard currency text format (e.g. *"Rupees Two Thousand Four Hundred Only"*).

---

## 5. DATA ISOLATION & STORAGE ARCHITECTURE

### 5.1 Storage Hierarchy
1. **Client Offline Layer**: LocalStorage scoped by school prefix: `mdm_${schoolId}__${key}`. Allows 100% offline functionality.
2. **Server-Side Protected Store**: Express `/api/data/*` with atomic file-level JSON persistence in `.data/schools/${schoolId}.json`.
3. **Cloud Firestore**: Document collection `school_data/${schoolId}__${key}` guarded by strict `firestore.rules`.

### 5.2 Multi-Tenant Data Protection (IDOR / BOLA Prevention)
* The server derives `schoolId` solely from the validated session token (`req.userSession.schoolId`).
* Client-supplied `schoolId` parameters in URLs or JSON bodies are never trusted for authorization.
* Idempotency keys (`X-Idempotency-Key`) protect all mutation endpoints against double-tap duplicate records.

---

## 6. UPDATE SAFETY & REGRESSION CHECKLIST

Before deploying any future update:
1. Run `compile_applet` to verify clean TypeScript compilation.
2. Verify all 8 navigation tabs (`dashboard`, `daily-entry`, `student-strength`, `commodity-stock`, `monthly-summary`, `cash-voucher`, `reports`, `settings`) render correctly.
3. Verify that negative opening balances for Eggs and Chikki are preserved.
4. Verify that offline functionality continues without network connectivity.
5. Verify that authentication lockout and OTP TTL protections remain active.
