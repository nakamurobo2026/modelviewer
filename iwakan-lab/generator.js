(function () {
  const IDEA_COUNT = 50;
  const categories = ["共感", "違和感", "懐かしさ", "深夜テンション", "地方感", "ちょい怖"];
  const hookByCategory = { "共感": "共感", "違和感": "観察", "懐かしさ": "懐かしさ", "深夜テンション": "深夜", "地方感": "地方感", "ちょい怖": "ちょい怖" };
  const tuneMap = { "共感": ["共感", "地方感"], "違和感": ["違和感", "ちょい怖"], "懐かしさ": ["懐かしさ", "地方感"] };
  const abstractWords = ["静か", "違和感", "深い", "エモい", "孤独", "ノスタルジー", "余白", "世界観", "尊い", "沁みる"];
  const bannedPhrases = ["心が静か", "時間が止まる", "孤独が優しい", "空気が沁みる", "分かる人いる", "刺さる人には刺さる", "深夜の空気"];

  const observationDb = {
    "スーパー": [
      { place: "スーパー", time: "17時過ぎ", light: "惣菜売り場の照明だけ黄色い", sound: "レジのスキャン音だけ奥まで響く", smell: "揚げ物の匂いが少し残る", people: "駐車場の車がまばら", behavior: "値引きシールを待つ人が棚の前で止まる", local: "半分消えた看板", era: "昭和っぽい棚配置", tension: "閉店前だけ棚の色が暗く見える" },
      { place: "スーパー", time: "雨の日の夕方", light: "入口の蛍光灯が床に反射してる", sound: "カートの車輪だけ大きく聞こえる", smell: "濡れた傘とパン売り場の匂いが混ざる", people: "レジ前だけ人が固まる", behavior: "袋詰め台で全員ちょっと無言になる", local: "広すぎる駐車場", era: "古いポスターがまだ貼ってある", tension: "外が暗いのに店内だけ昼みたい" },
      { place: "スーパー", time: "閉店30分前", light: "冷凍ケースの白さが強い", sound: "BGMが小さくなった気がする", smell: "魚売り場の匂いだけ残る", people: "通路に店員の台車が増える", behavior: "奥の棚だけ補充が始まる", local: "入口のガチャガチャが古い", era: "床のタイルが昔のまま", tension: "急に買い物が作業っぽくなる" }
    ],
    "ホームセンター": [
      { place: "ホームセンター", time: "閉店前", light: "木材売り場の蛍光灯だけ白い", sound: "遠くで台車の音が響く", smell: "木材と肥料の匂いが混ざる", people: "客より店員の方が多く見える", behavior: "ネジ売り場でひとりだけ長く止まってる", local: "駐車場の端が暗い", era: "工具棚のラベルが少し古い", tension: "木材売り場だけ時間が遅い" },
      { place: "ホームセンター", time: "日曜の夕方", light: "園芸コーナーだけ外の色が残る", sound: "館内放送が天井でぼやける", smell: "土と灯油の匂いがする", people: "家族連れが一気に減る", behavior: "レジ前で軍手だけ買う人がいる", local: "軽トラが入口近くに止まってる", era: "展示品の椅子が少し日焼けしてる", tension: "広いのに急に人の気配が薄い" },
      { place: "ホームセンター", time: "平日の昼", light: "資材館の奥だけ暗い", sound: "チェーンの揺れる音が残る", smell: "ゴムと段ボールの匂い", people: "通路が広すぎて誰も近くにいない", behavior: "同じ棚を何度も見直す人がいる", local: "外の自販機が古い", era: "値札のフォントが昔っぽい", tension: "必要な物を探してるだけなのに少し迷子になる" }
    ],
    "コンビニ": [
      { place: "コンビニ", time: "深夜1時", light: "白い照明が強すぎる", sound: "冷蔵ケースの音がずっと鳴ってる", smell: "コーヒーマシンの匂いだけ残る", people: "客が自分ひとり", behavior: "店員がバックヤードからなかなか出てこない", local: "駐車場が妙に広い", era: "古いコピー機が端にある", tension: "外が真っ暗で店内だけ浮いてる" },
      { place: "コンビニ", time: "朝5時", light: "窓際だけ青っぽい", sound: "揚げ物ケースの小さい音", smell: "床清掃の匂いがする", people: "作業着の人が無言で弁当を選ぶ", behavior: "雑誌棚の前だけ誰も止まらない", local: "入口の灰皿跡が残ってる", era: "看板の端が少し色あせてる", tension: "一日が始まる前の店っぽい" },
      { place: "コンビニ", time: "雨の夜", light: "ガラスに店内が二重に映る", sound: "自動ドアの音だけ目立つ", smell: "濡れた服とおでんの匂い", people: "駐車場に車だけいる", behavior: "傘立ての前で一瞬迷う", local: "国道沿いの広い入口", era: "古いATMの音", tension: "明るいのに外へ出るのが少し嫌になる" }
    ],
    "地方駅": [
      { place: "地方駅", time: "18時前", light: "ホームの端だけ夕日が残る", sound: "改札の音が数分に一回だけ鳴る", smell: "濡れた線路みたいな匂い", people: "ベンチにひとりだけ座ってる", behavior: "時刻表を見たあと全員黙る", local: "駅前の看板が半分消えてる", era: "古い待合室の椅子", tension: "次の電車までの時間が長く見える" },
      { place: "地方駅", time: "昼過ぎ", light: "待合室の蛍光灯が少し暗い", sound: "自販機の低い音", smell: "古い畳と雨の匂い", people: "駅員より乗客が少ない", behavior: "切符を買う音だけ響く", local: "駅前ロータリーが広い", era: "手書きの案内が残る", tension: "誰も急いでないのが逆に目立つ" }
    ],
    "市役所": [
      { place: "市役所", time: "15時半", light: "窓口の番号表示だけ明るい", sound: "プリンターの音が続く", smell: "紙と古い床の匂い", people: "待ってる人が同じ姿勢のまま", behavior: "番号を呼ばれても一拍遅れる", local: "掲示板のポスターが多い", era: "古い長椅子", tension: "用事は普通なのに少し緊張する" },
      { place: "市役所", time: "閉庁前", light: "廊下の奥だけ暗い", sound: "職員の足音が遠い", smell: "コピー用紙の匂い", people: "窓口前が急に空く", behavior: "書類を持った人だけ早足になる", local: "地域イベントの旗が立ってる", era: "案内板の文字が古い", tension: "建物全体が片付けに入ってる" }
    ],
    "商店街": [
      { place: "商店街", time: "夕方", light: "アーケードの照明が早めにつく", sound: "シャッターの音が一つだけ響く", smell: "惣菜屋の油の匂い", people: "歩いてる人より自転車が多い", behavior: "開いてる店と閉まってる店の差が大きい", local: "半分消えた看板", era: "昭和のタイル", tension: "明るい店ほど少し寂しく見える" },
      { place: "商店街", time: "昼過ぎ", light: "店の奥が暗い", sound: "ラジオの音が外に漏れてる", smell: "古い紙袋の匂い", people: "店主だけが外を見てる", behavior: "商品より棚の古さを見てしまう", local: "旗が色あせてる", era: "手書き値札", tension: "営業中なのに時間が止まりかけてる" }
    ],
    "古い病院": [
      { place: "古い病院", time: "午前の終わり", light: "待合室の窓だけ明るい", sound: "スリッパの音が廊下で響く", smell: "消毒液と古い椅子の匂い", people: "受付前だけ人が固まる", behavior: "呼ばれる直前に全員少し顔を上げる", local: "掲示物が多すぎる", era: "古い診察券入れ", tension: "静かに待ってる時間が長い" },
      { place: "古い病院", time: "夕方前", light: "蛍光灯の白さが残る", sound: "遠くの咳だけ聞こえる", smell: "湿布の匂い", people: "待合室の席が一列空く", behavior: "テレビを誰も見てない", local: "駐車場の線が薄い", era: "古い受付カウンター", tension: "普通の待ち時間が少し長く感じる" }
    ],
    "学校": [
      { place: "学校", time: "放課後", light: "廊下の端だけ夕日が入る", sound: "遠くの部活の声", smell: "ワックスと砂の匂い", people: "教室に机だけ残ってる", behavior: "黒板の日付だけそのまま", local: "校庭の隅が暗い", era: "古い掲示板", tension: "誰もいない教室ほど音が残る" },
      { place: "学校", time: "休日の午前", light: "体育館の窓が白い", sound: "ボールの音が一回だけ響く", smell: "古い木の床の匂い", people: "職員室だけ人の気配がある", behavior: "廊下を歩く音が大きすぎる", local: "校門の塗装が剥げてる", era: "昭和っぽい下駄箱", tension: "建物が休んでる感じがする" }
    ],
    "パチンコ屋": [
      { place: "パチンコ屋", time: "朝の開店前", light: "入口のLEDだけ派手", sound: "駐車場がまだ静か", smell: "タバコの匂いが少し残る", people: "数人だけ入口に並ぶ", behavior: "誰も話さずスマホを見てる", local: "大きい看板が国道沿いにある", era: "古いポスターの色", tension: "店内が始まる前の無音が目立つ" },
      { place: "パチンコ屋", time: "夜", light: "外の看板だけ明るすぎる", sound: "自動ドアが開くと音が漏れる", smell: "芳香剤の匂い", people: "駐車場に車だけ多い", behavior: "出てくる人がみんな少し無言", local: "隣の空き地が暗い", era: "景品交換所の小窓", tension: "外に出た瞬間だけ現実に戻る" }
    ],
    "ドラッグストア": [
      { place: "ドラッグストア", time: "21時過ぎ", light: "棚の白さが強い", sound: "BGMが止まる瞬間だけ店内が広くなる", smell: "洗剤と湿布の匂い", people: "客が数人だけ", behavior: "レジ前でポイントカードを探す音", local: "駐車場が広い", era: "薬売り場の古い棚札", tension: "明るいのに少し眠い店内" },
      { place: "ドラッグストア", time: "夕方", light: "入口だけ西日が入る", sound: "冷蔵棚の音が続く", smell: "柔軟剤の匂いが強い", people: "通路ですれ違う人が少ない", behavior: "同じ棚を何度も見直す人がいる", local: "半分消えた看板", era: "古い蛍光灯", tension: "日用品を買うだけなのに少し遠くへ来た感じ" }
    ]
  };

  function normalizeTheme(theme) { return theme.trim().replace(/\s+/g, " ") || "古いスーパー"; }
  function pick(items, index) { return items[index % items.length]; }
  function inferPlace(theme, index) {
    const clean = normalizeTheme(theme);
    const found = Object.keys(observationDb).find((place) => clean.includes(place.replace("古い", "")) || clean.includes(place));
    if (found) return found;
    if (clean.includes("駅")) return "地方駅";
    if (clean.includes("役所")) return "市役所";
    if (clean.includes("病院")) return "古い病院";
    if (clean.includes("学校")) return "学校";
    if (clean.includes("商店")) return "商店街";
    if (clean.includes("ホーム")) return "ホームセンター";
    if (clean.includes("ドラッグ")) return "ドラッグストア";
    if (clean.includes("コンビニ")) return "コンビニ";
    return pick(Object.keys(observationDb), index);
  }
  function buildObservation(theme, category, index) {
    const placeName = inferPlace(theme, index);
    const base = pick(observationDb[placeName], index);
    return { ...base, topic: normalizeTheme(theme), category };
  }
  function composeObservationText(obs, index) {
    const forms = [
      `${obs.time}の${obs.place}、${obs.behavior}`,
      `${obs.place}の${obs.time}、${obs.sound}`,
      `${obs.place}、${obs.light}と${obs.people}の組み合わせが妙に残る`,
      `${obs.time}の${obs.place}、${obs.tension}`,
      `${obs.place}で${obs.smell}時、急に昔の店みたいに見える`,
      `${obs.place}、${obs.local}の近くで${obs.sound}`,
      `${obs.time}、${obs.place}の${obs.era}だけ先に古くなる`,
      `${obs.topic}、${obs.place}で見ると${obs.behavior}`,
      `${obs.place}の${obs.people}感じ、${obs.light}せいで余計に目立つ`,
      `${obs.time}の${obs.place}、${obs.sound}と${obs.smell}だけ覚えてる`
    ];
    return polishLength(pick(forms, index), obs.topic);
  }
  function concreteScore(text) {
    const concreteTokens = ["時", "売り場", "駐車場", "レジ", "棚", "蛍光灯", "BGM", "看板", "台車", "匂い", "音", "入口", "通路", "待合室", "改札", "床", "窓", "夕方", "閉店", "雨", "カート", "自販機"];
    const concrete = concreteTokens.filter((word) => text.includes(word)).length * 7;
    const abstractPenalty = abstractWords.filter((word) => text.includes(word)).length * 6;
    const bannedPenalty = bannedPhrases.some((phrase) => text.includes(phrase)) ? 40 : 0;
    const lengthScore = text.length >= 20 && text.length <= 90 ? 18 : 4;
    const talkScore = /だけ|急に|一瞬|なぜか|妙に|まだ|先に/.test(text) ? 10 : 4;
    return Math.max(35, Math.min(98, 54 + concrete + lengthScore + talkScore - abstractPenalty - bannedPenalty));
  }
  function passesQuality(text) {
    if (bannedPhrases.some((phrase) => text.includes(phrase))) return false;
    if (text.length < 18 || text.length > 95) return false;
    const abstractOnly = abstractWords.filter((word) => text.includes(word)).length >= 2 && !/[0-9時]|売り場|駐車場|レジ|棚|蛍光灯|BGM|看板|音|匂い|入口|通路/.test(text);
    return !abstractOnly;
  }
  function polishLength(text, theme) {
    const clean = text.replace(/\s+/g, " ").replace(/。。+/g, "。").trim();
    if (clean.length <= 90) return clean;
    const compactTheme = theme.length > 20 ? `${theme.slice(0, 20)}…` : theme;
    return clean.replaceAll(theme, compactTheme).slice(0, 88).replace(/[、。,.!?？!]*$/, "") + "。";
  }
  function normalizeIdea(idea, fallbackCategory = "違和感", index = 0) {
    const text = polishLength(String(idea.text || "").trim(), "");
    const category = idea.category || fallbackCategory;
    const hook = idea.hook || idea.hookType || hookByCategory[category] || "観察";
    return { id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`, text, category, score: Number(idea.score) || concreteScore(text), hookType: hook, status: "new", createdAt: new Date().toISOString() };
  }
  function generate({ theme, category, count = IDEA_COUNT, tune = null }) {
    const cats = tuneMap[tune] || [category];
    const ideas = [];
    let index = 0;
    while (ideas.length < count && index < count * 8) {
      const cat = cats[index % cats.length] || categories[index % categories.length];
      const obs = buildObservation(theme, cat, index);
      const text = composeObservationText(obs, index);
      if (passesQuality(text) && !ideas.some((idea) => idea.text === text)) {
        ideas.push(normalizeIdea({ text, category: cat, score: concreteScore(text), hook: hookByCategory[cat] || "観察" }, cat, ideas.length));
      }
      index += 1;
    }
    while (ideas.length < count) {
      const cat = cats[ideas.length % cats.length] || category;
      const obs = buildObservation(theme, cat, ideas.length + 11);
      const text = polishLength(`${obs.time}の${obs.place}、${obs.sound}`, obs.topic);
      ideas.push(normalizeIdea({ text, category: cat, score: concreteScore(text), hook: hookByCategory[cat] || "観察" }, cat, ideas.length));
    }
    return ideas.slice(0, count);
  }

  window.TemplateGenerator = { IDEA_COUNT, generate, normalizeIdea, normalizeTheme };
})();
