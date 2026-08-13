<div align="center">

# DeepSeek Harness Desktop

**A native Electron desktop shell for the local DeepSeek Harness Web GUI.**

Run your local service in a focused window, with predictable startup, connection, configuration, and update behavior.

[![Release](https://img.shields.io/github/v/release/iuikj/dsh-desktop?display_name=tag&label=Release&color=4d6bfe)](https://github.com/iuikj/dsh-desktop/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/iuikj/dsh-desktop/build.yml?label=Build&logo=github)](https://github.com/iuikj/dsh-desktop/actions)
[![License](https://img.shields.io/badge/license-MIT-4d6bfe)](../package.json)

[简体中文](../README.md) · [English](./README.en.md) · [Bahasa Indonesia](./README.id.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

</div>

> **DeepSeek Harness Desktop does not replace DeepSeek Harness.** It detects and connects to a local DSH web service. If no service is running, it can use the system Node.js runtime and the official `npx` path to start one, subject to local configuration.

## Overview

DeepSeek Harness Desktop wraps the local Web GUI, normally served at `http://127.0.0.1:3080`, in an independent desktop window. It is designed for users who want a browser-based DSH workflow with desktop conveniences such as window-state memory, tray access, startup feedback, and local logs.

| Area | Included capability |
| --- | --- |
| **Connection and startup** | Detects an existing DSH service; can start one when none is found; selects a free port when the configured port is used by a non-DSH process. |
| **First-run flow** | Checks for Node.js and DSH; when automatic installation is allowed, retrieves the runtime through `npx @deepseek-ai/dsh`. |
| **Desktop experience** | Frameless custom title bar, saved size and position, single-instance protection, tray entry, and optional minimize-to-tray behavior. |
| **Observability** | Startup feedback, a retry path after errors, and `logs/dsh-server.log` in the Electron user-data directory. |
| **Updates and releases** | Packaged builds can check GitHub Release updates; pushing a `v*` tag triggers the Windows build-and-release workflow. |

## Requirements

The application needs a **system installation of Node.js, including `npm` and `npx`**. DSH uses native modules built for the system Node.js runtime, so Electron's embedded Node.js is not a substitute. On first launch, the desktop app checks whether DSH is available and, according to the configuration, can download or start the service.

| Component | Requirement | Notes |
| --- | --- | --- |
| Node.js | Required | `node` and `npx` must be available from the system environment. |
| DeepSeek Harness | Can be obtained automatically | A discovered installation is used directly; otherwise the app can prefetch it with the official `npx` route. |
| Operating system | Windows recommended | CI publishes Windows installers and ZIP files. Validate other package targets before distributing them. |

## Quick Start

Download the appropriate build from [Releases](https://github.com/iuikj/dsh-desktop/releases) and install it. On first launch, the app reports startup progress and loads the local DSH address automatically when the service is ready.

To run from source, use the commands below. Automatic updates are not checked in development mode.

```bash
npm install
npm start
```

| Situation | Recommended response |
| --- | --- |
| The startup page remains visible | Confirm that `node` and `npx` are available, inspect the logs, then select **Retry**. |
| DSH is already running | The desktop app connects to the service after confirming that it is DSH; it does not start a duplicate instance. |
| The configured port is in use | The app selects an available port and saves the new value to its local configuration. |
| You want the service to stay in the background | Enable `minimizeToTray`; closing the window will hide the app in the system tray. |

## Configuration

The first launch creates `config.json` in Electron's user-data directory. Open it from **Help → Open Configuration Folder**. Empty path fields defer to the app's automatic detection.

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

| Setting | Default | Purpose |
| --- | --- | --- |
| `host` / `port` | `127.0.0.1` / `3080` | Listening address for the local DSH service. |
| `autoStart` | `true` | Starts DSH when an existing service is not detected. |
| `autoInstallDsh` | `true` | Allows DSH to be fetched through `npx` when it is not found. |
| `killOnQuit` | `true` | Stops only service processes that **this application** started. |
| `minimizeToTray` | `false` | Hides the app in the tray instead of exiting when the window is closed. |
| `locale` | `""` | Uses the system locale when empty; the desktop UI currently supports Chinese and English. |
| `workspace` | `""` | DSH working directory; uses the current user's home directory when empty. |
| `nodePath` / `dshBin` | `""` | Overrides automatically detected Node.js or DSH entry paths. |

## Build and Release

The project uses Electron Builder. The following commands create an unpacked inspection build and distribution artifacts respectively.

```bash
# Create an unpacked build for quick inspection
npm run pack

# Create the installer and ZIP artifacts
npm run dist
```

GitHub Actions builds the Windows installer and ZIP when a `v*` tag is pushed, then attaches them to the matching Release. Validate the relevant platform before creating a production tag.

## Privacy and Security Boundary

The default service address is the loopback address `127.0.0.1`. The app blocks new embedded windows and sends ordinary `http`/`https` links to the system browser. Service logs are stored locally in the user-data directory; review them for workspace or environment information before sharing.

> DeepSeek Harness, its dependencies, model services, and account-related data are governed by their respective providers' policies. Review the relevant documentation and privacy notices before use.

## Contributing

Contributions through Issues and Pull Requests are welcome. Keep changes focused, describe how they were verified, and do not commit logs, build artifacts, or credentials.

```bash
git clone https://github.com/iuikj/dsh-desktop.git
cd dsh-desktop
npm install
npm start
```

## Acknowledgements

Thanks to the friends at [LINUX DO](https://linux.do/) for their support and feedback.

---

<div align="center">

**DeepSeek Harness Desktop** · A local-first desktop entry point

</div>
