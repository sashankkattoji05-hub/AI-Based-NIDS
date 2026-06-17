import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal, init_db, Alert, Metric

client = TestClient(app)

def init_db_for_test():
    # Setup test database and tables
    init_db()
    
    # Pre-populate some alerts and metrics for querying tests
    db = SessionLocal()
    try:
        # Check if test alerts already exist, if not create
        if db.query(Alert).count() == 0:
            alert = Alert(
                src_ip="192.168.1.50",
                dst_ip="192.168.1.100",
                src_port=44503,
                dst_port=80,
                protocol="TCP",
                attack_type="SYN Flood (DDoS)",
                severity="High",
                confidence=0.92,
                packet_length=60,
                payload_summary="Test DDoS packet"
            )
            db.add(alert)
            
        if db.query(Metric).count() == 0:
            metric = Metric(
                packet_count=150,
                byte_count=12400,
                anomaly_count=1
            )
            db.add(metric)
            
        db.commit()
    except Exception as e:
        print(f"Error setting up test DB data: {e}")
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db_for_test()
    yield

def test_get_status():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "mode" in data
    assert "interfaces" in data

def test_get_model_info():
    response = client.get("/api/model/info")
    assert response.status_code == 200
    data = response.json()
    assert "accuracy" in data
    assert "feature_importances" in data
    assert "classification_report" in data

def test_control_sniffer_start_simulation():
    # Test starting sniffer in simulation mode
    response = client.post("/api/control/start", json={
        "mode": "simulation",
        "confidence_threshold": 0.55
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success" or data["message"] == "Sniffer is already running."

def test_control_sniffer_invalid_mode():
    response = client.post("/api/control/start", json={
        "mode": "invalid_mode_xyz"
    })
    assert response.status_code == 422  # Pydantic validation error or FastAPI exception

def test_trigger_attack_simulation():
    # Start simulation first to test trigger
    client.post("/api/control/start", json={"mode": "simulation"})
    
    response = client.post("/api/control/attack", json={
        "attack_type": "DDoS"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_trigger_invalid_attack():
    response = client.post("/api/control/attack", json={
        "attack_type": "SQL_Injection"
    })
    assert response.status_code == 400

def test_get_alerts():
    response = client.get("/api/alerts?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    assert "total" in data
    assert len(data["alerts"]) > 0

def test_get_metrics():
    response = client.get("/api/metrics?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_control_sniffer_stop():
    response = client.post("/api/control/stop")
    assert response.status_code == 200
    assert "status" in response.json()

if __name__ == "__main__":
    print("=== Running Sentinel NIDS API Integration Tests ===")
    # Initialize DB for tests directly
    init_db_for_test()
    
    tests = [
        test_get_status,
        test_get_model_info,
        test_control_sniffer_start_simulation,
        test_trigger_attack_simulation,
        test_trigger_invalid_attack,
        test_get_alerts,
        test_get_metrics,
        test_control_sniffer_stop
    ]
    
    passed = 0
    failed = 0
    for test in tests:
        try:
            print(f"Running {test.__name__:<40}", end="")
            test()
            print("\033[92m[PASSED]\033[0m")
            passed += 1
        except Exception as e:
            print(f"\033[91m[FAILED]\033[0m: {e}")
            failed += 1
            
    print(f"\n=== Test Summary: {passed} passed, {failed} failed ===")

