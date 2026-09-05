// Firebase SDK v10 via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// User's Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAjMrDOBSCgDyZ_cWAn2karkr7MK29BiMQ",
  authDomain: "licence-management-4793d.firebaseapp.com",
  projectId: "licence-management-4793d",
  storageBucket: "licence-management-4793d.firebasestorage.app",
  messagingSenderId: "218075326760",
  appId: "1:218075326760:web:ae24c43f8830ec84c6881d",
  measurementId: "G-ZYHX1GZ467"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State Management
let allLicenses = [];
let allApps = [];
let liveLogs = [];
let securityThreats = [];
let selectedSingleDuration = "30";
let lastBulkKeys = [];

// DOM References
const licensesTableBody = document.getElementById("licensesTableBody");
const appsTableBody = document.getElementById("appsTableBody");
const appsCardsContainer = document.getElementById("appsCardsContainer");
const devicesTableBody = document.getElementById("devicesTableBody");
const threatsTableBody = document.getElementById("threatsTableBody");
const logsTableBody = document.getElementById("logsTableBody");
const searchInput = document.getElementById("searchInput");
const filterApp = document.getElementById("filterApp");
const filterStatus = document.getElementById("filterStatus");
const filterDuration = document.getElementById("filterDuration");

const statTotalApps = document.getElementById("statTotalApps");
const statActiveKeys = document.getElementById("statActiveKeys");
const statTotalDevices = document.getElementById("statTotalDevices");
const statUnusedKeys = document.getElementById("statUnusedKeys");
const statRevokedKeys = document.getElementById("statRevokedKeys");

const countTabApps = document.getElementById("countTabApps");
const countTabLicenses = document.getElementById("countTabLicenses");
const countTabDevices = document.getElementById("countTabDevices");
const countTabThreats = document.getElementById("countTabThreats");
const countTabLogs = document.getElementById("countTabLogs");

// Toast Notification
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.borderLeftColor = isError ? "var(--accent-red)" : "var(--accent-cyan)";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 3200);
}

// Global Copy Helper
window.copyToClipboard = function(text, label = "Copied to clipboard!") {
  navigator.clipboard.writeText(text).then(() => {
    showToast(label);
  }).catch(() => {
    prompt("Copy text:", text);
  });
};

// Global Tab Switcher
window.switchTab = function(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  
  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");

  const btn = document.querySelector(`[data-tab="${tabId}"]`);
  if (btn) btn.classList.add("active");
};

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.getAttribute("data-tab");
    window.switchTab(tabId);
  });
});

// Helper: Format Date
function formatDate(timestamp) {
  if (!timestamp) return "Never";
  try {
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(d.getTime())) return String(timestamp);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return String(timestamp);
  }
}

// Helper: Random Hex
function generateRandomHex(bytes = 4) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ----------------------------------------------------
// 1. FAST REST + REALTIME APPS SYNC
// ----------------------------------------------------
async function fetchAppsViaRest() {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/applications?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.documents && data.documents.length > 0) {
        allApps = data.documents.map(doc => {
          const id = doc.name.split('/').pop();
          const f = doc.fields || {};
          return {
            id: id,
            name: f.name?.stringValue || id,
            platform: f.platform?.stringValue || 'Multi',
            description: f.description?.stringValue || '',
            api_key: f.api_key?.stringValue || '',
            api_secret: f.api_secret?.stringValue || '',
            status: f.status?.stringValue || 'ACTIVE',
            version: f.version?.stringValue || '1.0.0',
            maintenance: f.maintenance?.booleanValue || false
          };
        });
        renderAppsUI();
        updateAppDropdowns();
        updateDocSnippets();
      }
    }
  } catch (err) {
    console.warn("REST apps fetch fallback error:", err);
  }
}

function subscribeApps() {
  fetchAppsViaRest();

  const colRef = collection(db, "applications");
  onSnapshot(colRef, (snapshot) => {
    if (!snapshot.empty) {
      allApps = [];
      snapshot.forEach(docSnap => {
        allApps.push({ id: docSnap.id, ...docSnap.data() });
      });
      renderAppsUI();
      updateAppDropdowns();
      updateTelemetry();
      updateDocSnippets();
    }
  }, (err) => {
    console.warn("Apps realtime sync listener:", err);
  });
}

function renderAppsUI() {
  renderAppsCards();
  renderAppsTable();
  updateTelemetry();
}

function renderAppsCards() {
  if (!appsCardsContainer) return;
  countTabApps.textContent = allApps.length;
  statTotalApps.textContent = allApps.length;

  if (allApps.length === 0) {
    appsCardsContainer.innerHTML = `<div style="color: var(--text-muted); padding: 20px;">No applications registered. Click "+ Register New Application" above.</div>`;
    return;
  }

  // Count licenses per app
  const appKeysCount = {};
  const activeCount = {};
  allLicenses.forEach(l => {
    const aid = l.app_id || 'ALL';
    appKeysCount[aid] = (appKeysCount[aid] || 0) + 1;
    if (l.status === 'ACTIVE') activeCount[aid] = (activeCount[aid] || 0) + 1;
  });

  appsCardsContainer.innerHTML = allApps.map(app => {
    let platformIcon = "📱";
    if (app.platform === "Windows") platformIcon = "💻";
    else if (app.platform === "Linux" || app.platform?.includes("Bot")) platformIcon = "🤖";
    else if (app.platform === "Web") platformIcon = "🌐";

    const totalKeys = appKeysCount[app.id] || 0;
    const activeKeys = activeCount[app.id] || 0;
    const isMaintenance = app.maintenance === true;

    return `
      <div class="glass app-card">
        <div class="app-card-header">
          <div class="app-card-title">
            <div class="app-card-icon">${platformIcon}</div>
            <div>
              <strong style="font-size: 15px; color: #FFF;">${app.name}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${app.id}</div>
            </div>
          </div>
          <span class="status-badge ${isMaintenance ? 'status-suspended' : 'status-active'}">
            ${isMaintenance ? '⚠️ MAINTENANCE' : 'ONLINE'}
          </span>
        </div>

        <p style="font-size: 12px; color: var(--text-secondary); min-height: 36px;">
          ${app.description || 'Enterprise software ecosystem connected to CyberAuth Authority.'}
        </p>

        <div class="app-card-meta">
          <div class="app-card-meta-item">
            <span>Total Issued Keys</span>
            <strong>${totalKeys} Keys</strong>
          </div>
          <div class="app-card-meta-item">
            <span>Active Clients</span>
            <strong style="color: var(--accent-green);">${activeKeys} Online</strong>
          </div>
          <div class="app-card-meta-item">
            <span>Platform</span>
            <strong>${app.platform || 'Multi'}</strong>
          </div>
          <div class="app-card-meta-item">
            <span>Version</span>
            <strong>v${app.version || '1.0.0'}</strong>
          </div>
        </div>

        <div class="app-key-box">
          <span style="color: var(--accent-cyan); cursor: pointer;" onclick="copyToClipboard('${app.api_key}', 'Public API key copied!')">
            🔑 ${app.api_key || 'pk_live_default'}
          </span>
          <button class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 10px;" onclick="copyToClipboard('${app.api_key}', 'API Key Copied!')">📋 Copy</button>
        </div>

        <div class="app-card-actions">
          <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="openGenForApp('${app.id}')">⚡ Issue Key</button>
          <button class="btn btn-outline btn-sm" onclick="toggleMaintenance('${app.id}', ${!isMaintenance})">
            ${isMaintenance ? '🟢 End Maint.' : '⏸️ Maint.'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteApplication('${app.id}')" title="Delete App">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderAppsTable() {
  if (!appsTableBody) return;
  if (allApps.length === 0) {
    appsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;">No applications found.</td></tr>`;
    return;
  }

  appsTableBody.innerHTML = allApps.map(app => {
    const isMaintenance = app.maintenance === true;
    return `
      <tr>
        <td><strong style="color: #FFF;">${app.name}</strong></td>
        <td><span class="key-tag" onclick="copyToClipboard('${app.id}', 'App ID copied!')">${app.id} 📋</span></td>
        <td><span class="badge-pill" style="font-size: 11px;">${app.platform || 'Multi'}</span></td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-cyan); cursor: pointer;" onclick="copyToClipboard('${app.api_key}', 'Public API key copied!')">
            ${app.api_key || 'pk_live_default'} 📋
          </span>
        </td>
        <td>
          <span id="secret_${app.id}" class="secret-mask" style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-pink);">
            ${app.api_secret || 'sk_live_default'}
          </span>
          <button class="btn btn-outline btn-sm" style="margin-left: 6px; padding: 2px 6px; font-size: 10px;" onclick="toggleSecretMask('secret_${app.id}')">👁️</button>
        </td>
        <td><strong>${allLicenses.filter(l => l.app_id === app.id).length}</strong></td>
        <td>
          <span class="status-badge ${isMaintenance ? 'status-suspended' : 'status-active'}">
            ${isMaintenance ? 'MAINTENANCE' : 'ONLINE'}
          </span>
        </td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-outline btn-sm" onclick="regenerateSecret('${app.id}')" title="Re-Key">🔄 Re-Key</button>
            <button class="btn btn-danger btn-sm" onclick="deleteApplication('${app.id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.toggleSecretMask = function(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.toggle("revealed");
};

window.openGenForApp = function(appId) {
  window.switchTab("tab-generator");
  const sel = document.getElementById("singleAppId");
  if (sel) {
    sel.value = appId;
    updateKeyPreview();
  }
};

window.toggleMaintenance = async function(appId, enable) {
  try {
    const docRef = doc(db, "applications", appId);
    await updateDoc(docRef, { maintenance: enable });
    showToast(`Application ${appId} maintenance mode: ${enable ? 'ENABLED' : 'DISABLED'}`);
    fetchAppsViaRest();
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
};

window.regenerateSecret = async function(appId) {
  if (!confirm(`Regenerate Secret HMAC Key for ${appId}?`)) return;
  const newSecret = "sk_live_" + generateRandomHex(16).toLowerCase();
  await updateDoc(doc(db, "applications", appId), { api_secret: newSecret });
  showToast("Secret key successfully regenerated!");
  fetchAppsViaRest();
};

window.deleteApplication = async function(appId) {
  if (!confirm(`Permanently delete application ${appId}?`)) return;
  await deleteDoc(doc(db, "applications", appId));
  showToast(`Deleted application ${appId}`);
  fetchAppsViaRest();
};

// Application Modal Handlers
window.openCreateAppModal = function() {
  document.getElementById("createAppModal").style.display = "flex";
};
window.closeCreateAppModal = function() {
  document.getElementById("createAppModal").style.display = "none";
};

document.getElementById("createAppForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("appNameInput").value.trim();
  let id = document.getElementById("appIdInput").value.trim().toLowerCase().replace(/\s+/g, '_');
  const platform = document.getElementById("appPlatformInput").value;
  const desc = document.getElementById("appDescInput").value.trim();

  if (!id.startsWith("app_")) id = "app_" + id;

  const appData = {
    id: id,
    name: name,
    platform: platform,
    description: desc,
    api_key: "pk_live_" + generateRandomHex(12).toLowerCase(),
    api_secret: "sk_live_" + generateRandomHex(16).toLowerCase(),
    status: "ACTIVE",
    version: "1.0.0",
    maintenance: false,
    created_at: serverTimestamp()
  };

  await setDoc(doc(db, "applications", id), appData);
  window.closeCreateAppModal();
  document.getElementById("createAppForm").reset();
  showToast(`Application ${name} (${id}) registered!`);
  fetchAppsViaRest();
});

function updateAppDropdowns() {
  const filter = document.getElementById("filterApp");
  const singleApp = document.getElementById("singleAppId");
  const bulkApp = document.getElementById("bulkAppId");
  const docApp = document.getElementById("docAppSelector");

  if (!filter || !singleApp || !bulkApp || !docApp) return;

  const curFilter = filter.value;
  const curSingle = singleApp.value;

  filter.innerHTML = `<option value="ALL">Filter by Application (All)</option>`;
  singleApp.innerHTML = `<option value="ALL">Universal (All Applications)</option>`;
  bulkApp.innerHTML = `<option value="ALL">Universal (All Applications)</option>`;
  docApp.innerHTML = "";

  allApps.forEach(a => {
    filter.innerHTML += `<option value="${a.id}">${a.name} (${a.id})</option>`;
    singleApp.innerHTML += `<option value="${a.id}">${a.name} (${a.id})</option>`;
    bulkApp.innerHTML += `<option value="${a.id}">${a.name} (${a.id})</option>`;
    docApp.innerHTML += `<option value="${a.id}">${a.name} (${a.id})</option>`;
  });

  if (curFilter) filter.value = curFilter;
  if (curSingle) singleApp.value = curSingle;
  updateKeyPreview();
}

// ----------------------------------------------------
// 2. FAST REST + REALTIME LICENSES SYNC
// ----------------------------------------------------
async function fetchLicensesViaRest() {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/licenses?key=${firebaseConfig.apiKey}&pageSize=300`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.documents) {
        allLicenses = data.documents.map(doc => {
          const key = doc.name.split('/').pop();
          const f = doc.fields || {};
          return {
            id: key,
            key: key,
            app_id: f.app_id?.stringValue || 'ALL',
            duration_days: f.duration_days?.stringValue || '30',
            max_devices: parseInt(f.max_devices?.integerValue || '1'),
            status: f.status?.stringValue || 'UNUSED',
            bound_hwid: f.bound_hwid?.stringValue || '',
            device_name: f.device_name?.stringValue || '',
            note: f.note?.stringValue || '',
            expires_at: f.expires_at?.timestampValue || null,
            activated_at: f.activated_at?.timestampValue || null
          };
        });
        renderLicensesTable();
        renderDevicesTable();
        updateTelemetry();
        renderActivityStream();
      }
    }
  } catch (err) {
    console.warn("REST licenses fetch fallback error:", err);
  }
}

function subscribeLicenses() {
  fetchLicensesViaRest();

  const colRef = collection(db, "licenses");
  onSnapshot(colRef, (snapshot) => {
    allLicenses = [];
    snapshot.forEach(docSnap => {
      allLicenses.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderLicensesTable();
    renderDevicesTable();
    updateTelemetry();
    renderActivityStream();
  }, (err) => {
    console.warn("Licenses sync listener error:", err);
  });
}

function renderLicensesTable() {
  if (!licensesTableBody) return;
  const queryText = (searchInput?.value || "").toLowerCase().trim();
  const selectedApp = filterApp?.value || "ALL";
  const selectedStatus = filterStatus?.value || "ALL";
  const selectedDur = filterDuration?.value || "ALL";

  const filtered = allLicenses.filter(item => {
    if (selectedApp !== "ALL" && item.app_id !== selectedApp && item.app_id !== "ALL") return false;
    if (selectedStatus !== "ALL" && item.status !== selectedStatus) return false;
    if (selectedDur !== "ALL") {
      if (selectedDur === "LIFETIME" && item.duration_days !== "LIFETIME") return false;
      if (selectedDur !== "LIFETIME" && String(item.duration_days) !== String(selectedDur)) return false;
    }
    if (queryText) {
      const matchKey = (item.key || "").toLowerCase().includes(queryText);
      const matchHWID = (item.bound_hwid || "").toLowerCase().includes(queryText);
      const matchNote = (item.note || "").toLowerCase().includes(queryText);
      const matchApp = (item.app_id || "").toLowerCase().includes(queryText);
      if (!matchKey && !matchHWID && !matchNote && !matchApp) return false;
    }
    return true;
  });

  const countHeader = document.getElementById("licensesCountHeader");
  if (countHeader) countHeader.textContent = allLicenses.length;
  countTabLicenses.textContent = allLicenses.length;

  if (filtered.length === 0) {
    licensesTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:32px;">No matching licenses found.</td></tr>`;
    return;
  }

  licensesTableBody.innerHTML = filtered.map(item => {
    const statusClass = `status-${(item.status || 'UNUSED').toLowerCase()}`;
    const durationLabel = item.duration_days === "LIFETIME" ? "Lifetime 👑" : `${item.duration_days} Days`;
    const hwidText = item.bound_hwid ? item.bound_hwid : "Unbound (Pending First Login)";
    const deviceText = item.device_name ? `<br><small style="color:var(--text-muted)">${item.device_name}</small>` : "";
    const devLimit = item.max_devices || 1;
    const activeDevs = item.bound_hwid ? 1 : 0;

    return `
      <tr>
        <td>
          <span class="key-tag" onclick="copyToClipboard('${item.key}', 'License key copied!')" title="Click to copy">
            ${item.key} 📋
          </span>
        </td>
        <td><strong>${item.app_id || 'Universal'}</strong></td>
        <td>
          <strong>${durationLabel}</strong><br>
          <small style="color: var(--text-muted)">${item.expires_at ? formatDate(item.expires_at) : 'Starts upon login'}</small>
        </td>
        <td><span class="status-badge ${statusClass}">${item.status || 'UNUSED'}</span></td>
        <td><span class="badge-pill" style="font-size: 11px;">${activeDevs} / ${devLimit} Dev</span></td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 12px; color: ${item.bound_hwid ? 'var(--accent-cyan)' : 'var(--text-muted)'}">
            ${hwidText}
          </span>
          ${deviceText}
        </td>
        <td>${item.note ? `<span style="color: #FFF;">${item.note}</span>` : '<span style="color: var(--text-muted)">-</span>'}</td>
        <td>
          <div class="actions-cell">
            ${item.bound_hwid ? `
              <button class="btn btn-outline btn-sm" onclick="resetHwid('${item.key}')" title="Unbind HWID">🔄 Reset HWID</button>
            ` : ''}

            ${item.status === 'SUSPENDED' ? `
              <button class="btn btn-outline btn-sm" style="color: var(--accent-green);" onclick="setKeyStatus('${item.key}', 'ACTIVE')">▶ Resume</button>
            ` : `
              <button class="btn btn-outline btn-sm" style="color: var(--accent-amber);" onclick="setKeyStatus('${item.key}', 'SUSPENDED')">⏸ Pause</button>
            `}

            ${item.status === 'REVOKED' ? `
              <button class="btn btn-outline btn-sm" style="color: var(--accent-green);" onclick="setKeyStatus('${item.key}', 'ACTIVE')">✅ Restore</button>
            ` : `
              <button class="btn btn-outline btn-sm" style="color: var(--accent-red);" onclick="setKeyStatus('${item.key}', 'REVOKED')" title="Revoke & Kill">🚫 Revoke</button>
            `}

            <button class="btn btn-outline btn-sm" onclick="extendKey('${item.key}', 30)" title="Add +30 Days">⏳ +30D</button>
            <button class="btn btn-danger btn-sm" onclick="deleteLicense('${item.key}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Fast Writer Helper (SDK + REST Fallback)
async function writeKeyToFirestore(key, docData) {
  try {
    const sdkPromise = setDoc(doc(db, "licenses", key), docData);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("SDK_TIMEOUT")), 2000));
    await Promise.race([sdkPromise, timeoutPromise]);
  } catch (_) {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/licenses/${key}?key=${firebaseConfig.apiKey}`;
    const payload = {
      fields: {
        key: { stringValue: key },
        app_id: { stringValue: docData.app_id || 'ALL' },
        duration_days: { stringValue: String(docData.duration_days) },
        max_devices: { integerValue: String(docData.max_devices || 1) },
        status: { stringValue: docData.status || 'UNUSED' },
        bound_hwid: { stringValue: docData.bound_hwid || '' },
        device_name: { stringValue: docData.device_name || '' },
        note: { stringValue: docData.note || '' }
      }
    };
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }
}

// Single License Preview Updater
function updateKeyPreview() {
  const appId = document.getElementById("singleAppId")?.value || "ALL";
  const customPrefix = document.getElementById("singlePrefix")?.value.trim().toUpperCase();
  const prefix = customPrefix || (appId === "ALL" ? "VIP" : appId.replace("app_", "").split('_')[0].toUpperCase());
  const durationTag = selectedSingleDuration === "LIFETIME" ? "LIFE" : `${selectedSingleDuration}D`;
  const preview = document.getElementById("singleKeyPreview");
  if (preview) {
    preview.textContent = `${prefix}-${durationTag}-XXXX-YYYY`;
  }
}

document.getElementById("singlePrefix")?.addEventListener("input", updateKeyPreview);
document.getElementById("singleAppId")?.addEventListener("change", updateKeyPreview);

// Duration chips listeners
document.querySelectorAll("#durationChips .chip-btn").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#durationChips .chip-btn").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    selectedSingleDuration = chip.getAttribute("data-days");
    updateKeyPreview();
  });
});

// Single Generator Submit
document.getElementById("singleGenForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector("button[type='submit']");
  const originalText = submitBtn.innerHTML;

  submitBtn.disabled = true;
  submitBtn.innerHTML = "⏳ Generating & Saving to Cloud...";

  const appId = document.getElementById("singleAppId").value;
  const customPrefix = document.getElementById("singlePrefix").value.trim().toUpperCase();
  const devLimit = parseInt(document.getElementById("singleDeviceLimit").value) || 1;
  const note = document.getElementById("singleNote").value.trim();

  const prefix = customPrefix || (appId === "ALL" ? "VIP" : appId.replace("app_", "").split('_')[0].toUpperCase());
  const durationTag = selectedSingleDuration === "LIFETIME" ? "LIFE" : `${selectedSingleDuration}D`;
  const key = `${prefix}-${durationTag}-${generateRandomHex(4)}-${generateRandomHex(4)}`;

  const docData = {
    key: key,
    app_id: appId,
    duration_days: selectedSingleDuration,
    max_devices: devLimit,
    status: "UNUSED",
    bound_hwid: "",
    device_name: "",
    note: note,
    created_at: serverTimestamp(),
    activated_at: null,
    expires_at: null
  };

  try {
    await writeKeyToFirestore(key, docData);
    document.getElementById("modalKeysPre").textContent = key;
    document.getElementById("successModal").style.display = "flex";
    recordLog(appId, key, "/license/create", 200, "Dashboard Admin");
    showToast("License generated & synced to Cloud Firestore!");
    fetchLicensesViaRest();
  } catch (err) {
    alert("Error generating license: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

// Bulk Generator Submit
document.getElementById("bulkGenForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector("button[type='submit']");
  const originalText = submitBtn.innerHTML;

  submitBtn.disabled = true;
  submitBtn.innerHTML = "⚡ Generating Bulk Batch...";

  const appId = document.getElementById("bulkAppId").value;
  const quantity = parseInt(document.getElementById("bulkQuantity").value) || 20;
  const duration = document.getElementById("bulkDuration").value;
  const note = document.getElementById("bulkNote").value.trim();

  lastBulkKeys = [];

  try {
    for (let i = 0; i < quantity; i++) {
      const prefix = appId === "ALL" ? "VIP" : appId.replace("app_", "").split('_')[0].toUpperCase();
      const durationTag = duration === "LIFETIME" ? "LIFE" : `${duration}D`;
      const key = `${prefix}-${durationTag}-${generateRandomHex(4)}-${generateRandomHex(4)}`;

      const docData = {
        key: key,
        app_id: appId,
        duration_days: duration,
        max_devices: 1,
        status: "UNUSED",
        bound_hwid: "",
        device_name: "",
        note: note ? `${note} (#${i+1})` : `Bulk Batch (#${i+1})`,
        created_at: serverTimestamp(),
        activated_at: null,
        expires_at: null
      };

      await writeKeyToFirestore(key, docData);
      lastBulkKeys.push(key);
    }

    document.getElementById("bulkDownloadArea").style.display = "block";
    document.getElementById("bulkSuccessMsg").textContent = `${quantity} licenses successfully generated & synced to Cloud Firestore!`;

    recordLog(appId, `Bulk Batch (${quantity} keys)`, "/license/bulk_generate", 200, "Dashboard Admin");
    showToast(`Generated batch of ${quantity} keys!`);
    fetchLicensesViaRest();
  } catch (err) {
    alert("Bulk generation error: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

// Bulk Download Handlers
document.getElementById("btnDownloadCsv")?.addEventListener("click", () => {
  if (lastBulkKeys.length === 0) return;
  let csv = "License Key,Status,Created At\n";
  lastBulkKeys.forEach(k => { csv += `${k},UNUSED,${new Date().toISOString()}\n`; });
  downloadFile(csv, "licenses_bulk.csv", "text/csv");
});

document.getElementById("btnDownloadTxt")?.addEventListener("click", () => {
  if (lastBulkKeys.length === 0) return;
  downloadFile(lastBulkKeys.join("\n"), "licenses_bulk.txt", "text/plain");
});

document.getElementById("btnDownloadJson")?.addEventListener("click", () => {
  if (lastBulkKeys.length === 0) return;
  const jsonStr = JSON.stringify(lastBulkKeys.map(k => ({ key: k, status: "UNUSED" })), null, 2);
  downloadFile(jsonStr, "licenses_bulk.json", "application/json");
});

document.getElementById("btnCopyBulk")?.addEventListener("click", () => {
  if (lastBulkKeys.length === 0) return;
  window.copyToClipboard(lastBulkKeys.join("\n"), "All batch keys copied!");
});

document.getElementById("downloadCsvBtn")?.addEventListener("click", () => {
  if (allLicenses.length === 0) {
    showToast("No licenses to export!", true);
    return;
  }
  let csv = "License Key,Application,Duration,Status,Bound HWID,Device Name,Note,Expires At\n";
  allLicenses.forEach(l => {
    csv += `"${l.key}","${l.app_id || 'ALL'}","${l.duration_days}","${l.status}","${l.bound_hwid || ''}","${l.device_name || ''}","${l.note || ''}","${l.expires_at || ''}"\n`;
  });
  downloadFile(csv, "central_licenses_full.csv", "text/csv");
});

// Database Full Backup JSON
document.getElementById("downloadFullBackupBtn")?.addEventListener("click", () => {
  const backup = {
    exported_at: new Date().toISOString(),
    project_id: firebaseConfig.projectId,
    total_applications: allApps.length,
    total_licenses: allLicenses.length,
    applications: allApps,
    licenses: allLicenses
  };
  downloadFile(JSON.stringify(backup, null, 2), `cyberauth_backup_${Date.now()}.json`, "application/json");
});

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${fileName}!`);
}

// Success Modal Actions
window.closeSuccessModal = function() {
  document.getElementById("successModal").style.display = "none";
};

window.viewInTableFromModal = function() {
  window.closeSuccessModal();
  window.switchTab("tab-licenses");
  renderLicensesTable();
};

document.getElementById("modalCopyBtn")?.addEventListener("click", () => {
  const text = document.getElementById("modalKeysPre").textContent;
  if (text) window.copyToClipboard(text, "License key copied!");
});

// License Actions: Reset HWID, Status, Extend, Delete
window.resetHwid = async function(key) {
  if (!confirm(`Reset HWID for ${key}? The user can bind a new phone/PC on next login.`)) return;
  try {
    await updateDoc(doc(db, "licenses", key), {
      bound_hwid: "",
      device_name: "",
      status: "UNUSED",
      activated_at: null,
      expires_at: null
    });
    recordLog("Central Authority", key, "/device/reset", 200, "HWID Reset");
    showToast(`HWID successfully reset for ${key}!`);
    fetchLicensesViaRest();
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
};

window.setKeyStatus = async function(key, status) {
  try {
    await updateDoc(doc(db, "licenses", key), { status: status });
    recordLog("Central Authority", key, `/license/status/${status}`, 200, `Status -> ${status}`);
    showToast(`Status updated to ${status}!`);
    fetchLicensesViaRest();
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
};

window.extendKey = async function(key, daysToAdd) {
  try {
    const docRef = doc(db, "licenses", key);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    
    const data = snap.data();
    let newExpiry;
    if (data.expires_at) {
      const cur = data.expires_at.toDate ? data.expires_at.toDate() : new Date(data.expires_at);
      newExpiry = new Date(cur.getTime() + daysToAdd * 86400000);
    } else {
      newExpiry = new Date(Date.now() + daysToAdd * 86400000);
    }

    await updateDoc(docRef, {
      expires_at: newExpiry,
      status: "ACTIVE"
    });
    recordLog("Central Authority", key, `/license/extend`, 200, `+${daysToAdd} Days`);
    showToast(`Extended ${key} by +${daysToAdd} days!`);
    fetchLicensesViaRest();
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
};

window.deleteLicense = async function(key) {
  if (!confirm(`Permanently delete license ${key}?`)) return;
  await deleteDoc(doc(db, "licenses", key));
  recordLog("Central Authority", key, "/license/delete", 200, "Deleted from Authority");
  showToast(`Deleted ${key}`);
  fetchLicensesViaRest();
};

// ----------------------------------------------------
// 3. DEVICE MANAGER
// ----------------------------------------------------
function renderDevicesTable() {
  if (!devicesTableBody) return;
  const boundLicenses = allLicenses.filter(l => l.bound_hwid && l.bound_hwid.trim() !== "");
  const devCountHeader = document.getElementById("countDevicesHeader");
  if (devCountHeader) devCountHeader.textContent = boundLicenses.length;
  countTabDevices.textContent = boundLicenses.length;
  statTotalDevices.textContent = boundLicenses.length;

  if (boundLicenses.length === 0) {
    devicesTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;">No hardware devices currently bound.</td></tr>`;
    return;
  }

  devicesTableBody.innerHTML = boundLicenses.map(item => {
    const isBanned = item.status === 'BANNED' || item.status === 'REVOKED';
    return `
      <tr>
        <td>
          <span style="font-family: var(--font-mono); color: var(--accent-cyan); font-weight: 700; cursor: pointer;" onclick="copyToClipboard('${item.bound_hwid}', 'HWID copied!')">
            ${item.bound_hwid} 📋
          </span>
        </td>
        <td><strong>${item.app_id || 'Universal'}</strong></td>
        <td>
          <span class="key-tag" onclick="copyToClipboard('${item.key}', 'Key copied!')">${item.key}</span>
        </td>
        <td>${item.device_name || 'Verified Client Device'}</td>
        <td>${item.activated_at ? formatDate(item.activated_at) : 'Recently'}</td>
        <td><span class="status-badge ${isBanned ? 'status-banned' : 'status-active'}">${isBanned ? 'BLOCKED' : 'VERIFIED'}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-outline btn-sm" onclick="resetHwid('${item.key}')" title="Unbind device">🔄 Unbind</button>
            ${isBanned ? `
              <button class="btn btn-outline btn-sm" style="color: var(--accent-green);" onclick="setKeyStatus('${item.key}', 'ACTIVE')">Unblock</button>
            ` : `
              <button class="btn btn-danger btn-sm" onclick="setKeyStatus('${item.key}', 'BANNED')" title="Block HWID">🚫 Blacklist</button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ----------------------------------------------------
// 4. SECURITY & THREAT RADAR
// ----------------------------------------------------
function renderThreatsTable() {
  if (!threatsTableBody) return;
  const countH = document.getElementById("threatsCountHeader");
  if (countH) countH.textContent = securityThreats.length;
  countTabThreats.textContent = securityThreats.length;

  if (securityThreats.length === 0) {
    threatsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;">Shield active. No security threats or crack attempts detected.</td></tr>`;
    return;
  }

  threatsTableBody.innerHTML = securityThreats.map((t, idx) => `
    <tr>
      <td style="color: var(--text-muted); font-family: var(--font-mono);">${t.timestamp}</td>
      <td><strong>${t.appId}</strong></td>
      <td><span style="color: var(--accent-red); font-weight: 700;">🚨 ${t.threat}</span></td>
      <td><span style="font-family: var(--font-mono); color: var(--accent-cyan);">${t.hwid}</span></td>
      <td><span class="status-badge status-banned">${t.severity}</span></td>
      <td><small style="color: var(--text-secondary);">${t.action}</small></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="blacklistThreatHwid('${t.hwid}', '${t.key}')">🚫 Blacklist HWID</button>
      </td>
    </tr>
  `).join("");
}

window.recordThreat = function(appId, threat, hwid, key = "") {
  securityThreats.unshift({
    timestamp: new Date().toLocaleTimeString(),
    appId,
    threat,
    hwid,
    key,
    severity: "CRITICAL",
    action: "App Terminated / Self-Destruct Triggered"
  });
  if (securityThreats.length > 50) securityThreats.pop();
  renderThreatsTable();
  showToast(`⚠️ Threat Detected: ${threat} on HWID ${hwid.substring(0, 8)}...`, true);
};

window.blacklistThreatHwid = async function(hwid, key) {
  if (key) {
    await setKeyStatus(key, "BANNED");
  }
  showToast(`HWID ${hwid} has been permanently blacklisted!`);
};

window.clearThreatLogs = function() {
  securityThreats = [];
  renderThreatsTable();
  showToast("Threat radar cleared!");
};

// ----------------------------------------------------
// 5. TELEMETRY & LIVE LOGS
// ----------------------------------------------------
function updateTelemetry() {
  const active = allLicenses.filter(l => l.status === "ACTIVE").length;
  const unused = allLicenses.filter(l => l.status === "UNUSED").length;
  const revExp = allLicenses.filter(l => l.status === "EXPIRED" || l.status === "REVOKED" || l.status === "BANNED" || l.status === "SUSPENDED").length;
  const boundDevs = allLicenses.filter(l => l.bound_hwid && l.bound_hwid.trim() !== "").length;

  statTotalApps.textContent = allApps.length;
  statActiveKeys.textContent = active;
  statTotalDevices.textContent = boundDevs;
  statUnusedKeys.textContent = unused;
  statRevokedKeys.textContent = revExp;
}

function renderActivityStream() {
  const container = document.getElementById("activityStreamList");
  if (!container) return;
  const recentItems = allLicenses.slice(0, 10);

  if (recentItems.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 24px;">No recent license activities.</div>`;
    return;
  }

  container.innerHTML = recentItems.map(l => {
    let icon = "🔑";
    let color = "var(--accent-cyan)";
    if (l.status === "ACTIVE") { icon = "✅"; color = "var(--accent-green)"; }
    if (l.status === "REVOKED" || l.status === "BANNED") { icon = "🚫"; color = "var(--accent-red)"; }
    if (l.status === "SUSPENDED") { icon = "⏸️"; color = "var(--accent-amber)"; }

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255, 255, 255, 0.02); border-radius: 6px; border-left: 2px solid ${color};">
        <div>
          <span style="font-size: 14px; margin-right: 6px;">${icon}</span>
          <strong style="color: #FFF; font-family: var(--font-mono); font-size: 12px;">${l.key}</strong>
          <small style="color: var(--text-muted); margin-left: 8px;">(${l.app_id || 'Universal'})</small>
        </div>
        <span class="status-badge status-${(l.status||'unused').toLowerCase()}" style="font-size: 10px;">${l.status || 'UNUSED'}</span>
      </div>
    `;
  }).join("");
}

function recordLog(appId, key, endpoint, status, note) {
  liveLogs.unshift({
    timestamp: new Date().toLocaleTimeString(),
    appId,
    key,
    endpoint,
    status,
    note,
    duration: Math.floor(Math.random() * 35 + 22) + "ms"
  });

  if (liveLogs.length > 50) liveLogs.pop();
  renderLogsTable();
}

function renderLogsTable() {
  if (!logsTableBody) return;
  countTabLogs.textContent = liveLogs.length;

  if (liveLogs.length === 0) {
    logsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;">Waiting for client license verification calls...</td></tr>`;
    return;
  }

  logsTableBody.innerHTML = liveLogs.map(l => `
    <tr>
      <td style="color: var(--text-muted); font-family: var(--font-mono);">${l.timestamp}</td>
      <td><strong>${l.appId}</strong></td>
      <td><span class="key-tag" style="font-size: 11px;">${l.key}</span></td>
      <td><code style="color: var(--accent-cyan);">${l.endpoint}</code></td>
      <td><span class="status-badge ${l.status === 200 ? 'status-active' : 'status-banned'}">${l.status}</span></td>
      <td><small style="color: var(--text-secondary);">${l.note}</small></td>
      <td style="color: var(--accent-green); font-family: var(--font-mono); font-size: 11px;">${l.duration}</td>
    </tr>
  `).join("");
}

window.clearLiveLogs = function() {
  liveLogs = [];
  renderLogsTable();
  showToast("Live API traffic logs cleared!");
};

// ----------------------------------------------------
// 6. INTERACTIVE LIVE API PLAYGROUND
// ----------------------------------------------------
document.getElementById("btnRunApiTest")?.addEventListener("click", async () => {
  const testKey = document.getElementById("testKeyInput")?.value.trim();
  const testHwid = document.getElementById("testHwidInput")?.value.trim() || "TEST-DEVICE-HWID-999";
  const resultArea = document.getElementById("testResultArea");
  const resultPre = document.getElementById("testResultJson");
  const statusBadge = document.getElementById("testStatusBadge");
  const latencyBadge = document.getElementById("testLatency");

  if (!testKey) {
    showToast("Please enter a license key to test!", true);
    return;
  }

  const startMs = performance.now();
  resultArea.style.display = "block";
  resultPre.textContent = "Sending verification request to Cloud Firestore...";

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/licenses/${testKey}?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url);
    const elapsed = Math.round(performance.now() - startMs);

    latencyBadge.textContent = `${elapsed}ms`;

    if (res.status === 200) {
      const data = await res.json();
      const fields = data.fields || {};
      const status = fields.status?.stringValue || "UNUSED";
      const boundHwid = fields.bound_hwid?.stringValue || "";
      const appId = fields.app_id?.stringValue || "ALL";

      statusBadge.textContent = "200 OK - VALID";
      statusBadge.className = "status-badge status-active";

      const formatted = {
        verification_status: "SUCCESS",
        status_code: 200,
        license_key: testKey,
        target_app: appId,
        license_status: status,
        bound_hwid: boundHwid,
        client_hwid_provided: testHwid,
        device_match: boundHwid === "" || boundHwid === testHwid,
        duration_plan: fields.duration_days?.stringValue,
        max_devices: fields.max_devices?.integerValue || 1,
        latency: `${elapsed}ms`
      };

      resultPre.textContent = JSON.stringify(formatted, null, 2);
      recordLog(appId, testKey, "/license/verify", 200, `Playground Test (${elapsed}ms)`);
    } else if (res.status === 404) {
      statusBadge.textContent = "404 NOT FOUND";
      statusBadge.className = "status-badge status-banned";
      resultPre.textContent = JSON.stringify({
        verification_status: "FAILED",
        status_code: 404,
        error: "LICENSE_KEY_NOT_FOUND",
        message: "The entered license key does not exist on this authority.",
        latency: `${elapsed}ms`
      }, null, 2);
      recordLog("API Playground", testKey, "/license/verify", 404, "Invalid Key");
    } else {
      statusBadge.textContent = `${res.status} ERROR`;
      statusBadge.className = "status-badge status-banned";
      const errText = await res.text();
      resultPre.textContent = errText;
    }
  } catch (err) {
    statusBadge.textContent = "NETWORK ERROR";
    statusBadge.className = "status-badge status-banned";
    resultPre.textContent = JSON.stringify({ error: err.message }, null, 2);
  }
});

// ----------------------------------------------------
// 7. DEVELOPER DOCS & SDK SNIPPETS
// ----------------------------------------------------
function updateDocSnippets() {
  const selector = document.getElementById("docAppSelector");
  if (!selector) return;

  const selectedAppId = selector.value || (allApps[0]?.id || "app_garena_android");
  const currentApp = allApps.find(a => a.id === selectedAppId) || allApps[0] || {
    id: "app_garena_android",
    api_key: "pk_live_default_key"
  };

  const appId = currentApp.id;
  const apiKey = currentApp.api_key;
  const projectId = firebaseConfig.projectId;

  // 1. Kotlin
  const elKot = document.getElementById("snippetKotlin");
  if (elKot) {
    elKot.textContent = 
`// Android Kotlin SDK Integration
val clientKey = "GARENA-30D-XXXX-YYYY"
val deviceHwid = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)

val verifyUrl = URL("https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/$clientKey?key=${firebaseConfig.apiKey}")
val conn = verifyUrl.openConnection() as HttpURLConnection

if (conn.responseCode == 200) {
    val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
    val fields = json.getJSONObject("fields")
    val status = fields.getJSONObject("status").getString("stringValue")
    val boundHwid = fields.optJSONObject("bound_hwid")?.optString("stringValue") ?: ""
    val targetApp = fields.optJSONObject("app_id")?.optString("stringValue") ?: "ALL"

    if (status == "ACTIVE" && (targetApp == "ALL" || targetApp == "${appId}")) {
        if (boundHwid.isEmpty() || boundHwid == deviceHwid) {
            // VIP Access Granted!
        }
    }
}`;
  }

  // 2. Python
  const elPy = document.getElementById("snippetPython");
  if (elPy) {
    elPy.textContent = 
`# Python Client Integration
import requests, platform, hashlib

APP_ID = "${appId}"
FIREBASE_KEY = "${firebaseConfig.apiKey}"
PROJECT_ID = "${projectId}"

def verify_license(license_key, device_hwid):
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/licenses/{license_key}?key={FIREBASE_KEY}"
    res = requests.get(url)
    if res.status_code == 200:
        fields = res.json().get("fields", {})
        status = fields.get("status", {}).get("stringValue")
        bound_hwid = fields.get("bound_hwid", {}).get("stringValue", "")
        app_target = fields.get("app_id", {}).get("stringValue", "ALL")

        if status == "ACTIVE" and (app_target == "ALL" or app_target == APP_ID):
            if not bound_hwid or bound_hwid == device_hwid:
                return True, "VIP Access Valid"
    return False, "License Invalid, Expired, or Bound to another Device"`;
  }

  // 3. C#
  const elCs = document.getElementById("snippetCSharp");
  if (elCs) {
    elCs.textContent = 
`// C# (.NET / WPF / Windows Forms)
using System.Net.Http;
using Newtonsoft.Json.Linq;

string appId = "${appId}";
string key = "WIN-30D-XXXX-YYYY";
string hwid = GetHardwareGuid();

using var client = new HttpClient();
string url = $"https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/{key}?key=${firebaseConfig.apiKey}";
var response = await client.GetAsync(url);

if (response.IsSuccessStatusCode) {
    var content = await response.Content.ReadAsStringAsync();
    var json = JObject.Parse(content);
    string status = json["fields"]?["status"]?["stringValue"]?.ToString();
    string bound = json["fields"]?["bound_hwid"]?["stringValue"]?.ToString();

    if (status == "ACTIVE" && (string.IsNullOrEmpty(bound) || bound == hwid)) {
        // Unlock Application Features
    }
}`;
  }

  // 4. cURL
  const elCurl = document.getElementById("snippetCurl");
  if (elCurl) {
    elCurl.textContent = 
`# cURL / Direct REST API Verification
curl -X GET "https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/YOUR_KEY?key=${firebaseConfig.apiKey}" \\
     -H "Accept: application/json"`;
  }
}

document.getElementById("docAppSelector")?.addEventListener("change", updateDocSnippets);

// Filter Listeners
searchInput?.addEventListener("input", renderLicensesTable);
filterApp?.addEventListener("change", renderLicensesTable);
filterStatus?.addEventListener("change", renderLicensesTable);
filterDuration?.addEventListener("change", renderLicensesTable);

document.getElementById("refreshBtn")?.addEventListener("click", () => {
  fetchAppsViaRest();
  fetchLicensesViaRest();
  showToast("Live authority data synchronized!");
});

// Seed Boot Log
recordLog("System Authority", "CENTRAL_ENGINE", "/system/boot", 200, "Authority Ready");

// Kick off real-time listeners
subscribeApps();
subscribeLicenses();
