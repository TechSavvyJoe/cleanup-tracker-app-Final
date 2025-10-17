import axios from 'axios';

export function createApiClient(baseUrl) {
  const normalized = baseUrl?.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return axios.create({
    baseURL: normalized || 'http://127.0.0.1:5051',
    timeout: 10000
  });
}
