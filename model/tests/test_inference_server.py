"""
tests/test_inference_server.py
Tests for the Flask inference server endpoints.
"""
import io
import json

import numpy as np
import pytest


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_jpeg_bytes(width: int = 64, height: int = 48) -> bytes:
    """Create a minimal valid JPEG in memory using PIL."""
    from PIL import Image
    img = Image.fromarray(
        np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
    )
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes(width: int = 32, height: int = 32) -> bytes:
    """Create a minimal valid PNG in memory using PIL."""
    from PIL import Image
    img = Image.fromarray(
        np.zeros((height, width, 3), dtype=np.uint8)
    )
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client(tmp_path, monkeypatch):
    """
    Import inference_server with model state patched to "no model loaded" so
    tests run without a real TensorFlow / MediaPipe install.
    """
    import sys

    # Ensure fresh import every test run to avoid state bleed
    for mod in list(sys.modules.keys()):
        if "inference_server" in mod:
            del sys.modules[mod]

    import inference_server as srv

    # Patch model state: no model loaded → neutral fallback path
    monkeypatch.setattr(srv, "MODEL_DIR", tmp_path)
    monkeypatch.setattr(srv, "_model", None)
    monkeypatch.setattr(srv, "_use_tflite", False)
    monkeypatch.setattr(srv, "_use_mediapipe", False)
    monkeypatch.setattr(srv, "_interpreter", None)

    srv.app.config["TESTING"] = True
    with srv.app.test_client() as c:
        yield c


# ── /health ───────────────────────────────────────────────────────────────────

class TestHealth:
    def test_returns_200(self, client):
        res = client.get("/health")
        assert res.status_code == 200

    def test_json_has_status_ok(self, client):
        payload = json.loads(client.get("/health").data)
        assert payload["status"] == "ok"

    def test_json_has_model_loaded_key(self, client):
        payload = json.loads(client.get("/health").data)
        assert "model_loaded" in payload

    def test_model_loaded_false_when_no_model(self, client):
        payload = json.loads(client.get("/health").data)
        assert payload["model_loaded"] is False


# ── /predict ──────────────────────────────────────────────────────────────────

class TestPredict:
    def test_missing_frame_returns_400(self, client):
        res = client.post("/predict", data={})
        assert res.status_code == 400

    def test_missing_frame_returns_error_message(self, client):
        payload = json.loads(client.post("/predict", data={}).data)
        assert "error" in payload

    def test_valid_jpeg_returns_200(self, client):
        jpeg = _make_jpeg_bytes()
        data = {"frame": (io.BytesIO(jpeg), "frame.jpg")}
        res = client.post("/predict", data=data,
                          content_type="multipart/form-data")
        assert res.status_code == 200

    def test_valid_jpeg_returns_label(self, client):
        jpeg = _make_jpeg_bytes()
        data = {"frame": (io.BytesIO(jpeg), "frame.jpg")}
        payload = json.loads(
            client.post("/predict", data=data,
                        content_type="multipart/form-data").data
        )
        assert payload["label"] in ("good_posture", "bad_posture")

    def test_valid_jpeg_returns_confidence(self, client):
        jpeg = _make_jpeg_bytes()
        data = {"frame": (io.BytesIO(jpeg), "frame.jpg")}
        payload = json.loads(
            client.post("/predict", data=data,
                        content_type="multipart/form-data").data
        )
        assert isinstance(payload["confidence"], float)
        assert 0.0 <= payload["confidence"] <= 1.0

    def test_valid_png_returns_200(self, client):
        png = _make_png_bytes()
        data = {"frame": (io.BytesIO(png), "frame.png")}
        res = client.post("/predict", data=data,
                          content_type="multipart/form-data")
        assert res.status_code == 200

    def test_fallback_no_model_returns_neutral_result(self, client):
        """When no model is loaded the server returns good_posture at 0.5."""
        jpeg = _make_jpeg_bytes()
        data = {"frame": (io.BytesIO(jpeg), "frame.jpg")}
        payload = json.loads(
            client.post("/predict", data=data,
                        content_type="multipart/form-data").data
        )
        assert payload["label"] == "good_posture"
        assert payload["confidence"] == 0.5
