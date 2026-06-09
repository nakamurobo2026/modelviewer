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

## セットアップ

```bash
cd cloudflare/workers/yume-analysis
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
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

## フロント接続方針

次の段階で `yume-app` に `config.js` を追加し、Worker URLをそこに置きます。

```js
window.YUME_AI_ENDPOINT = "https://YOUR-WORKER.workers.dev/analyze";
```

フロント側はWorker通信に失敗した場合、今まで通りブラウザ内モック分析へフォールバックします。
