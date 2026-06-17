import React, { useState, useEffect } from 'react';
import { Settings, Play, Square, ShieldAlert, Wifi, Info, ShieldAlert as AlertIcon, AlertTriangle } from 'lucide-react';
import { startSniffer, stopSniffer, triggerAttack } from '../utils/api';

export default function SettingsTab({ systemStatus, reloadStatus }) {
  const [mode, setMode] = useState(systemStatus.mode || 'simulation');
  const [selectedInterface, setSelectedInterface] = useState(systemStatus.interface || '');
  const [threshold, setThreshold] = useState(systemStatus.confidence_threshold || 0.5);
  
  const [activeAttack, setActiveAttack] = useState('None');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(systemStatus.mode);
    setSelectedInterface(systemStatus.interface || (systemStatus.interfaces && systemStatus.interfaces[0]) || '');
    setThreshold(systemStatus.confidence_threshold);
  }, [systemStatus]);

  const handleStart = async () => {
    setLoading(true);
    try {
      await startSniffer(mode, selectedInterface, threshold);
      await reloadStatus();
    } catch (err) {
      alert(`Error starting sniffer: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopSniffer();
      setActiveAttack('None');
      await reloadStatus();
    } catch (err) {
      alert(`Error stopping sniffer: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAttackTrigger = async (type) => {
    try {
      // API call expects: None, DDoS, PortScan, BruteForce
      await triggerAttack(type);
      setActiveAttack(type);
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    }
  };

  return (
    <div className="dashboard-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.4rem' }}>System Controls & Settings</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure real-time packet collection interfaces, ML thresholds, and simulation parameters</p>
      </div>

      <div className="dashboard-grid" style={{ margin: 0 }}>
        
        {/* Left: General Settings */}
        <div className="glass-panel col-6" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--color-primary)" />
            NIDS Engine Configurations
          </h3>

          {/* Sniffer Active state warning */}
          {systemStatus.is_running && (
            <div className="badge badge-success animate-pulse-cyan" style={{ padding: '8px 12px', width: '100%', justifyContent: 'center', borderRadius: '8px' }}>
              Sniffer engine is active and analyzing traffic
            </div>
          )}

          {/* Capture Mode Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Analysis Source Mode</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setMode('simulation')}
                className={`cyber-btn outline ${mode === 'simulation' ? 'glow-primary' : ''}`}
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderColor: mode === 'simulation' ? 'var(--color-primary)' : '', background: mode === 'simulation' ? 'rgba(0,242,254,0.05)' : '' }}
                disabled={systemStatus.is_running}
              >
                Traffic Simulator
              </button>
              <button 
                onClick={() => setMode('live')}
                className={`cyber-btn outline ${mode === 'live' ? 'glow-primary' : ''}`}
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderColor: mode === 'live' ? 'var(--color-primary)' : '', background: mode === 'live' ? 'rgba(0,242,254,0.05)' : '' }}
                disabled={systemStatus.is_running}
              >
                Live Interface Sniffer
              </button>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {mode === 'simulation' 
                ? 'Simulation: Safely feeds synthetic packet sequences to inspect the AI classifier without local packet drivers.' 
                : 'Live Sniffer: Attaches to your physical network interface using Scapy socket sniffers (requires administrative rights).'}
            </p>
          </div>

          {/* Network Interface selection (disabled if simulation) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Network Capture Interface</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select 
                value={selectedInterface} 
                onChange={(e) => setSelectedInterface(e.target.value)}
                disabled={mode === 'simulation' || systemStatus.is_running}
                className="cyber-input cyber-select"
                style={{ flex: 1 }}
              >
                {systemStatus.interfaces && systemStatus.interfaces.map(iface => (
                  <option key={iface} value={iface}>{iface}</option>
                ))}
              </select>
              <span style={{ color: mode === 'live' ? 'var(--color-primary)' : 'var(--text-muted)' }} title="Interface status">
                <Wifi size={18} />
              </span>
            </div>
          </div>

          {/* Confidence threshold slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="flex-between">
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>AI Threat Filter Threshold</label>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                {Math.round(threshold * 100)}%
              </span>
            </div>
            <input 
              type="range" 
              min="0.10" 
              max="0.95" 
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              disabled={systemStatus.is_running}
              style={{ 
                width: '100%', 
                accentColor: 'var(--color-primary)', 
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)'
              }}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Filters out anomalies classified with confidence scores below this percentage. Lower values increase capture sensitivity, while higher values block false positives.
            </p>
          </div>

          {/* Engine Start/Stop buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {!systemStatus.is_running ? (
              <button 
                onClick={handleStart} 
                className="cyber-btn success"
                disabled={loading}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Play size={16} />
                Activate NIDS Engine
              </button>
            ) : (
              <button 
                onClick={handleStop} 
                className="cyber-btn danger"
                disabled={loading}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Square size={16} />
                Deactivate NIDS Engine
              </button>
            )}
          </div>
        </div>

        {/* Right: Simulation Controls */}
        <div className="glass-panel col-6" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="var(--color-danger)" />
            Attack Simulation Injector
          </h3>
          
          <div style={{ padding: '12px 14px', background: 'rgba(0, 242, 254, 0.04)', border: '1px solid rgba(0, 242, 254, 0.15)', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: '1.4' }}>
              Use these triggers to inject cyber attacks into the packet simulator stream. This allows you to verify that the AI model correctly detects anomalies and generates visual dashboard alerts on command.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            
            {/* DDoS SYN Flood */}
            <div className={`glass-panel ${activeAttack === 'DDoS' ? 'glow-danger animate-pulse-danger' : ''}`} style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeAttack === 'DDoS' ? 'rgba(255, 23, 68, 0.05)' : '' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', display: 'block' }}>SYN Flood (DDoS Attack)</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rapidly streams hundreds of small TCP packets with empty payloads.</span>
              </div>
              <button 
                onClick={() => handleAttackTrigger('DDoS')}
                disabled={!systemStatus.is_running || systemStatus.mode !== 'simulation'}
                className={`cyber-btn outline ${activeAttack === 'DDoS' ? 'danger' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                Trigger
              </button>
            </div>

            {/* Port Scan */}
            <div className={`glass-panel ${activeAttack === 'PortScan' ? 'glow-danger animate-pulse-danger' : ''}`} style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeAttack === 'PortScan' ? 'rgba(255, 23, 68, 0.05)' : '' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', display: 'block' }}>Sequential Port Scan</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Queries sequential ports (1-1024) to locate open gateway services.</span>
              </div>
              <button 
                onClick={() => handleAttackTrigger('PortScan')}
                disabled={!systemStatus.is_running || systemStatus.mode !== 'simulation'}
                className={`cyber-btn outline ${activeAttack === 'PortScan' ? 'danger' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                Trigger
              </button>
            </div>

            {/* SSH Brute Force */}
            <div className={`glass-panel ${activeAttack === 'BruteForce' ? 'glow-danger animate-pulse-danger' : ''}`} style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activeAttack === 'BruteForce' ? 'rgba(255, 23, 68, 0.05)' : '' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', display: 'block' }}>Infiltration / SSH Brute Force</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Simulates large encrypted packet transfers executing login commands.</span>
              </div>
              <button 
                onClick={() => handleAttackTrigger('BruteForce')}
                disabled={!systemStatus.is_running || systemStatus.mode !== 'simulation'}
                className={`cyber-btn outline ${activeAttack === 'BruteForce' ? 'danger' : ''}`}
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                Trigger
              </button>
            </div>

            {/* Reset to normal */}
            <button 
              onClick={() => handleAttackTrigger('None')}
              disabled={!systemStatus.is_running || systemStatus.mode !== 'simulation' || activeAttack === 'None'}
              className="cyber-btn outline"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '10px' }}
            >
              Clear Simulation (Return to Normal Traffic)
            </button>
            
          </div>
        </div>

      </div>
    </div>
  );
}
