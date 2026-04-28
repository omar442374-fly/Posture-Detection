# 🖥️ Posture Detection — Desktop App for Tech Workers

A Windows desktop application that monitors your sitting posture in real-time using your webcam and a trained computer-vision model. It also reminds you to blink and drink water to protect your health during long work sessions.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📷 **Live Camera Feed** | Real-time webcam stream with skeleton overlay |
| 🧍 **Posture Detection** | Binary classifier (good / bad posture) using MobileNetV2 |
| 🔔 **Posture Alerts** | On-screen + system notification when bad posture detected |
| 👁️ **Blink Reminders** | Configurable interval (default: every 20 min) |
| 💧 **Water Reminders** | Configurable interval (default: every 30 min) |
| 📊 **Session Stats** | Good-posture %, alert count, session duration |
| 🎨 **Publication Design System** | Accessible, dark-mode UI with design tokens |
| ⚙️ **Settings Panel** | Adjust all intervals, delays, and server URL |
| 🔲 **System Tray** | Minimises to tray, always accessible |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│          Electron Shell             │
│  ┌───────────────────────────────┐  │
│  │     React UI (Vite)           │  │
│  │  - CameraFeed (WebRTC)        │  │
│  │  - PostureStatus              │  │
│  │  - AlertStack                 │  │
│  │  - Sidebar (Settings)         │  │
│  └──────────────┬────────────────┘  │
│                 │ HTTP POST /predict │
│  ┌──────────────▼────────────────┐  │
│  │  Python Flask Server :8765    │  │
│  │  - TensorFlow / TFLite model  │  │
│  │  - MediaPipe fallback         │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

- **Frontend**: React 18 + Vite inside Electron 31
- **Backend**: Python Flask + TensorFlow 2.x
- **Model**: MobileNetV2 (transfer learning) trained on posture images
- **Fallback**: MediaPipe Pose (rule-based, no GPU required)

---

## 📋 Prerequisites

### Windows

| Tool | Version | Download |
|------|---------|---------|
| Node.js | ≥ 20 LTS | https://nodejs.org |
| Python | ≥ 3.10 | https://python.org |
| Git | any | https://git-scm.com |
| Webcam | — | Built-in or USB |

---

## 🚀 Quick Start (Windows)

### 1 — Clone the repository

```powershell
git clone https://github.com/omar442374-fly/Posture-Detection.git
cd Posture-Detection
```

### 2 — Set up the Python environment

```powershell
cd model
python -m venv venv
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

> **Tip**: If you have a GPU, install `tensorflow[gpu]` instead of `tensorflow`.

### 3 — Download the dataset

```powershell
# You need a Kaggle account and API key.
# Set up ~/.kaggle/kaggle.json first: https://www.kaggle.com/settings/account

python download_dataset.py --output data
```

The script will download the **Posture Recognition** dataset
([`sahasradityathyadi/posture-recognition`](https://www.kaggle.com/datasets/sahasradityathyadi/posture-recognition))
and fall back to `nitishabharathi/chair-posture-dataset` if unavailable.

Expected data layout after download:
```
model/data/
    good_posture/
        img001.jpg ...
    bad_posture/
        img001.jpg ...
```

### 4 — Train the model

```powershell
python train.py --data data --epochs 20 --fine-tune-epochs 10
```

This runs two phases:
1. **Phase 1** — Train only the classification head (MobileNetV2 backbone frozen)
2. **Phase 2** — Fine-tune the top 30 layers of the backbone

Output files:
- `model/posture_model.keras` — full Keras model
- `model/posture_model.tflite` — optimised TFLite model
- `model/class_names.json` — label mapping

Training typically takes **5–15 minutes** on CPU, **1–3 minutes** on GPU.

### 5 — Start the inference server (for development)

```powershell
# In model/ directory with venv active
python inference_server.py
```

The server starts at `http://localhost:8765`.

### 6 — Install and run the Electron app

```powershell
cd ..\app
npm install
npm run dev
```

This starts the Vite dev server (`:5173`) and launches Electron.

---

## 🔨 Building for Production (Windows Installer)

```powershell
cd app
npm run build     # builds Vite + Electron bundles
npm run package   # creates NSIS installer in release/
```

The installer (`Posture Detection Setup.exe`) will be in `app/release/`.

> **Note**: The Python runtime and all dependencies must be bundled separately or
> installed on the target machine. See `app/package.json → build.extraResources`
> for how model files are included.

---

## 🧠 Model Details

### Dataset

| Dataset | Classes | Notes |
|---------|---------|-------|
| `sahasradityathyadi/posture-recognition` | good_posture, bad_posture | Primary; varied office settings |
| `nitishabharathi/chair-posture-dataset` | multiple posture classes | Fallback; laboratory setting |

### Architecture

- **Backbone**: MobileNetV2 (pre-trained on ImageNet, 224×224 input)
- **Head**: GlobalAveragePooling → Dropout(0.3) → Dense(128, ReLU) → Dropout(0.2) → Dense(2, Softmax)
- **Training**: Adam (lr=1e-3), categorical cross-entropy, EarlyStopping
- **Fine-tuning**: Adam (lr=1e-5) on top 30 backbone layers
- **Augmentations**: horizontal flip, rotation ±10°, zoom ±10%, brightness ±10%

### MediaPipe Fallback

When no trained model is present, the server uses **MediaPipe Pose** landmarks with rule-based heuristics:
- Shoulder slope > 5% → bad posture
- Head forward lean > 6% (normalised) → bad posture  
- Torso lateral lean > 8% → bad posture

---

## ⚙️ Configuration

Open the **Settings panel** (gear icon) in the app to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Blink reminder | 20 min | How often to remind you to blink |
| Water reminder | 30 min | How often to remind you to drink water |
| Posture alert delay | 5 sec | How long to tolerate bad posture before alerting |
| Inference server URL | `http://localhost:8765` | Python server endpoint |
| System notifications | On | Enable OS-level notifications |

---

## ♿ Accessibility

The app follows **WCAG 2.1 AA** guidelines:

- All interactive elements have `aria-label` attributes
- Status regions use `aria-live` for screen-reader announcements
- Focus indicators are visible (2px teal outline)
- Alert colours meet ≥ 4.5:1 contrast ratio
- Settings form uses native `<fieldset>`, `<legend>`, `<label for>` patterns
- Toggle switches expose `role="switch"` + `aria-checked`

---

## 🗂️ Project Structure

```
Posture-Detection/
├── app/                          # Electron + React frontend
│   ├── electron/
│   │   ├── main.js               # Main process (window, tray, IPC)
│   │   └── preload.js            # Context bridge (secure IPC)
│   ├── src/
│   │   ├── components/           # React UI components
│   │   │   ├── CameraFeed.jsx    # Webcam + frame capture + overlay
│   │   │   ├── PostureStatus.jsx # Status badge, confidence bar, stats
│   │   │   ├── AlertStack.jsx    # Toast alerts (posture, blink, water)
│   │   │   ├── Sidebar.jsx       # Settings panel
│   │   │   ├── Header.jsx        # App header + session stats
│   │   │   └── Icons.jsx         # SVG icon components
│   │   ├── hooks/
│   │   │   ├── usePostureDetection.js  # State + server polling
│   │   │   └── useReminders.js         # Blink & water timers
│   │   ├── styles/
│   │   │   ├── tokens.css        # Design token CSS custom properties
│   │   │   └── global.css        # Base styles
│   │   ├── App.jsx               # Root layout
│   │   └── main.jsx              # React entry point
│   ├── public/
│   │   └── icon.svg              # App icon
│   ├── index.html
│   ├── package.json
│   └── electron.vite.config.js
├── model/                        # Python ML pipeline
│   ├── download_dataset.py       # Kaggle dataset downloader
│   ├── train.py                  # MobileNetV2 transfer learning
│   ├── inference_server.py       # Flask HTTP inference server
│   ├── evaluate.py               # Model evaluation
│   └── requirements.txt          # Python dependencies
├── .gitignore
└── README.md
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Camera not starting | Allow camera permissions in Windows Settings → Privacy |
| Python server not found | Ensure Python is in PATH; check `python --version` |
| `ModuleNotFoundError` | Re-run `pip install -r requirements.txt` with venv active |
| Low model accuracy | Use more training data; increase `--epochs`; try `--fine-tune-epochs 20` |
| Electron shows blank screen | Run `npm run dev` and check DevTools console for errors |
| TFLite export fails | Install `tensorflow>=2.16`; TFLite export requires SavedModel format |

---

## 📄 License

MIT — see [LICENSE](LICENSE).