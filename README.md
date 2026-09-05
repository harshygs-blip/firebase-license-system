# 🛡️ CyberAuth - Central License Management Authority Platform

Enterprise-grade, serverless multi-tenant License Management Authority and Anti-Crack Telemetry Platform powered by **Google Cloud Firestore** and **Firebase Hosting**.

---

## 🌐 Live Production URL
- **Dashboard Platform:** [https://licencemanger.web.app](https://licencemanger.web.app)
- **Alternate Mirror:** [https://licence-management-4793d.web.app](https://licence-management-4793d.web.app)
- **GitHub Repository (Frontend):** [https://github.com/harshygs-blip/firebase-license-system](https://github.com/harshygs-blip/firebase-license-system)
- **GitHub Repository (Full Backend & Engine):** [https://github.com/harshygs-blip/render_license_backend](https://github.com/harshygs-blip/render_license_backend)

---

## 🚀 Key Features

### 1. 📱 Multi-Tenant Applications Hub
- Register unlimited developer software ecosystems (Android apps, Windows PC tools, Telegram bots, Web apps).
- Automatically generates isolated **Public API Keys (`pk_live_...`)** and **Secret HMAC Keys (`sk_live_...`)**.
- **1-Click Maintenance Mode:** Instantly pause or resume public authentication for specific software.
- Custom version control and force-update download links.

### 2. 🔑 License Manager
- **Status Pipeline:** `ACTIVE 🟢`, `UNUSED 🟡`, `EXPIRED 🔴`, `SUSPENDED ⏸️`, `REVOKED ⛔`.
- **Live Search & Multi-Filters:** Instant search across Key, HWID, Customer Note, and App.
- **Actions:**
  - 🔄 **Reset HWID:** One-click unbind so customers can switch to a new phone or PC.
  - ⏸️ **Pause / Freeze:** Stop the subscription countdown temporarily.
  - ⏳ **Extend Time:** Add +30 Days or Lifetime validity with 1-click.
  - 🚫 **Ban & Revoke:** Immediately kills access on the client device.
  - 📥 **Export CSV:** Instant spreadsheet download of all customer licenses.

### 3. ⚡ Single & Bulk Key Generators
- **Live Key Preview:** Dynamic preview as you configure app prefix and duration.
- **Duration Chips:** 1 Day Trial, 3 Days, 7 Days, 30 Days (Monthly), 90 Days, 1 Year, and Lifetime VIP 👑.
- **Enterprise Bulk Generator:** Generate batches of up to 500 licenses at once with instant direct download in **CSV**, **TXT**, or **JSON**.

### 4. 💻 Bound Hardware (HWID) Manager
- View all bound hardware devices, hardware models, first bind date, and active status.
- Hardware Unbind & Permanent HWID Blacklisting.

### 5. 🛡️ Threat Radar & Anti-Crack Telemetry
- Client-side `SecurityGuard` detects:
  - Root binaries (`/system/bin/su`, Magisk, KernelSU)
  - Reverse engineering tools (MT Manager, NP Manager, ZArchiver, Lucky Patcher, APK Editor)
  - Memory hooks (Frida, Xposed, EdXposed)
  - APK signature tampering (re-signed cracks)
- One-click **Blacklist HWID** from the dashboard.

### 6. 🧪 Interactive Live API Playground & SDK Docs
- Built-in test sandbox to verify license keys and test HWID binding directly inside the browser.
- Complete copy-paste SDK snippets for:
  - **Android Kotlin**
  - **Python (Desktop / Bot)**
  - **C# / .NET (WPF / WinForms)**
  - **cURL / REST API**

---

## 📡 REST API Integration Reference

### Verify License
```bash
curl -X GET "https://firestore.googleapis.com/v1/projects/licence-management-4793d/databases/(default)/documents/licenses/YOUR_KEY?key=AIzaSyAjMrDOBSCgDyZ_cWAn2karkr7MK29BiMQ" \
     -H "Accept: application/json"
```

### Response (Valid)
```json
{
  "fields": {
    "key": { "stringValue": "GARENA-30D-XXXX-YYYY" },
    "app_id": { "stringValue": "app_garena_android" },
    "status": { "stringValue": "ACTIVE" },
    "duration_days": { "stringValue": "30" },
    "max_devices": { "integerValue": "1" },
    "bound_hwid": { "stringValue": "device_fingerprint_hash" }
  }
}
```

---

## 🛠️ Deployment Instructions

### Deploy to Firebase Hosting
```bash
npx -y firebase-tools deploy --only hosting:licencemanger
```

### Deploy Firestore Security Rules
```bash
npx -y firebase-tools deploy --only firestore:rules
```
