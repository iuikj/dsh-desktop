'use strict'

const { app, BrowserWindow, Menu, shell, ipcMain, dialog, desktopCapturer, screen } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const server = require('./server')

const APP_NAME = 'DeepSeek Harness'
const TITLEBAR_HEIGHT = 40

const DEFAULT_CONFIG = {
  host: '127.0.0.1',
  port: 3080,
  autoStart: true, // 服务未运行时是否自动启动
  autoInstallDsh: true, // 未检测到 DeepSeek Harness 时是否自动安装
  killOnQuit: true, // 退出时是否杀掉由本应用启动的服务
  workspace: '', // 空串 => 使用用户主目录
  nodePath: '', // 空串 => 自动探测
  dshBin: '', // 空串 => 自动探测
}

let mainWindow = null
let spawnedChild = null
let config = { ...DEFAULT_CONFIG }
let latestStatus = { message: '正在初始化…', isError: false }
let booting = false

// ---------------------------------------------------------------- 配置

function configPath() {
  return path.join(app.getPath('userData'), 'config.json')
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8')
    config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch (_) {
    config = { ...DEFAULT_CONFIG }
  }
}

function saveConfig() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2) + '\n', 'utf8')
  } catch (err) {
    console.error('[config] 保存失败:', err)
  }
}

function serverUrl() {
  return `http://${config.host}:${config.port}`
}

// ---------------------------------------------------------------- 状态 / 日志

function setStatus(message, isError = false) {
  latestStatus = { message, isError }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dsh:status', latestStatus)
  }
}

function pushLog(text) {
  appendLog(text)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dsh:log', { text })
  }
}

function appendLog(text) {
  try {
    fs.mkdirSync(logDir(), { recursive: true })
    fs.appendFileSync(logFile(), text, 'utf8')
  } catch (_) {
    /* ignore */
  }
}

function logDir() {
  return path.join(app.getPath('userData'), 'logs')
}

function logFile() {
  return path.join(logDir(), 'dsh-server.log')
}

// ---------------------------------------------------------------- 窗口

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    show: false,
    frame: false, // 全自绘标题栏，与网页内容融为一体
    backgroundColor: '#1b1b1c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'loading.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('dsh:status', latestStatus)
    syncWinState()
  })

  mainWindow.on('maximize', () => syncWinState())
  mainWindow.on('unmaximize', () => syncWinState())

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function syncWinState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('dsh:win-state', { maximized: mainWindow.isMaximized() })
}

function navigateToServer() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadURL(serverUrl()).catch((err) => {
    setStatus('页面加载失败：' + err.message, true)
  })
  maybeDebugShot()
}

// 仅用于无头自检：设置 DSH_DESKTOP_SHOT=<path> 后，页面加载完成即截图并退出。
function maybeDebugShot() {
  const shotPath = process.env.DSH_DESKTOP_SHOT
  if (!shotPath || !mainWindow) return
  const doShot = async () => {
    await sleep(8000)
    if (!mainWindow || mainWindow.isDestroyed()) {
      app.quit()
      return
    }
    try {
      const image = await mainWindow.webContents.capturePage()
      fs.writeFileSync(shotPath, image.toPNG())
      // 导出窗口边界 + 整屏截图，用于无头验证外层圆角
      const primary0 = screen.getPrimaryDisplay()
      fs.writeFileSync(
        shotPath.replace(/\.png$/i, '.bounds.json'),
        JSON.stringify({
          bounds: mainWindow.getBounds(),
          scaleFactor: primary0.scaleFactor,
          workArea: primary0.workArea,
        })
      )
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: primary0.size.width, height: primary0.size.height },
      })
      if (sources.length) {
        fs.writeFileSync(shotPath.replace(/\.png$/i, '.screen.png'), sources[0].thumbnail.toPNG())
      }
    } catch (err) {
      console.error('[shot]', err)
    }
    app.quit()
  }
  doShot()
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------- 启动流程

async function boot() {
  if (booting) return
  booting = true
  try {
    setStatus('正在检测 DeepSeek Harness 环境…')
    const env = server.detectDshStatus()

    if (!env.dshFound) {
      if (!env.nodeFound) {
        setStatus('未检测到 Node.js。DeepSeek Harness 需要 Node.js 才能运行，请先安装 Node.js（含 npm）后重启本应用。', true)
        return
      }
      if (!config.autoInstallDsh) {
        setStatus('未检测到 DeepSeek Harness（已关闭自动安装）。请手动运行 npm install -g @deepseek-ai/dsh 后点击“重试”。', true)
        return
      }
      setStatus('未检测到 DeepSeek Harness，正在自动安装…（约需数分钟）')
      try {
        await server.installDsh({ onLog: (t) => pushLog(t) })
      } catch (err) {
        setStatus('DeepSeek Harness 安装失败：' + err.message, true)
        return
      }
      setStatus('安装完成，正在初始化服务…')
    }

    if (await server.isServerUp(config.host, config.port)) {
      setStatus('服务已在运行，正在打开…')
      navigateToServer()
      return
    }

    if (!config.autoStart) {
      setStatus('服务未运行（已关闭自动启动）。请手动启动 dsh web 后点击“重试”。', true)
      return
    }

    setStatus('正在启动 DeepSeek Harness 服务…')
    try {
      spawnedChild = server.startServer({
        host: config.host,
        port: config.port,
        nodePath: config.nodePath || undefined,
        binPath: config.dshBin || undefined,
        workspace: config.workspace || os.homedir(),
        onLog: (text) => pushLog(text),
      })
    } catch (err) {
      setStatus('服务启动失败：' + err.message, true)
      return
    }

    const ok = await server.waitForServer(config.host, config.port, {
      timeoutMs: 180000,
      onProgress: (seconds) => {
        setStatus(`服务启动中…（首次启动需初始化，已等待 ${seconds}s）`)
      },
    })

    if (ok) {
      setStatus('服务已就绪，正在打开…')
      navigateToServer()
    } else {
      setStatus('服务启动超时。请打开“帮助 → 打开日志目录”排查。', true)
    }
  } finally {
    booting = false
  }
}

// ---------------------------------------------------------------- 菜单（内嵌标题栏弹出）

function buildMenuTemplate() {
  return [
    {
      id: 'menu-file',
      label: '文件',
      submenu: [
        {
          label: '重新连接服务',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (spawnedChild) {
              server.killTree(spawnedChild)
              spawnedChild = null
            }
            boot()
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      id: 'menu-edit',
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      id: 'menu-view',
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      id: 'menu-window',
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      id: 'menu-help',
      label: '帮助',
      submenu: [
        { label: '在浏览器中打开', click: () => shell.openExternal(serverUrl()) },
        { label: '打开配置目录', click: () => shell.openPath(app.getPath('userData')) },
        { label: '打开日志目录', click: () => shell.openPath(logDir()) },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: APP_NAME,
              detail: `版本 ${app.getVersion()}\n服务地址 ${serverUrl()}\n配置文件 ${configPath()}`,
            })
          },
        },
      ],
    },
  ]
}

// ---------------------------------------------------------------- IPC

function registerIpc() {
  ipcMain.handle('dsh:app-info', () => ({
    name: APP_NAME,
    version: app.getVersion(),
    url: serverUrl(),
    status: latestStatus,
  }))
  ipcMain.handle('dsh:retry', () => {
    if (spawnedChild) {
      server.killTree(spawnedChild)
      spawnedChild = null
    }
    boot()
  })
  ipcMain.handle('dsh:open-in-browser', () => shell.openExternal(serverUrl()))
  ipcMain.handle('dsh:open-config', () => shell.openPath(app.getPath('userData')))
  ipcMain.handle('dsh:open-logs', () => shell.openPath(logDir()))

  // ---- 自绘标题栏：窗口控制 ----
  ipcMain.on('dsh:win-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.minimize()
  })
  ipcMain.on('dsh:win-toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('dsh:win-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })
  ipcMain.handle('dsh:win-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isMaximized() : false
  })

  // ---- 自绘标题栏：内嵌菜单弹出 ----
  ipcMain.on('dsh:menu-popup', (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || !payload) return
    const menu = Menu.getApplicationMenu()
    const item = menu && menu.items.find((i) => i.id === payload.menu)
    if (item && item.submenu) {
      const x = Math.round(Number(payload.x) || 0)
      const y = Math.round(Number(payload.y) || 0)
      item.submenu.popup({ window: win, x, y })
    }
  })
}

// ---------------------------------------------------------------- 生命周期

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    loadConfig()
    saveConfig()
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate()))
    registerIpc()
    createWindow()
    boot()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      boot()
    }
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('will-quit', () => {
    if (spawnedChild && config.killOnQuit) {
      server.killTree(spawnedChild)
      spawnedChild = null
    }
  })
}
