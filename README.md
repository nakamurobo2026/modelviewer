# 材料価格管理PWA Full

## 全乗せ内容
- カメラ撮影
- 画像選択
- OCR解析（Tesseract.js / 初回はネット必要）
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

## iwakan-lab: Cloudflare Worker経由のAI生成

`iwakan-lab` はGitHub Pagesから直接OpenAI APIを呼びません。AI生成はCloudflare Worker `iwakan-lab-generate-posts` 経由で行い、ブラウザにはOpenAI APIキーを保存しません。Worker URLが未設定、または通信失敗した場合はローカルテンプレート生成へ自動で戻ります。

### 構成

```text
GitHub Pages
  -> Cloudflare Worker: iwakan-lab-generate-posts
    -> OpenAI Responses API
```

### 追加ファイル

- `cloudflare/workers/generate-posts/wrangler.toml`
- `cloudflare/workers/generate-posts/src/index.js`
- `iwakan-lab/ai-client.js`

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

4. 必要なら `wrangler.toml` の `ALLOWED_ORIGIN` と `OPENAI_MODEL` を調整します。

```toml
[vars]
OPENAI_MODEL = "gpt-5-mini"
ALLOWED_ORIGIN = "https://nakamurobo2026.github.io"
```

5. Workerをデプロイします。

```bash
npx wrangler deploy
```

6. `iwakan-lab` の画面で「AI設定」を開き、Cloudflare Worker URLを保存します。

```text
https://iwakan-lab-generate-posts.YOUR_SUBDOMAIN.workers.dev
```

### Worker仕様

- モデル初期値: `gpt-5-mini`
- OpenAI APIキー: Cloudflare Worker secret `OPENAI_API_KEY`
- タイムアウト: 15秒
- 成功時: `{ "ok": true, "model": "gpt-5-mini", "ideas": [...] }`
- 失敗時: `{ "ok": false, "error": "...", "detail": "..." }`

### ブラウザ側の保存内容

ブラウザのlocalStorageに保存するのはCloudflare Worker URLだけです。過去に保存していた `iwakan_lab_openai_api_key_v1` は起動時に削除されます。
