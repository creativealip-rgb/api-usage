const BASE_URL = '/api';

export const api = {
  // Account endpoints
  async getAccounts() {
    const res = await fetch(`${BASE_URL}/accounts`);
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  },

  async addAccount(data) {
    const res = await fetch(`${BASE_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add account');
    }
    return res.json();
  },

  async updateAccount(id, data) {
    const res = await fetch(`${BASE_URL}/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update account');
    return res.json();
  },

  async deleteAccount(id) {
    const res = await fetch(`${BASE_URL}/accounts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete account');
    return res.json();
  },

  async testAccount(id) {
    const res = await fetch(`${BASE_URL}/accounts/${id}/test`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to test account');
    return res.json();
  },

  // Usage endpoints
  async getCosts(accountId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/usage/${accountId}/costs?${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch costs');
    }
    return res.json();
  },

  async getCompletions(accountId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/usage/${accountId}/completions?${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch completions');
    }
    return res.json();
  },

  async getAllCosts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/usage/batch/all/costs?${query}`);
    if (!res.ok) throw new Error('Failed to fetch all costs');
    return res.json();
  },

  async getAllCompletions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/usage/batch/all/completions?${query}`);
    if (!res.ok) throw new Error('Failed to fetch all completions');
    return res.json();
  },

  // OAuth / Codex CLI endpoints
  async detectCodex() {
    const res = await fetch(`${BASE_URL}/accounts/detect-codex`);
    if (!res.ok) throw new Error('Failed to detect Codex CLI');
    return res.json();
  },

  async importCodex(data) {
    const res = await fetch(`${BASE_URL}/accounts/import-codex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to import Codex account');
    }
    return res.json();
  },

  async refreshCodexToken(id) {
    const res = await fetch(`${BASE_URL}/accounts/${id}/refresh-token`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to refresh token');
    }
    return res.json();
  },
};
