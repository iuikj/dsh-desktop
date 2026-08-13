<div align="center">

# DeepSeek Harness Desktop

**为 DeepSeek Harness 本地 Web GUI 打造的原生 Electron 桌面外壳。**

让本地服务以独立窗口运行，并提供更可预期的启动、连接、配置与更新体验。

[![Release](https://img.shields.io/github/v/release/iuikj/dsh-desktop?display_name=tag&label=Release&color=4d6bfe)](https://github.com/iuikj/dsh-desktop/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/iuikj/dsh-desktop/build.yml?label=Build&logo=github)](https://github.com/iuikj/dsh-desktop/actions)
[![License](https://img.shields.io/badge/license-MIT-4d6bfe)](./package.json)

[简体中文](./README.md) · [English](./docs/README.en.md) · [Bahasa Indonesia](./docs/README.id.md) · [日本語](./docs/README.ja.md) · [한국어](./docs/README.ko.md)

</div>

> **DeepSeek Harness Desktop 不替代 DeepSeek Harness。** 它负责检测并连接本机的 DSH Web 服务；当服务尚未运行时，应用会按配置尝试使用系统 Node.js 与官方 `npx` 方式启动它。

## 概览

DeepSeek Harness Desktop 将默认运行在 `http://127.0.0.1:3080` 的本地 Web 界面包装为独立桌面应用。它适合希望保留浏览器式工作流、同时获得窗口记忆、托盘操作、启动状态与本地日志等桌面能力的用户。

| 领域 | 已提供的能力 |
| --- | --- |
| **连接与启动** | 探测已有 DSH 服务；无服务时可自动启动；若目标端口被非 DSH 服务占用，将选择可用端口。 |
| **首次使用** | 检测 Node.js 与 DSH 环境；在允许自动安装时，通过 `npx @deepseek-ai/dsh` 取得运行时。 |
| **桌面体验** | 无边框自绘标题栏、窗口位置与尺寸记忆、单实例保护、托盘入口和可选的关闭时最小化。 |
| **可观测性** | 启动状态、错误重试入口，以及存放在用户数据目录中的 `logs/dsh-server.log`。 |
| **更新与发布** | 打包应用可检查 GitHub Release 更新；推送 `v*` 标签可触发 Windows 构建与 Release 上传。 |

## 系统要求

应用需要**系统安装的 Node.js（含 `npm`/`npx`）**。DSH 依赖系统 Node.js 的原生模块，因此不应使用 Electron 内置的 Node 代替系统 Node。首次运行时，桌面端会检查 DSH 是否可用，并根据配置自动下载或启动服务。

| 组件 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | 必需 | 应能从系统环境中找到 `node` 和 `npx`。 |
| DeepSeek Harness | 可自动获取 | 已安装时直接使用；未安装时可由应用通过官方 `npx` 方式预取。 |
| 操作系统 | 建议 Windows | 当前 CI 发布 Windows 安装包与 ZIP；其他打包目标应在分发前自行验证。 |

## 快速开始

从 [Releases](https://github.com/iuikj/dsh-desktop/releases) 下载与系统相符的构建产物并安装。首次打开时，应用会显示启动状态；服务就绪后，主窗口会自动加载本地 DSH 地址。

如果需要从源代码运行，请使用以下命令。开发环境下不会检查自动更新。

```bash
npm install
npm start
```

| 常见情况 | 建议处理 |
| --- | --- |
| 长时间停留在启动页 | 确认系统中可找到 `node` 与 `npx`，然后查看日志并点击“重试”。 |
| 已有 DSH 正在运行 | 桌面端将连接至确认属于 DSH 的现有服务，不会另行启动重复实例。 |
| 端口已被其他程序占用 | 桌面端会选择可用端口，并将新的端口写回本地配置。 |
| 希望保留后台服务 | 在配置中启用 `minimizeToTray`；关闭窗口时应用将隐藏到托盘。 |

## 配置

首次启动会在 Electron 用户数据目录创建 `config.json`。可通过菜单 **Help / 帮助 → Open Configuration Folder / 打开配置目录** 直接访问。未填写的路径字段会使用自动探测结果。

```json
{
  "host": "127.0.0.1",
  "port": 3080,
  "autoStart": true,
  "autoInstallDsh": true,
  "killOnQuit": true,
  "minimizeToTray": false,
  "locale": "",
  "workspace": "",
  "nodePath": "",
  "dshBin": ""
}
```

| 字段 | 默认值 | 用途 |
| --- | --- | --- |
| `host` / `port` | `127.0.0.1` / `3080` | 本地 DSH 服务的监听地址。 |
| `autoStart` | `true` | 未检测到现有服务时，是否自动启动 DSH。 |
| `autoInstallDsh` | `true` | 未找到 DSH 时，是否允许使用 `npx` 自动获取。 |
| `killOnQuit` | `true` | 退出时仅停止**由本应用启动**的服务进程。 |
| `minimizeToTray` | `false` | 关闭窗口时是否隐藏到托盘而非退出。 |
| `locale` | `""` | 留空跟随系统；当前桌面端界面支持中文与英文。 |
| `workspace` | `""` | DSH 工作目录；留空时使用当前用户主目录。 |
| `nodePath` / `dshBin` | `""` | 覆盖自动探测到的 Node.js 或 DSH 入口路径。 |

## 构建与发布

项目使用 Electron Builder。以下命令分别生成未打包目录和分发产物。

```bash
# 生成可直接检查的未打包目录
npm run pack

# 生成安装包与 ZIP
npm run dist
```

GitHub Actions 在推送符合 `v*` 的标签时构建 Windows 安装包和 ZIP，并将产物附加至同名 Release。请在创建正式标签前，在本机或 CI 环境完成相应平台的验证。

## 隐私与安全边界

默认服务地址为回环地址 `127.0.0.1`。应用会阻止内嵌页面打开新窗口；普通 `http`/`https` 外链交由系统浏览器处理。服务日志保存在本机的用户数据目录中，请在分享日志前自行检查其中可能包含的工作区或环境信息。

> DeepSeek Harness 及其依赖、模型服务和账号相关的数据处理由各自提供方的政策约束。使用前请审阅相应服务的文档与隐私说明。

## 贡献

欢迎通过 Issue 或 Pull Request 改进项目。提交前请保持变更聚焦，说明验证方式，并避免提交本地日志、构建产物或任何凭据。

```bash
git clone https://github.com/iuikj/dsh-desktop.git
cd dsh-desktop
npm install
npm start
```

## 致谢

感谢 [LINUX DO](https://linux.do/) 社区朋友提供的支持与反馈。

---

<div align="center">

**DeepSeek Harness Desktop** · 本地优先的桌面入口

</div>
