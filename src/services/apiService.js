const API_URL = 'http://localhost:5000/api';

export const api = {
  get: async (endpoint) => {
    const res = await fetch(`${API_URL}${endpoint}`);
    if (!res.ok) throw new Error(`Error fetching ${endpoint}`);
    return res.json();
  },
  post: async (endpoint, data) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Error posting to ${endpoint}`);
    return res.json();
  },
  put: async (endpoint, data) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Error putting to ${endpoint}`);
    return res.json();
  },
  delete: async (endpoint) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`Error deleting ${endpoint}`);
    return res.json();
  }
};
