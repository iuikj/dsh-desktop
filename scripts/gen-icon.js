#!/usr/bin/env node
'use strict'

/**
 * 生成应用图标：把 build/icon.svg 渲染成多尺寸 PNG + 一个多尺寸 ICO。
 * 需要 sharp（开发依赖）：npm i -D sharp
 * 运行：node scripts/gen-icon.js
 */

const sharp = require('sharp')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'build', 'icon.svg')
const OUT = path.join(ROOT, 'build')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

/** 用 PNG 压缩条目拼一个多尺寸 ICO（Windows Vista+ 支持）。 */
function buildIco(pngs, sizes) {
  const count = pngs.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(count, 4) // count
  const dirs = []
  let offset = 6 + 16 * count
  for (let i = 0; i < count; i++) {
    const s = sizes[i]
    const e = Buffer.alloc(16)
    e.writeUInt8(s >= 256 ? 0 : s, 0) // width (0 = 256)
    e.writeUInt8(s >= 256 ? 0 : s, 1) // height (0 = 256)
    e.writeUInt8(0, 2) // colors
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // planes
    e.writeUInt16LE(32, 6) // bitcount
    e.writeUInt32LE(pngs[i].length, 8) // bytes in resource
    e.writeUInt32LE(offset, 12) // image offset
    dirs.push(e)
    offset += pngs[i].length
  }
  return Buffer.concat([header, ...dirs, ...pngs])
}

async function main() {
  const svg = fs.readFileSync(SRC)

  // 主 PNG（512，供 electron-builder / Linux）
  await sharp(svg).resize(512, 512).png().toFile(path.join(OUT, 'icon.png'))

  // 多尺寸 PNG + ICO
  const pngs = []
  for (const s of SIZES) {
    const buf = await sharp(svg).resize(s, s).png().toBuffer()
    pngs.push(buf)
    fs.writeFileSync(path.join(OUT, `icon-${s}.png`), buf)
  }
  fs.writeFileSync(path.join(OUT, 'icon.ico'), buildIco(pngs, SIZES))

  const names = ['icon.png', 'icon.ico', ...SIZES.map((s) => `icon-${s}.png`)]
  console.log('生成完成:', names.join(', '))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
