'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// 与主进程 titleBar 高度保持一致：网页内容顶部预留自绘标题栏的空间。
const TITLEBAR_HEIGHT = 40

const TITLEBAR_COPY = {
  en: {
    sidebar: 'Toggle sidebar',
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore',
    close: 'Close',
    menus: {
      'menu-file': 'File',
      'menu-edit': 'Edit',
      'menu-view': 'View',
      'menu-window': 'Window',
      'menu-help': 'Help',
    },
  },
  zh: {
    sidebar: '收起/打开侧边栏',
    minimize: '最小化',
    maximize: '最大化',
    restore: '还原',
    close: '关闭',
    menus: {
      'menu-file': '文件',
      'menu-edit': '编辑',
      'menu-view': '视图',
      'menu-window': '窗口',
      'menu-help': '帮助',
    },
  },
}

let titlebarLocale = navigator.language && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'

function setTitlebarLocale(locale) {
  titlebarLocale = locale === 'zh' ? 'zh' : 'en'
}

function titlebarCopy() {
  return TITLEBAR_COPY[titlebarLocale]
}

// ---------------------------------------------------------------- 应用桥

contextBridge.exposeInMainWorld('dshApp', {
  getAppInfo: () => ipcRenderer.invoke('dsh:app-info'),
  onStatus: (cb) => {
    if (typeof cb !== 'function') return () => {}
    const l = (_e, p) => cb(p)
    ipcRenderer.on('dsh:status', l)
    return () => ipcRenderer.removeListener('dsh:status', l)
  },
  onLog: (cb) => {
    if (typeof cb !== 'function') return () => {}
    const l = (_e, p) => cb(p)
    ipcRenderer.on('dsh:log', l)
    return () => ipcRenderer.removeListener('dsh:log', l)
  },
  retry: () => ipcRenderer.invoke('dsh:retry'),
  openInBrowser: () => ipcRenderer.invoke('dsh:open-in-browser'),
  openConfig: () => ipcRenderer.invoke('dsh:open-config'),
  openLogs: () => ipcRenderer.invoke('dsh:open-logs'),
  getMenus: () => ipcRenderer.invoke('dsh:menus'),
})

// ---------------------------------------------------------------- 自绘标题栏

const ICONS = {
  min: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 9h10" stroke="currentColor" stroke-width="1"/></svg>',
  max: '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor"/></svg>',
  restore:
    '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor"/><path d="M2.5 2.5V0.5H9.5V7.5H7.5" fill="none" stroke="currentColor"/></svg>',
  close: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" stroke-width="1"/></svg>',
  sidebar:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><line x1="5.5" y1="2.5" x2="5.5" y2="13.5"/></svg>',
}

function titlebarCss() {
  return `
#dsh-titlebar{position:fixed;top:0;left:0;right:0;height:${TITLEBAR_HEIGHT}px;display:flex;align-items:stretch;
  background:var(--dsw-specific-sidebar-fill,#1b1b1c);color:var(--dsw-alias-label-tertiary,#adb2b8);
  -webkit-app-region:drag;z-index:2147483647;user-select:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;}
#dsh-titlebar .tb-sidebar-toggle{-webkit-app-region:no-drag;width:34px;margin-left:6px;padding:0;display:flex;
  align-items:center;justify-content:center;background:transparent;border:none;border-radius:6px;
  color:var(--dsw-alias-label-secondary,#cfd3d6);cursor:default;}
#dsh-titlebar .tb-sidebar-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,0.08));}
#dsh-titlebar .tb-menus{display:flex;align-items:center;gap:2px;padding-left:2px;-webkit-app-region:no-drag;}
#dsh-titlebar .tb-menus button{-webkit-app-region:no-drag;background:transparent;border:none;border-radius:6px;
  color:var(--dsw-alias-label-secondary,#cfd3d6);font-size:13px;padding:5px 10px;cursor:default;line-height:1;}
#dsh-titlebar .tb-menus button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,0.08));}
#dsh-titlebar .tb-drag{flex:1;height:100%;}
#dsh-titlebar .tb-controls{display:flex;height:100%;-webkit-app-region:no-drag;}
#dsh-titlebar .tb-controls button{-webkit-app-region:no-drag;width:46px;height:100%;background:transparent;border:none;
  color:var(--dsw-alias-label-tertiary,#adb2b8);display:flex;align-items:center;justify-content:center;cursor:default;}
#dsh-titlebar .tb-controls button:hover{background:rgba(255,255,255,0.08);color:#fff;}
#dsh-titlebar .tb-controls .tb-close:hover{background:#e81123;color:#fff;}
`
}

function buildTitlebar() {
  const copy = titlebarCopy()
  const bar = document.createElement('div')
  bar.id = 'dsh-titlebar'
  bar.innerHTML = `
    <button class="tb-sidebar-toggle" title="${copy.sidebar}">${ICONS.sidebar}</button>
    <div class="tb-menus"></div>
    <div class="tb-drag"></div>
    <div class="tb-controls">
      <button class="tb-min" title="${copy.minimize}">${ICONS.min}</button>
      <button class="tb-max" title="${copy.maximize}">${ICONS.max}</button>
      <button class="tb-close" title="${copy.close}">${ICONS.close}</button>
    </div>
  `
  return bar
}

function applyControlLabels(bar) {
  const copy = titlebarCopy()
  const sidebar = bar.querySelector('.tb-sidebar-toggle')
  const min = bar.querySelector('.tb-min')
  const max = bar.querySelector('.tb-max')
  const close = bar.querySelector('.tb-close')
  if (sidebar) sidebar.title = copy.sidebar
  if (min) min.title = copy.minimize
  if (max) max.title = max.dataset.maximized === 'true' ? copy.restore : copy.maximize
  if (close) close.title = copy.close
}

// 用主进程返回的本地化标签填充标题栏菜单。
function renderMenus(container, menus) {
  container.innerHTML = ''
  const copy = titlebarCopy()
  const items = Array.isArray(menus) && menus.length ? menus : Object.entries(copy.menus).map(([id, label]) => ({ id, label }))
  for (const m of items) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.menu = m.id
    btn.textContent = m.label
    btn.addEventListener('click', () => {
      const r = btn.getBoundingClientRect()
      ipcRenderer.send('dsh:menu-popup', { menu: m.id, x: r.left, y: r.bottom })
    })
    container.appendChild(btn)
  }
}

// 找到 DSH 应用侧边栏的折叠按钮（优先哈希类，兜底按 aria-label 匹配中/英）。
function findToggleButton() {
  const byClass = document.querySelector('.hHd-Xa_toggle')
  if (byClass) return byClass
  const labels = ['收起侧边栏', '打开侧边栏', 'Collapse sidebar', 'Open sidebar']
  for (const btn of document.querySelectorAll('button')) {
    const al = btn.getAttribute('aria-label') || ''
    if (labels.includes(al)) return btn
  }
  return null
}

function wireTitlebar(bar) {
  const minBtn = bar.querySelector('.tb-min')
  const maxBtn = bar.querySelector('.tb-max')
  const closeBtn = bar.querySelector('.tb-close')
  const sidebarBtn = bar.querySelector('.tb-sidebar-toggle')

  minBtn.addEventListener('click', () => ipcRenderer.send('dsh:win-minimize'))
  maxBtn.addEventListener('click', () => ipcRenderer.send('dsh:win-toggle-maximize'))
  closeBtn.addEventListener('click', () => ipcRenderer.send('dsh:win-close'))
  sidebarBtn.addEventListener('click', () => {
    const target = findToggleButton()
    if (target) target.click()
  })

  const setMaximized = (m) => {
    maxBtn.dataset.maximized = String(Boolean(m))
    maxBtn.innerHTML = m ? ICONS.restore : ICONS.max
    maxBtn.title = m ? titlebarCopy().restore : titlebarCopy().maximize
  }
  ipcRenderer.on('dsh:win-state', (_e, s) => {
    if (s && typeof s.maximized === 'boolean') setMaximized(s.maximized)
  })
  ipcRenderer.invoke('dsh:win-is-maximized').then(setMaximized).catch(() => {})
}

function injectTitlebar() {
  if (document.getElementById('dsh-titlebar')) return
  const style = document.createElement('style')
  style.textContent = titlebarCss()
  ;(document.head || document.documentElement).appendChild(style)

  const bar = buildTitlebar()
  ;(document.body || document.documentElement).appendChild(bar)
  wireTitlebar(bar)

  const menusEl = bar.querySelector('.tb-menus')
  ipcRenderer
    .invoke('dsh:app-info')
    .then((info) => {
      setTitlebarLocale(info && info.locale)
      applyControlLabels(bar)
      renderMenus(menusEl, info && info.menus)
    })
    .catch(() => renderMenus(menusEl, null))
}

// ---------------- 仅对 DSH 网页本体的「浑然一体」注入 ----------------

function injectAppCss() {
  const style = document.createElement('style')
  style.dataset.dshDesktop = 'app-layout'
  style.textContent = `
    /* 给自绘标题栏预留空间，避免遮住应用自己的顶部内容 */
    #root{padding-top:${TITLEBAR_HEIGHT}px !important;box-sizing:border-box !important;}

    /* L 形底面（标题栏 + 侧栏同色），内容区作为浮起的圆角卡片 */
    .pI_x6G_frame{background:var(--dsw-specific-sidebar-fill,#1b1b1c) !important;}
    .pI_x6G_frame > div:nth-child(2){
      background:var(--dsw-alias-bg-base,#151517) !important;
      border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,0.06)) !important;
      border-top-left-radius:12px !important;
    }
    .pI_x6G_frame > div:nth-child(3){background:var(--dsw-alias-bg-base,#151517) !important;}

    /* 侧边栏折叠按钮已上移到顶栏左上角，隐藏侧边栏内的原按钮 */
    .hHd-Xa_toggle{display:none !important;}
  `
  ;(document.head || document.documentElement).appendChild(style)
}

function onDomReady() {
  injectTitlebar()
  if (document.getElementById('root')) {
    injectAppCss()
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDomReady)
} else {
  onDomReady()
}
