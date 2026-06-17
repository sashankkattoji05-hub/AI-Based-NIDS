import time
import threading
from collections import deque
from scapy.all import sniff, IP, TCP, UDP, ICMP, get_if_list
from backend.database import SessionLocal, Alert, Metric
from backend.model import predict_packet, load_model
from backend.mock_traffic import mock_generator

class NetworkSniffer:
    def __init__(self):
        self.running = False
        self.mode = "simulation"  # "live" or "simulation"
        self.interface = None     # Defaults to scapy default
        self.confidence_threshold = 0.50
        
        self.thread = None
        self.metrics_thread = None
        
        # 10s sliding window for feature extraction
        self.window = deque()
        self.window_lock = threading.Lock()
        
        # Client broadcast callback
        self.broadcast_callback = None
        
        # Performance/Stats tracking for the current second
        self.packet_count = 0
        self.byte_count = 0
        self.anomaly_count = 0
        self.stats_lock = threading.Lock()

    def set_broadcast_callback(self, callback):
        self.broadcast_callback = callback

    def get_interfaces(self):
        try:
            return get_if_list()
        except Exception as e:
            print(f"Error getting interfaces: {e}")
            return ["Loopback", "Ethernet", "Wi-Fi"]

    def start(self, mode="simulation", interface=None, confidence_threshold=0.5):
        if self.running:
            return False
            
        self.mode = mode
        self.interface = interface
        self.confidence_threshold = confidence_threshold
        self.running = True
        
        # Load model beforehand
        load_model()
        
        # Start packet capture thread
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()
        
        # Start metrics aggregator thread (runs once per second)
        self.metrics_thread = threading.Thread(target=self._metrics_loop, daemon=True)
        self.metrics_thread.start()
        
        print(f"NIDS Sniffer started in {self.mode} mode.")
        return True

    def stop(self):
        if not self.running:
            return False
            
        self.running = False
        if self.mode == "simulation":
            mock_generator.stop()
            
        if self.thread:
            self.thread.join(timeout=2.0)
        if self.metrics_thread:
            self.metrics_thread.join(timeout=2.0)
            
        print("NIDS Sniffer stopped.")
        return True

    def _capture_loop(self):
        if self.mode == "simulation":
            mock_generator.start()
            while self.running:
                if not mock_generator.queue.empty():
                    packet_info = mock_generator.queue.get()
                    self._process_packet(packet_info)
                else:
                    time.sleep(0.01)
        else:
            # Live Scapy sniffing
            try:
                def prn_callback(pkt):
                    if not self.running:
                        # Stop sniffing when self.running is False
                        return True
                    parsed = self._parse_scapy_packet(pkt)
                    if parsed:
                        self._process_packet(parsed)

                # sniff runs in a blocking loop, but terminates when prn returns True or we timeout
                sniff(iface=self.interface, prn=prn_callback, store=0, stop_filter=lambda x: not self.running)
            except Exception as e:
                print(f"Scapy Sniffer failed (requires admin/Npcap on Windows): {e}")
                self.running = False
                if self.broadcast_callback:
                    self.broadcast_callback({
                        "type": "error",
                        "message": f"Live sniffing failed: {str(e)}. Switching to simulation mode recommended."
                    })

    def _parse_scapy_packet(self, pkt):
        if not pkt.haslayer(IP):
            return None
        
        ip_layer = pkt[IP]
        src_ip = ip_layer.src
        dst_ip = ip_layer.dst
        
        protocol = "Other"
        protocol_type = 3  # 0=TCP, 1=UDP, 2=ICMP, 3=Other
        src_port = 0
        dst_port = 0
        tcp_flags_syn = 0
        tcp_flags_ack = 0
        tcp_flags_fin = 0
        tcp_flags_rst = 0
        tcp_flags_psh = 0
        
        if pkt.haslayer(TCP):
            protocol = "TCP"
            protocol_type = 0
            tcp_layer = pkt[TCP]
            src_port = int(tcp_layer.sport)
            dst_port = int(tcp_layer.dport)
            
            # Scapy flag flags parser
            flags = str(tcp_layer.flags)
            if 'S' in flags: tcp_flags_syn = 1
            if 'A' in flags: tcp_flags_ack = 1
            if 'F' in flags: tcp_flags_fin = 1
            if 'R' in flags: tcp_flags_rst = 1
            if 'P' in flags: tcp_flags_psh = 1
            
        elif pkt.haslayer(UDP):
            protocol = "UDP"
            protocol_type = 1
            udp_layer = pkt[UDP]
            src_port = int(udp_layer.sport)
            dst_port = int(udp_layer.dport)
            
        elif pkt.haslayer(ICMP):
            protocol = "ICMP"
            protocol_type = 2
            
        packet_len = len(pkt)
        
        # Generate summary of packet contents
        payload_summary = f"{protocol} Packet"
        try:
            if pkt.haslayer(TCP) and pkt[TCP].payload:
                payload_summary = str(pkt[TCP].payload)[:60]
            elif pkt.haslayer(UDP) and pkt[UDP].payload:
                payload_summary = str(pkt[UDP].payload)[:60]
        except Exception:
            pass
            
        return {
            "timestamp": time.time(),
            "packet_len": packet_len,
            "protocol_type": protocol_type,
            "protocol_name": protocol,
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "src_port": src_port,
            "dst_port": dst_port,
            "tcp_flags_syn": tcp_flags_syn,
            "tcp_flags_ack": tcp_flags_ack,
            "tcp_flags_fin": tcp_flags_fin,
            "tcp_flags_rst": tcp_flags_rst,
            "tcp_flags_psh": tcp_flags_psh,
            "payload_summary": payload_summary
        }

    def _process_packet(self, packet_info):
        # Update metrics tracking
        with self.stats_lock:
            self.packet_count += 1
            self.byte_count += packet_info["packet_len"]
            
        # Get AI prediction
        with self.window_lock:
            prediction = predict_packet(packet_info, self.window)
            # Add to sliding window
            self.window.append(packet_info)
            
        is_anomaly = prediction["class_id"] > 0 and prediction["confidence"] >= self.confidence_threshold
        
        alert_data = None
        if is_anomaly:
            with self.stats_lock:
                self.anomaly_count += 1
                
            # Log alert to database
            db = SessionLocal()
            try:
                alert = Alert(
                    src_ip=packet_info["src_ip"],
                    dst_ip=packet_info["dst_ip"],
                    src_port=packet_info["src_port"],
                    dst_port=packet_info["dst_port"],
                    protocol=packet_info["protocol_name"],
                    attack_type=prediction["attack_type"],
                    severity=prediction["severity"],
                    confidence=prediction["confidence"],
                    packet_length=packet_info["packet_len"],
                    payload_summary=packet_info["payload_summary"]
                )
                db.add(alert)
                db.commit()
                db.refresh(alert)
                
                alert_data = {
                    "id": alert.id,
                    "timestamp": alert.timestamp.isoformat(),
                    "src_ip": alert.src_ip,
                    "dst_ip": alert.dst_ip,
                    "src_port": alert.src_port,
                    "dst_port": alert.dst_port,
                    "protocol": alert.protocol,
                    "attack_type": alert.attack_type,
                    "severity": alert.severity,
                    "confidence": alert.confidence,
                    "packet_length": alert.packet_length,
                    "payload_summary": alert.payload_summary
                }
            except Exception as e:
                print(f"Error saving alert to DB: {e}")
            finally:
                db.close()

        # Send real-time packet information to WebSocket clients
        if self.broadcast_callback:
            packet_telemetry = {
                "type": "packet",
                "timestamp": packet_info["timestamp"],
                "src_ip": packet_info["src_ip"],
                "dst_ip": packet_info["dst_ip"],
                "src_port": packet_info["src_port"],
                "dst_port": packet_info["dst_port"],
                "protocol": packet_info["protocol_name"],
                "packet_length": packet_info["packet_len"],
                "is_anomaly": is_anomaly,
                "attack_type": prediction["attack_type"] if is_anomaly else "Normal",
                "confidence": prediction["confidence"],
                "features": prediction["features"]
            }
            
            payload = {
                "packet": packet_telemetry
            }
            if alert_data:
                payload["alert"] = alert_data
                
            self.broadcast_callback(payload)

    def _metrics_loop(self):
        db = SessionLocal()
        while self.running:
            time.sleep(1.0)
            
            # Extract current second metrics and reset counters
            with self.stats_lock:
                current_packets = self.packet_count
                current_bytes = self.byte_count
                current_anomalies = self.anomaly_count
                
                self.packet_count = 0
                self.byte_count = 0
                self.anomaly_count = 0
                
            # Log metrics to DB
            try:
                metric = Metric(
                    packet_count=current_packets,
                    byte_count=current_bytes,
                    anomaly_count=current_anomalies
                )
                db.add(metric)
                db.commit()
                
                # Send stats update via WebSockets
                if self.broadcast_callback:
                    self.broadcast_callback({
                        "type": "metrics",
                        "metrics": {
                            "timestamp": metric.timestamp.isoformat(),
                            "packet_count": current_packets,
                            "byte_count": current_bytes,
                            "anomaly_count": current_anomalies
                        }
                    })
            except Exception as e:
                print(f"Error saving metrics to DB: {e}")
                
        db.close()

# Singleton sniffer instance
sniffer = NetworkSniffer()
