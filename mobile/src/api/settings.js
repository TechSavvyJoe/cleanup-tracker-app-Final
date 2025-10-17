import { createApiClient } from './client';

export async function fetchSettings({ baseUrl, token }) {
  const client = createApiClient(baseUrl);
  const response = await client.get('/api/v2/settings', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  return response.data;
}
