// Replace this domain with your live Render backend URL after deploying it
export const BACKEND_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'localhost:8000'
  : 'ai-based-nids.onrender.com'; // Replace with your Render domain

export const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api'
  : `https://${BACKEND_HOST}/api`;


export const fetchStatus = async () => {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Failed to fetch system status');
  return res.json();
};

export const startSniffer = async (mode, interfaceName, threshold) => {
  const res = await fetch(`${API_BASE}/control/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, interface: interfaceName, confidence_threshold: parseFloat(threshold) })
  });
  if (!res.ok) throw new Error('Failed to start sniffer');
  return res.json();
};

export const stopSniffer = async () => {
  const res = await fetch(`${API_BASE}/control/stop`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to stop sniffer');
  return res.json();
};

export const triggerAttack = async (attackType) => {
  const res = await fetch(`${API_BASE}/control/attack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attack_type: attackType })
  });
  if (!res.ok) throw new Error('Failed to trigger attack simulation');
  return res.json();
};

export const fetchAlerts = async (filters = {}) => {
  const cleanFilters = {};
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      cleanFilters[key] = filters[key];
    }
  });
  
  const params = new URLSearchParams(cleanFilters);
  const res = await fetch(`${API_BASE}/alerts?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
};

export const fetchMetrics = async (limit = 60) => {
  const res = await fetch(`${API_BASE}/metrics?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch traffic metrics');
  return res.json();
};

export const fetchModelInfo = async () => {
  const res = await fetch(`${API_BASE}/model/info`);
  if (!res.ok) throw new Error('Failed to fetch AI model info');
  return res.json();
};

export const retrainModel = async () => {
  const res = await fetch(`${API_BASE}/model/train`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to retrain model');
  return res.json();
};

export const getWebSocketUrl = () => {
  const loc = window.location;
  const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  
  if (isLocal) {
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = loc.port === '3000' ? '8000' : loc.port;
    return `${proto}//${loc.hostname}:${port}/ws/traffic`;
  } else {
    // Production secure WebSocket
    return `wss://${BACKEND_HOST}/ws/traffic`;
  }
};
