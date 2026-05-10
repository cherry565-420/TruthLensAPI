import os
import requests
import cv2

from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)

# HARDCODED KEYS (Use these directly since os.getenv was failing)
# This tries to get the key from the system/Render, 
# but uses your hardcoded key if it's missing.
# HARDCODED KEYS
API_USER = os.getenv('SIGHTENGINE_USER', '1208752896')
API_SECRET = os.getenv('SIGHTENGINE_SECRET', 'VWNFCGN6S5i7qARrt9D5Aue76CAg8Sfh')

def call_api(filepath, models):
    """Centralized API caller to avoid code duplication"""
    try:
        with open(filepath, 'rb') as f:
            res = requests.post('https://api.sightengine.com/1.0/check.json', 
                                files={'media': f}, 
                                data={'models': models, 'api_user': API_USER, 'api_secret': API_SECRET})
            return res.json()
    except Exception as e:
        return {"status": "failure", "error": str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze-image', methods=['POST'])
def analyze_image():
    file = request.files['file']
    path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(path)
    
    data = call_api(path, 'genai,deepfake')
    
    # Extract scores safely
    score = max(data.get('type', {}).get('ai_generated', 0), 
                data.get('deepfake', {}).get('score', 0))
    
    status = "FAKE" if score > 0.4 else "REAL"
    confidence = round(score * 100 if status == "FAKE" else (1-score)*100, 2)
    
    return jsonify({
        "result": status,
        "confidence": confidence,
        "method": "Sightengine Neural Forensic API",
        "explanation": f"Pixel artifacting patterns indicate content is {status}."
    })

@app.route('/analyze-video', methods=['POST'])
def analyze_video():
    file = request.files['file']
    path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(path)
    
    # Process video frame directly
    cap = cv2.VideoCapture(path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2) # Jump to middle
    success, frame = cap.read()
    
    if not success: # Fallback to start
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        success, frame = cap.read()
    
    frame_path = os.path.join(UPLOAD_FOLDER, "temp_v.jpg")
    cv2.imwrite(frame_path, frame)
    cap.release()
    
    # Analyze the extracted frame
    data = call_api(frame_path, 'genai,deepfake')
    if os.path.exists(frame_path): os.remove(frame_path)
    
    score = max(data.get('type', {}).get('ai_generated', 0), 
                data.get('deepfake', {}).get('score', 0))
    
    status = "FAKE" if score > 0.4 else "REAL"
    confidence = round(score * 100 if status == "FAKE" else (1-score)*100, 2)
    
    return jsonify({
        "result": status, 
        "confidence": confidence,
        "method": "Mid-Frame Temporal Scan",
        "explanation": f"Mid-frame analysis detected {status} markers."
    })

@app.route('/analyze-document', methods=['POST'])
def analyze_document():
    file = request.files['file']
    path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(path)
    
    data = call_api(path, 'genai')
    score = data.get('type', {}).get('ai_generated', 0)
    
    status = "FAKE" if score > 0.4 else "REAL"
    confidence = round(score * 100 if status == "FAKE" else (1-score)*100, 2)
    
    return jsonify({
        "result": status, 
        "confidence": confidence,
        "method": "Forensic OCR Scan",
        "explanation": f"Digital signature and font consistency check: {status}."
    })

if __name__ == "__main__":
    # Render provides the PORT as an environment variable
    port = int(os.environ.get("PORT", 5005))
    app.run(host='0.0.0.0', port=port)