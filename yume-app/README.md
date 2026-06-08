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

スマホで確認すること:

- iPhone Safariでホーム画面に追加できるか
- Android Chromeでインストール導線が出るか
- 一度開いた後、オフラインでもトップ画面が表示されるか

## 将来のAPI接続

GitHub Pages上ではOpenAI APIキーを安全に扱えません。
AI化する場合は、ブラウザからOpenAI APIを直接呼ばず、Vercel Functions / Cloudflare Workers / Supabase Edge Functions などの外部APIを経由します。

Next.js版のソースは別途、PWA化・外部API接続・Capacitor化へ拡張するための設計資産として管理します。
