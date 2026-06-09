// GitHubの画面で、このファイルだけ編集してAI接続先を切り替えます。
// 空文字の間は、ブラウザ内のモックAIで動きます。
// Cloudflare Workerを使う場合は、Dashboardで確認したURLの末尾に /analyze を付けます。
// モックAIに戻す場合は、下の値を "" に戻します。
window.YUME_AI_ENDPOINT = "https://yume-analysis.nakamura0407.workers.dev/analyze";
