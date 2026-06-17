import React, { useState, useEffect, useRef } from 'react';
import { Activity, ShieldAlert, Cpu, Settings, Circle, RefreshCw } from 'lucide-react';
import { getWebSocketUrl, fetchStatus } from './utils/api';
import Dashboard from './components/Dashboard';
import AlertList from './components/AlertList';
import ModelHub from './components/ModelHub';
import SettingsTab from './components/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [wsConnected, setWsConnected] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    is_running: false,
    mode: 'simulation',
    interface: null,
    confidence_threshold: 0.5,
    interfaces: []
  });
  
  // Real-time states
  const [livePackets, setLivePackets] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState([]);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Load status on mount
  const loadSystemStatus = async () => {
    try {
      const data = await fetchStatus();
      setSystemStatus(data);
    } catch (e) {
      console.error("Failed to load status:", e);
    }
  };

  useEffect(() => {
    loadSystemStatus();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const wsUrl = getWebSocketUrl();
    console.log("Connecting WebSocket to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected.");
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle stream data types
        if (data.packet) {
          // Keep only last 15 packets for live scroll
          setLivePackets(prev => [data.packet, ...prev].slice(0, 15));
        }
        
        if (data.alert) {
          // Keep only last 30 alerts for immediate ticker
          setRecentAlerts(prev => [data.alert, ...prev].slice(0, 30));
        }
        
        if (data.metrics) {
          setLiveMetrics(prev => {
            const next = [...prev, data.metrics];
            // Keep last 45 data points for live charts
            if (next.length > 45) {
              return next.slice(next.length - 45);
            }
            return next;
          });
        }
        
        // Handle error messages from backend
        if (data.type === "error") {
          alert(data.message);
          loadSystemStatus();
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected. Reconnecting...");
      setWsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    };
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            livePackets={livePackets} 
            recentAlerts={recentAlerts} 
            liveMetrics={liveMetrics} 
            systemStatus={systemStatus}
          />
        );
      case 'alerts':
        return <AlertList />;
      case 'model':
        return <ModelHub />;
      case 'settings':
        return (
          <SettingsTab 
            systemStatus={systemStatus} 
            reloadStatus={loadSystemStatus}
          />
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header bar */}
      <header className="glass-panel" style={{ borderRadius: '0px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="dashboard-container" style={{ padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-flex', padding: '8px', background: 'rgba(0, 242, 254, 0.1)', borderRadius: '10px', color: 'var(--color-primary)', border: '1px solid rgba(0, 242, 254, 0.15)' }}>
                <Activity size={24} className="animate-pulse-cyan" />
              </span>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(90deg, #00f2fe, #7f00ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  SENTINEL NIDS
                </h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  AI-Based Network Intrusion Detection System
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`cyber-btn outline ${activeTab === 'dashboard' ? 'glow-primary' : ''}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: activeTab === 'dashboard' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)', background: activeTab === 'dashboard' ? 'rgba(0,242,254,0.05)' : '' }}
            >
              <Activity size={16} />
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('alerts')}
              className={`cyber-btn outline ${activeTab === 'alerts' ? 'glow-primary' : ''}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: activeTab === 'alerts' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)', background: activeTab === 'alerts' ? 'rgba(0,242,254,0.05)' : '' }}
            >
              <ShieldAlert size={16} />
              Alert Log
            </button>
            <button 
              onClick={() => setActiveTab('model')}
              className={`cyber-btn outline ${activeTab === 'model' ? 'glow-primary' : ''}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: activeTab === 'model' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)', background: activeTab === 'model' ? 'rgba(0,242,254,0.05)' : '' }}
            >
              <Cpu size={16} />
              AI Model Hub
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`cyber-btn outline ${activeTab === 'settings' ? 'glow-primary' : ''}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: activeTab === 'settings' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)', background: activeTab === 'settings' ? 'rgba(0,242,254,0.05)' : '' }}
            >
              <Settings size={16} />
              Settings
            </button>
          </nav>

          {/* System Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* WebSocket Connection indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              <Circle size={8} fill={wsConnected ? "var(--color-success)" : "var(--color-danger)"} stroke="none" className={wsConnected ? "" : "animate-pulse"} />
              {wsConnected ? 'Websocket: Live' : 'Websocket: Closed'}
            </div>

            {/* Sniffer Indicator */}
            <div className="badge" style={{ 
              background: systemStatus.is_running ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 23, 68, 0.12)',
              color: systemStatus.is_running ? 'var(--color-success)' : 'var(--color-danger)',
              border: systemStatus.is_running ? '1px solid rgba(0, 230, 118, 0.2)' : '1px solid rgba(255, 23, 68, 0.2)'
            }}>
              {systemStatus.is_running ? 'SNIFFING' : 'STOPPED'}
            </div>
            
            {/* Mode Indicator */}
            <div className="badge" style={{ 
              background: systemStatus.mode === 'live' ? 'rgba(127, 0, 255, 0.12)' : 'rgba(0, 242, 254, 0.12)',
              color: systemStatus.mode === 'live' ? 'var(--color-secondary)' : 'var(--color-primary)',
              border: systemStatus.mode === 'live' ? '1px solid rgba(127, 0, 255, 0.2)' : '1px solid rgba(0, 242, 254, 0.2)'
            }}>
              {systemStatus.mode === 'live' ? 'LIVE CAPTURE' : 'SIMULATION'}
            </div>

            <button 
              onClick={() => { loadSystemStatus(); connectWebSocket(); }} 
              className="cyber-btn outline" 
              style={{ padding: '6px', borderRadius: '50%' }}
              title="Refresh state"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </main>

      {/* Footer */}
      <footer style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)' }}>
        Sentinel NIDS Dashboard &copy; 2026. Built with Python, FastAPI, Scikit-Learn, and React.
      </footer>
    </div>
  );
}
