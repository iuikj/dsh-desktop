'use strict'

/**
 * DeepSeek Harness 服务生命周期管理 + 环境检测/安装。
 *
 * 职责：
 *   1. 探测 http://host:port 是否已有服务在运行；
 *   2. 若没有，用真实的 Node.js 二进制启动 `dsh web`；
 *   3. 检测本机是否已安装 DeepSeek Harness，缺失时用 npm 自动安装；
 *   4. 轮询等待服务就绪；退出时清理由本应用启动的服务进程树。
 *
 * 注意：Electron 主进程的 process.execPath 是 electron.exe，其内置 Node
 * 与系统 Node 的 ABI 不同（dsh 的 node-pty / sharp / koffi 等原生模块按
 * 系统 Node 编译），因此必须定位真实的 node.exe 来运行 dsh。
 */

const { spawn, spawnSync } = require('node:child_process')
const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 3080
const DSH_PACKAGE = '@deepseek-ai/dsh'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** dsh 数据的家目录（profile / sessions / settings 所在）。 */
function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

/** profile 本地 bin.js 的稳定路径（首次 dsh web 后会初始化出来）。 */
function profileBinPath() {
  return path.join(dshHome(), 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

// ---------------------------------------------------------------- 探测

function isServerUp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const req = http.request(
      { host, port, path: '/', method: 'GET', timeout: timeoutMs },
      (res) => {
        res.resume()
        finish(true)
      }
    )
    req.on('error', () => finish(false))
    req.on('timeout', () => {
      req.destroy()
      finish(false)
    })
    req.end()
  })
}

async function waitForServer(host, port, { intervalMs = 500, timeoutMs = 90000, onProgress } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastSecond = -1
  while (Date.now() < deadline) {
    if (await isServerUp(host, port)) return true
    const elapsed = Math.floor((Date.now() + timeoutMs - deadline) / 1000)
    if (typeof onProgress === 'function' && elapsed !== lastSecond) {
      lastSecond = elapsed
      onProgress(elapsed)
    }
    await sleep(Math.min(intervalMs, Math.max(50, deadline - Date.now())))
  }
  return false
}

// ---------------------------------------------------------------- 定位可执行文件

function which(name) {
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which'
    const res = spawnSync(whichCmd, [name], { encoding: 'utf8', windowsHide: true })
    if (res.status === 0 && res.stdout) {
      return res.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    }
  } catch (_) {
    /* ignore */
  }
  return []
}

function resolveNode() {
  if (process.env.DSH_NODE && fs.existsSync(process.env.DSH_NODE)) return process.env.DSH_NODE

  const candidates = which('node')
  if (process.platform === 'win32') {
    candidates.push('C:\\nodejs\\node.exe')
    candidates.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'))
    candidates.push(
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe')
    )
  } else {
    candidates.push('/usr/local/bin/node', '/usr/bin/node', '/opt/homebrew/bin/node')
  }

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return null
}

function resolveNpm() {
  if (process.env.DSH_NPM && fs.existsSync(process.env.DSH_NPM)) return process.env.DSH_NPM

  const node = resolveNode()
  if (node) {
    const dir = path.dirname(node)
    const names = process.platform === 'win32' ? ['npm.cmd', 'npm'] : ['npm']
    for (const n of names) {
      const cand = path.join(dir, n)
      if (fs.existsSync(cand)) return cand
    }
  }
  const found = which('npm')
  return found[0] || null
}

function resolveDshBin() {
  if (process.env.DSH_BIN && fs.existsSync(process.env.DSH_BIN)) return process.env.DSH_BIN

  // 1. $DSH_HOME/profiles 本地副本（稳定、随用户 profile 走）
  if (fs.existsSync(profileBinPath())) return profileBinPath()

  // 2. PATH 里的 dsh（全局 npm 安装 / npx 缓存），解析出相邻的 bin.js
  for (const l of which('dsh')) {
    if (process.platform === 'win32' && /\.(cmd|ps1|exe)$/i.test(l)) continue
    const guess = path.join(path.dirname(l), '..', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    if (fs.existsSync(guess)) return path.resolve(guess)
  }
  return null
}

/** 完整环境检测结果。 */
function detectDshStatus() {
  const nodePath = resolveNode()
  const dshBin = resolveDshBin()
  return {
    nodeFound: Boolean(nodePath),
    nodePath,
    npmPath: resolveNpm(),
    dshFound: Boolean(dshBin),
    dshBin,
    profileInitialized: fs.existsSync(profileBinPath()),
  }
}

// ---------------------------------------------------------------- 启动服务

function startServer({ host = DEFAULT_HOST, port = DEFAULT_PORT, nodePath, binPath, workspace, onLog } = {}) {
  const node = nodePath || resolveNode()
  if (!node) {
    throw new Error('找不到 node.exe。请安装 Node.js，或在 config.json 里设置 nodePath。')
  }
  const bin = binPath || resolveDshBin()
  if (!bin) {
    throw new Error('找不到 dsh 的 bin.js。请确认已安装 DeepSeek Harness，或在 config.json 里设置 dshBin。')
  }

  const cwd = workspace && fs.existsSync(workspace) ? workspace : os.homedir()
  const args = [bin, 'web', '--host', host, '--port', String(port)]

  const child = spawn(node, args, {
    cwd,
    env: { ...process.env, DSH_HOME: dshHome() },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const forward = (chunk) => {
    const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
    if (typeof onLog === 'function') onLog(text)
  }
  if (child.stdout) child.stdout.on('data', forward)
  if (child.stderr) child.stderr.on('data', forward)
  child.on('error', (err) => {
    if (typeof onLog === 'function') onLog(`[dsh 启动错误] ${err.message}\n`)
  })

  return child
}

// ---------------------------------------------------------------- 安装 DSH

/**
 * 用 npm 全局安装 DeepSeek Harness CLI。
 * @param {{ onLog?: (text:string)=>void }} opts
 * @returns {Promise<{npmPath:string}>}
 */
function installDsh({ onLog } = {}) {
  return new Promise((resolve, reject) => {
    const npm = resolveNpm()
    if (!npm) {
      reject(new Error('找不到 npm。请先安装 Node.js（含 npm）。'))
      return
    }
    const log = (text) => {
      if (typeof onLog === 'function') onLog(text)
    }

    log(`使用 npm 全局安装 ${DSH_PACKAGE} …\n`)
    log(`npm 路径：${npm}\n`)

    // Windows 的 npm.cmd 需经 shell 运行；统一用 shell:true 拼接整条命令。
    const cmd =
      process.platform === 'win32'
        ? `"${npm}" install -g ${DSH_PACKAGE}`
        : `"${npm}" install -g ${DSH_PACKAGE}`
    const child = spawn(cmd, {
      shell: true,
      windowsHide: true,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const forward = (chunk) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
      log(text)
    }
    if (child.stdout) child.stdout.on('data', forward)
    if (child.stderr) child.stderr.on('data', forward)

    let settled = false
    child.on('error', (err) => {
      if (settled) return
      settled = true
      log(`[安装错误] ${err.message}\n`)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      if (code === 0) {
        log('DeepSeek Harness 安装完成。\n')
        resolve({ npmPath: npm })
      } else {
        const msg = `npm 安装退出码 ${code}`
        log(`[安装失败] ${msg}\n`)
        reject(new Error(msg))
      }
    })
  })
}

/** 终止由本应用启动的服务进程树。 */
function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    } else {
      child.kill('SIGTERM')
    }
  } catch (_) {
    /* ignore */
  }
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DSH_PACKAGE,
  dshHome,
  isServerUp,
  waitForServer,
  resolveNode,
  resolveNpm,
  resolveDshBin,
  detectDshStatus,
  startServer,
  installDsh,
  killTree,
}
