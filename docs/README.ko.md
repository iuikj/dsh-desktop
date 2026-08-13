<div align="center">

# DeepSeek Harness Desktop

**로컬에서 실행되는 DeepSeek Harness Web GUI를 위한 네이티브 Electron 데스크톱 셸입니다.**

로컬 서비스를 별도 창에서 실행하고, 시작, 연결, 구성, 업데이트 과정을 더 예측 가능하게 만듭니다.

[![Release](https://img.shields.io/github/v/release/iuikj/dsh-desktop?display_name=tag&label=Release&color=4d6bfe)](https://github.com/iuikj/dsh-desktop/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/iuikj/dsh-desktop/build.yml?label=Build&logo=github)](https://github.com/iuikj/dsh-desktop/actions)
[![License](https://img.shields.io/badge/license-MIT-4d6bfe)](../package.json)

[简体中文](../README.md) · [English](./README.en.md) · [Bahasa Indonesia](./README.id.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

</div>

> **DeepSeek Harness Desktop은 DeepSeek Harness를 대체하지 않습니다.** 로컬 DSH 웹 서비스를 감지하고 연결합니다. 실행 중인 서비스가 없으면 로컬 구성에 따라 시스템 Node.js 런타임과 공식 `npx` 경로를 사용해 서비스를 시작할 수 있습니다.

## 개요

DeepSeek Harness Desktop은 일반적으로 `http://127.0.0.1:3080`에서 제공되는 로컬 Web GUI를 독립적인 데스크톱 창으로 감쌉니다. 브라우저 기반 DSH 워크플로를 유지하면서 창 상태 기억, 트레이 접근, 시작 상태, 로컬 로그와 같은 데스크톱 편의 기능을 원하는 사용자를 위해 설계되었습니다.

| 영역 | 제공 기능 |
| --- | --- |
| **연결 및 시작** | 기존 DSH 서비스를 감지하고, 없으면 시작할 수 있습니다. 구성된 포트를 DSH가 아닌 프로세스가 사용 중이면 사용 가능한 포트를 선택합니다. |
| **첫 실행 흐름** | Node.js와 DSH를 확인합니다. 자동 설치가 허용된 경우 `npx @deepseek-ai/dsh`로 런타임을 가져옵니다. |
| **데스크톱 경험** | 프레임 없는 사용자 지정 제목 표시줄, 저장된 창 크기와 위치, 단일 인스턴스 보호, 트레이 진입점, 트레이 최소화 옵션을 제공합니다. |
| **관측 가능성** | 시작 상태, 오류 발생 후 재시도 경로, Electron 사용자 데이터 디렉터리의 `logs/dsh-server.log`를 제공합니다. |
| **업데이트 및 릴리스** | 패키지 빌드는 GitHub Release 업데이트를 확인할 수 있습니다. `v*` 태그를 푸시하면 Windows 빌드 및 릴리스 워크플로가 실행됩니다. |

## 요구 사항

애플리케이션에는 **`npm` 및 `npx`를 포함한 시스템 Node.js 설치**가 필요합니다. DSH는 시스템 Node.js 런타임용으로 빌드된 네이티브 모듈을 사용하므로 Electron에 내장된 Node.js는 대체할 수 없습니다. 첫 실행 시 데스크톱 앱은 DSH의 사용 가능 여부를 확인하고, 구성에 따라 서비스를 가져오거나 시작할 수 있습니다.

| 구성 요소 | 요구 사항 | 참고 |
| --- | --- | --- |
| Node.js | 필수 | 시스템 환경에서 `node`와 `npx`를 사용할 수 있어야 합니다. |
| DeepSeek Harness | 자동으로 가져올 수 있음 | 기존 설치를 찾으면 바로 사용하고, 없으면 공식 `npx` 경로로 가져올 수 있습니다. |
| 운영 체제 | Windows 권장 | CI는 Windows 설치 프로그램과 ZIP을 게시합니다. 다른 패키지 대상은 배포 전에 검증하세요. |

## 빠른 시작

[Releases](https://github.com/iuikj/dsh-desktop/releases)에서 맞는 빌드를 내려받아 설치합니다. 처음 시작할 때 앱이 진행 상황을 표시하며, 서비스 준비가 완료되면 로컬 DSH 주소를 자동으로 불러옵니다.

소스에서 실행하려면 다음 명령을 사용하세요. 개발 모드에서는 자동 업데이트를 확인하지 않습니다.

```bash
npm install
npm start
```

| 상황 | 권장 대응 |
| --- | --- |
| 시작 페이지가 계속 표시됨 | `node`와 `npx`를 사용할 수 있는지 확인하고 로그를 검토한 후 **Retry**를 선택합니다. |
| DSH가 이미 실행 중임 | DSH 서비스임을 확인한 후 연결하며 중복 인스턴스를 시작하지 않습니다. |
| 구성한 포트가 사용 중임 | 사용 가능한 포트를 선택하고 새 값을 로컬 구성에 저장합니다. |
| 서비스를 백그라운드에서 계속 실행하고 싶음 | `minimizeToTray`를 활성화합니다. 창을 닫으면 시스템 트레이에 숨겨집니다. |

## 구성

첫 실행 시 Electron 사용자 데이터 디렉터리에 `config.json`이 생성됩니다. **Help → Open Configuration Folder**에서 열 수 있습니다. 비어 있는 경로 필드는 앱의 자동 감지 결과를 사용합니다.

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

| 설정 | 기본값 | 목적 |
| --- | --- | --- |
| `host` / `port` | `127.0.0.1` / `3080` | 로컬 DSH 서비스의 수신 주소입니다. |
| `autoStart` | `true` | 기존 서비스를 감지하지 못하면 DSH를 시작합니다. |
| `autoInstallDsh` | `true` | DSH를 찾지 못했을 때 `npx`로 가져오는 것을 허용합니다. |
| `killOnQuit` | `true` | **이 애플리케이션이 시작한** 서비스 프로세스만 중지합니다. |
| `minimizeToTray` | `false` | 창을 닫을 때 종료하지 않고 트레이에 숨깁니다. |
| `locale` | `""` | 비어 있으면 시스템 로캘을 사용합니다. 현재 데스크톱 UI는 중국어와 영어를 지원합니다. |
| `workspace` | `""` | DSH 작업 디렉터리입니다. 비어 있으면 현재 사용자의 홈 디렉터리를 사용합니다. |
| `nodePath` / `dshBin` | `""` | 자동 감지된 Node.js 또는 DSH 진입 경로를 재정의합니다. |

## 빌드 및 릴리스

프로젝트는 Electron Builder를 사용합니다. 다음 명령은 각각 확인용 언패키지 빌드와 배포 아티팩트를 생성합니다.

```bash
# 빠른 확인을 위한 언패키지 빌드 생성
npm run pack

# 설치 프로그램과 ZIP 아티팩트 생성
npm run dist
```

`v*` 태그를 푸시하면 GitHub Actions가 Windows 설치 프로그램과 ZIP을 빌드하여 해당 Release에 첨부합니다. 운영용 태그를 만들기 전에 대상 플랫폼을 검증하세요.

## 개인정보 및 보안 경계

기본 서비스 주소는 루프백 주소 `127.0.0.1`입니다. 앱은 임베디드 페이지에서 새 창을 여는 것을 차단하고, 일반 `http`/`https` 링크는 시스템 브라우저로 보냅니다. 서비스 로그는 사용자 데이터 디렉터리에 로컬로 저장되므로, 공유 전에 작업 영역이나 환경 정보가 포함되어 있는지 검토하세요.

> DeepSeek Harness, 해당 종속성, 모델 서비스, 계정 관련 데이터에는 각 제공업체의 정책이 적용됩니다. 사용하기 전에 관련 문서와 개인정보처리방침을 검토하세요.

## 기여하기

Issue와 Pull Request를 통한 기여를 환영합니다. 변경은 한 가지 목적에 집중하고, 검증 방법을 설명하며, 로그, 빌드 아티팩트, 자격 증명은 커밋하지 마세요.

```bash
git clone https://github.com/iuikj/dsh-desktop.git
cd dsh-desktop
npm install
npm start
```

## 감사의 말

지원과 피드백을 제공해 주신 [LINUX DO](https://linux.do/) 커뮤니티 분들께 감사드립니다.

---

<div align="center">

**DeepSeek Harness Desktop** · 로컬 우선 데스크톱 진입점

</div>
