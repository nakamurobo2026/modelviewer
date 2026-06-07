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

## iwakan-lab: Supabase Edge Function経由のAI生成

`iwakan-lab` はGitHub Pagesから直接OpenAI APIを呼びません。AI生成はSupabase Edge Function `generate-posts` 経由で行い、ブラウザにはOpenAI APIキーを保存しません。Edge Function URLが未設定、または通信失敗した場合はローカルテンプレート生成へ自動で戻ります。

### 構成

```text
GitHub Pages
  -> Supabase Edge Function: generate-posts
    -> OpenAI Responses API
```

### 追加ファイル

- `supabase/functions/generate-posts/index.ts`
- `iwakan-lab/ai-client.js`

### Supabaseセットアップ

1. Supabase CLIでログインします。

```bash
supabase login
```

2. プロジェクトをリンクします。

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

3. OpenAI APIキーをSupabase secretsに保存します。

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

必要ならモデルや許可Originも設定できます。

```bash
supabase secrets set OPENAI_MODEL=gpt-5-mini
supabase secrets set ALLOWED_ORIGIN=https://nakamurobo2026.github.io
```

4. Edge Functionをデプロイします。

```bash
supabase functions deploy generate-posts
```

GitHub Pagesからログインなしで呼び出す運用にする場合は、Supabase側で関数のJWT検証設定をプロジェクト方針に合わせて調整してください。公開関数にする場合でも、OpenAI APIキーはSupabase secret内にだけ置かれ、ブラウザへは送られません。

5. `iwakan-lab` の画面で「AI設定」を開き、Edge Function URLを保存します。

```text
https://YOUR_PROJECT_REF.functions.supabase.co/generate-posts
```

### Edge Function仕様

- モデル初期値: `gpt-5-mini`
- OpenAI APIキー: Supabase secret `OPENAI_API_KEY`
- タイムアウト: 15秒
- 成功時: `{ "ok": true, "model": "gpt-5-mini", "ideas": [...] }`
- 失敗時: `{ "ok": false, "error": "...", "detail": "..." }`

### ブラウザ側の保存内容

ブラウザのlocalStorageに保存するのはEdge Function URLだけです。過去に保存していた `iwakan_lab_openai_api_key_v1` は起動時に削除されます。
