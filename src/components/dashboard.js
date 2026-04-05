import { api } from '../utils/api.js';
import { formatCurrency, formatTokens, formatNumber, formatDate, getTimeRange, getChartColor } from '../utils/formatters.js';

let costChartInstance = null;
let tokenChartInstance = null;

export function renderDashboard(container, { accounts, Chart }) {
  const hasAccounts = accounts && accounts.length > 0;

  container.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Overview of all your OpenAI accounts' usage and costs</p>
    </div>

    ${hasAccounts ? `
      <div id="usage-warning" style="display:none;margin-bottom:12px;padding:10px 12px;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08);color:#f59e0b;border-radius:10px;font-size:12px;"></div>
      <div class="date-range-bar">
        <button class="date-range-btn active" data-range="7d">7 Days</button>
        <button class="date-range-btn" data-range="30d">30 Days</button>
        <button class="date-range-btn" data-range="90d">90 Days</button>
      </div>

      <div class="cards-grid" id="stats-cards">
        <div class="stat-card">
          <div class="stat-card-icon cyan">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div class="stat-card-label">Total Cost</div>
          <div class="stat-card-value" id="total-cost"><div class="skeleton skeleton-title"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <div class="stat-card-label">Total Requests</div>
          <div class="stat-card-value" id="total-requests"><div class="skeleton skeleton-title"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div class="stat-card-label">Input Tokens</div>
          <div class="stat-card-value" id="total-input-tokens"><div class="skeleton skeleton-title"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon emerald">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div class="stat-card-label">Output Tokens</div>
          <div class="stat-card-value" id="total-output-tokens"><div class="skeleton skeleton-title"></div></div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Cost Over Time</div>
              <div class="chart-card-subtitle">Cost breakdown by account</div>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="cost-chart"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Token Usage</div>
              <div class="chart-card-subtitle">Input vs Output tokens</div>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="token-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="table-card">
        <div class="table-card-header">
          <div class="chart-card-title">Account Overview</div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Status</th>
              <th>Total Cost</th>
              <th>Requests</th>
              <th>Input Tokens</th>
              <th>Output Tokens</th>
            </tr>
          </thead>
          <tbody id="account-table-body">
            ${accounts.map(() => `
              <tr>
                <td><div class="skeleton skeleton-text" style="width:120px"></div></td>
                <td><div class="skeleton skeleton-text" style="width:60px"></div></td>
                <td><div class="skeleton skeleton-text" style="width:80px"></div></td>
                <td><div class="skeleton skeleton-text" style="width:60px"></div></td>
                <td><div class="skeleton skeleton-text" style="width:80px"></div></td>
                <td><div class="skeleton skeleton-text" style="width:80px"></div></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
        </div>
        <h3>No Accounts Added</h3>
        <p>Add your first OpenAI account to start monitoring API usage, costs, and tokens in real-time.</p>
        <button class="btn btn-primary" id="empty-add-account">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Account
        </button>
      </div>
    `}
  `;

  // Wire up events
  if (!hasAccounts) {
    const addBtn = container.querySelector('#empty-add-account');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        document.querySelector('[data-view="accounts"]').click();
      });
    }
    return;
  }

  // Date range buttons
  const rangeBtns = container.querySelectorAll('.date-range-btn');
  rangeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      rangeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadDashboardData(accounts, btn.dataset.range, Chart);
    });
  });

  // Initial data load
  loadDashboardData(accounts, '7d', Chart);
}

async function loadDashboardData(accounts, range, Chart) {
  const timeRange = getTimeRange(range);

  try {
    const [costsResults, completionsResults] = await Promise.all([
      api.getAllCosts({
        start_time: timeRange.start_time,
        end_time: timeRange.end_time,
        bucket_width: '1d',
      }),
      api.getAllCompletions({
        start_time: timeRange.start_time,
        end_time: timeRange.end_time,
        bucket_width: '1d',
      }),
    ]);

    const warningEl = document.getElementById('usage-warning');
    const unsupported = [...costsResults, ...completionsResults].filter((r) =>
      typeof r?.error === 'string' && r.error.toLowerCase().includes('oauth')
    );
    if (warningEl) {
      if (unsupported.length > 0) {
        warningEl.style.display = 'block';
        warningEl.textContent = 'Some OAuth accounts are profile-only and cannot show detailed org usage/cost. Add Admin API Key accounts for full analytics.';
      } else {
        warningEl.style.display = 'none';
        warningEl.textContent = '';
      }
    }

    // Aggregate stats
    let totalCost = 0;
    let totalRequests = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const accountStats = {};

    // Process costs
    costsResults.forEach((result) => {
      if (result.error) return;
      const accountId = result.accountId;
      if (!accountStats[accountId]) {
        accountStats[accountId] = { label: result.label, cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
      }
      if (result.data?.data) {
        result.data.data.forEach((bucket) => {
          if (bucket.result) {
            bucket.result.forEach((r) => {
              const amount = r.amount?.value ?? r.amount_value ?? 0;
              totalCost += amount;
              accountStats[accountId].cost += amount;
            });
          }
        });
      }
    });

    // Process completions
    completionsResults.forEach((result) => {
      if (result.error) return;
      const accountId = result.accountId;
      if (!accountStats[accountId]) {
        accountStats[accountId] = { label: result.label, cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
      }
      if (result.data?.data) {
        result.data.data.forEach((bucket) => {
          if (bucket.result) {
            bucket.result.forEach((r) => {
              const reqs = r.num_model_requests || 0;
              const inp = r.input_tokens || 0;
              const out = r.output_tokens || 0;
              totalRequests += reqs;
              totalInputTokens += inp;
              totalOutputTokens += out;
              accountStats[accountId].requests += reqs;
              accountStats[accountId].inputTokens += inp;
              accountStats[accountId].outputTokens += out;
            });
          }
        });
      }
    });

    // Update stat cards
    document.getElementById('total-cost').textContent = formatCurrency(totalCost);
    document.getElementById('total-requests').textContent = formatNumber(totalRequests);
    document.getElementById('total-input-tokens').textContent = formatTokens(totalInputTokens);
    document.getElementById('total-output-tokens').textContent = formatTokens(totalOutputTokens);

    // Update account table
    const tbody = document.getElementById('account-table-body');
    if (tbody) {
      tbody.innerHTML = accounts.map((acc) => {
        const stats = accountStats[acc.id] || { cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
        const statusClass = acc.status || 'pending';
        return `
          <tr>
            <td class="model-name">${acc.label}</td>
            <td><span class="account-status ${statusClass}"><span class="status-dot"></span>${statusClass}</span></td>
            <td class="number">${formatCurrency(stats.cost)}</td>
            <td class="number">${formatNumber(stats.requests)}</td>
            <td class="number">${formatTokens(stats.inputTokens)}</td>
            <td class="number">${formatTokens(stats.outputTokens)}</td>
          </tr>
        `;
      }).join('');
    }

    // Render charts
    renderCostChart(costsResults, Chart);
    renderTokenChart(completionsResults, Chart);

  } catch (err) {
    console.error('Dashboard data load error:', err);
  }
}

function renderCostChart(costsResults, Chart) {
  if (costChartInstance) {
    costChartInstance.destroy();
    costChartInstance = null;
  }

  const canvas = document.getElementById('cost-chart');
  if (!canvas) return;

  const datasets = [];
  const allLabels = new Set();

  costsResults.forEach((result, idx) => {
    if (result.error || !result.data?.data) return;
    const dataMap = {};
    result.data.data.forEach((bucket) => {
      const label = formatDate(bucket.start_time);
      allLabels.add(label);
      let total = 0;
      if (bucket.result) {
        bucket.result.forEach((r) => {
          total += r.amount?.value ?? r.amount_value ?? 0;
        });
      }
      dataMap[label] = (dataMap[label] || 0) + total;
    });

    const color = getChartColor(idx);
    datasets.push({
      label: result.label,
      data: dataMap,
      backgroundColor: color.bg,
      borderColor: color.border,
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: color.border,
    });
  });

  const labels = [...allLabels].sort();
  datasets.forEach((ds) => {
    const mapped = labels.map((l) => ds.data[l] || 0);
    ds.data = mapped;
  });

  costChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 16 },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
            callback: (v) => '$' + v.toFixed(2),
          },
        },
      },
    },
  });
}

function renderTokenChart(completionsResults, Chart) {
  if (tokenChartInstance) {
    tokenChartInstance.destroy();
    tokenChartInstance = null;
  }

  const canvas = document.getElementById('token-chart');
  if (!canvas) return;

  const allLabels = new Set();
  const inputMap = {};
  const outputMap = {};

  completionsResults.forEach((result) => {
    if (result.error || !result.data?.data) return;
    result.data.data.forEach((bucket) => {
      const label = formatDate(bucket.start_time);
      allLabels.add(label);
      if (bucket.result) {
        bucket.result.forEach((r) => {
          inputMap[label] = (inputMap[label] || 0) + (r.input_tokens || 0);
          outputMap[label] = (outputMap[label] || 0) + (r.output_tokens || 0);
        });
      }
    });
  });

  const labels = [...allLabels].sort();

  tokenChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Input Tokens',
          data: labels.map((l) => inputMap[l] || 0),
          backgroundColor: 'rgba(139, 92, 246, 0.4)',
          borderColor: '#8b5cf6',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Output Tokens',
          data: labels.map((l) => outputMap[l] || 0),
          backgroundColor: 'rgba(6, 182, 212, 0.4)',
          borderColor: '#06b6d4',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 16 },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatTokens(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
          stacked: true,
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
            callback: (v) => formatTokens(v),
          },
          stacked: true,
        },
      },
    },
  });
}
