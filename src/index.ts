import * as line from "@line/bot-sdk";
import express from "express";
import http from "node:http";
import assert from "assert";
import { env } from "process";
// ★楽曲データを別ファイルから読み込む
import { songs } from "./songs";
// ★ルールを別ファイルから読み込む
import { gameRules, orderRules } from "./rules";

const { MessagingApiClient } = line.messagingApi;

// --- 参加者入力待ち状態を管理 ---
const waitingForMembers: Record<string, boolean> = {};
// --- 歌うジャンルの状態管理 ---
const songState: Record<string, { genre?: string }> = {};

/**
 * 最初の案内文＋4択ボタン
 */
function startMessages(): line.messagingApi.Message[] {
  return [
    {
      type: "text",
      text: [
        "やっほー！カラキンだよー！",
        "",
        "僕に指示をしてくれたら、",
        "　①歌う順番の提案",
        "　②歌う曲の提案",
        "　③遊び方の提案",
        "　④カラキンの説明",
        "をするよ～",
        "",
        "やってほしいことを教えてね！！",
      ].join("\n"),
    },
    {
      type: "template",
      altText: "やってほしいことを選んでね",
      template: {
        type: "buttons",
        text: "どれをやるかな？",
        actions: [
          { type: "message", label: "① 歌う順番", text: "①歌う順番の提案" },
          { type: "message", label: "② 歌う曲", text: "②歌う曲の提案" },
          { type: "message", label: "③ 遊び方", text: "③遊び方の提案" },
          { type: "message", label: "④ 説明", text: "④カラキンの説明" },
        ],
      },
    },
  ];
}

function standardButtons(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "やってほしいことを選んでね",
      template: {
        type: "buttons",
        text: "どれをやる？",
        actions: [
          { type: "message", label: "① 歌う順番", text: "①歌う順番の提案" },
          { type: "message", label: "② 歌う曲", text: "②歌う曲の提案" },
          { type: "message", label: "③ 遊び方", text: "③遊び方の提案" },
          { type: "message", label: "④ 説明", text: "④カラキンの説明" },
        ],
      },
    },
  ];
}

// --- 順番決めの方式選択ボタン ---
function orderTypeButtons(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "どうやって順番を決める？",
      template: {
        type: "buttons",
        text: "どうやって順番を決める？",
        actions: [
          { type: "message", label: "ランダムで決める", text: "ランダムで決める" },
          { type: "message", label: "決め方を提案して", text: "決め方を提案して" },
        ],
      },
    },
  ];
}

// --- 曲の決定方法選択 ---
function songButtons(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "どうやって決める？",
      template: {
        type: "buttons",
        text: "どうやって決める？",
        actions: [
          { type: "message", label: "ランダムで1曲決める", text: "ランダムで1曲決める"},
          { type: "message", label: "ジャンルから選ぶ", text: "ジャンルから選ぶ"},
          { type: "message", label: "年別ヒット曲から選ぶ", text: "年別ヒット曲から選ぶ"},
        ],
      },
    },
  ];
}

// --- 歌う曲のジャンル選択ボタン（日本語送信） ---
function genreButtons1(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どのジャンルにする？",
        actions: [
          { type: "message", label: "JPOP", text: "ジャンル：JPOP" },
          { type: "message", label: "ロック", text: "ジャンル：ロック" },
          { type: "message", label: "アニメ", text: "ジャンル：アニメ" },
        ],
      },
    },
  ];
}

function genreButtons2(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "他には...",
        actions: [
          { type: "message", label: "バラード", text: "ジャンル：バラード" },
          { type: "message", label: "アイドル", text: "ジャンル：アイドル" },
        ],
      },
    },
  ];
}

// --- 曲の操作ボタン（候補を出した後も使う） ---
function songAfterCandidateButtons(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "どうかな？",
      template: {
        type: "buttons",
        text: "どうかな？",
        actions: [
          { type: "message", label: "もう一度候補を出す", text: "候補を出す" },
          { type: "message", label: "1曲に決める", text: "1曲に決める" },
          { type: "message", label: "決まった", text: "決まった" },
        ],
      },
    },
  ];
}


// --- 曲の決定/候補ボタン ---
function songDecisionButtons(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "1曲に決めるか候補を出すか選んでね",
      template: {
        type: "buttons",
        text: "どうする？",
        actions: [
          { type: "message", label: "1曲に決める", text: "1曲に決める" },
          { type: "message", label: "候補を出す", text: "候補を出す" },
        ],
      },
    },
  ];
}

// --- 歌う曲の年代選択ボタン（日本語送信） ---
function yearButtons1(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年代にする？",
        actions: [
          { type: "message", label: "2000～2003", text: "年代：2000～2003" },
          { type: "message", label: "2004～2007", text: "年代：2004～2007" },
          { type: "message", label: "2008～2011", text: "年代：2008～2011" },
          { type: "message", label: "2012～2015", text: "年代：2012～2015" },
        ],
      },
    },
  ];
}

function yearButtons2(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年代にする？",
        actions: [
          { type: "message", label: "2016～2019", text: "年代：2016～2019" },
          { type: "message", label: "2020～2023", text: "年代：2020～2023" },
          { type: "message", label: "2024～2025", text: "年代：2024～2025" },
        ],
      },
    },
  ];
}

function yearDicisionButtons1(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年にする？",
        actions: [
          { type: "message", label: "2000", text: "年：2000" },
          { type: "message", label: "2001", text: "年：2001" },
          { type: "message", label: "2002", text: "年：2002" },
          { type: "message", label: "2003", text: "年：2003" },
        ],
      },
    },
  ];
}

function yearDicisionButtons2(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年にする？",
        actions: [
          { type: "message", label: "2004", text: "年：2004" },
          { type: "message", label: "2005", text: "年：2005" },
          { type: "message", label: "2006", text: "年：2006" },
          { type: "message", label: "2007", text: "年：2007" },
        ],
      },
    },
  ];
}

function yearDicisionButtons3(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年にする？",
        actions: [
          { type: "message", label: "2008", text: "年：2008" },
          { type: "message", label: "2009", text: "年：2009" },
          { type: "message", label: "2010", text: "年：2010" },
          { type: "message", label: "2011", text: "年：2011" },
        ],
      },
    },
  ];
}

function yearDicisionButtons4(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年にする？",
        actions: [
          { type: "message", label: "2012", text: "年：2012" },
          { type: "message", label: "2013", text: "年：2013" },
          { type: "message", label: "2014", text: "年：2014" },
          { type: "message", label: "2015", text: "年：2015" },
        ],
      },
    },
  ];
}

function yearDicisionButtons5(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年にする？",
        actions: [
          { type: "message", label: "2016", text: "年：2016" },
          { type: "message", label: "2017", text: "年：2017" },
          { type: "message", label: "2018", text: "年：2018" },
          { type: "message", label: "2019", text: "年：2019" },
        ],
      },
    },
  ];
}

function yearDicisionButtons6(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年にする？",
        actions: [
          { type: "message", label: "2020", text: "年：2020" },
          { type: "message", label: "2021", text: "年：2021" },
          { type: "message", label: "2022", text: "年：2022" },
          { type: "message", label: "2023", text: "年：2023" },
        ],
      },
    },
  ];
}

function yearDicisionButtons7(): line.messagingApi.Message[] {
  return [
    {
      type: "template",
      altText: "じゃあ、歌う曲を決めよう",
      template: {
        type: "buttons",
        text: "どの年にする？",
        actions: [
          { type: "message", label: "2024", text: "年：2024" },
          { type: "message", label: "2025", text: "年：2025" },
        ],
      },
    },
  ];
}

// --- ジャンル日本語→キー変換マップ ---
const genreMap: Record<string, string> = {
  "ジャンル：JPOP": "Jpop",
  "ジャンル：ロック": "Rock",
  "ジャンル：アニメ": "Anime",
  "ジャンル：バラード": "Ballad",
  "ジャンル：アイドル": "Idol",
};

const eraButtonHandlers: Record<string, () => line.messagingApi.Message[]> = {
  "2000～2003": yearDicisionButtons1,
  "2004～2007": yearDicisionButtons2,
  "2008～2011": yearDicisionButtons3,
  "2012～2015": yearDicisionButtons4,
  "2016～2019": yearDicisionButtons5,
  "2020～2023": yearDicisionButtons6,
  "2024～2025": yearDicisionButtons7,
};


// --- 年→キー変換マップ ---
const yearMap: Record<string, string> = {
  "年：2000": "y2000",
  "年：2001": "y2001",
  "年：2002": "y2002",
  "年：2003": "y2003",
  "年：2004": "y2004",
  "年：2005": "y2005",
  "年：2006": "y2006",
  "年：2007": "y2007",
  "年：2008": "y2008",
  "年：2009": "y2009",
  "年：2010": "y2010",
  "年：2011": "y2011",
  "年：2012": "y2012",
  "年：2013": "y2013",
  "年：2014": "y2014",
  "年：2015": "y2015",
  "年：2016": "y2016",
  "年：2017": "y2017",
  "年：2018": "y2018",
  "年：2019": "y2019",
  "年：2020": "y2020",
  "年：2021": "y2021",
  "年：2022": "y2022",
  "年：2023": "y2023",
  "年：2024": "y2024",
  "年：2025": "y2025",
};

async function handleEvent(
  client: line.messagingApi.MessagingApiClient,
  event: line.WebhookEvent,
) {
  // --- 友だち追加 ---
  if (event.type === "follow") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: startMessages(),
    });
    return;
  }

  // --- グループ・ルーム招待 ---
  if (event.type === "join") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: startMessages(),
    });
    return;
  }

  // --- テキスト以外は無視 ---
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;
  const userId = event.source.userId || "unknown";

  // --- 「カラキン」と言われたら最初の案内 ---
  if (text === "カラキン") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: startMessages(),
    });
    return;
  }

// --- ①歌う順番の提案（最初の入り口） ---
  if (text === "①歌う順番の提案") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: orderTypeButtons(),
    });
    return;
  }

  // --- ランダムで決める（名前入力待ちへ） ---
  if (text === "ランダムで決める") {
    waitingForMembers[userId] = true;
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: "了解！参加者の名前をスペースで区切って入力してね！\n例: たろう じろう はなこ",
        },
      ],
    });
    return;
  }

  // --- 決め方を提案する ---
  if (text === "決め方を提案して") {
    const orderKeys = Object.keys(orderRules);
    const randomOrderTitle = orderKeys[Math.floor(Math.random() * orderKeys.length)];
    const orderDescription = orderRules[randomOrderTitle];

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `こんな順番の決め方はどうかな？\n\n【${randomOrderTitle}】\n${orderDescription}`,
        },
        { type: "text", text: "ほかにやってほしいことはある？" },
        ...standardButtons(),
      ],
    });
    return;
  }

  // --- 名前入力待ち状態のとき、ランダム順を返す ---
  if (waitingForMembers[userId]) {
    const members = text.trim().split(/\s+/);
    if (members.length === 0) {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "名前が入力されていないよ。もう一度入力してね。" }],
      });
      return;
    }

    const shuffled = members.sort(() => Math.random() - 0.5);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `今回の歌う順番はこんな感じでどうかな？\n\n${shuffled.join(" → ")}`,
        },
        {
          type: "text",
          text: "ほかにやってほしいことはある？",
        },
        ...standardButtons(),
      ],
    });

    waitingForMembers[userId] = false;
    return;
  }

  // --- 歌う曲の提案 ---
  if (text === "②歌う曲の提案") {
    songState[userId] = {};
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: "じゃあ、歌う曲を決めよう" },
        ...songButtons(),
      ],
    });
    return;
  }

  // --- ランダムで1曲決める (全ジャンル・全年代から) ---
  if (text === "ランダムで1曲決める") {
    // 1. 全ジャンル名（キー）の配列を取得
    const allGenreKeys = Object.keys(songs);
    
    // 2. ジャンルをランダムに1つ選択
    const randomGenreKey = allGenreKeys[Math.floor(Math.random() * allGenreKeys.length)];
    
    // 3. そのジャンルの曲リストを取得
    const selectedSongList = songs[randomGenreKey];
    
    // 4. 曲リストからランダムに1曲選択
    const randomSong = selectedSongList[Math.floor(Math.random() * selectedSongList.length)];

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `この曲はどうかな？\n\n🎵 ${randomSong}\n\n早速デンモクで予約しよう!!`,
        },
        { type: "text", text: "ほかにやってほしいことはある？" },
        ...standardButtons(),
      ],
    });
    return;
  }
  
  // --- 歌う曲の提案（ジャンル） ---
  if (text === "ジャンルから選ぶ") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: "じゃあ、ジャンルから決めよう" },
        ...genreButtons1(),
        ...genreButtons2(),
      ],
    });
    return;
  }

  // --- ジャンル選択 ---
  if (text.startsWith("ジャンル：")) {
    const genreKey = genreMap[text];
    if (!genreKey) return; // 無効なジャンルなら無視

    songState[userId] = { genre: genreKey };
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: `ジャンルは${text.replace("ジャンル：", "")}だね！` },
        ...songDecisionButtons(),
      ],
    });
    return;
  }

  // --- 1曲決定 ---
  if (text === "1曲に決める" && songState[userId]?.genre) {
    const genre = songState[userId].genre!;
    const song = songs[genre][Math.floor(Math.random() * songs[genre].length)];
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: `今回歌う曲はこれに決定！\n\n${song}\n\n早速デンモクで予約しよう!!` },
        { type: "text", text: "ほかにやってほしいことはある？" },
        ...standardButtons(),
      ],
    });
    delete songState[userId];
    return;
  }

  // --- 候補を出す ---
  if (text === "候補を出す" && songState[userId]?.genre) {
    const genre = songState[userId].genre!;
    const candidate = [...songs[genre]].sort(() => Math.random() - 0.5).slice(0, 3);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: `候補はこんな感じだよ:\n\n${candidate.join("\n")}` },
        ...songAfterCandidateButtons(), // ここで次の操作用ボタンを表示
      ],
    });
    return;
  }

  // --- 曲が決まった場合 ---
  if (text === "決まった") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: "そしたら早速デンモクで予約しよう!!\nほかにやってほしいことはある？" },
        ...standardButtons(), // 元の4択に戻す
      ],
    });
    delete songState[userId]; // 状態リセット
    return;
  }

  // --- 歌う曲の提案（年代） ---
  if (text === "年別ヒット曲から選ぶ") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: "じゃあ、年代から決めよう" },
        ...yearButtons1(),
        ...yearButtons2(),
      ],
    });
    return;
  }

  // --- 年選択 ---
  if (text.startsWith("年代：")) {
    const era = text.replace("年代：", "").trim();
    const handler = eraButtonHandlers[era];

    if (!handler) {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          { type: "text", text: "その年代はまだ対応していないよ💦" },
        ],
      });
      return;
    }

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: `${era}だね！` },
        ...handler(), // ★ ここで yearDicisionButtons7() が実行される
      ],
    });
    return;
  }

  // --- ジャンル決定 ---
  if (text.startsWith("年：")) {
    const yearKey = yearMap[text];
    if (!yearKey) return; // 無効な年なら無視

    songState[userId] = { genre: yearKey };
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: `${text.replace("年：", "")}年だね！` },
        ...songDecisionButtons(),
      ],
    });
    return;
  }

  // --- 遊び方の決定 ---
  if (text === "③遊び方の提案") {
    // 1. ルール名（キー）の配列を取得
    const ruleKeys = Object.keys(gameRules);
    
    // 2. ルール名をランダムに1つ選択
    const randomRuleTitle = ruleKeys[Math.floor(Math.random() * ruleKeys.length)];
    
    // 3. そのルール名に対応する説明文を取得
    const ruleDescription = gameRules[randomRuleTitle];

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `こんな遊び方はどうかな？！！\n\n【${randomRuleTitle}】\n${ruleDescription}`,
        },
        { type: "text", text: "ほかにやってほしいことはある？" },
        ...standardButtons(),
      ],
    });
    return;
  }

  if (text === "④カラキンの説明") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", 
          text:[
            "カラキンはカラオケを盛り上げるためのBotだよ！",
            "",
            "僕に指示をしてくれたら、歌う順番や歌う曲、遊び方を提案するよ。",
            "",
            "ひとりの時も、みんなでいるときも、困ったら僕を頼ってね！",
          ].join("\n"),
        },
        ...standardButtons(),
      ],
    });
    return;
  }
}

function main() {
  const channelSecret = env.CHANNEL_SECRET;
  const channelAccessToken = env.CHANNEL_ACCESS_TOKEN;
  assert(channelSecret && channelAccessToken);

  const client = new MessagingApiClient({ channelAccessToken });

  const app = express();
  app.post("/", line.middleware({ channelSecret }), (req, res) => {
    const { events } = req.body as { events: line.WebhookEvent[] };
    res.sendStatus(200);
    events.forEach((e) => handleEvent(client, e));
  });

  http.createServer(app).listen(21153, () => {
    console.log("ポート21153で起動しました");
  });
}

main();
