import { createApiClient } from './client';

export async function loginUser({ baseUrl, employeeId, pin }) {
  if (!pin) {
    throw new Error('PIN is required');
  }

  const client = createApiClient(baseUrl);
  const payload = employeeId
    ? { employeeId: String(employeeId).trim(), pin: String(pin).trim() }
    : { pin: String(pin).trim() };

  const response = await client.post('/api/v2/auth/login', payload);
  return response.data;
}

export async function getDashboardSummary({ baseUrl, token }) {
  if (!token) {
    throw new Error('Missing access token');
  }
  const client = createApiClient(baseUrl);
  const response = await client.get('/api/v2/reports/summary', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}
