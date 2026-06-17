import os
import json
import pickle
import datetime
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support

# Define feature names
FEATURE_NAMES = [
    "packet_len",
    "protocol_type",       # 0=TCP, 1=UDP, 2=ICMP, 3=Other
    "tcp_flags_syn",
    "tcp_flags_ack",
    "tcp_flags_fin",
    "tcp_flags_rst",
    "tcp_flags_psh",
    "dst_host_count",      # Count of packets to same dest IP in last 10s
    "srv_count",           # Count of packets to same dest port in last 10s
    "same_srv_rate",       # Fraction of packets to same service in last 10s
    "serror_rate"          # Fraction of TCP packets with SYN flag set only
]

# Attack Labels
# 0 = Normal
# 1 = SYN Flood (DDoS)
# 2 = Port Scan
# 3 = Infiltration / Brute Force

def generate_synthetic_dataset(num_samples=5000):
    np.random.seed(42)
    data = []
    labels = []

    # 1. Normal Traffic (~50% of dataset)
    num_normal = int(num_samples * 0.5)
    for _ in range(num_normal):
        packet_len = np.random.normal(500, 300)  # Average web packet length
        packet_len = max(40, min(1500, packet_len))
        
        protocol_type = np.random.choice([0, 1, 2], p=[0.7, 0.25, 0.05])
        
        tcp_flags_syn = 0
        tcp_flags_ack = 0
        tcp_flags_fin = 0
        tcp_flags_rst = 0
        tcp_flags_psh = 0
        
        if protocol_type == 0:  # TCP
            # Most normal packets are ACK or PSH-ACK, occasionally SYN/FIN
            flag_choice = np.random.choice([1, 2, 3, 4], p=[0.85, 0.10, 0.03, 0.02])
            if flag_choice == 1:
                tcp_flags_ack = 1
            elif flag_choice == 2:
                tcp_flags_ack = 1
                tcp_flags_psh = 1
            elif flag_choice == 3:
                tcp_flags_syn = 1
                tcp_flags_ack = 1
            elif flag_choice == 4:
                tcp_flags_fin = 1
                tcp_flags_ack = 1
        
        # Low traffic densities for normal traffic
        dst_host_count = np.random.randint(1, 10)
        srv_count = np.random.randint(1, 5)
        same_srv_rate = np.random.uniform(0.7, 1.0)
        serror_rate = np.random.uniform(0.0, 0.1)
        
        data.append([
            packet_len, protocol_type, tcp_flags_syn, tcp_flags_ack,
            tcp_flags_fin, tcp_flags_rst, tcp_flags_psh,
            dst_host_count, srv_count, same_srv_rate, serror_rate
        ])
        labels.append(0)

    # 2. SYN Flood / DDoS (~20%)
    num_ddos = int(num_samples * 0.2)
    for _ in range(num_ddos):
        packet_len = np.random.normal(60, 5)  # Small empty SYN packets
        packet_len = max(40, min(80, packet_len))
        
        protocol_type = 0  # Must be TCP
        tcp_flags_syn = 1
        tcp_flags_ack = 0
        tcp_flags_fin = 0
        tcp_flags_rst = 0
        tcp_flags_psh = 0
        
        # High traffic density to a single host/service
        dst_host_count = np.random.randint(80, 150)
        srv_count = np.random.randint(80, 150)
        same_srv_rate = np.random.uniform(0.9, 1.0)
        serror_rate = np.random.uniform(0.9, 1.0)  # High serror rate
        
        data.append([
            packet_len, protocol_type, tcp_flags_syn, tcp_flags_ack,
            tcp_flags_fin, tcp_flags_rst, tcp_flags_psh,
            dst_host_count, srv_count, same_srv_rate, serror_rate
        ])
        labels.append(1)

    # 3. Port Scan (~15%)
    num_scan = int(num_samples * 0.15)
    for _ in range(num_scan):
        packet_len = np.random.choice([40, 44, 60])  # TCP SYN/Connect flags only
        
        protocol_type = np.random.choice([0, 1], p=[0.9, 0.1])  # TCP/UDP scans
        
        tcp_flags_syn = 0
        tcp_flags_ack = 0
        tcp_flags_fin = 0
        tcp_flags_rst = 0
        tcp_flags_psh = 0
        
        if protocol_type == 0:
            tcp_flags_syn = 1  # Standard SYN scan
            
        # Target same destination host but *different* services (low srv_count)
        dst_host_count = np.random.randint(50, 120)
        srv_count = np.random.randint(1, 3)  # Scanned ports are distinct
        same_srv_rate = np.random.uniform(0.0, 0.1)  # Distinct ports
        serror_rate = np.random.uniform(0.8, 1.0) if protocol_type == 0 else 0.0
        
        data.append([
            packet_len, protocol_type, tcp_flags_syn, tcp_flags_ack,
            tcp_flags_fin, tcp_flags_rst, tcp_flags_psh,
            dst_host_count, srv_count, same_srv_rate, serror_rate
        ])
        labels.append(2)

    # 4. Infiltration / Brute Force / Exfiltration (~15%)
    num_brute = int(num_samples * 0.15)
    for _ in range(num_brute):
        packet_len = np.random.normal(1200, 200)  # Large payload data transfers
        packet_len = max(500, min(1500, packet_len))
        
        protocol_type = 0  # TCP
        tcp_flags_syn = 0
        tcp_flags_ack = 1
        tcp_flags_fin = 0
        tcp_flags_rst = 0
        tcp_flags_psh = np.random.choice([0, 1], p=[0.3, 0.7])  # Push flag to force write
        
        # Moderately high traffic to same host and service (repeated login/download attempts)
        dst_host_count = np.random.randint(40, 80)
        srv_count = np.random.randint(40, 80)
        same_srv_rate = np.random.uniform(0.85, 1.0)
        serror_rate = np.random.uniform(0.0, 0.05)
        
        data.append([
            packet_len, protocol_type, tcp_flags_syn, tcp_flags_ack,
            tcp_flags_fin, tcp_flags_rst, tcp_flags_psh,
            dst_host_count, srv_count, same_srv_rate, serror_rate
        ])
        labels.append(3)

    return np.array(data), np.array(labels)

def train_and_evaluate(model_dir="./"):
    print("Generating synthetic network traffic dataset...")
    X, y = generate_synthetic_dataset(num_samples=6000)
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print("Training Random Forest Classifier model...")
    clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    clf.fit(X_train_scaled, y_train)
    
    # Predictions & metrics
    y_pred = clf.predict(X_test_scaled)
    acc = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')
    
    print(f"Model Training Completed! Accuracy: {acc:.4f}, F1-Score: {f1:.4f}")
    
    # Save model and scaler
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "nids_model.pkl")
    scaler_path = os.path.join(model_dir, "scaler.pkl")
    
    with open(model_path, "wb") as f:
        pickle.dump(clf, f)
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
        
    print(f"Model saved to {model_path}")
    print(f"Scaler saved to {scaler_path}")
    
    # Save training metrics to json
    report = classification_report(y_test, y_pred, output_dict=True)
    
    # Extract feature importances
    importances = clf.feature_importances_
    feature_importance_dict = {
        FEATURE_NAMES[i]: float(importances[i]) for i in range(len(FEATURE_NAMES))
    }
    # Sort feature importances
    feature_importance_dict = dict(sorted(feature_importance_dict.items(), key=lambda item: item[1], reverse=True))
    
    metrics = {
        "accuracy": float(acc),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "feature_importances": feature_importance_dict,
        "classification_report": report,
        "classes": ["Normal", "SYN Flood (DDoS)", "Port Scan", "Infiltration/Brute Force"],
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    stats_path = os.path.join(model_dir, "model_stats.json")
    with open(stats_path, "w") as f:
        json.dump(metrics, f, indent=4)
        
    print(f"Model statistics saved to {stats_path}")
    return metrics

if __name__ == "__main__":
    train_and_evaluate(model_dir="./")
