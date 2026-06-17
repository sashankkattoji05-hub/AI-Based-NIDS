import os
import json
import asyncio
from typing import Optional, List
from pydantic import BaseModel
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, Query, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import init_db, get_db, Alert, Metric
from backend.sniffer import sniffer
from backend.mock_traffic import mock_generator
from backend.train_model import train_and_evaluate

app = FastAPI(title="AI-Based NIDS API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup and event loop setup
loop = None

@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()
    
    # Initialize SQLite tables
    init_db()
    
    # Configure sniffer to broadcast via our websocket manager
    def sniffer_callback(data):
        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(data), loop)
            
    sniffer.set_broadcast_callback(sniffer_callback)
    
    # Start sniffer in simulation mode by default on startup
    sniffer.start(mode="simulation", confidence_threshold=0.5)

@app.on_event("shutdown")
async def shutdown_event():
    sniffer.stop()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"Client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws/traffic")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; clients don't need to send messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Pydantic Schemas
class StartSnifferRequest(BaseModel):
    mode: str = "simulation"  # "live" or "simulation"
    interface: Optional[str] = None
    confidence_threshold: float = 0.50

class AttackRequest(BaseModel):
    attack_type: str  # "None", "DDoS", "PortScan", "BruteForce"

# REST Endpoints
@app.get("/api/status")
def get_status():
    return {
        "is_running": sniffer.running,
        "mode": sniffer.mode,
        "interface": sniffer.interface,
        "confidence_threshold": sniffer.confidence_threshold,
        "interfaces": sniffer.get_interfaces()
    }

@app.post("/api/control/start")
def start_sniffer(req: StartSnifferRequest):
    if req.mode not in ["live", "simulation"]:
        raise HTTPException(status_code=400, detail="Invalid sniffer mode. Use 'live' or 'simulation'.")
        
    success = sniffer.start(
        mode=req.mode,
        interface=req.interface,
        confidence_threshold=req.confidence_threshold
    )
    if not success:
        return {"status": "error", "message": "Sniffer is already running."}
        
    return {
        "status": "success",
        "message": f"Sniffer started in {req.mode} mode.",
        "config": {
            "mode": sniffer.mode,
            "interface": sniffer.interface,
            "confidence_threshold": sniffer.confidence_threshold
        }
    }

@app.post("/api/control/stop")
def stop_sniffer():
    success = sniffer.stop()
    if not success:
        return {"status": "error", "message": "Sniffer is not running."}
    return {"status": "success", "message": "Sniffer stopped."}

@app.post("/api/control/attack")
def trigger_attack(req: AttackRequest):
    if req.attack_type not in ["None", "DDoS", "PortScan", "BruteForce"]:
        raise HTTPException(status_code=400, detail="Invalid attack type. Choose from: None, DDoS, PortScan, BruteForce.")
        
    if sniffer.mode != "simulation" and req.attack_type != "None":
        raise HTTPException(status_code=400, detail="Attacks can only be simulated when NIDS is in Simulation Mode.")
        
    mock_generator.set_attack(req.attack_type)
    return {"status": "success", "message": f"Simulated attack state set to: {req.attack_type}"}

@app.get("/api/alerts")
def get_alerts(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    severity: Optional[str] = None,
    protocol: Optional[str] = None,
    attack_type: Optional[str] = None
):
    query = db.query(Alert)
    
    if severity:
        query = query.filter(Alert.severity == severity)
    if protocol:
        query = query.filter(Alert.protocol == protocol)
    if attack_type:
        query = query.filter(Alert.attack_type == attack_type)
        
    total = query.count()
    alerts = query.order_by(desc(Alert.timestamp)).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "alerts": [
            {
                "id": a.id,
                "timestamp": a.timestamp.isoformat(),
                "src_ip": a.src_ip,
                "dst_ip": a.dst_ip,
                "src_port": a.src_port,
                "dst_port": a.dst_port,
                "protocol": a.protocol,
                "attack_type": a.attack_type,
                "severity": a.severity,
                "confidence": round(a.confidence, 4),
                "packet_length": a.packet_length,
                "payload_summary": a.payload_summary
            } for a in alerts
        ]
    }

@app.get("/api/metrics")
def get_metrics(db: Session = Depends(get_db), limit: int = Query(60, ge=5, le=300)):
    # Fetch recent timeline metrics for the dashboard charts
    metrics = db.query(Metric).order_by(desc(Metric.timestamp)).limit(limit).all()
    metrics.reverse()  # Return in chronological order
    
    return [
        {
            "timestamp": m.timestamp.isoformat(),
            "packet_count": m.packet_count,
            "byte_count": m.byte_count,
            "anomaly_count": m.anomaly_count
        } for m in metrics
    ]

@app.get("/api/model/info")
def get_model_info():
    model_dir = os.path.dirname(os.path.abspath(__file__))
    stats_path = os.path.join(model_dir, "model_stats.json")
    
    if not os.path.exists(stats_path):
        # Trigger training to build the files if they are missing
        train_and_evaluate(model_dir=model_dir)
        
    try:
        with open(stats_path, "r") as f:
            stats = json.load(f)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read model statistics: {e}")

def run_retrain_task():
    model_dir = os.path.dirname(os.path.abspath(__file__))
    train_and_evaluate(model_dir=model_dir)
    print("Background retraining completed.")

@app.post("/api/model/train")
def retrain_model(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_retrain_task)
    return {"status": "success", "message": "Model retraining initiated in the background."}
