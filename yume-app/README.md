# 夢アプリ

「今からでも、遅くないかもしれない。」を中心コンセプトにした、夢を今日の一歩へ分解する静的MVPです。

公開URL: https://nakamurobo2026.github.io/modelviewer/yume-app/

## 現在の構成

- GitHub Pages配下で動く完全静的アプリ
- Worker URL未設定時はブラウザ内のモックAIで分析
- Worker URL設定時はCloudflare Workers経由でAI分析
- PWAの土台として `manifest.webmanifest`、`sw.js`、アイコンを配置済み
- 将来のスマホアプリ化では、この静的UIをCapacitorへ流用する想定

## ファイル構成

- `index.html`: 画面本体
- `styles.css`: スマホファーストのUIスタイル
- `app-v2.js`: 入力、状態保存、モックAI、画面遷移
- `config.js`: Cloudflare Worker URLの切り替え設定
- `cloudflare-ai.js`: Worker URLがある場合だけ外部AIへ接続する薄い接続層
- `manifest.webmanifest`: PWA用manifest
- `sw.js`: PWA用service worker
- `register-sw.js`: service worker登録
- `icons/`: PWAアイコン

## AI接続の考え方

GitHub PagesだけではAPIキーを安全に扱えません。
そのため、OpenAI APIはブラウザから直接呼びません。

Phase 1では、`app-v2.js` のモックAIでロードマップを生成します。
Phase 3では、Cloudflare Workersの `yume-analysis` を外部API中継として使います。

`config.js` の `window.YUME_AI_ENDPOINT` が空の場合はモックAIのまま動きます。
URLを設定した場合だけ、`cloudflare-ai.js` がWorkerへ接続します。

## config.js の切り替え例

モックAIで動かす場合:

```js
window.YUME_AI_ENDPOINT = "";
```

Cloudflare Workersへ接続する場合:

```js
window.YUME_AI_ENDPOINT = "https://yume-analysis.YOUR_SUBDOMAIN.workers.dev/analyze";
```

`YOUR_SUBDOMAIN` はCloudflare Dashboardで表示される自分のworkers.devサブドメインに置き換えてください。

## Cloudflare WorkerをDashboardで作成する

1. Cloudflare Dashboardを開きます。
2. 左メニューから `Workers & Pages` を開きます。
3. `Create application` を選びます。
4. `Worker` を選びます。
5. Worker名を `yume-analysis` にします。
6. 作成後、Workerの編集画面を開きます。
7. GitHub上の `cloudflare/workers/yume-analysis/src/index.js` の内容を確認します。
8. 初回だけDashboardのWorker編集画面に同じコードを貼り付けて保存しておくと、画面上でも動作確認しやすくなります。

以後の更新はGitHub Actionsからデプロイできます。

## OPENAI_API_KEYをCloudflareに登録する

1. Cloudflare Dashboardで `Workers & Pages` を開きます。
2. `yume-analysis` Workerを選びます。
3. `Settings` を開きます。
4. `Variables and Secrets` を開きます。
5. `Add` を押します。
6. 種類はSecretとして、名前に `OPENAI_API_KEY` を入れます。
7. 値にOpenAI APIキーを貼り付けて保存します。
8. 必要に応じて、通常の変数として `ALLOWED_ORIGIN` に `https://nakamurobo2026.github.io` を設定します。
9. 必要に応じて、通常の変数として `OPENAI_MODEL` に利用したいモデル名を設定します。

APIキーは `config.js` やHTMLには絶対に書きません。

## GitHub SecretsにCLOUDFLARE_API_TOKENを登録する

1. Cloudflare Dashboard右上のプロフィールメニューを開きます。
2. `My Profile` を開きます。
3. `API Tokens` を開きます。
4. WorkersをデプロイできるAPI Tokenを作成します。
5. 作成後に表示されるTokenをコピーします。
6. GitHubで `nakamurobo2026/modelviewer` リポジトリを開きます。
7. `Settings` を開きます。
8. `Secrets and variables` から `Actions` を開きます。
9. `New repository secret` を選びます。
10. Nameに `CLOUDFLARE_API_TOKEN` を入れます。
11. SecretにCloudflareで作成したTokenを貼り付けて保存します。

CloudflareのTokenは一度しか表示されないため、コピー後すぐにGitHub Secretsへ登録してください。

## GitHub ActionsからWorkerをデプロイする

1. GitHubで `nakamurobo2026/modelviewer` リポジトリを開きます。
2. `Actions` タブを開きます。
3. `Deploy yume-analysis Worker` を選びます。
4. `Run workflow` を押します。
5. 対象ブランチが `main` になっていることを確認します。
6. 実行します。
7. 完了後、Cloudflare Dashboardで `yume-analysis` WorkerのURLを確認します。

Worker URLは通常、次のような形式になります。

```text
https://yume-analysis.YOUR_SUBDOMAIN.workers.dev
```

夢アプリから使うURLは末尾に `/analyze` を付けます。

```text
https://yume-analysis.YOUR_SUBDOMAIN.workers.dev/analyze
```

## Worker URLをyume-app/config.jsに設定する

1. GitHubで `yume-app/config.js` を開きます。
2. 画面右上の編集ボタンを押します。
3. `window.YUME_AI_ENDPOINT = "";` を、Worker URL入りの値に変更します。
4. 変更を `main` ブランチへCommitします。
5. GitHub Pagesの反映後、公開URLを開いて分析を試します。

設定後の例:

```js
window.YUME_AI_ENDPOINT = "https://yume-analysis.YOUR_SUBDOMAIN.workers.dev/analyze";
```

空に戻すと、いつでもモックAIへ戻せます。

## GitHub Pages公開手順

1. GitHubで `nakamurobo2026/modelviewer` リポジトリを開きます。
2. `Settings` を開きます。
3. `Pages` を開きます。
4. Sourceを `Deploy from a branch` にします。
5. Branchを `main` にします。
6. Folderを `/ (root)` にします。
7. 保存します。
8. 反映後、次のURLで確認します。

https://nakamurobo2026.github.io/modelviewer/yume-app/

## フェーズ設計

### Phase 1: 静的MVP

- GitHub Pagesで公開
- モックAIでロードマップ生成
- 入力、分析結果、年齢別ロードマップ、今日の一歩、週1振り返りを提供

### Phase 2: PWA

- ホーム画面追加
- オフライン時の最低限表示
- アイコン、テーマカラー、キャッシュ戦略の調整

### Phase 3: 外部AI接続

- Cloudflare Workersの `yume-analysis` 経由でOpenAI APIを呼ぶ
- GitHub Pages側にはAPIキーを置かない
- Worker URL未設定時はモックAIで動く

### Phase 4: Capacitorアプリ化

- 現在の静的UIをCapacitorへ流用
- iOS / Android向けに通知、ローカル保存、ネイティブ共有などを追加検討

## 注意

このアプリは「成功を保証する」アプリではありません。
確実とは言えない現実を見ながら、今ある経験から始められる一歩を探すためのプロトタイプです。
