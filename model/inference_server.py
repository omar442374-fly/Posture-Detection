#!/usr/bin/env python3
"""
inference_server.py
────────────────────
Lightweight Flask HTTP server that exposes two endpoints:

  GET  /health   → {"status": "ok"}
  POST /predict  → {"label": "good_posture"|"bad_posture",
                    "confidence": float,
                    "keypoints": [...]}   # optional

The server runs on localhost:8765 and is launched by Electron's main
process as a subprocess before the React UI loads.

Model lookup order (first found wins):
  1. ./posture_model.keras   (Keras format, trained locally)
  2. ./posture_model.tflite  (TFLite, faster inference)
  3. MediaPipe Pose fallback (rule-based, no pre-trained model needed)
"""

import io
import json
import os
import sys
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

# ── Config ────────────────────────────────────────────────────────────────────

PORT = int(os.environ.get("POSTURE_PORT", 8765))
MODEL_DIR = Path(__file__).parent
IMG_SIZE = 224

# ── MediaPipe posture thresholds ──────────────────────────────────────────────

SHOULDER_SLOPE_THRESHOLD  = 0.05   # normalised y-difference between shoulders
HEAD_FORWARD_THRESHOLD    = 0.06   # normalised x-offset of ear vs shoulder
TORSO_LEAN_THRESHOLD      = 0.08   # normalised x-offset of shoulder vs hip
SHOULDER_SLOPE_WEIGHT     = 0.35   # contribution to bad-posture score
HEAD_FORWARD_WEIGHT       = 0.40
TORSO_LEAN_WEIGHT         = 0.25
BAD_POSTURE_SCORE_CUTOFF  = 0.40   # score >= this → bad posture

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "file://*"]}})

# ── Model Loading ─────────────────────────────────────────────────────────────

_model = None
_class_names = ["bad_posture", "good_posture"]
_use_tflite = False
_use_mediapipe = False
_interpreter = None
_input_details = None
_output_details = None


def _load_class_names() -> list:
    p = MODEL_DIR / "class_names.json"
    if p.exists():
        with open(p) as f:
            return json.load(f)
    return ["bad_posture", "good_posture"]


def _load_model():
    global _model, _use_tflite, _use_mediapipe
    global _interpreter, _input_details, _output_details, _class_names

    _class_names = _load_class_names()

    keras_path  = MODEL_DIR / "posture_model.keras"
    tflite_path = MODEL_DIR / "posture_model.tflite"

    if keras_path.exists():
        print(f"[server] Loading Keras model: {keras_path}", flush=True)
        try:
            import tensorflow as tf
            _model = tf.keras.models.load_model(str(keras_path))
            print("[server] Keras model loaded ✓", flush=True)
            return
        except Exception as exc:
            print(f"[server] Keras load failed: {exc}", flush=True)

    if tflite_path.exists():
        print(f"[server] Loading TFLite model: {tflite_path}", flush=True)
        try:
            import tensorflow as tf
            _interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
            _interpreter.allocate_tensors()
            _input_details  = _interpreter.get_input_details()
            _output_details = _interpreter.get_output_details()
            _use_tflite = True
            print("[server] TFLite model loaded ✓", flush=True)
            return
        except Exception as exc:
            print(f"[server] TFLite load failed: {exc}", flush=True)

    # Fall back to MediaPipe rule-based inference
    print("[server] No trained model found — using MediaPipe rule-based fallback", flush=True)
    try:
        import mediapipe as mp
        _use_mediapipe = True
        print("[server] MediaPipe loaded ✓", flush=True)
    except ImportError:
        print("[server] WARNING: mediapipe not installed. Returning random predictions.", flush=True)


# ── Preprocessing ─────────────────────────────────────────────────────────────

def _preprocess(image_bytes: bytes) -> np.ndarray:
    """Decode image bytes → normalised (1, H, W, 3) float32 array."""
    from PIL import Image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return arr[np.newaxis, ...]   # add batch dim


# ── Inference Backends ────────────────────────────────────────────────────────

def _infer_keras(image_bytes: bytes) -> dict:
    arr = _preprocess(image_bytes)
    preds = _model.predict(arr, verbose=0)[0]
    idx = int(np.argmax(preds))
    return {
        "label": _class_names[idx],
        "confidence": float(preds[idx]),
        "all_scores": {_class_names[i]: float(preds[i]) for i in range(len(preds))}
    }


def _infer_tflite(image_bytes: bytes) -> dict:
    arr = _preprocess(image_bytes)
    _interpreter.set_tensor(_input_details[0]["index"], arr)
    _interpreter.invoke()
    preds = _interpreter.get_tensor(_output_details[0]["index"])[0]
    idx = int(np.argmax(preds))
    return {
        "label": _class_names[idx],
        "confidence": float(preds[idx]),
        "all_scores": {_class_names[i]: float(preds[i]) for i in range(len(preds))}
    }


def _infer_mediapipe(image_bytes: bytes) -> dict:
    """
    Rule-based posture inference using MediaPipe Pose landmarks.
    Heuristics:
      - Head tilt > 15° → bad (forward-head posture)
      - Shoulder slope > 0.05 (normalised) → bad (uneven / slouched)
      - Torso lean > 0.08 → bad
    """
    import cv2
    import mediapipe as mp

    mp_pose = mp.solutions.pose
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w = img.shape[:2]

    keypoints = []
    with mp_pose.Pose(static_image_mode=True,
                      model_complexity=1,
                      min_detection_confidence=0.5) as pose:
        results = pose.process(img_rgb)
        if not results.pose_landmarks:
            return {"label": "good_posture", "confidence": 0.5, "keypoints": []}

        lm = results.pose_landmarks.landmark

        def pt(idx):
            p = lm[idx]
            return np.array([p.x, p.y])

        NOSE        = mp_pose.PoseLandmark.NOSE.value
        L_SHOULDER  = mp_pose.PoseLandmark.LEFT_SHOULDER.value
        R_SHOULDER  = mp_pose.PoseLandmark.RIGHT_SHOULDER.value
        L_EAR       = mp_pose.PoseLandmark.LEFT_EAR.value
        R_EAR       = mp_pose.PoseLandmark.RIGHT_EAR.value
        L_HIP       = mp_pose.PoseLandmark.LEFT_HIP.value
        R_HIP       = mp_pose.PoseLandmark.RIGHT_HIP.value

        nose       = pt(NOSE)
        l_shoulder = pt(L_SHOULDER)
        r_shoulder = pt(R_SHOULDER)
        l_ear      = pt(L_EAR)
        r_ear      = pt(R_EAR)
        l_hip      = pt(L_HIP)
        r_hip      = pt(R_HIP)

        mid_shoulder = (l_shoulder + r_shoulder) / 2
        mid_hip      = (l_hip + r_hip) / 2
        mid_ear      = (l_ear + r_ear) / 2

        # Shoulder slope (y difference, normalised by image width)
        shoulder_slope = abs(l_shoulder[1] - r_shoulder[1])

        # Head-forward: ear should be directly above shoulder
        head_forward = mid_ear[0] - mid_shoulder[0]

        # Torso lean: mid_shoulder should be above mid_hip (x-axis)
        torso_lean = abs(mid_shoulder[0] - mid_hip[0])

        bad_score = 0.0
        if shoulder_slope > SHOULDER_SLOPE_THRESHOLD:  bad_score += SHOULDER_SLOPE_WEIGHT
        if abs(head_forward) > HEAD_FORWARD_THRESHOLD: bad_score += HEAD_FORWARD_WEIGHT
        if torso_lean > TORSO_LEAN_THRESHOLD:          bad_score += TORSO_LEAN_WEIGHT

        label = "bad_posture" if bad_score >= BAD_POSTURE_SCORE_CUTOFF else "good_posture"
        confidence = min(0.95, 0.5 + abs(bad_score - BAD_POSTURE_SCORE_CUTOFF))

        for lmk in lm:
            keypoints.append({"x": lmk.x * w, "y": lmk.y * h})

        return {
            "label": label,
            "confidence": float(confidence),
            "keypoints": keypoints[:17]  # return only first 17 landmarks
        }


# ── Flask Routes ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({"status": "ok", "model_loaded": _model is not None or _use_tflite or _use_mediapipe})


@app.post("/predict")
def predict():
    if "frame" not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    image_bytes = request.files["frame"].read()

    try:
        if _model is not None:
            result = _infer_keras(image_bytes)
        elif _use_tflite:
            result = _infer_tflite(image_bytes)
        elif _use_mediapipe:
            result = _infer_mediapipe(image_bytes)
        else:
            # No model at all — return a neutral response
            result = {"label": "good_posture", "confidence": 0.5}
    except Exception as exc:
        print(f"[server] Inference error: {exc}", flush=True)
        return jsonify({"error": "Inference failed. Check server logs."}), 500

    return jsonify(result)


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    _load_model()
    print(f"[server] Posture inference server starting on port {PORT}…", flush=True)
    # Use threaded=True so the server handles concurrent requests from the UI
    app.run(host="127.0.0.1", port=PORT, threaded=True)
