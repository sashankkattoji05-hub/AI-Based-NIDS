import React, { useEffect, useState } from 'react';
import { ShieldAlert, Shield, Activity, HardDrive, Network, AlertOctagon } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { fetchMetrics } from '../utils/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard({ livePackets, recentAlerts, liveMetrics, systemStatus }) {
  const [historyMetrics, setHistoryMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await fetchMetrics(45);
        setHistoryMetrics(data);
      } catch (err) {
        console.error("Error loading historical metrics:", err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  // Merge history with incoming live WS metrics
  const displayMetrics = [...historyMetrics, ...liveMetrics].slice(-45);

  // Calculate totals and statistics
  const totalPackets = displayMetrics.reduce((acc, curr) => acc + curr.packet_count, 0);
  const totalBytes = displayMetrics.reduce((acc, curr) => acc + curr.byte_count, 0);
  const totalAnomalies = displayMetrics.reduce((acc, curr) => acc + curr.anomaly_count, 0);
  
  const anomalyPercentage = totalPackets > 0 ? ((totalAnomalies / totalPackets) * 100).toFixed(2) : "0.00";
  const normalPercentage = (100 - parseFloat(anomalyPercentage)).toFixed(2);
  const currentBitrateKbps = displayMetrics.length > 0 
    ? ((displayMetrics[displayMetrics.length - 1].byte_count * 8) / 1024).toFixed(1)
    : "0.0";
    
  // Protocol breakdown from live packets
  const protocolCounts = livePackets.reduce((acc, curr) => {
    acc[curr.protocol] = (acc[curr.protocol] || 0) + 1;
    return acc;
  }, { TCP: 0, UDP: 0, ICMP: 0 });

  // 1. Line Chart Data: Packet rate vs. Anomaly rate
  const lineChartData = {
    labels: displayMetrics.map((_, index) => `${index + 1}s`),
    datasets: [
      {
        label: 'Total Packets/sec',
        data: displayMetrics.map(m => m.packet_count),
        borderColor: '#00f2fe',
        backgroundColor: 'rgba(0, 242, 254, 0.1)',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'Anomalies/sec',
        data: displayMetrics.map(m => m.anomaly_count),
        borderColor: '#ff1744',
        backgroundColor: 'rgba(255, 23, 68, 0.2)',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } },
        position: 'top'
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#64748b', font: { family: 'Outfit', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#64748b', font: { family: 'Outfit', size: 10 } },
        beginAtZero: true
      }
    }
  };

  // 2. Doughnut Chart Data: Protocol Distribution
  const doughnutChartData = {
    labels: ['TCP', 'UDP', 'ICMP', 'Other'],
    datasets: [
      {
        data: [
          protocolCounts.TCP || 1,
          protocolCounts.UDP || 0,
          protocolCounts.ICMP || 0,
          Math.max(0, livePackets.length - (protocolCounts.TCP + protocolCounts.UDP + protocolCounts.ICMP))
        ],
        backgroundColor: [
          '#7f00ff', // TCP - Indigo
          '#00f2fe', // UDP - Cyan
          '#ffb300', // ICMP - Amber
          'rgba(255, 255, 255, 0.15)'
        ],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }
    ]
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } },
        position: 'right'
      }
    },
    cutout: '65%'
  };

  return (
    <div className="dashboard-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. System Warning Banner if an active attack is detected */}
      {recentAlerts.length > 0 && recentAlerts[0].severity === 'High' && (
        <div className="glass-panel glow-danger animate-pulse-danger" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', background: 'rgba(255, 23, 68, 0.08)' }}>
          <AlertOctagon size={28} color="var(--color-danger)" />
          <div>
            <h3 style={{ color: 'var(--color-danger)', fontSize: '1.1rem', fontWeight: 700 }}>
              CRITICAL INTRUSION ALERT: {recentAlerts[0].attack_type.toUpperCase()} DETECTED
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Detected anomaly originating from <strong style={{ color: '#fff' }}>{recentAlerts[0].src_ip}</strong> targeting <strong style={{ color: '#fff' }}>{recentAlerts[0].dst_ip}:{recentAlerts[0].dst_port}</strong> with {Math.round(recentAlerts[0].confidence * 100)}% AI confidence.
            </p>
          </div>
        </div>
      )}

      {/* 2. KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '12px', background: 'rgba(0, 242, 254, 0.08)', color: 'var(--color-primary)' }}>
            <Network size={22} />
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Packets</p>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px' }}>
              {loading ? '...' : totalPackets.toLocaleString()}
            </h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '12px', background: normalPercentage > 85 ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 23, 68, 0.08)', color: normalPercentage > 85 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {normalPercentage > 85 ? <Shield size={22} /> : <ShieldAlert size={22} />}
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Normal Traffic Rate</p>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: normalPercentage > 85 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {loading ? '...' : `${normalPercentage}%`}
            </h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '12px', background: recentAlerts.length > 0 ? 'rgba(255, 23, 68, 0.08)' : 'rgba(0, 230, 118, 0.08)', color: recentAlerts.length > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Anomalies</p>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: recentAlerts.length > 0 ? 'var(--color-danger)' : 'var(--text-main)' }}>
              {loading ? '...' : totalAnomalies}
            </h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '12px', background: 'rgba(127, 0, 255, 0.08)', color: 'var(--color-secondary)' }}>
            <HardDrive size={22} />
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bandwidth Speed</p>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px' }}>
              {loading ? '...' : `${currentBitrateKbps} Kbps`}
            </h2>
          </div>
        </div>
      </div>

      {/* 3. Charts Area */}
      <div className="dashboard-grid" style={{ margin: 0 }}>
        {/* Live Traffic Flow Chart */}
        <div className="glass-panel col-8" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--color-primary)" />
              Real-Time Traffic Analysis
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Monitoring packets rate vs AI anomaly detections</p>
          </div>
          <div style={{ flex: 1, minHeight: '300px', position: 'relative' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Loading charts...</div>
            ) : (
              <Line data={lineChartData} options={lineChartOptions} />
            )}
          </div>
        </div>

        {/* Protocol Breakdown Chart */}
        <div className="glass-panel col-4" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Network size={18} color="var(--color-secondary)" />
              Active Protocol Share
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Ratio of packet protocols currently passing</p>
          </div>
          <div style={{ flex: 1, minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: '100%', height: '220px' }}>
              <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Console Data Tickers */}
      <div className="dashboard-grid" style={{ margin: 0 }}>
        {/* Live Packet Sniffer Inspector */}
        <div className="glass-panel col-6" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '420px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--color-primary)" />
                Telemetry Packet Stream
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Real-time inspector of incoming traffic</p>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              {livePackets.length} captured
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {livePackets.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Waiting for packets... Start the sniffer to view feed.
              </div>
            ) : (
              livePackets.map((pkt, idx) => {
                const isAnomaly = pkt.is_anomaly;
                return (
                  <div 
                    key={idx} 
                    className="glass-panel animate-slide-in" 
                    style={{ 
                      padding: '10px 14px', 
                      background: isAnomaly ? 'rgba(255, 23, 68, 0.04)' : 'rgba(255,255,255,0.01)',
                      borderColor: isAnomaly ? 'rgba(255, 23, 68, 0.25)' : 'var(--border-glass)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-family-mono)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ 
                        color: pkt.protocol === 'TCP' ? 'var(--color-secondary)' : (pkt.protocol === 'UDP' ? 'var(--color-primary)' : 'var(--color-warning)'),
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        background: 'rgba(255,255,255,0.03)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {pkt.protocol}
                      </span>
                      <span style={{ color: 'var(--text-main)' }}>
                        {pkt.src_ip}:{pkt.src_port || '0'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {pkt.dst_ip}:{pkt.dst_port || '0'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {pkt.packet_length}B
                      </span>
                      {isAnomaly ? (
                        <span className="badge badge-danger" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                          {pkt.attack_type}
                        </span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                          Normal
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Alerts Log Ticker */}
        <div className="glass-panel col-6" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '420px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="var(--color-danger)" />
              Security Intrusion Feed
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Real-time warning ticker of flagged traffic</p>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentAlerts.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Shield size={24} style={{ opacity: 0.3, marginRight: '10px' }} />
                No anomalies detected. System secure.
              </div>
            ) : (
              recentAlerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  className="glass-panel animate-slide-in glow-danger" 
                  style={{ 
                    padding: '12px 16px', 
                    background: 'rgba(255, 23, 68, 0.04)',
                    borderColor: 'rgba(255, 23, 68, 0.3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                        {alert.severity}
                      </span>
                      <strong style={{ color: 'var(--color-danger)' }}>{alert.attack_type}</strong>
                    </div>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
                      {alert.src_ip} &rarr; {alert.dst_ip}:{alert.dst_port} ({alert.protocol})
                    </p>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>
                      {Math.round(alert.confidence * 100)}%
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(alert.timestamp || Date.now()).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
