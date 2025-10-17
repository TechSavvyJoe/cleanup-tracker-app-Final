import { createApiClient } from './client';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function searchVehicles({ baseUrl, token, query }) {
  const client = createApiClient(baseUrl);
  const params = query ? { q: query } : {};
  const response = await client.get('/api/v2/vehicles/search', {
    params,
    headers: authHeaders(token)
  });
  return response.data;
}

export async function listVehicles({ baseUrl, token, filters = {} }) {
  const client = createApiClient(baseUrl);
  const response = await client.get('/api/v2/vehicles', {
    params: filters,
    headers: authHeaders(token)
  });
  return response.data;
}

export async function joinVehicleByVin({ baseUrl, token, vin, userId }) {
  const client = createApiClient(baseUrl);
  const response = await client.put(
    '/api/v2/vehicles/join-by-vin',
    { vin, userId },
    { headers: authHeaders(token) }
  );
  return response.data;
}
