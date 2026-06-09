# yume-analysis Worker

夢アプリの外部AI接続用Cloudflare Workerです。

GitHub PagesではAPIキーを安全に扱えないため、ブラウザからOpenAI APIを直接呼ばず、このWorkerを中継します。

## 役割

- `POST /analyze` を受け取る
- 入力された夢、年齢、状況、時間、お金、経験、不安をもとに分析する
- OpenAI APIキーが設定されている場合はOpenAI APIを呼ぶ
- APIキー未設定、またはAI接続に失敗した場合はWorker内のフォールバック分析を返す
- ブラウザ側の `config.js` が未設定の場合は、このWorkerを使わずモックAIで動く

## Cloudflare DashboardでWorkerを作成する

1. Cloudflare Dashboardを開きます。
2. 左メニューから `Workers & Pages` を開きます。
3. `Create application` を選びます。
4. `Worker` を選びます。
5. Worker名を `yume-analysis` にします。
6. 作成後、Workerの編集画面を開きます。
7. GitHub上の `cloudflare/workers/yume-analysis/src/index.js` の内容を確認します。
8. 初回だけDashboardのWorker編集画面に同じコードを貼り付けて保存しておくと、画面上でも動作確認しやすくなります。

以後の更新はGitHub Actionsからデプロイできます。

## Variables and Secrets

Cloudflare Dashboardで `yume-analysis` Workerを開き、`Settings` から `Variables and Secrets` を設定します。

必要なSecret:

```text
OPENAI_API_KEY
```

任意のVariables:

```text
ALLOWED_ORIGIN=https://nakamurobo2026.github.io
OPENAI_MODEL=gpt-5-mini
```

`OPENAI_API_KEY` は必ずSecretとして保存してください。GitHub Pages側の `config.js`、HTML、JavaScriptには書きません。

## GitHub Secrets

GitHub ActionsからWorkerをデプロイするため、GitHub側にCloudflareのAPI Tokenを登録します。

1. Cloudflare Dashboard右上のプロフィールメニューを開きます。
2. `My Profile` を開きます。
3. `API Tokens` を開きます。
4. WorkersをデプロイできるAPI Tokenを作成します。
5. 作成されたTokenをコピーします。
6. GitHubで `nakamurobo2026/modelviewer` リポジトリを開きます。
7. `Settings` を開きます。
8. `Secrets and variables` から `Actions` を開きます。
9. `New repository secret` を選びます。
10. Nameに `CLOUDFLARE_API_TOKEN` を入れます。
11. SecretにCloudflareのTokenを貼り付けて保存します。

## GitHub Actionsからデプロイする

1. GitHubで `nakamurobo2026/modelviewer` リポジトリを開きます。
2. `Actions` タブを開きます。
3. `Deploy yume-analysis Worker` を選びます。
4. `Run workflow` を押します。
5. ブランチが `main` であることを確認します。
6. 実行します。
7. 完了後、Cloudflare Dashboardで `yume-analysis` のURLを確認します。

Worker URLは通常、次のような形式です。

```text
https://yume-analysis.YOUR_SUBDOMAIN.workers.dev
```

夢アプリに設定するURLは次の形式です。

```text
https://yume-analysis.YOUR_SUBDOMAIN.workers.dev/analyze
```

## yume-app/config.jsへの反映

GitHub上で `yume-app/config.js` を編集します。

モックAIのまま使う場合:

```js
window.YUME_AI_ENDPOINT = "";
```

Workerに接続する場合:

```js
window.YUME_AI_ENDPOINT = "https://yume-analysis.YOUR_SUBDOMAIN.workers.dev/analyze";
```

空に戻すと、いつでもモックAIへ戻せます。

## CORS

初期設定では `https://nakamurobo2026.github.io` からのアクセスを許可します。

必要に応じて、Cloudflare DashboardのVariablesで `ALLOWED_ORIGIN` を変更してください。

## フォールバック

次の場合でも、ユーザー体験が完全に止まらないようにしています。

- `config.js` のWorker URLが空
- `OPENAI_API_KEY` が未設定
- OpenAI API接続に失敗

この場合は、ブラウザ内モックAIまたはWorker内フォールバック分析でロードマップを返します。
