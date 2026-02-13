const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Check-in
export const startCheckin = (date?: string) =>
  request<any>('/checkin/start', { method: 'POST', body: JSON.stringify({ date }) });

export const submitAnswer = (checkin_id: number, question_id: string, category: string, answer: string) =>
  request<any>('/checkin/answer', {
    method: 'POST',
    body: JSON.stringify({ checkin_id, question_id, category, answer }),
  });

export const getCheckinHistory = (limit?: number) =>
  request<any[]>(`/checkin/history?limit=${limit || 30}`);

export const getCheckinDetail = (id: number) =>
  request<any>(`/checkin/${id}`);

// Dashboard
export const getDashboardSummary = (days?: number) =>
  request<any>(`/dashboard/summary?days=${days || 30}`);

export const getInsights = (limit?: number) =>
  request<any[]>(`/dashboard/insights?limit=${limit || 10}`);

export const dismissInsight = (id: number) =>
  request<any>(`/dashboard/insights/${id}/dismiss`, { method: 'POST' });

export const refreshInsights = () =>
  request<any[]>('/dashboard/insights/refresh', { method: 'POST' });

// Settings
export const getSettings = () =>
  request<Record<string, string>>('/settings/');

export const updateSettings = (settings: Record<string, string>) =>
  request<any>('/settings/', { method: 'PUT', body: JSON.stringify(settings) });
