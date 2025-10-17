import axios from 'axios';

export function createApiClient(baseUrl) {
  const trimmed = typeof baseUrl === 'string' ? baseUrl.trim() : '';
  if (!trimmed) {
    throw new Error('API base URL is not configured');
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('API base URL must include the protocol, e.g. https://api.yourdomain.com');
  }

  const normalized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  return axios.create({
    baseURL: normalized,
    timeout: 10000
  });
}
