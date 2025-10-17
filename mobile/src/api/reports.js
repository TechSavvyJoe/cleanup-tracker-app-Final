import { createApiClient } from './client';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchReports({ baseUrl, token, params = {} }) {
  const client = createApiClient(baseUrl);
  const response = await client.get('/api/v2/reports', {
    params,
    headers: authHeaders(token)
  });
  return response.data;
}
