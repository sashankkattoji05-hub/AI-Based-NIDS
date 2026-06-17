# Sentinel NIDS: AI-Based Network Intrusion Detection System

Sentinel NIDS is a full-stack, real-time Network Intrusion Detection System built with a **FastAPI backend**, a **Scikit-Learn machine learning pipeline (Random Forest Classifier)**, and a **React/Vite dashboard** designed with a premium, glassmorphic dark theme.

The system features real-time network packet collection, automated 10-second sliding-window feature engineering, AI classification, WebSocket telemetry streaming, and database logging of detected security incidents.

---

## System Architecture

Sentinel NIDS is divided into three primary layers:
1. **Network Layer (Telemetry & Ingestion):** Captures live packets using Scapy. It includes an **Attack Simulation Injector** that mocks packet streams (SYN Floods, Port Scans, SSH Brute Forcing) for demo environments.
2. **AI Layer (Feature Extraction & Machine Learning):** Computes network statistics (packet rate, serror rate, port frequency) over a 10s sliding window. An offline/online Random Forest Classifier evaluates vectors to flag anomalies.
3. **Control Cockpit (REST & WebSockets):** Serves real-time charts, metrics, and incident databases via FastAPI REST and pushes packet flows to React via WebSockets.

---

## Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Npcap** (Optional: Only required for live packet capture on Windows. Download from [npcap.com](https://npcap.org/) and select "Install Npcap in WinPcap API-compatible Mode").

---

### Installation

#### 1. Backend Setup
Navigate to the root directory and install Python dependencies:
```bash
# Install dependencies
pip install -r backend/requirements.txt

# (Optional) Install pytest to run unit tests
pip install pytest
```

#### 2. Frontend Setup
Navigate to the `frontend` folder and install Node packages:
```bash
cd frontend
npm install
```

---

### Running the Application

Sentinel NIDS runs as two concurrent services: the FastAPI API engine (port 8000) and the Vite frontend proxy server (port 3000).

#### Step 1: Start the Backend API
Run the backend server from the project root directory:
```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```
*Note: On startup, the backend automatically generates a synthetic traffic dataset, trains the Random Forest classifier, and creates the SQLite database (`nids.db`).*

#### Step 2: Start the Frontend Cockpit
In a separate terminal, start the Vite development server:
```bash
cd frontend
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

---

### Testing & Verification

We have written an integration test suite targeting all API and ML endpoints. Run it from the project root:
```bash
python -m backend.test_main
```

---

## Features Walkthrough

### 📊 Real-Time Dashboard
- **Security Warning Banner:** Displays glowing red warnings immediately upon critical threat detection.
- **KPI Stats cards:** Tracks total packets, clean traffic rate, active alerts, and network speed.
- **Telemetry Charts:** Plots real-time traffic (packets/sec) against anomaly rates, and maps protocol distributions (TCP vs. UDP vs. ICMP).
- **Console Tickers:** Streams individual packet logs and live alerts side-by-side using WebSockets.

### 🔍 Security Incident Log
- paginated logs database showing timestamp, protocol, source IP/port, target IP/port, threat class, severity, and AI confidence score.
- Search and filter records by IP address, severity level, protocol type, or attack pattern.
- Detailed modal displaying raw payload snippets and the 10-second sliding window features parsed by the ML model.
- Client-side export option to download database queries as CSV sheets.

### 🧠 AI Model Hub
- Displays model metrics (Accuracy, Precision, Recall, F1).
- Visualizes feature importances (which features the Random Forest weights most, e.g. `serror_rate`).
- Retrain button: spawns background training tasks and streams compile logs to a mock terminal.

### ⚙️ Engine Configurations
- **Mode Toggles:** Switch between **Simulation Mode** (zero driver dependencies) and **Live Sniffing Mode**.
- **Interface Selector:** Attaches packet capture to selected hardware (Wi-Fi, Ethernet, Loopback).
- **Threshold Slider:** Adjusts detection criteria (filters out predictions below set confidence bounds).
- **Attack Injector:** Toggles mock attacks on command (SYN Flood, Port Scan, SSH Infiltration).
