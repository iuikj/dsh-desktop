#!/usr/bin/env node
'use strict'

/**
 * 独立的 DeepSeek Harness 检测/安装脚本（纯 Node，无 Electron 依赖）。
 * 供 NSIS 安装器在安装阶段调用，也可手动运行：
 *   node bootstrap-dsh.js
 *
 * 行为：
 *   - 已检测到 DSH（profile 本地 bin.js 或 PATH 上的 dsh）→ 退出 0，不重复安装；
 *   - 未检测到但找到 npm → npm 全局安装 @deepseek-ai/dsh，退出 0/1；
 *   - 找不到 Node.js/npm → 退出 2。
 */

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const DSH_PACKAGE = '@deepseek-ai/dsh'

function log(s) {
  process.stdout.write(s)
}

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function profileBin() {
  return path.join(dshHome(), 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

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
  const candidates = which('node')
  if (process.platform === 'win32') {
    candidates.push('C:\\nodejs\\node.exe')
    candidates.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'))
  } else {
    candidates.push('/usr/local/bin/node', '/usr/bin/node', '/opt/homebrew/bin/node')
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return null
}

function resolveNpm() {
  const node = resolveNode()
  if (node) {
    const dir = path.dirname(node)
    const names = process.platform === 'win32' ? ['npm.cmd', 'npm'] : ['npm']
    for (const n of names) {
      const cand = path.join(dir, n)
      if (fs.existsSync(cand)) return cand
    }
  }
  return which('npm')[0] || null
}

function dshInstalled() {
  if (fs.existsSync(profileBin())) return true
  return which('dsh').length > 0
}

function install() {
  return new Promise((resolve) => {
    const npm = resolveNpm()
    if (!npm) {
      log('未检测到 Node.js/npm，无法自动安装。请先安装 Node.js（含 npm）。\n')
      resolve(2)
      return
    }
    log(`使用 npm 安装 ${DSH_PACKAGE} …\n`)
    log(`npm: ${npm}\n`)
    const cmd = `"${npm}" install -g ${DSH_PACKAGE}`
    const child = spawn(cmd, {
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const fwd = (chunk) => log(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk))
    child.stdout.on('data', fwd)
    child.stderr.on('data', fwd)
    child.on('error', (err) => {
      log('安装失败：' + err.message + '\n')
      resolve(1)
    })
    child.on('close', (code) => {
      if (code === 0) {
        log('DeepSeek Harness 安装完成。\n')
        resolve(0)
      } else {
        log(`安装失败（退出码 ${code}）。\n`)
        resolve(1)
      }
    })
  })
}

async function main() {
  log('=== DeepSeek Harness 环境检测 ===\n')
  if (dshInstalled()) {
    log('已检测到 DeepSeek Harness，跳过安装。\n')
    process.exit(0)
  }
  log('未检测到 DeepSeek Harness，开始自动安装。\n')
  const code = await install()
  process.exit(code)
}

main()
