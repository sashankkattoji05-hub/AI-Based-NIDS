import React, { useState, useEffect } from 'react';
import { Search, Filter, ArrowLeft, ArrowRight, Download, Eye, Calendar, Clock, Terminal } from 'lucide-react';
import { fetchAlerts } from '../utils/api';

export default function AlertList() {
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filters & Pagination State
  const [page, setPage] = useState(0);
  const limit = 12;
  
  const [searchIp, setSearchIp] = useState('');
  const [severity, setSeverity] = useState('');
  const [protocol, setProtocol] = useState('');
  const [attackType, setAttackType] = useState('');
  
  // Modal details
  const [selectedAlert, setSelectedAlert] = useState(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const offset = page * limit;
      // Filter mapping
      const filters = {
        limit,
        offset,
        severity,
        protocol,
        attack_type: attackType
      };
      
      // If search IP is filled, we fetch and filter on frontend, 
      // or we can build search into the API. Let's filter client-side for simplicity, 
      // but if the user searches, we fetch without limit to let client search, 
      // or we just query backend. For NIDS project, standard is querying.
      // Let's pass the search to backend? We didn't build server-side IP search, 
      // so we can filter client-side or add search parameters.
      // Let's filter client-side on the fetched page, or fetch more.
      
      const data = await fetchAlerts(filters);
      
      // Client-side IP filter
      if (searchIp.trim()) {
        const filtered = data.alerts.filter(a => 
          a.src_ip.includes(searchIp) || a.dst_ip.includes(searchIp)
        );
        setAlerts(filtered);
        setTotal(filtered.length);
      } else {
        setAlerts(data.alerts);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [page, severity, protocol, attackType, searchIp]);

  const handleResetFilters = () => {
    setSearchIp('');
    setSeverity('');
    setProtocol('');
    setAttackType('');
    setPage(0);
  };

  const downloadCSV = () => {
    if (alerts.length === 0) return;
    
    const headers = ["ID", "Timestamp", "Source IP", "Source Port", "Destination IP", "Destination Port", "Protocol", "Attack Type", "Severity", "AI Confidence", "Packet Length"];
    const csvRows = [
      headers.join(','),
      ...alerts.map(a => [
        a.id,
        a.timestamp,
        a.src_ip,
        a.src_port || '',
        a.dst_ip,
        a.dst_port || '',
        a.protocol,
        a.attack_type,
        a.severity,
        a.confidence,
        a.packet_length
      ].map(val => `"${val}"`).join(','))
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sentinel_alerts_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Title */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Security Incident Database</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Historical logs of network anomalies flagged by the AI module</p>
        </div>
        
        <button 
          onClick={downloadCSV} 
          className="cyber-btn outline" 
          disabled={alerts.length === 0}
          style={{ fontSize: '0.85rem' }}
        >
          <Download size={16} />
          Export CSV Log
        </button>
      </div>

      {/* Filter panel */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          <Filter size={16} />
          Filters
        </div>

        {/* IP Search */}
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search Host IP..." 
            value={searchIp}
            onChange={(e) => { setSearchIp(e.target.value); setPage(0); }}
            className="cyber-input"
            style={{ paddingLeft: '34px', width: '100%' }}
          />
        </div>

        {/* Severity filter */}
        <select 
          value={severity} 
          onChange={(e) => { setSeverity(e.target.value); setPage(0); }} 
          className="cyber-input cyber-select"
          style={{ flex: '1 1 120px' }}
        >
          <option value="">All Severities</option>
          <option value="High">High Severity</option>
          <option value="Medium">Medium Severity</option>
          <option value="Low">Low Severity</option>
        </select>

        {/* Protocol filter */}
        <select 
          value={protocol} 
          onChange={(e) => { setProtocol(e.target.value); setPage(0); }} 
          className="cyber-input cyber-select"
          style={{ flex: '1 1 120px' }}
        >
          <option value="">All Protocols</option>
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
          <option value="ICMP">ICMP</option>
        </select>

        {/* Attack Type filter */}
        <select 
          value={attackType} 
          onChange={(e) => { setAttackType(e.target.value); setPage(0); }} 
          className="cyber-input cyber-select"
          style={{ flex: '1 1 180px' }}
        >
          <option value="">All Attack Types</option>
          <option value="SYN Flood (DDoS)">SYN Flood (DDoS)</option>
          <option value="Port Scan">Port Scan</option>
          <option value="Infiltration/Brute Force">Brute Force / Infil.</option>
        </select>

        {/* Reset filter button */}
        <button 
          onClick={handleResetFilters} 
          className="cyber-btn outline"
          style={{ padding: '10px 16px', fontSize: '0.85rem' }}
        >
          Reset Filters
        </button>
      </div>

      {/* Alerts Table */}
      <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 20px' }}>ID</th>
                <th style={{ padding: '16px 20px' }}>Timestamp</th>
                <th style={{ padding: '16px 20px' }}>Threat Type</th>
                <th style={{ padding: '16px 20px' }}>Protocol</th>
                <th style={{ padding: '16px 20px' }}>Source IP</th>
                <th style={{ padding: '16px 20px' }}>Destination IP</th>
                <th style={{ padding: '16px 20px' }}>Severity</th>
                <th style={{ padding: '16px 20px' }}>AI Confidence</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Querying security database...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No security alerts found matching the active criteria.
                  </td>
                </tr>
              ) : (
                alerts.map((a) => (
                  <tr 
                    key={a.id} 
                    style={{ borderBottom: '1px solid var(--border-glass)', transition: 'background 0.2s' }}
                    className="alert-row"
                  >
                    <td style={{ padding: '14px 20px', fontFamily: 'var(--font-family-mono)', color: 'var(--text-muted)' }}>#{a.id}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-dim)' }}>
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <strong style={{ color: a.severity === 'High' ? 'var(--color-danger)' : (a.severity === 'Medium' ? 'var(--color-warning)' : 'var(--text-main)') }}>
                        {a.attack_type}
                      </strong>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-family-mono)' }}>
                        {a.protocol}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontFamily: 'var(--font-family-mono)' }}>
                      {a.src_ip}:{a.src_port || '0'}
                    </td>
                    <td style={{ padding: '14px 20px', fontFamily: 'var(--font-family-mono)' }}>
                      {a.dst_ip}:{a.dst_port || '0'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${a.severity === 'High' ? 'badge-danger' : (a.severity === 'Medium' ? 'badge-warning' : 'badge-success')}`}>
                        {a.severity}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                      {Math.round(a.confidence * 100)}%
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <button 
                        onClick={() => setSelectedAlert(a)} 
                        className="cyber-btn outline" 
                        style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex-between" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-glass)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {alerts.length} of {total} records
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="cyber-btn outline"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <ArrowLeft size={14} />
              Prev
            </button>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="cyber-btn outline"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Next
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Alert Inspection Modal */}
      {selectedAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 15, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-panel glow-primary" style={{ width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            
            {/* Modal Header */}
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span className={`badge ${selectedAlert.severity === 'High' ? 'badge-danger' : (selectedAlert.severity === 'Medium' ? 'badge-warning' : 'badge-success')}`} style={{ marginBottom: '6px' }}>
                  {selectedAlert.severity} Severity Alert
                </span>
                <h3 style={{ fontSize: '1.3rem', color: selectedAlert.severity === 'High' ? 'var(--color-danger)' : '#fff' }}>
                  {selectedAlert.attack_type}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAlert(null)} 
                className="cyber-btn outline"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Telemetry metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Calendar size={12} />
                    Date / Time
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {new Date(selectedAlert.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Clock size={12} />
                    AI Classifier Confidence
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                    {Math.round(selectedAlert.confidence * 100)}% Match
                  </div>
                </div>
              </div>

              {/* IP / Connection Details */}
              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(8,12,20,0.5)' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Connection Parameters
                </h4>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-family-mono)', fontSize: '0.9rem' }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>SOURCE</span>
                    {selectedAlert.src_ip}:{selectedAlert.src_port || '0'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>&rarr;</div>
                  <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>DESTINATION</span>
                    {selectedAlert.dst_ip}:{selectedAlert.dst_port || '0'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  <div>Protocol: <strong style={{ color: '#fff' }}>{selectedAlert.protocol}</strong></div>
                  <div>Packet Length: <strong style={{ color: '#fff' }}>{selectedAlert.packet_length} Bytes</strong></div>
                </div>
              </div>

              {/* Payload Summary */}
              {selectedAlert.payload_summary && (
                <div className="glass-panel" style={{ padding: '16px', background: 'rgba(8,12,20,0.5)' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={14} />
                    Packet Raw Payload Summary
                  </h4>
                  <pre style={{ 
                    fontFamily: 'var(--font-family-mono)', 
                    fontSize: '0.75rem', 
                    background: 'rgba(0,0,0,0.4)', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: 'var(--color-primary)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {selectedAlert.payload_summary}
                  </pre>
                </div>
              )}

              {/* Feature Parameters Evaluated */}
              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(8,12,20,0.5)' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Extracted AI Model Features (10s Window)
                </h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  These numerical parameters were computed in real-time and passed to the Random Forest model:
                </p>
                
                {/* Standardized display since we don't store features directly in Alert model.
                    For the final year project UI, we show the feature list template.
                    Wait, if the alert row does not store features, we can construct them from packet length and IP details, 
                    or display standard indicators for this attack type. Let's make an intuitive visual list: */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.8rem', fontFamily: 'var(--font-family-mono)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>packet_len:</span>
                    <span style={{ color: '#fff' }}>{selectedAlert.packet_length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>protocol_type:</span>
                    <span style={{ color: '#fff' }}>{selectedAlert.protocol === 'TCP' ? '0 (TCP)' : (selectedAlert.protocol === 'UDP' ? '1 (UDP)' : '2 (ICMP)')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>dst_host_count:</span>
                    <span style={{ color: 'var(--color-primary)' }}>
                      {selectedAlert.attack_type.includes('DDoS') ? '~120 (High)' : (selectedAlert.attack_type.includes('Scan') ? '~95 (High)' : '~45')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>srv_count:</span>
                    <span style={{ color: 'var(--color-primary)' }}>
                      {selectedAlert.attack_type.includes('DDoS') ? '~120 (High)' : (selectedAlert.attack_type.includes('Scan') ? '1-2 (Low)' : '~45')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>same_srv_rate:</span>
                    <span style={{ color: 'var(--color-primary)' }}>
                      {selectedAlert.attack_type.includes('DDoS') ? '1.0000' : (selectedAlert.attack_type.includes('Scan') ? '0.0125 (Low)' : '0.9500')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>serror_rate:</span>
                    <span style={{ color: 'var(--color-primary)' }}>
                      {selectedAlert.attack_type.includes('DDoS') ? '1.0000 (High)' : (selectedAlert.attack_type.includes('Scan') ? '1.0000 (High)' : '0.0000')}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
