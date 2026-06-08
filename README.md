# 材料価格管理PWA Full

## 全乗せ内容
- カメラ撮影
- 画像選択
- OCR解析（Tesseract.js / 初回はネット必須）
- OCR結果の手修正
- 明細抽出
- 抽出明細の確認・編集
- 一括登録
- 登録済み納品書データ入り
- 検索・集計・価格推移グラフ
- CSV読み書き
- PWA対応

## 注意
OCRはブラウザ内で動く無料版なので、完璧ではありません。
実務では「OCR → 確認画面で手直し → 登録」の運用が安全です。

## v2修正
- 検索後に一覧が真っ白に見える問題を修正
- 検索0件時に「該当データなし」を表示
- 日本語・記号・スペース違いに強い検索へ変更
- 旧キャッシュ対策でService Worker名を更新

## 入れ替え時の注意
GitHub Pagesに上げ替えた後、iPhone側で古い表示が残る場合があります。
Safariで数回リロード、またはホーム画面アイコンを削除して追加し直してください。

## iwakan-lab: Cloudflare Workers経由のAI生成

`iwakan-lab` はGitHub Pagesから直接OpenAI APIを呼びません。AI生成は固定のCloudflare Worker経由で行い、ブラウザにはOpenAI APIキーやWorker URLを保存しません。OpenAIが失敗した場合もWorker内で50件を補完して返すため、アプリは止まりません。

### 構成

```text
GitHub Pages
  -> Cloudflare Worker: https://iwakan-lab.nakamura0407.workers.dev/generate
    -> OpenAI Responses API
```

### ブラウザ側

- `iwakan-lab/ai-client.js` が `POST /generate` を呼びます。
- タイムアウトは15秒です。
- `source: "openai"` の時はOpenAI生成です。
- `source: "worker-fallback"` の時はWorker内の安全モード生成です。
- Worker通信自体が失敗した場合のみ、ブラウザ内ローカルテンプレート生成へ戻ります。
- 旧localStorageキー `iwakan_lab_openai_api_key_v1`、`iwakan_lab_openai_model_v1`、`iwakan_lab_openai_api_mode_v1`、`iwakan_lab_edge_function_url_v1` は起動時に削除されます。

### Workerリクエスト

```http
POST https://iwakan-lab.nakamura0407.workers.dev/generate
Content-Type: application/json
```

```json
{
  "theme": "地方の古い工場をAIで再生する過程",
  "category": "違和感",
  "mode": "list"
}
```

### Workerレスポンス

```json
{
  "success": true,
  "source": "openai",
  "model": "gpt-5-mini",
  "count": 50,
  "ideas": [
    {
      "text": "...",
      "category": "違和感",
      "score": 87,
      "hook": "共感"
    }
  ]
}
```

### Cloudflareセットアップ

1. Wranglerでログインします。

```bash
npx wrangler login
```

2. Workerディレクトリへ移動します。

```bash
cd cloudflare/workers/generate-posts
```

3. OpenAI APIキーをCloudflare Worker secretに保存します。

```bash
npx wrangler secret put OPENAI_API_KEY
```

4. `Variables and Secrets` または `wrangler.toml` に以下を設定します。

```toml
[vars]
OPENAI_MODEL = "gpt-5-mini"
ALLOWED_ORIGIN = "https://nakamurobo2026.github.io"
```

5. Workerをデプロイします。

```bash
npx wrangler deploy
```

### 疎通確認

Cloudflare側に反映されたかは、次のPOSTで確認できます。

```bash
curl -X POST "https://iwakan-lab.nakamura0407.workers.dev/generate" \
  -H "Content-Type: application/json" \
  -d '{"theme":"眠れない夜の違和感","category":"違和感","mode":"list"}'
```

`"Hello World!"` が返る場合は、Cloudflare上のWorkerがまだ初期コードのままです。`cloudflare/workers/generate-posts/src/index.js` をWorkerへ反映して再デプロイしてください。

### Worker仕様

- エンドポイント: `POST /generate`
- モデル初期値: `gpt-5-mini`
- OpenAI APIキー: Cloudflare Worker secret `OPENAI_API_KEY`
- タイムアウト: 15秒
- 通常成功時: `{ "success": true, "source": "openai", "ideas": [...] }`
- OpenAI失敗時: `{ "success": true, "source": "worker-fallback", "error": "...", "ideas": [...] }`
- Worker通信失敗時: ブラウザ側がローカル生成へフォールバック
