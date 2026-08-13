<div align="center">

# DeepSeek Harness Desktop

**ローカルで動作する DeepSeek Harness Web GUI のためのネイティブ Electron デスクトップシェル。**

ローカルサービスを専用ウィンドウで実行し、起動、接続、設定、更新をより予測しやすくします。

[![Release](https://img.shields.io/github/v/release/iuikj/dsh-desktop?display_name=tag&label=Release&color=4d6bfe)](https://github.com/iuikj/dsh-desktop/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/iuikj/dsh-desktop/build.yml?label=Build&logo=github)](https://github.com/iuikj/dsh-desktop/actions)
[![License](https://img.shields.io/badge/license-MIT-4d6bfe)](../package.json)

[简体中文](../README.md) · [English](./README.en.md) · [Bahasa Indonesia](./README.id.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md)

</div>

> **DeepSeek Harness Desktop は DeepSeek Harness 自体を置き換えるものではありません。** ローカルの DSH Web サービスを検出して接続します。サービスが稼働していない場合は、ローカル設定に従い、システムの Node.js と公式の `npx` 経路で起動できます。

## 概要

DeepSeek Harness Desktop は、通常 `http://127.0.0.1:3080` で提供されるローカル Web GUI を独立したデスクトップウィンドウに包みます。ブラウザベースの DSH ワークフローを維持しながら、ウィンドウ状態の記憶、トレイアクセス、起動状況、ローカルログといったデスクトップ機能を利用したいユーザー向けです。

| 分野 | 提供される機能 |
| --- | --- |
| **接続と起動** | 既存の DSH サービスを検出し、見つからない場合は起動可能です。設定ポートが非 DSH プロセスに使われている場合は、利用可能なポートを選択します。 |
| **初回起動** | Node.js と DSH を確認します。自動インストールが許可されている場合は、`npx @deepseek-ai/dsh` でランタイムを取得します。 |
| **デスクトップ体験** | フレームレスのカスタムタイトルバー、サイズと位置の保存、単一インスタンス保護、トレイ入口、トレイへ最小化するオプションを備えます。 |
| **可観測性** | 起動状況、エラー時の再試行導線、Electron ユーザーデータディレクトリ内の `logs/dsh-server.log` を提供します。 |
| **更新とリリース** | パッケージ版は GitHub Release の更新を確認できます。`v*` タグのプッシュで Windows のビルド・リリースワークフローが実行されます。 |

## 必要条件

アプリケーションには **`npm` と `npx` を含むシステムの Node.js** が必要です。DSH はシステム Node.js 用にビルドされたネイティブモジュールを使用するため、Electron に同梱される Node.js は代用になりません。初回起動時に DSH の利用可否を確認し、設定に応じてサービスを取得または起動します。

| コンポーネント | 要件 | 補足 |
| --- | --- | --- |
| Node.js | 必須 | システム環境から `node` と `npx` を利用できる必要があります。 |
| DeepSeek Harness | 自動取得可能 | 既存のインストールが見つかれば直接使用し、見つからない場合は公式の `npx` 経路で取得できます。 |
| OS | Windows を推奨 | CI は Windows インストーラーと ZIP を公開します。他のパッケージターゲットは配布前に検証してください。 |

## クイックスタート

[Releases](https://github.com/iuikj/dsh-desktop/releases) から対応するビルドをダウンロードしてインストールします。初回起動時には進行状況が表示され、サービスの準備が完了するとローカル DSH アドレスが自動で読み込まれます。

ソースから実行する場合は、次のコマンドを使用してください。開発モードでは自動更新は確認されません。

```bash
npm install
npm start
```

| 状況 | 推奨する対応 |
| --- | --- |
| 起動ページが表示されたままになる | `node` と `npx` が使用できることを確認し、ログを確認してから **Retry** を選択します。 |
| DSH がすでに起動している | DSH であることを確認した後に接続し、重複したインスタンスは起動しません。 |
| 設定済みポートが使用中である | 利用可能なポートを選択し、新しい値をローカル設定に保存します。 |
| サービスをバックグラウンドで維持したい | `minimizeToTray` を有効にします。ウィンドウを閉じるとシステムトレイに隠れます。 |

## 設定

初回起動時に Electron のユーザーデータディレクトリへ `config.json` が作成されます。**Help → Open Configuration Folder** から開けます。空のパス項目にはアプリの自動検出結果が使われます。

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

| 設定 | 初期値 | 用途 |
| --- | --- | --- |
| `host` / `port` | `127.0.0.1` / `3080` | ローカル DSH サービスの待受アドレスです。 |
| `autoStart` | `true` | 既存のサービスを検出できない場合に DSH を起動します。 |
| `autoInstallDsh` | `true` | DSH が見つからない場合に `npx` での取得を許可します。 |
| `killOnQuit` | `true` | **このアプリケーションが起動した**サービスプロセスだけを停止します。 |
| `minimizeToTray` | `false` | ウィンドウを閉じたとき、終了せずトレイへ隠します。 |
| `locale` | `""` | 空の場合はシステムロケールを使用します。デスクトップ UI は現在、中国語と英語に対応しています。 |
| `workspace` | `""` | DSH の作業ディレクトリです。空の場合は現在のユーザーのホームディレクトリを使います。 |
| `nodePath` / `dshBin` | `""` | 自動検出された Node.js または DSH エントリーパスを上書きします。 |

## ビルドとリリース

このプロジェクトは Electron Builder を使用します。以下のコマンドで、確認用の未パッケージビルドと配布成果物をそれぞれ生成します。

```bash
# 簡易確認用の未パッケージビルドを作成
npm run pack

# インストーラーと ZIP を作成
npm run dist
```

`v*` タグがプッシュされると、GitHub Actions が Windows インストーラーと ZIP を作成し、対応する Release に添付します。本番用タグを作成する前に、対象プラットフォームを検証してください。

## プライバシーとセキュリティの境界

既定のサービスアドレスはループバックアドレス `127.0.0.1` です。アプリは埋め込みページでの新規ウィンドウをブロックし、通常の `http`/`https` リンクはシステムブラウザーで開きます。サービスログはユーザーデータディレクトリにローカル保存されるため、共有する前にワークスペースや環境情報が含まれていないか確認してください。

> DeepSeek Harness、その依存関係、モデルサービス、アカウント関連データには、それぞれの提供者のポリシーが適用されます。利用前に関連する文書とプライバシー通知を確認してください。

## コントリビューション

Issue と Pull Request による貢献を歓迎します。変更は焦点を絞り、検証方法を説明し、ログ、ビルド成果物、認証情報をコミットしないでください。

```bash
git clone https://github.com/iuikj/dsh-desktop.git
cd dsh-desktop
npm install
npm start
```

## 謝辞

支援とフィードバックを寄せてくださった [LINUX DO](https://linux.do/) の皆様に感謝します。

---

<div align="center">

**DeepSeek Harness Desktop** · ローカルファーストのデスクトップ入口

</div>
