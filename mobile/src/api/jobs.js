import { createApiClient } from './client';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchJobs({ baseUrl, token }) {
  const client = createApiClient(baseUrl);
  const response = await client.get('/api/v2/jobs', {
    headers: authHeaders(token)
  });
  return response.data;
}

export async function fetchJobById({ baseUrl, token, jobId }) {
  const client = createApiClient(baseUrl);
  const response = await client.get(`/api/v2/jobs/${jobId}`, {
    headers: authHeaders(token)
  });
  return response.data;
}

export async function createJob({ baseUrl, token, payload }) {
  const client = createApiClient(baseUrl);
  const response = await client.post('/api/v2/jobs', payload, {
    headers: authHeaders(token)
  });
  return response.data;
}

export async function completeJob({ baseUrl, token, jobId }) {
  const client = createApiClient(baseUrl);
  const response = await client.put(`/api/v2/jobs/${jobId}/complete`, null, {
    headers: authHeaders(token)
  });
  return response.data;
}

export async function pauseJob({ baseUrl, token, jobId, reason }) {
  const client = createApiClient(baseUrl);
  const response = await client.post(`/api/v2/jobs/${jobId}/pause`, { reason }, {
    headers: authHeaders(token)
  });
  return response.data;
}

export async function resumeJob({ baseUrl, token, jobId }) {
  const client = createApiClient(baseUrl);
  const response = await client.put(`/api/v2/jobs/${jobId}/resume`, null, {
    headers: authHeaders(token)
  });
  return response.data;
}

export async function updateJobStatus({ baseUrl, token, jobId, status, qcNotes }) {
  const client = createApiClient(baseUrl);
  const response = await client.put(`/api/v2/jobs/${jobId}/status`, { status, qcNotes }, {
    headers: authHeaders(token)
  });
  return response.data;
}

export async function completeQc({ baseUrl, token, jobId, qcPassed, qcNotes, qcCheckerId }) {
  const client = createApiClient(baseUrl);
  const payload = {
    qcPassed,
    qcNotes,
    qcCheckerId
  };
  const response = await client.put(`/api/v2/jobs/${jobId}/qc-complete`, payload, {
    headers: authHeaders(token)
  });
  return response.data;
}
