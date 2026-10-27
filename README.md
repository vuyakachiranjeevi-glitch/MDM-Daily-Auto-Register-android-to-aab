# MDM Daily Auto Register - Source Code

A complete, production-grade Web and Android (PWA / TWA) application for Mid-Day Meal (MDM) Daily Auto Register, Commodity Stock Tracking, Cash Voucher, and Monthly PM-POSHAN Reports for Schools.

## Project Structure
- `/src` - Complete React 19 + TypeScript frontend with Tailwind CSS and Lucide icons
- `/src/components` - UI Views (DailyEntryView, CommodityStockView, ReportsView, CashVoucherView, SettingsView, etc.)
- `/src/lib` - Local storage, Cloud sync, automated indent calculators, PDF generation
- `/server` - Express.js backend services (Authentication, Data routes, SMS OTP service)
- `/server.ts` - Main Express server entry point
- `/public` - Static assets, PWA icons, manifest, and service worker
- `/firestore.rules` - Production Firestore security rules
- `/firebase-blueprint.json` - Firestore schema and indexes specification
- `/twa-manifest.json` & `/android-build.gradle` - Android Trusted Web Activity packaging

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

### 3. Production Build
```bash
npm run build
npm start
```
