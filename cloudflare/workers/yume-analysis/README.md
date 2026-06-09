# yume-analysis Cloudflare Worker

夢アプリ用のAI分析ゲートウェイです。
GitHub PagesのブラウザからOpenAI APIを直接呼ばず、このWorkerを経由します。

## 役割

```txt
GitHub Pages yume-app
  -> Cloudflare Worker yume-analysis
    -> OpenAI Responses API
```

ブラウザにはOpenAI APIキーを置きません。
OpenAI APIキーはCloudflare Worker secretとして保存します。

## エンドポイント

```http
POST /analyze
Content-Type: application/json
```

Cloudflare Workersではパスを厳密に見ていないため、`POST /` でも動きます。
運用上は `/analyze` を推奨します。

## 入力

`DreamPlan` と同じ形です。

```json
{
  "dreamTitle": "小さなカフェを開きたい",
  "targetDescription": "週末だけ試し営業できる状態",
  "currentAge": 44,
  "targetAge": 50,
  "currentSituation": "会社員。平日は忙しい。",
  "availableTime": "平日30分、週末2時間",
  "availableMoney": "月1万円まで",
  "skills": "接客、料理、SNS",
  "anxieties": "遅いかもしれない"
}
```

## 出力

`AnalysisResult` 互換です。

```json
{
  "source": "openai",
  "summary": "...",
  "possibilityLevel": "medium",
  "message": "...",
  "existingAssets": [],
  "missingPieces": [],
  "risks": [],
  "roadmap": [],
  "todayActions": []
}
```

OpenAI未設定または失敗時は `source: "worker-fallback"` で、Worker内の安全なフォールバック分析を返します。

## GitHub Actionsデプロイ

Workflowを追加済みです。

```txt
.github/workflows/deploy-yume-analysis.yml
```

GitHub repository secrets に以下を追加します。

```txt
CLOUDFLARE_API_TOKEN
```

その後、GitHub Actionsの `Deploy yume-analysis Worker` を手動実行、または `cloudflare/workers/yume-analysis/**` へのpushで自動デプロイされます。

OpenAI APIキーはGitHub Secretsではなく、Cloudflare Worker secretに保存します。

```bash
cd cloudflare/workers/yume-analysis
npx wrangler secret put OPENAI_API_KEY
```

## ローカルからデプロイ

```bash
cd cloudflare/workers/yume-analysis
npm install
npm run secret:openai
npm run deploy
```

`wrangler.toml` の初期値:

```toml
[vars]
ALLOWED_ORIGIN = "https://nakamurobo2026.github.io"
OPENAI_MODEL = "gpt-5-mini"
```

## 疎通確認

```bash
curl -X POST "https://YOUR-WORKER.workers.dev/analyze" \
  -H "Content-Type: application/json" \
  -d '{"dreamTitle":"小さなカフェを開きたい","currentAge":44,"targetAge":50,"currentSituation":"会社員。週末に少し時間がある。","availableTime":"週末2時間","availableMoney":"月1万円","skills":"接客、料理","anxieties":"遅いかもしれない"}'
```

## フロント接続

`yume-app/config.js` にWorker URLを設定します。

```js
window.YUME_AI_ENDPOINT = "https://YOUR-WORKER.workers.dev/analyze";
```

未設定の間はブラウザ内モック分析で動きます。
Worker通信に失敗した場合も、ブラウザ内モック分析へフォールバックします。
