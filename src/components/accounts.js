import { api } from '../utils/api.js';
import { showToast, openModalWithAuthType } from '../main.js';

let codexDetected = null;

export function renderAccounts(container, { accounts, onAccountsChange }) {
  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h1>Accounts</h1>
        <p>Manage your OpenAI accounts for usage monitoring</p>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-ghost" id="btn-add-oauth" title="Add via OAuth Token">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          OAuth
        </button>
        <button class="btn btn-primary" id="btn-add-account">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Account
        </button>
      </div>
    </div>

    <div id="codex-detect-area"></div>

    <div class="accounts-grid" id="accounts-grid">
      ${accounts.map((acc) => accountCardHTML(acc)).join('')}
      <div class="add-account-card" id="add-account-trigger">
        <div class="plus-icon">+</div>
        <span>Add new account</span>
      </div>
    </div>
  `;

  // Detect Codex CLI
  detectCodexCLI(onAccountsChange);

  // Wire up add buttons
  const addBtn = document.getElementById('btn-add-account');
  const addOAuthBtn = document.getElementById('btn-add-oauth');
  const addTrigger = document.getElementById('add-account-trigger');

  addBtn.addEventListener('click', () => openModalWithAuthType('apiKey'));
  addOAuthBtn.addEventListener('click', () => openModalWithAuthType('oauth'));
  addTrigger.addEventListener('click', () => openModalWithAuthType('apiKey'));

  // Wire up account card actions
  accounts.forEach((acc) => {
    const card = document.getElementById(`account-${acc.id}`);
    if (!card) return;

    // Test connection
    const testBtn = card.querySelector('.btn-test');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        testBtn.disabled = true;
        testBtn.innerHTML = '<svg class="spinning" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 115.64 5.64L1 10"/></svg>';
        try {
          const result = await api.testAccount(acc.id);
          if (result.success) {
            showToast('Connection successful!', 'success');
            if (result.note) {
              setTimeout(() => showToast(result.note, 'info'), 500);
            }
          } else {
            showToast(`Connection failed: ${result.message}`, 'error');
          }
          onAccountsChange();
        } catch (err) {
          showToast(`Test failed: ${err.message}`, 'error');
        }
        testBtn.disabled = false;
      });
    }

    // Refresh token (for Codex CLI linked accounts)
    const refreshBtn = card.querySelector('.btn-refresh-token');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        try {
          const result = await api.refreshCodexToken(acc.id);
          showToast(result.message || 'Token refreshed!', 'success');
          onAccountsChange();
        } catch (err) {
          showToast(`Refresh failed: ${err.message}`, 'error');
        }
      });
    }

    // Edit
    const editBtn = card.querySelector('.btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const modal = document.getElementById('account-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('account-form');
        const submitBtn = document.getElementById('modal-submit');
        const labelInput = document.getElementById('account-label');
        const orgInput = document.getElementById('account-org-id');
        const authTabs = document.getElementById('auth-tabs');
        const apiKeyFields = document.getElementById('auth-apikey-fields');
        const oauthFields = document.getElementById('auth-oauth-fields');

        title.textContent = 'Edit Account';
        submitBtn.textContent = 'Save Changes';
        form.dataset.editId = acc.id;
        form.dataset.editAuthType = acc.authType || 'apiKey';
        labelInput.value = acc.label;
        orgInput.value = acc.orgId || '';

        // Hide auth type tabs when editing (can't change type)
        authTabs.style.display = 'none';

        if (acc.authType === 'oauth') {
          apiKeyFields.style.display = 'none';
          oauthFields.style.display = 'block';
          document.getElementById('account-access-token').value = '';
          document.getElementById('account-access-token').placeholder = 'Leave empty to keep current token';
          document.getElementById('account-refresh-token').value = '';
        } else {
          apiKeyFields.style.display = 'block';
          oauthFields.style.display = 'none';
          const apiKeyInput = document.getElementById('account-api-key');
          apiKeyInput.value = '';
          apiKeyInput.placeholder = 'Leave empty to keep current key';
        }

        modal.classList.remove('hidden');
      });
    }

    // Delete
    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to delete "${acc.label}"?`)) return;
        try {
          await api.deleteAccount(acc.id);
          showToast('Account deleted', 'info');
          onAccountsChange();
        } catch (err) {
          showToast(`Delete failed: ${err.message}`, 'error');
        }
      });
    }
  });
}

async function detectCodexCLI(onAccountsChange) {
  const area = document.getElementById('codex-detect-area');
  if (!area) return;

  try {
    const result = await api.detectCodex();
    if (result.found && result.results.length > 0) {
      codexDetected = result.results;
      area.innerHTML = result.results.map((r, idx) => `
        <div class="codex-detect-banner" id="codex-banner-${idx}">
          <div class="codex-detect-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div class="codex-detect-content">
            <h4>Codex CLI Detected!</h4>
            <p>Found OAuth token at <code>${r.path.replace(/\\/g, '/').split('/').slice(-3).join('/')}</code>${r.isExpired ? ' <span style="color:var(--accent-amber)">(expired)</span>' : ''}</p>
          </div>
          <div class="codex-detect-actions">
            <button class="btn btn-primary btn-sm" data-codex-idx="${idx}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Import
            </button>
          </div>
        </div>
      `).join('');

      // Wire up import buttons
      result.results.forEach((r, idx) => {
        const btn = area.querySelector(`[data-codex-idx="${idx}"]`);
        if (btn) {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Importing...';
            try {
              await api.importCodex({ path: r.path, label: 'Codex CLI' });
              showToast('Codex CLI account imported!', 'success');
              // Remove banner
              const banner = document.getElementById(`codex-banner-${idx}`);
              if (banner) banner.remove();
              onAccountsChange();
            } catch (err) {
              showToast(`Import failed: ${err.message}`, 'error');
              btn.disabled = false;
              btn.textContent = 'Import';
            }
          });
        }
      });
    }
  } catch {
    // Silently fail — detection is optional
  }
}

function accountCardHTML(acc) {
  const statusClass = acc.status || 'pending';
  const statusLabel = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
  const isOAuth = acc.authType === 'oauth';
  const isCodexLinked = acc.source === 'codex-cli';

  return `
    <div class="account-card" id="account-${acc.id}">
      <div class="account-card-header">
        <div class="account-card-info">
          <h3>${acc.label}</h3>
          <div class="key-preview">${isOAuth ? (acc.tokenPreview || '••••••••') : (acc.keyPreview || '••••••••')}</div>
          <div class="auth-type-badge ${isOAuth ? 'oauth' : 'apikey'}">
            ${isOAuth ? '🔐 OAuth' : '🔑 API Key'}
          </div>
          <div style="font-size:0.68rem;color:var(--text-muted);margin-top:6px;">
            ${isOAuth ? 'Profile only (no detailed usage/cost)' : 'Full usage + cost access'}
          </div>
        </div>
        <span class="account-status ${statusClass}">
          <span class="status-dot"></span>
          ${statusLabel}
        </span>
      </div>

      ${acc.orgId ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">Org: ${acc.orgId}</div>` : ''}
      ${isOAuth && acc.isExpired ? `<div style="font-size:0.75rem;color:var(--accent-amber);margin-bottom:8px;">⚠ Token expired — please refresh</div>` : ''}
      ${isCodexLinked ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px;">Linked to Codex CLI</div>` : ''}
      ${isOAuth && acc.profile ? `
        <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);border-radius:8px;padding:10px 14px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff;">${(acc.profile.name || '?').charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-size:0.8rem;font-weight:600;">${acc.profile.name || 'Unknown'}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);">${acc.profile.email || ''}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${acc.profile.plan ? `<span style="font-size:0.65rem;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:rgba(6,182,212,0.15);color:var(--accent-cyan);">${acc.profile.plan}</span>` : ''}
            ${acc.profile.orgTitle ? `<span style="font-size:0.65rem;color:var(--text-muted);">${acc.profile.orgTitle}</span>` : ''}
          </div>
        </div>
      ` : ''}
      ${isOAuth && !acc.profile && acc.status === 'active' ? '' : (isOAuth && acc.status !== 'active' ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:8px;font-style:italic;">Test connection to load profile</div>` : '')}

      <div class="account-card-actions">
        <button class="btn-icon btn-test" title="Test Connection">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </button>
        ${isCodexLinked ? `
          <button class="btn-icon btn-refresh-token" title="Refresh Token from Codex CLI">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
        ` : ''}
        <button class="btn-icon btn-edit" title="Edit Account">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon btn-delete danger" title="Delete Account">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}
