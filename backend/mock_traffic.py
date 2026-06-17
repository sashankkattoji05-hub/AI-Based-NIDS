import time
import random
import threading
from queue import Queue

# Configuration
NORMAL_IP_POOL = [f"192.168.1.{i}" for i in range(10, 50)]
SERVER_IP = "192.168.1.100"
GATEWAY_IP = "192.168.1.1"
PUBLIC_IPS = ["8.8.8.8", "1.1.1.1", "142.250.190.46", "31.13.72.36", "13.224.22.10"]

NORMAL_PORTS = [80, 443, 53, 22, 3306, 8080]

class MockTrafficGenerator:
    def __init__(self):
        self.queue = Queue()
        self.running = False
        self.thread = None
        self.attack_type = "None"  # None, DDoS, PortScan, BruteForce
        self.lock = threading.Lock()
        
    def set_attack(self, attack_type):
        with self.lock:
            self.attack_type = attack_type
            
    def get_attack(self):
        with self.lock:
            return self.attack_type

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._run, daemon=True)
            self.thread.start()
            print("Mock Traffic Generator started.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
            print("Mock Traffic Generator stopped.")

    def _run(self):
        while self.running:
            attack = self.get_attack()
            
            if attack == "DDoS":
                # High volume SYN flood
                self._generate_ddos_burst()
                time.sleep(0.05)  # Fast generation
            elif attack == "PortScan":
                # High speed port scanning
                self._generate_port_scan_burst()
                time.sleep(0.1)
            elif attack == "BruteForce":
                # Large data transfers
                self._generate_brute_force_packet()
                time.sleep(0.15)
            else:
                # Normal traffic
                self._generate_normal_packet()
                # Normal packet interval is slightly random
                time.sleep(random.uniform(0.1, 0.4))

    def _generate_normal_packet(self):
        src_ip = random.choice(NORMAL_IP_POOL)
        dst_ip = random.choice(PUBLIC_IPS + [SERVER_IP, GATEWAY_IP])
        
        # Avoid same src and dst
        if src_ip == dst_ip:
            dst_ip = SERVER_IP
            
        protocol = random.choice(["TCP", "UDP", "ICMP"])
        
        src_port = random.randint(49152, 65535)
        dst_port = random.choice(NORMAL_PORTS)
        
        tcp_flags_syn = 0
        tcp_flags_ack = 0
        tcp_flags_fin = 0
        tcp_flags_rst = 0
        tcp_flags_psh = 0
        
        if protocol == "TCP":
            flag_choice = random.choice(["ACK", "PSH-ACK", "SYN-ACK", "FIN-ACK"])
            if flag_choice == "ACK":
                tcp_flags_ack = 1
            elif flag_choice == "PSH-ACK":
                tcp_flags_ack = 1
                tcp_flags_psh = 1
            elif flag_choice == "SYN-ACK":
                tcp_flags_syn = 1
                tcp_flags_ack = 1
            elif flag_choice == "FIN-ACK":
                tcp_flags_fin = 1
                tcp_flags_ack = 1
            packet_len = int(random.normalvariate(500, 300))
        elif protocol == "UDP":
            dst_port = 53  # Standard DNS port
            packet_len = random.randint(60, 200)
        else:  # ICMP
            dst_port = 0
            packet_len = random.randint(32, 64)
            
        packet_len = max(40, min(1500, packet_len))
        
        packet_dict = {
            "timestamp": time.time(),
            "packet_len": packet_len,
            "protocol_type": 0 if protocol == "TCP" else (1 if protocol == "UDP" else 2),
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
            "payload_summary": f"Normal {protocol} traffic"
        }
        self.queue.put(packet_dict)

    def _generate_ddos_burst(self):
        # DDoS SYN flood targets SERVER_IP:80 from spoofed external IPs
        src_ip = f"10.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
        dst_ip = SERVER_IP
        dst_port = 80
        src_port = random.randint(1024, 65535)
        
        packet_dict = {
            "timestamp": time.time(),
            "packet_len": 60,  # Small SYN packet
            "protocol_type": 0,  # TCP
            "protocol_name": "TCP",
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "src_port": src_port,
            "dst_port": dst_port,
            "tcp_flags_syn": 1,
            "tcp_flags_ack": 0,
            "tcp_flags_fin": 0,
            "tcp_flags_rst": 0,
            "tcp_flags_psh": 0,
            "payload_summary": "DDoS Attack: SYN Flood"
        }
        self.queue.put(packet_dict)

    def _generate_port_scan_burst(self):
        # Attacker sweeps ports on SERVER_IP
        src_ip = "192.168.1.250"  # Dedicated malicious host in local subnet
        dst_ip = SERVER_IP
        
        # We simulate scanning consecutive ports
        if not hasattr(self, '_scan_port'):
            self._scan_port = 1
            
        dst_port = self._scan_port
        self._scan_port = (self._scan_port % 1024) + 1  # Scan ports 1 to 1024
        
        src_port = random.randint(40000, 50000)
        
        # Standard SYN scan
        packet_dict = {
            "timestamp": time.time(),
            "packet_len": 44,
            "protocol_type": 0,  # TCP
            "protocol_name": "TCP",
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "src_port": src_port,
            "dst_port": dst_port,
            "tcp_flags_syn": 1,
            "tcp_flags_ack": 0,
            "tcp_flags_fin": 0,
            "tcp_flags_rst": 0,
            "tcp_flags_psh": 0,
            "payload_summary": f"Port Scan: probing port {dst_port}"
        }
        self.queue.put(packet_dict)

    def _generate_brute_force_packet(self):
        # Attacker tries multiple login combinations with heavy payloads
        src_ip = "192.168.1.199"
        dst_ip = SERVER_IP
        dst_port = 22  # SSH Port
        src_port = random.randint(55000, 56000)
        
        # Large encrypted payload containing SSH authentication attempts
        packet_dict = {
            "timestamp": time.time(),
            "packet_len": random.randint(1000, 1400),
            "protocol_type": 0,  # TCP
            "protocol_name": "TCP",
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "src_port": src_port,
            "dst_port": dst_port,
            "tcp_flags_syn": 0,
            "tcp_flags_ack": 1,
            "tcp_flags_fin": 0,
            "tcp_flags_rst": 0,
            "tcp_flags_psh": 1,
            "payload_summary": "SSH Infiltration Attempt (Brute Force)"
        }
        self.queue.put(packet_dict)

# Singleton traffic generator
mock_generator = MockTrafficGenerator()
