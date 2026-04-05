import { Chart, registerables } from 'chart.js';
import { api } from './utils/api.js';
import { renderDashboard } from './components/dashboard.js';
import { renderAnalytics } from './components/analytics.js';
import { renderAccounts } from './components/accounts.js';

// Register Chart.js components
Chart.register(...registerables);

// Global state
let currentView = 'dashboard';
let accounts = [];
let currentAuthType = 'apiKey';

// Toast system
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Initialize
async function init() {
  setupNavigation();
  setupModal();
  setupRefresh();
  await loadAccounts();
  renderCurrentView();
}

// Navigation
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      currentView = item.dataset.view;
      renderCurrentView();
    });
  });
}

// Modal
function setupModal() {
  const modal = document.getElementById('account-modal');
  const closeBtn = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('modal-cancel');
  const form = document.getElementById('account-form');

  // Auth type tabs
  const authTabs = document.querySelectorAll('.auth-tab');
  const apiKeyFields = document.getElementById('auth-apikey-fields');
  const oauthFields = document.getElementById('auth-oauth-fields');

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      authTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentAuthType = tab.dataset.auth;

      if (currentAuthType === 'oauth') {
        apiKeyFields.style.display = 'none';
        oauthFields.style.display = 'block';
      } else {
        apiKeyFields.style.display = 'block';
        oauthFields.style.display = 'none';
      }
    });
  });

  const close = () => {
    modal.classList.add('hidden');
    form.reset();
    form.dataset.editId = '';
    form.dataset.editAuthType = '';
    currentAuthType = 'apiKey';
    // Reset tabs
    authTabs.forEach((t) => t.classList.remove('active'));
    authTabs[0].classList.add('active');
    apiKeyFields.style.display = 'block';
    oauthFields.style.display = 'none';
    // Reset api key field
    const apiKeyInput = document.getElementById('account-api-key');
    apiKeyInput.placeholder = 'sk-admin-...';
    // Show tabs
    document.getElementById('auth-tabs').style.display = 'flex';
  };

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const label = document.getElementById('account-label').value.trim();
    const orgId = document.getElementById('account-org-id').value.trim();
    const editId = form.dataset.editId;
    const editAuthType = form.dataset.editAuthType;

    // Determine auth type for this submission
    const authType = editId ? (editAuthType || currentAuthType) : currentAuthType;

    try {
      if (editId) {
        // Update
        const updateData = { label, orgId };
        if (authType === 'oauth') {
          const accessToken = document.getElementById('account-access-token').value.trim();
          const refreshToken = document.getElementById('account-refresh-token').value.trim();
          const expiresAtInput = document.getElementById('account-expires-at').value;
          if (accessToken) updateData.accessToken = accessToken;
          if (refreshToken) updateData.refreshToken = refreshToken;
          if (expiresAtInput) updateData.expiresAt = new Date(expiresAtInput).toISOString();
        } else {
          const apiKey = document.getElementById('account-api-key').value.trim();
          if (apiKey) updateData.apiKey = apiKey;
        }
        await api.updateAccount(editId, updateData);
        showToast('Account updated successfully', 'success');
      } else {
        // Create
        if (authType === 'oauth') {
          const accessToken = document.getElementById('account-access-token').value.trim();
          const refreshToken = document.getElementById('account-refresh-token').value.trim();
          const expiresAtInput = document.getElementById('account-expires-at').value;

          if (!accessToken) {
            showToast('Access token is required', 'error');
            return;
          }

          await api.addAccount({
            label,
            authType: 'oauth',
            accessToken,
            refreshToken,
            expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : '',
            orgId,
          });
        } else {
          const apiKey = document.getElementById('account-api-key').value.trim();
          if (!apiKey) {
            showToast('API key is required', 'error');
            return;
          }
          await api.addAccount({ label, apiKey, orgId });
        }
        showToast('Account added successfully', 'success');
      }

      close();
      await loadAccounts();
      renderCurrentView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Open modal with specific auth type
export function openModalWithAuthType(type = 'apiKey') {
  const modal = document.getElementById('account-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('account-form');
  const submitBtn = document.getElementById('modal-submit');
  const authTabs = document.querySelectorAll('.auth-tab');
  const apiKeyFields = document.getElementById('auth-apikey-fields');
  const oauthFields = document.getElementById('auth-oauth-fields');

  title.textContent = 'Add Account';
  submitBtn.textContent = 'Add Account';
  form.reset();
  form.dataset.editId = '';
  form.dataset.editAuthType = '';
  currentAuthType = type;

  // Set correct tab
  authTabs.forEach((t) => {
    t.classList.toggle('active', t.dataset.auth === type);
  });

  if (type === 'oauth') {
    apiKeyFields.style.display = 'none';
    oauthFields.style.display = 'block';
  } else {
    apiKeyFields.style.display = 'block';
    oauthFields.style.display = 'none';
  }

  document.getElementById('auth-tabs').style.display = 'flex';
  modal.classList.remove('hidden');
}

// Refresh
function setupRefresh() {
  const refreshBtn = document.getElementById('btn-refresh-all');
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('spinning');
    await loadAccounts();
    renderCurrentView();
    updateLastRefresh();
    refreshBtn.classList.remove('spinning');
    showToast('Data refreshed', 'info');
  });
}

function updateLastRefresh() {
  const el = document.getElementById('last-refresh');
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Load accounts
async function loadAccounts() {
  try {
    accounts = await api.getAccounts();
  } catch (err) {
    console.error('Failed to load accounts:', err);
    accounts = [];
  }
}

// Render
function renderCurrentView() {
  const container = document.getElementById('main-content');

  switch (currentView) {
    case 'dashboard':
      renderDashboard(container, { accounts, Chart });
      break;
    case 'analytics':
      renderAnalytics(container, { accounts, Chart });
      break;
    case 'accounts':
      renderAccounts(container, {
        accounts,
        onAccountsChange: async () => {
          await loadAccounts();
          renderCurrentView();
        },
      });
      break;
    default:
      renderDashboard(container, { accounts, Chart });
  }

  updateLastRefresh();
}

// Start the app
init();
