export function formatCurrency(value) {
  if (value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '0';
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + 'B';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
  return value.toLocaleString();
}

export function formatTokens(value) {
  if (value === null || value === undefined) return '0';
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + 'B';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
  return value.toLocaleString();
}

export function formatDate(timestamp) {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(timestamp) {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function getTimeRange(range) {
  const now = Math.floor(Date.now() / 1000);
  const ranges = {
    '1d': now - 86400,
    '7d': now - 7 * 86400,
    '30d': now - 30 * 86400,
    '90d': now - 90 * 86400,
  };
  return {
    start_time: ranges[range] || ranges['7d'],
    end_time: now,
  };
}

// Color palette for charts - each account/model gets a unique color
export const CHART_COLORS = [
  { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4' },
  { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6' },
  { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' },
  { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' },
  { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e' },
  { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6' },
  { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899' },
  { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7' },
];

export function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
