import { api } from '../utils/api.js';
import { formatCurrency, formatTokens, formatNumber, formatDate, getTimeRange, getChartColor } from '../utils/formatters.js';

let costTrendChart = null;
let tokenTrendChart = null;
let costDistChart = null;
let modelBreakdownChart = null;

export function renderAnalytics(container, { accounts, Chart }) {
  const hasAccounts = accounts && accounts.length > 0;

  if (!hasAccounts) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Analytics</h1>
        <p>Deep dive into your API usage patterns</p>
      </div>
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <h3>No Data Available</h3>
        <p>Add an account first to see analytics data.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>Analytics</h1>
      <p>Deep dive into your API usage patterns</p>
    </div>

    <div id="usage-warning" style="display:none;margin-bottom:12px;padding:10px 12px;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08);color:#f59e0b;border-radius:10px;font-size:12px;"></div>

    <div class="analytics-filters">
      <label>Account:</label>
      <select class="custom-select" id="analytics-account-filter">
        <option value="all">All Accounts</option>
        ${accounts.map((a) => `<option value="${a.id}">${a.label}</option>`).join('')}
      </select>
      
      <label style="margin-left: 16px;">Period:</label>
      <div class="date-range-bar" style="margin-bottom:0">
        <button class="date-range-btn active" data-range="7d">7D</button>
        <button class="date-range-btn" data-range="30d">30D</button>
        <button class="date-range-btn" data-range="90d">90D</button>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Cost Trend</div>
            <div class="chart-card-subtitle">Daily cost over selected period</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="analytics-cost-trend"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Cost Distribution</div>
            <div class="chart-card-subtitle">By account</div>
          </div>
        </div>
        <div class="chart-container" style="max-width:280px;margin:0 auto;">
          <canvas id="analytics-cost-dist"></canvas>
        </div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Token Usage Trend</div>
            <div class="chart-card-subtitle">Input & Output tokens over time</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="analytics-token-trend"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Model Breakdown</div>
            <div class="chart-card-subtitle">Requests by model</div>
          </div>
        </div>
        <div class="chart-container" style="max-width:280px;margin:0 auto;">
          <canvas id="analytics-model-breakdown"></canvas>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-card-header">
        <div class="chart-card-title">Model Details</div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Requests</th>
            <th>Input Tokens</th>
            <th>Output Tokens</th>
            <th>Estimated Cost</th>
          </tr>
        </thead>
        <tbody id="analytics-model-table">
          <tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Wire up events
  const accountFilter = document.getElementById('analytics-account-filter');
  const rangeBtns = container.querySelectorAll('.date-range-btn');

  function getCurrentRange() {
    const active = container.querySelector('.date-range-btn.active');
    return active?.dataset.range || '7d';
  }

  accountFilter.addEventListener('change', () => {
    loadAnalyticsData(accounts, accountFilter.value, getCurrentRange(), Chart);
  });

  rangeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      rangeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadAnalyticsData(accounts, accountFilter.value, btn.dataset.range, Chart);
    });
  });

  loadAnalyticsData(accounts, 'all', '7d', Chart);
}

async function loadAnalyticsData(accounts, accountFilter, range, Chart) {
  const timeRange = getTimeRange(range);
  const params = {
    start_time: timeRange.start_time,
    end_time: timeRange.end_time,
    bucket_width: '1d',
    group_by: 'model',
  };

  try {
    let costsResults, completionsResults;

    if (accountFilter === 'all') {
      [costsResults, completionsResults] = await Promise.all([
        api.getAllCosts({ ...params, group_by: undefined }),
        api.getAllCompletions(params),
      ]);
    } else {
      const acc = accounts.find((a) => a.id === accountFilter);
      try {
        const [costData, compData] = await Promise.all([
          api.getCosts(accountFilter, { ...params, group_by: undefined }),
          api.getCompletions(accountFilter, params),
        ]);
        costsResults = [{ accountId: accountFilter, label: acc?.label || 'Unknown', data: costData }];
        completionsResults = [{ accountId: accountFilter, label: acc?.label || 'Unknown', data: compData }];
      } catch (err) {
        costsResults = [{ accountId: accountFilter, label: acc?.label || 'Unknown', error: err.message }];
        completionsResults = [{ accountId: accountFilter, label: acc?.label || 'Unknown', error: err.message }];
      }
    }

    const warningEl = document.getElementById('usage-warning');
    const unsupported = [...costsResults, ...completionsResults].filter((r) =>
      typeof r?.error === 'string' && r.error.toLowerCase().includes('oauth')
    );
    if (warningEl) {
      if (unsupported.length > 0) {
        warningEl.style.display = 'block';
        warningEl.textContent = 'Selected OAuth account is profile-only. Detailed analytics require Admin API Key account.';
      } else {
        warningEl.style.display = 'none';
        warningEl.textContent = '';
      }
    }

    renderCostTrendChart(costsResults, Chart);
    renderCostDistChart(costsResults, Chart);
    renderTokenTrendChart(completionsResults, Chart);
    renderModelBreakdownChart(completionsResults, Chart);
    renderModelTable(completionsResults);

  } catch (err) {
    console.error('Analytics data load error:', err);
  }
}

function renderCostTrendChart(costsResults, Chart) {
  if (costTrendChart) costTrendChart.destroy();
  const canvas = document.getElementById('analytics-cost-trend');
  if (!canvas) return;

  const allLabels = new Set();
  const datasets = [];

  costsResults.forEach((result, idx) => {
    if (result.error || !result.data?.data) return;
    const dataMap = {};
    result.data.data.forEach((bucket) => {
      const label = formatDate(bucket.start_time);
      allLabels.add(label);
      let total = 0;
      if (bucket.result) {
        bucket.result.forEach((r) => { total += r.amount?.value ?? r.amount_value ?? 0; });
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
  datasets.forEach((ds) => { ds.data = labels.map((l) => ds.data[l] || 0); });

  costTrendChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions('$', (v) => '$' + v.toFixed(2), (v) => formatCurrency(v)),
  });
}

function renderCostDistChart(costsResults, Chart) {
  if (costDistChart) costDistChart.destroy();
  const canvas = document.getElementById('analytics-cost-dist');
  if (!canvas) return;

  const accountCosts = {};
  costsResults.forEach((result) => {
    if (result.error || !result.data?.data) return;
    let total = 0;
    result.data.data.forEach((bucket) => {
      if (bucket.result) {
        bucket.result.forEach((r) => { total += r.amount?.value ?? r.amount_value ?? 0; });
      }
    });
    accountCosts[result.label] = (accountCosts[result.label] || 0) + total;
  });

  const labels = Object.keys(accountCosts);
  const data = Object.values(accountCosts);
  const colors = labels.map((_, i) => getChartColor(i).border);
  const bgColors = labels.map((_, i) => getChartColor(i).bg);

  costDistChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: 'rgba(0,0,0,0.3)', borderWidth: 2, hoverOffset: 8 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 16, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` },
        },
      },
    },
  });
}

function renderTokenTrendChart(completionsResults, Chart) {
  if (tokenTrendChart) tokenTrendChart.destroy();
  const canvas = document.getElementById('analytics-token-trend');
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

  tokenTrendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Input Tokens',
          data: labels.map((l) => inputMap[l] || 0),
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderColor: '#8b5cf6',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#8b5cf6',
        },
        {
          label: 'Output Tokens',
          data: labels.map((l) => outputMap[l] || 0),
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          borderColor: '#06b6d4',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#06b6d4',
        },
      ],
    },
    options: chartOptions('tokens', (v) => formatTokens(v), (v) => formatTokens(v)),
  });
}

function renderModelBreakdownChart(completionsResults, Chart) {
  if (modelBreakdownChart) modelBreakdownChart.destroy();
  const canvas = document.getElementById('analytics-model-breakdown');
  if (!canvas) return;

  const modelRequests = {};
  completionsResults.forEach((result) => {
    if (result.error || !result.data?.data) return;
    result.data.data.forEach((bucket) => {
      if (bucket.result) {
        bucket.result.forEach((r) => {
          const model = r.model || 'unknown';
          modelRequests[model] = (modelRequests[model] || 0) + (r.num_model_requests || 0);
        });
      }
    });
  });

  const sorted = Object.entries(modelRequests).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([m]) => m);
  const data = sorted.map(([, v]) => v);
  const colors = labels.map((_, i) => getChartColor(i).border);

  modelBreakdownChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: 'rgba(0,0,0,0.3)', borderWidth: 2, hoverOffset: 8 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 16, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          callbacks: { label: (ctx) => `${ctx.label}: ${formatNumber(ctx.raw)} requests` },
        },
      },
    },
  });
}

function renderModelTable(completionsResults) {
  const tbody = document.getElementById('analytics-model-table');
  if (!tbody) return;

  const modelData = {};
  completionsResults.forEach((result) => {
    if (result.error || !result.data?.data) return;
    result.data.data.forEach((bucket) => {
      if (bucket.result) {
        bucket.result.forEach((r) => {
          const model = r.model || 'unknown';
          if (!modelData[model]) modelData[model] = { requests: 0, inputTokens: 0, outputTokens: 0 };
          modelData[model].requests += r.num_model_requests || 0;
          modelData[model].inputTokens += r.input_tokens || 0;
          modelData[model].outputTokens += r.output_tokens || 0;
        });
      }
    });
  });

  const sorted = Object.entries(modelData).sort((a, b) => b[1].requests - a[1].requests);

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No data available</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(([model, stats]) => `
    <tr>
      <td class="model-name">${model}</td>
      <td class="number">${formatNumber(stats.requests)}</td>
      <td class="number">${formatTokens(stats.inputTokens)}</td>
      <td class="number">${formatTokens(stats.outputTokens)}</td>
      <td class="number">—</td>
    </tr>
  `).join('');
}

function chartOptions(unit, tickFormat, tooltipFormat) {
  return {
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
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${tooltipFormat(ctx.raw)}` },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: tickFormat },
      },
    },
  };
}
