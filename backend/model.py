import os
import pickle
import numpy as np
import time
from collections import deque

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "nids_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")

# Mapping of labels to names and severities
ATTACK_MAPPING = {
    0: {"name": "Normal", "severity": "Low"},
    1: {"name": "SYN Flood (DDoS)", "severity": "High"},
    2: {"name": "Port Scan", "severity": "Medium"},
    3: {"name": "Infiltration/Brute Force", "severity": "High"}
}

# Global loaded model and scaler
model = None
scaler = None

def load_model():
    global model, scaler
    if model is not None and scaler is not None:
        return model, scaler

    # If model files do not exist, train one first
    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        print("Model or scaler not found. Running training script...")
        from backend.train_model import train_and_evaluate
        train_and_evaluate(model_dir=MODEL_DIR)

    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    with open(SCALER_PATH, "rb") as f:
        scaler = pickle.load(f)

    return model, scaler

def extract_features(packet_info, window):
    """
    Extracts numerical features from packet_info using sliding window.
    packet_info structure:
    {
        'timestamp': float,
        'packet_len': int,
        'protocol_type': int (0=TCP, 1=UDP, 2=ICMP, 3=Other),
        'src_ip': str,
        'dst_ip': str,
        'dst_port': int,
        'tcp_flags_syn': int,
        'tcp_flags_ack': int,
        'tcp_flags_fin': int,
        'tcp_flags_rst': int,
        'tcp_flags_psh': int
    }
    window: deque of packet_info records representing the last 10 seconds.
    """
    now = packet_info['timestamp']
    
    # 1. Prune older packets from the window (keep only last 10 seconds)
    while window and (now - window[0]['timestamp']) > 10.0:
        window.popleft()

    # Add the current packet to the window for calculation
    # We will temporarily append it, compute features, and let the caller decide
    # when to keep it (typically it is appended to the window right after feature extraction)
    window_list = list(window) + [packet_info]
    
    dst_ip = packet_info['dst_ip']
    dst_port = packet_info['dst_port']
    protocol_type = packet_info['protocol_type']

    # 2. Count packets to same destination IP in last 10s
    dst_host_count = sum(1 for p in window_list if p['dst_ip'] == dst_ip)

    # 3. Count packets to same destination port (service) in last 10s
    srv_count = sum(1 for p in window_list if p['dst_port'] == dst_port)

    # 4. Same Service Rate: Fraction of packets to the same host and service in the last 10s
    # among all packets to the same host
    same_srv_count = sum(1 for p in window_list if p['dst_ip'] == dst_ip and p['dst_port'] == dst_port)
    same_srv_rate = same_srv_count / dst_host_count if dst_host_count > 0 else 1.0

    # 5. SYN Error Rate: Fraction of TCP packets with SYN set (and ACK unset) among all packets to the same host in last 10s
    syn_errors = sum(1 for p in window_list if p['dst_ip'] == dst_ip and p['protocol_type'] == 0 and p['tcp_flags_syn'] == 1 and p['tcp_flags_ack'] == 0)
    serror_rate = syn_errors / dst_host_count if dst_host_count > 0 else 0.0

    # Assemble feature vector
    features = [
        packet_info['packet_len'],
        protocol_type,
        packet_info['tcp_flags_syn'],
        packet_info['tcp_flags_ack'],
        packet_info['tcp_flags_fin'],
        packet_info['tcp_flags_rst'],
        packet_info['tcp_flags_psh'],
        dst_host_count,
        srv_count,
        same_srv_rate,
        serror_rate
    ]
    
    return features

def predict_packet(packet_info, window):
    """
    Extracts features and predicts if packet_info is normal or anomalous.
    """
    clf, scl = load_model()
    
    features = extract_features(packet_info, window)
    
    # Reshape for sklearn prediction
    features_arr = np.array(features).reshape(1, -1)
    features_scaled = scl.transform(features_arr)
    
    # Run prediction
    pred_class = int(clf.predict(features_scaled)[0])
    probabilities = clf.predict_proba(features_scaled)[0]
    confidence = float(probabilities[pred_class])
    
    result = ATTACK_MAPPING.get(pred_class, {"name": "Unknown", "severity": "Low"})
    
    feature_dict = {
        "packet_len": features[0],
        "protocol_type": features[1],
        "tcp_flags_syn": features[2],
        "tcp_flags_ack": features[3],
        "tcp_flags_fin": features[4],
        "tcp_flags_rst": features[5],
        "tcp_flags_psh": features[6],
        "dst_host_count": features[7],
        "srv_count": features[8],
        "same_srv_rate": round(features[9], 4),
        "serror_rate": round(features[10], 4)
    }
    
    return {
        "class_id": pred_class,
        "attack_type": result["name"],
        "severity": result["severity"],
        "confidence": confidence,
        "features": feature_dict
    }
