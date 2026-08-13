'use strict'

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  shell,
  ipcMain,
  dialog,
  desktopCapturer,
  screen,
  nativeTheme,
  Notification,
} = require('electron')
const { autoUpdater } = require('electron-updater')
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
  minimizeToTray: false, // 关闭窗口时是否最小化到托盘
  locale: '', // 空串 => 跟随系统
  workspace: '', // 空串 => 使用用户主目录
  nodePath: '', // 空串 => 自动探测
  dshBin: '', // 空串 => 自动探测
}

let mainWindow = null
let tray = null
let spawnedChild = null
let config = { ...DEFAULT_CONFIG }
let latestStatus = { message: '正在初始化…', isError: false }
let booting = false
let isQuitting = false
let saveStateTimer = null

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

// ---------------------------------------------------------------- 本地化

function isZhLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('zh')
}

function uiLocale() {
  const loc = config.locale || app.getLocale()
  return isZhLocale(loc) ? 'zh' : 'en'
}

function t(zh, en) {
  return uiLocale() === 'zh' ? zh : en
}

/** 顶层菜单标签（同时供原生菜单与标题栏按钮使用）。 */
function topLevelMenus() {
  return [
    { id: 'menu-file', label: t('文件', 'File') },
    { id: 'menu-edit', label: t('编辑', 'Edit') },
    { id: 'menu-view', label: t('视图', 'View') },
    { id: 'menu-window', label: t('窗口', 'Window') },
    { id: 'menu-help', label: t('帮助', 'Help') },
  ]
}

// ---------------------------------------------------------------- 窗口状态

function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'))
    if (s && Number.isFinite(s.width) && Number.isFinite(s.height)) return s
  } catch (_) {
    /* ignore */
  }
  return {}
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    const bounds = mainWindow.getNormalBounds()
    const state = { ...bounds, maximized: mainWindow.isMaximized() }
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(windowStatePath(), JSON.stringify(state), 'utf8')
  } catch (_) {
    /* ignore */
  }
}

/** 校验窗口位置是否仍落在某个显示器内，避免换屏后窗口跑出视野。 */
function ensureVisible(bounds) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return null
  const displays = screen.getAllDisplays()
  for (const d of displays) {
    const wa = d.workArea
    if (
      bounds.x < wa.x + wa.width - 80 &&
      bounds.x + 80 > wa.x &&
      bounds.y >= wa.y - 8 &&
      bounds.y < wa.y + wa.height - 40
    ) {
      return { x: bounds.x, y: bounds.y }
    }
  }
  return null
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

// ---------------------------------------------------------------- 主题

function currentBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#1b1b1c' : '#f9fafb'
}

// ---------------------------------------------------------------- 窗口

function createWindow() {
  const state = loadWindowState()
  const visible = ensureVisible(state)
  const winOpts = {
    width: state.width || 1320,
    height: state.height || 860,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    show: false,
    frame: false,
    backgroundColor: currentBackgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }
  if (visible) {
    winOpts.x = visible.x
    winOpts.y = visible.y
  }

  mainWindow = new BrowserWindow(winOpts)
  if (state.maximized) mainWindow.maximize()

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

  const scheduleSave = () => {
    clearTimeout(saveStateTimer)
    saveStateTimer = setTimeout(saveWindowState, 500)
  }
  mainWindow.on('resize', scheduleSave)
  mainWindow.on('move', scheduleSave)

  mainWindow.on('close', (e) => {
    saveWindowState()
    if (!isQuitting && config.minimizeToTray && tray) {
      e.preventDefault()
      mainWindow.hide()
      if (!config.minimizeToTrayNotified) {
        notify('已最小化到托盘', 'DeepSeek Harness 仍在后台运行，点托盘图标可重新打开。')
        config.minimizeToTrayNotified = true
        saveConfig()
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 安全加固：外链用系统浏览器打开，禁止应用内新窗口/跳转。
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith(serverUrl()) || url.startsWith('file://')
    if (!allowed) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    }
  })
}

function syncWinState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('dsh:win-state', { maximized: mainWindow.isMaximized() })
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow()
    boot()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
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
      const primary0 = screen.getPrimaryDisplay()
      fs.writeFileSync(
        shotPath.replace(/\.png$/i, '.bounds.json'),
        JSON.stringify({ bounds: mainWindow.getBounds(), scaleFactor: primary0.scaleFactor })
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

// ---------------------------------------------------------------- 托盘

function trayIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', 'icon-32.png')
  }
  return path.join(__dirname, 'build', 'icon-32.png')
}

function createTray() {
  try {
    const iconPath = trayIconPath()
    if (!fs.existsSync(iconPath)) return
    tray = new Tray(iconPath)
    tray.setToolTip(APP_NAME)
    const menu = Menu.buildFromTemplate([
      { label: t('打开 DeepSeek Harness', 'Open DeepSeek Harness'), click: () => showMainWindow() },
      { type: 'separator' },
      { label: t('退出', 'Quit'), click: () => quitApp() },
    ])
    tray.setContextMenu(menu)
    tray.on('click', () => showMainWindow())
  } catch (err) {
    console.error('[tray]', err)
  }
}

function quitApp() {
  isQuitting = true
  app.quit()
}

// ---------------------------------------------------------------- 通知

function notify(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: trayIconPath() }).show()
    }
  } catch (_) {
    /* ignore */
  }
}

// ---------------------------------------------------------------- 首启引导

function firstRunWizard() {
  const flag = path.join(app.getPath('userData'), '.onboarded')
  if (fs.existsSync(flag)) return
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(flag, String(Date.now()), 'utf8')
    notify(
      t('欢迎使用 DeepSeek Harness 桌面端', 'Welcome to DeepSeek Harness Desktop'),
      t('服务会自动启动；左上角收起侧边栏；关闭窗口默认退出（可在 config.json 开启最小化到托盘）。', 'The service auto-starts. Sidebar toggle is top-left. Closing quits by default.')
    )
  } catch (_) {
    /* ignore */
  }
}

// ---------------------------------------------------------------- 启动流程

async function boot() {
  if (booting) return
  booting = true
  try {
    setStatus(t('正在检测 DeepSeek Harness 环境…', 'Detecting DeepSeek Harness environment…'))
    const env = server.detectDshStatus()

    if (!env.dshFound) {
      if (!env.nodeFound) {
        setStatus(
          t('未检测到 Node.js。DeepSeek Harness 需要 Node.js 才能运行，请先安装 Node.js（含 npm/npx）后重启本应用。', 'Node.js not found. DeepSeek Harness requires Node.js. Install Node.js (with npm/npx) and restart.'),
          true
        )
        return
      }
      if (!config.autoInstallDsh) {
        setStatus(
          t('未检测到 DeepSeek Harness（已关闭自动安装）。请手动运行 npx @deepseek-ai/dsh web 后点击“重试”。', 'DeepSeek Harness not found (auto-install disabled). Run npx @deepseek-ai/dsh web then retry.'),
          true
        )
        return
      }
      // 首次运行：下面 startServer 会走官方 npx 方式自动下载 + 初始化 + 启动。
      setStatus(t('未检测到 DeepSeek Harness，将通过 npx 自动下载并启动（首次约需数分钟）', 'DeepSeek Harness not found, downloading via npx (may take minutes on first run)'))
    }

    // 端口探测：已有 DSH 则直接连；被别的服务占用则自动换空闲端口。
    const up = await server.isServerUp(config.host, config.port)
    if (up && (await server.isDshServer(config.host, config.port))) {
      setStatus(t('服务已在运行，正在打开…', 'Service already running, opening…'))
      navigateToServer()
      return
    }
    if (up) {
      const freePort = await server.findFreePort(config.host, config.port)
      setStatus(t(`端口 ${config.port} 被其他程序占用，改用 ${freePort}`, `Port ${config.port} is occupied, using ${freePort}`))
      config.port = freePort
      saveConfig()
    }

    if (!config.autoStart) {
      setStatus(t('服务未运行（已关闭自动启动）。请手动启动 dsh web 后点击“重试”。', 'Service not running (auto-start disabled).'), true)
      return
    }

    setStatus(t('正在启动 DeepSeek Harness 服务…', 'Starting DeepSeek Harness service…'))
    try {
      spawnedChild = server.startServer({
        host: config.host,
        port: config.port,
        nodePath: config.nodePath || undefined,
        binPath: config.dshBin || undefined,
        workspace: config.workspace || os.homedir(),
        onLog: (txt) => pushLog(txt),
      })
    } catch (err) {
      setStatus(t('服务启动失败：', 'Service start failed: ') + err.message, true)
      return
    }

    const ok = await server.waitForServer(config.host, config.port, {
      timeoutMs: 360000,
      onProgress: (seconds) => {
        setStatus(t(`服务启动中…（首次需下载/初始化，已等待 ${seconds}s）`, `Starting… (${seconds}s)`))
      },
    })

    if (ok) {
      setStatus(t('服务已就绪，正在打开…', 'Service ready, opening…'))
      if (mainWindow && !mainWindow.isVisible()) notify(t('服务已就绪', 'Service ready'), serverUrl())
      navigateToServer()
    } else {
      setStatus(t('服务启动超时。请打开“帮助 → 查看日志”排查。', 'Service start timed out. Open Help → View logs.'), true)
    }
  } finally {
    booting = false
  }
}

// ---------------------------------------------------------------- 菜单

function buildMenuTemplate() {
  const M = topLevelMenus()
  const label = (id) => M.find((m) => m.id === id).label
  return [
    {
      id: 'menu-file',
      label: label('menu-file'),
      submenu: [
        { label: t('选择工作目录…', 'Choose Workspace…'), click: () => chooseWorkspace() },
        {
          label: t('重新连接服务', 'Reconnect'),
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
        { role: 'quit', label: t('退出', 'Quit') },
      ],
    },
    {
      id: 'menu-edit',
      label: label('menu-edit'),
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
      label: label('menu-view'),
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
      label: label('menu-window'),
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      id: 'menu-help',
      label: label('menu-help'),
      submenu: [
        { label: t('在浏览器中打开', 'Open in Browser'), click: () => shell.openExternal(serverUrl()) },
        { label: t('查看日志', 'View Logs'), click: () => viewLogs() },
        { label: t('打开配置目录', 'Open Config Folder'), click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        {
          label: t('关于', 'About'),
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: t('关于', 'About'),
              message: APP_NAME,
              detail: `${t('版本', 'Version')} ${app.getVersion()}\n${t('服务地址', 'Service')} ${serverUrl()}\n${t('配置文件', 'Config')} ${configPath()}`,
            })
          },
        },
      ],
    },
  ]
}

async function chooseWorkspace() {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: t('选择工作目录', 'Choose Workspace'),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (res.canceled || !res.filePaths.length) return
  config.workspace = res.filePaths[0]
  saveConfig()
  setStatus(t('工作目录已设为：', 'Workspace set to: ') + config.workspace)
}

function viewLogs() {
  const logPath = logFile()
  let tail = ''
  try {
    const content = fs.readFileSync(logPath, 'utf8')
    const lines = content.split(/\r?\n/)
    tail = lines.slice(-60).join('\n')
  } catch (_) {
    tail = t('（暂无日志）', '(no logs yet)')
  }
  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      title: t('服务日志（最近 60 行）', 'Service Logs (last 60 lines)'),
      message: logPath,
      detail: tail,
      buttons: [t('关闭', 'Close'), t('打开完整日志', 'Open Full Log')],
      defaultId: 0,
      cancelId: 0,
    })
    .then((r) => {
      if (r.response === 1) shell.openPath(logPath)
    })
    .catch(() => {})
}

// ---------------------------------------------------------------- 自动更新

function setupAutoUpdater() {
  if (!app.isPackaged) return // 开发模式不检查更新
  try {
    autoUpdater.autoDownload = true
    autoUpdater.on('update-available', (info) => {
      notify(t('发现新版本', 'Update available'), `${t('版本', 'Version')} ${info.version}`)
    })
    autoUpdater.on('update-downloaded', (info) => {
      dialog
        .showMessageBox(mainWindow, {
          type: 'info',
          title: t('更新已下载', 'Update Downloaded'),
          message: t('新版本已下载，重启后生效。', 'A new version is ready. Restart to apply.'),
          detail: `${t('版本', 'Version')} ${info.version}`,
          buttons: [t('立即重启', 'Restart Now'), t('稍后', 'Later')],
          defaultId: 0,
        })
        .then((r) => {
          if (r.response === 0) autoUpdater.quitAndInstall()
        })
        .catch(() => {})
    })
    autoUpdater.on('error', (err) => {
      console.error('[updater]', err && err.message)
    })
    autoUpdater.checkForUpdates().catch(() => {})
  } catch (err) {
    console.error('[updater]', err && err.message)
  }
}

// ---------------------------------------------------------------- IPC

function registerIpc() {
  ipcMain.handle('dsh:app-info', () => ({
    name: APP_NAME,
    version: app.getVersion(),
    url: serverUrl(),
    status: latestStatus,
    locale: uiLocale(),
    menus: topLevelMenus(),
  }))
  ipcMain.handle('dsh:menus', () => topLevelMenus())
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
    showMainWindow()
  })

  app.whenReady().then(() => {
    loadConfig()
    saveConfig()
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate()))
    registerIpc()
    createWindow()
    createTray()
    nativeTheme.on('updated', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setBackgroundColor(currentBackgroundColor())
      }
    })
    boot()
    firstRunWizard()
    setupAutoUpdater()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      boot()
    }
  })

  app.on('window-all-closed', () => {
    if (!config.minimizeToTray) app.quit()
  })

  app.on('before-quit', () => {
    isQuitting = true
    saveWindowState()
  })

  app.on('will-quit', () => {
    if (spawnedChild && config.killOnQuit) {
      server.killTree(spawnedChild)
      spawnedChild = null
    }
  })
}
