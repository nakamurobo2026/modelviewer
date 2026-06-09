# 夢アプリ 静的MVP

公開URL:

```txt
https://nakamurobo2026.github.io/modelviewer/yume-app/
```

このフォルダはGitHub Pages直置き用のPhase 1静的成果物です。
モックAIでロードマップを生成するため、APIキーやサーバーは不要です。

## Phase 2 PWA土台

以下を追加済みです。

- `manifest.webmanifest`
- `sw.js`
- `register-sw.js`
- `icons/icon.svg`
- `icons/maskable.svg`
- iOS向け `apple-mobile-web-app-*` metadata
- theme color
- 前回の分析結果と振り返りのローカル保存

スマホで確認すること:

- iPhone Safariでホーム画面に追加できるか
- Android Chromeでインストール導線が出るか
- 一度開いた後、オフラインでもトップ画面が表示されるか
- 分析後に再読み込みして「前回の結果を見る」が表示されるか

## 保存仕様

`localStorage` に最新の分析結果と振り返りを保存します。
サーバー送信はしていません。
結果画面の「記録を消す」でブラウザ内の保存を削除できます。

## Phase 3 Cloudflare Worker準備

夢アプリ用のWorker雛形を追加済みです。

```txt
cloudflare/workers/yume-analysis/
```

このWorkerは `DreamPlan` を受け取り、`AnalysisResult` 互換JSONを返します。
OpenAI APIキーはCloudflare Worker secretに置きます。
OpenAIが未設定、または失敗した場合も `worker-fallback` として安全なモック分析を返します。

次の接続ステップでは、`yume-app/config.js` にWorker URLを置きます。

```js
window.YUME_AI_ENDPOINT = "https://YOUR-WORKER.workers.dev/analyze";
```

フロント側はWorker通信に失敗した場合、今まで通りブラウザ内モック分析へ戻します。

## 将来のAPI接続

GitHub Pages上ではOpenAI APIキーを安全に扱えません。
AI化する場合は、ブラウザからOpenAI APIを直接呼ばず、Vercel Functions / Cloudflare Workers / Supabase Edge Functions などの外部APIを経由します。

Next.js版のソースは別途、PWA化・外部API接続・Capacitor化へ拡張するための設計資産として管理します。
