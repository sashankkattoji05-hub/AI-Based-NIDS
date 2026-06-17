import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def run_nids_client_demo():
    print("=========================================")
    print("   Sentinel NIDS API Client Demo Test    ")
    print("=========================================\n")

    try:
        # 1. Query the engine status
        print("[*] Querying NIDS status...")
        status_res = requests.get(f"{BASE_URL}/api/status")
        status_res.raise_for_status()
        status = status_res.json()
        print(f"    - Engine Running: {status['is_running']}")
        print(f"    - Mode:           {status['mode'].upper()}")
        print(f"    - Threshold:      {status['confidence_threshold'] * 100}%\n")

        # 2. Query the AI Model details
        print("[*] Retrieving AI Model stats...")
        model_res = requests.get(f"{BASE_URL}/api/model/info")
        model_res.raise_for_status()
        model_info = model_res.json()
        print(f"    - Classifier Accuracy: {model_info['accuracy'] * 100:.2f}%")
        print(f"    - Balanced F1-Score:   {model_info['f1_score'] * 100:.2f}%")
        print("    - Top 3 Network Feature Weights:")
        for feat, val in list(model_info['feature_importances'].items())[:3]:
            print(f"      • {feat:<18} : {val * 100:.1f}%")
        print()

        # 3. Retrieve Latest Security Incident Logs
        print("[*] Querying latest database alerts (limit 3)...")
        alerts_res = requests.get(f"{BASE_URL}/api/alerts?limit=3")
        alerts_res.raise_for_status()
        alerts_data = alerts_res.json()
        print(f"    - Total Alerts in Database: {alerts_data['total']}")
        
        if alerts_data['alerts']:
            for alert in alerts_data['alerts']:
                print(f"      • [{alert['severity'].upper()}] {alert['attack_type']:<24} | Src: {alert['src_ip']}:{alert['src_port']} -> Dst: {alert['dst_ip']}:{alert['dst_port']}")
        else:
            print("      • (No alerts recorded yet. Try triggering a simulation attack first!)")
        print()

    except requests.exceptions.ConnectionError:
        print("\033[91m[ERROR] Connection failed!\033[0m")
        print(f"Could not connect to NIDS backend at {BASE_URL}.")
        print("Please make sure your FastAPI backend is running: uvicorn backend.main:app --reload")
    except Exception as e:
        print(f"\033[91m[ERROR] An error occurred: {e}\033[0m")

if __name__ == "__main__":
    run_nids_client_demo()
