// GitHubの画面で、このファイルだけ編集してAI接続先や世界観を切り替えます。
// 空文字の間は、ブラウザ内のモックAIで動きます。
window.YUME_AI_ENDPOINT = "https://yume-analysis.nakamura0407.workers.dev/analyze";

// アプリ名候補: ここから / まだ、 / YOHAKU / RE: / 一歩だけ / restart note
window.YUME_APP_CONFIG = {
  name: "ここから",
  subtitle: "止まっていたものを、少しだけ動かすノート",
  worldMessage: "頑張れない日も前提に、人生を少し整理します。",
  heroMessage: "深夜でも開ける、再起動のための小さな場所。",
  theme: {
    ink: "#4b4f4a",
    paper: "#fffdf7",
    accent: "#8aa982",
    calm: "#dceef1"
  }
};
