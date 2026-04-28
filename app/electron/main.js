const { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let mainWindow = null
let tray = null
let pythonProcess = null

// ── Python inference server ──────────────────────────────────────────────────

function startPythonServer () {
  const isDev = !app.isPackaged
  const modelDir = isDev
    ? path.join(__dirname, '../../model')
    : path.join(process.resourcesPath, 'model')

  const pythonExe = process.platform === 'win32' ? 'python' : 'python3'
  const serverScript = path.join(modelDir, 'inference_server.py')

  console.log('[Main] Starting Python server:', serverScript)

  pythonProcess = spawn(pythonExe, [serverScript], {
    cwd: modelDir,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  })

  pythonProcess.stdout.on('data', (d) => console.log('[Python]', d.toString().trim()))
  pythonProcess.stderr.on('data', (d) => console.error('[Python ERR]', d.toString().trim()))
  pythonProcess.on('exit', (code) => console.log('[Python] exited with code', code))
}

function stopPythonServer () {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}

// ── Wait for Python server before opening window ─────────────────────────────

function waitForServer (url, retries, delay, cb) {
  http.get(url, (res) => {
    if (res.statusCode === 200) cb(null)
    else cb(new Error('Not ready'))
  }).on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForServer(url, retries - 1, delay, cb), delay)
    } else {
      cb(new Error('Server did not start in time'))
    }
  })
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    title: 'Posture Detection',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })
}

// ── System Tray ───────────────────────────────────────────────────────────────

function createTray () {
  const iconPath = path.join(__dirname, '../public/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow && mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } }
  ])

  tray.setToolTip('Posture Detection')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => mainWindow && mainWindow.show())
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('send-notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

ipcMain.handle('open-external', (_event, url) => {
  shell.openExternal(url)
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  startPythonServer()
  createTray()

  // Give Python server a moment to start (retry for up to 15s)
  waitForServer('http://localhost:8765/health', 30, 500, (err) => {
    if (err) console.warn('[Main] Python server not ready:', err.message)
    createWindow()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
  stopPythonServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopPythonServer()
    app.quit()
  }
})
