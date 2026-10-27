# Google Play Store Release & Android TWA Engineering Manual

**Application**: MDM Daily Auto Register  
**Package Identifier**: `com.school.mdmautoregister` (also aliases `com.mdm.dailyautoregister`)  
**Architecture**: Android Trusted Web Activity (TWA) via Google Bubblewrap & Android Browser Helper  
**Compliance**: Android 14+ / Android 15 (Target API Level 34/35), Java 17, ProGuard R8 Optimization

---

## 1. Production Architecture Overview

The system is decoupled into two production deployment tiers:
1. **Frontend PWA & Web Client (`https://mdm.yourdomain.com`)**:
   - Packaged into an Android App Bundle (`.aab`) via Trusted Web Activity (TWA).
   - Runs full-screen with native Android status bar, splash screen, and edge-to-edge support.
   - Verified cryptographically by Google Play using Digital Asset Links (`/.well-known/assetlinks.json`).
2. **Dedicated Backend API Server (`https://api-mdm.yourdomain.com` or container)**:
   - Node.js / Express backend (`server.ts`, `/server/*`) running on containerized infrastructure (Google Cloud Run / Render / AWS ECS / VPS).
   - Directly connects to Google Cloud Firestore with role-based authenticated access.
   - Enforces strict CORS headers allowing only `https://mdm.yourdomain.com` and Android TWA User-Agents.

---

## 2. Server Isolation & Cloud Backend Deployment

Because the native Android App Bundle (`.aab`) cannot run a Node.js process inside the mobile operating system, `server.ts` must be hosted on an HTTPS-enabled backend server.

### Deploying the Backend to Google Cloud Run or Docker Container:
```bash
# 1. Build Docker image
docker build -t mdm-autoregister-backend .

# 2. Run container with production environment
docker run -d \
  -p 3000:3000 \
  --name mdm-api \
  --env-file .env.production \
  mdm-autoregister-backend
```

### Deploying directly via Google Cloud Run:
```bash
gcloud run deploy mdm-backend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,ALLOWED_ORIGINS=https://mdm.yourdomain.com,APP_URL=https://mdm.yourdomain.com
```

---

## 3. Cryptographic Keystore Generation

To generate the PKCS12 release keystore for Android app signing:

```bash
keytool -genkey -v \
  -keystore android.keystore \
  -alias mdm-release-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype PKCS12
```

### Inspecting SHA-256 Fingerprint for Digital Asset Links:
```bash
keytool -list -v -keystore android.keystore -alias mdm-release-key
```
Locate the line starting with `SHA256:` and copy the colon-separated hex string into `public/.well-known/assetlinks.json`.

---

## 4. Digital Asset Links (`/.well-known/assetlinks.json`)

Ensure both your local release keystore fingerprint and Google Play App Signing key are declared:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.school.mdmautoregister",
      "sha256_cert_fingerprints": [
        "YOUR_LOCAL_RELEASE_KEYSTORE_SHA256",
        "YOUR_GOOGLE_PLAY_APP_SIGNING_SHA256"
      ]
    }
  }
]
```

### Verification Command:
```bash
curl -sI "https://mdm.yourdomain.com/.well-known/assetlinks.json" | grep -i "content-type"
# Must return: Content-Type: application/json
```

---

## 5. Building the Production Android App Bundle (.aab)

### Step 1: Pre-Flight Health Check
Run the automated pre-flight audit in the project root:
```bash
npm run build:playstore
```

### Step 2: Install Bubblewrap CLI
```bash
npm install -g @bubblewrap/cli
```

### Step 3: Initialize and Build the App Bundle
```bash
# Build the production bundle using the audited twa-manifest.json
bubblewrap build
```

When prompted:
* **Keystore Path**: `./android.keystore`
* **Keystore Alias**: `mdm-release-key`
* Output Artifact: `app-release-bundle.aab`

---

## 6. Google Play Console Listing & Policy Checklist

1. **Policy Pages (Publicly accessible without login)**:
   * Privacy Policy URL: `https://mdm.yourdomain.com/privacy-policy.html`
   * Account Deletion URL: `https://mdm.yourdomain.com/account-deletion.html`
2. **App Category & Content Rating**:
   * Category: Education / Productivity Tools
   * Target Age Group: 18+ (Teachers, Headmasters, Education Staff)
3. **Data Safety Declaration**:
   * Data is encrypted in transit over HTTPS (TLS 1.3).
   * User data is isolated per school account.
   * Account deletion requests can be triggered via the in-app settings or public web portal.
4. **App Assets**:
   * App Icon: `public/pwa-512x512.png` (512x512 PNG 32-bit)
   * Feature Graphic: 1024x500 PNG
   * Screenshots: `public/screenshot-desktop.png` & `public/screenshot-mobile.png`
