import * as line from "@line/bot-sdk";
import assert from "assert";
import express from "express";
import http from "node:http";
import { env } from "process";

/**
 * グループに入った時に送られる挨拶
 */
const GREETING =
  '参加ありがとう！はじめるときは「カラキン」って送ってね（やめるときは「カラキンばいばい」）';

type FlowState =
  | "IDLE"
  | "AWAIT_ACK"
  | "AWAIT_SONG_DECISION_1"
  | "AWAIT_FINISH_1"
  | "AWAIT_SONG_DECISION_2"
  | "AWAIT_FINISH_2"
  | "AWAIT_SONG_DECISION_3"
  | "AWAIT_FINISH_3"
  | "ENDED";

let state: FlowState = "IDLE";
let moreSongsCount1 = 0;
let moreSongsCount2 = 0;
let moreSongsCount3 = 0;


function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "")
    .replace(/[！!]+/g, "!")
    .replace(/[。．.]+/g, "")
    .toLowerCase();
}

type Intent = "START" | "ACK" | "DECIDED" | "MORE" | "FINISHED" | "EXIT" | "UNKNOWN";

function detectIntent(message: string): Intent {
  const m = normalize(message);

  if (m === "カラキン" || m === "からきん") return "START";
  if (m === "カラキンばいばい" || m === "からきんばいばい") return "EXIT";

  if (m === "わかった" || m === "了解" || m === "りょうかい" || m === "ok") return "ACK";

  if (m === "決まった" || m === "決まった!") return "DECIDED";

  if (
    m === "他の曲を教えて" ||
    m === "ほかの曲を教えて" ||
    m === "他の曲" ||
    m === "ほかの曲"
  )
    return "MORE";

  if (m === "おわった" || m === "終わった" || m === "終了" || m === "しゅうりょう")
    return "FINISHED";

  return "UNKNOWN";
}

const pool1 = [
  ["キセキ", "新宝島", "さくらんぼ"],
  ["小さな恋のうた", "前前前世", "残酷な天使のテーゼ"],
];

const pool2 = [
  ["シンデレラボーイ", "ライラック", "怪獣の花唄"],
  ["怪獣のはなうた", "Lemon", "マリーゴールド"],
  ["睡蓮花", "マツケンサンバ", "アンパンマンマーチ"],
];

const pool3 = [
  ["シンデレラボーイ", "ライラック", "怪獣の花唄"],
  ["さよならエレジー", "チェリー", "世界が終るまでは…"],
];

function pick(pool: string[][], count: number): string[] {
  const idx = Math.min(count, pool.length - 1);
  return pool[idx];
}

function renderStart(): string {
  return [
    "やっほー！カラキンだよー！",
    "",
    "ぼくが決めたルールで、みんなでカラオケで盛り上がろう！！",
    "飽きた時は「カラキンばいばい」って言ってね",
    "",
    "わかったかな？",
    "（「わかった」って言ってください）",
  ].join("\n");
}

function renderPhase1Choose(songs: string[]): string {
  return [
    "最初は、、、",
    "みんなで1曲歌おう！",
    "",
    "この3曲の中から歌う曲をえらんでね",
    ...songs.map((s) => `・${s}`),
    "",
    "曲は決まったかな？",
    "「決まった！」「他の曲を教えて」",
  ].join("\n");
}

function renderReserve(): string {
  return [
    "早速デンモクで予約しよう！",
    "",
    "全員歌い終わったら誰か一人が「おわった」って言ってね",
  ].join("\n");
}

function renderPhase2Choose(songs: string[]): string {
  return [
    "いい歌いっぱいだったね！",
    "",
    "次は、、、",
    "それぞれ1曲ずつ歌おう！",
    "",
    "「点数勝負（小数点以下）」をしよう。",
    "採点の点数で小数点以下の数字が大きいほうが勝ちだよ",
    "たとえば、87.621 と 89.199 だったら、87.621 の勝ちだよ！",
    "",
    "例えはこんな曲はどうかな？",
    ...songs.map((s) => `・${s}`),
    "",
    "曲は決まったかな？",
    "「決まった！」「他の曲を教えて」",
  ].join("\n");
}

function renderPhase3Choose(songs: string[]): string {
  return [
    "いい歌いっぱいだったね！",
    "",
    "次は、、、",
    "ペアを組んで1曲ずつ歌おう！",
    "",
    "ペアと順番はこれだよ",
    "① A＆B",
    "② C＆D",
    "",
    "たとえばこんな曲はどうかな？",
    ...songs.map((s) => `・${s}`),
    "",
    "曲は決まったかな？",
    "「決まった！」「他の曲を教えて」",
  ].join("\n");
}

function renderEnd(): string {
  return ["またいっしょに遊びたいときは「カラキン」って呼んでね", "", "また会おうぜ"].join("\n");
}

function renderUnknown(): string {
  switch (state) {
    case "AWAIT_ACK":
      return "今は「わかった」って言ってね";
    case "AWAIT_SONG_DECISION_1":
    case "AWAIT_SONG_DECISION_2":
    case "AWAIT_SONG_DECISION_3":
      return "今は「決まった！」か「他の曲を教えて」を送ってね";
    case "AWAIT_FINISH_1":
    case "AWAIT_FINISH_2":
    case "AWAIT_FINISH_3":
      return "歌い終わったら「おわった」って言ってね";
    default:
      return "始めるときは「カラキン」って呼んでね";
  }
}

/**
 * MVP版 createReply：RoomIdなし（グローバル状態のみ）
 */
function createReply(message: string): string | undefined {
  const intent = detectIntent(message);

  // 共通終了
  if (intent === "EXIT") {
    state = "ENDED";
    return renderEnd();
  }

  // 開始（IDLE/ENDEDのみ）
  if ((state === "IDLE" || state === "ENDED") && intent === "START") {
    state = "AWAIT_ACK";
    moreSongsCount1 = 0;
    moreSongsCount2 = 0;
    moreSongsCount3 = 0;
    return renderStart();
  }

  switch (state) {
    case "AWAIT_ACK": {
      if (intent !== "ACK") return renderUnknown();
      state = "AWAIT_SONG_DECISION_1";
      return renderPhase1Choose(pick(pool1, moreSongsCount1));
    }

    case "AWAIT_SONG_DECISION_1": {
      if (intent === "MORE") {
        moreSongsCount1 += 1;
        return renderPhase1Choose(pick(pool1, moreSongsCount1));
      }
      if (intent === "DECIDED") {
        state = "AWAIT_FINISH_1";
        return renderReserve();
      }
      return renderUnknown();
    }

    case "AWAIT_FINISH_1": {
      if (intent !== "FINISHED") return renderUnknown();
      state = "AWAIT_SONG_DECISION_2";
      return renderPhase2Choose(pick(pool2, moreSongsCount2));
    }

    case "AWAIT_SONG_DECISION_2": {
      if (intent === "MORE") {
        moreSongsCount2 += 1;
        return renderPhase2Choose(pick(pool2, moreSongsCount2));
      }
      if (intent === "DECIDED") {
        state = "AWAIT_FINISH_2";
        return renderReserve();
      }
      return renderUnknown();
    }

    case "AWAIT_FINISH_2": {
      if (intent !== "FINISHED") return renderUnknown();
      state = "AWAIT_SONG_DECISION_3";
      return renderPhase3Choose(pick(pool3, moreSongsCount3));
    }

    case "AWAIT_SONG_DECISION_3": {
      if (intent === "MORE") {
        moreSongsCount3 += 1;
        return renderPhase3Choose(pick(pool3, moreSongsCount3));
      }
      if (intent === "DECIDED") {
        state = "AWAIT_FINISH_3";
        return renderReserve();
      }
      return renderUnknown();
    }

    case "AWAIT_FINISH_3": {
      if (intent !== "FINISHED") return renderUnknown();
      state = "ENDED";
      return renderEnd();
    }

    default:
      return renderUnknown();
  }
}

const { MessagingApiClient } = line.messagingApi;

async function handleEvent(
  client: line.messagingApi.MessagingApiClient,
  event: line.WebhookEvent,
): Promise<void> {
  if (event.type === "join") {
    if (event.source.type === "group" || event.source.type === "room") {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: GREETING }],
      });
      console.log("グループに参加しました");
    }
  } else if (event.type === "message" && event.message.type === "text") {
    const reply = createReply(event.message.text);
    if (reply !== undefined) {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: reply }],
      });
      console.log(
        `メッセージ「${event.message.text}」に「${reply}」と返信しました`,
      );
    } else {
      console.log(`メッセージ「${event.message.text}」を無視しました`);
    }
  }
}

function main(): void {
  const channelSecret = env.CHANNEL_SECRET;
  const channelAccessToken = env.CHANNEL_ACCESS_TOKEN;
  assert(channelSecret !== undefined && channelAccessToken !== undefined);
  const port = 21153;

  const client = new MessagingApiClient({ channelAccessToken });

  const app = express();
  app.post("/", line.middleware({ channelSecret }), (req, res) => {
    // The middleware takes care of parsing the request body
    const { events } = req.body as { events: line.WebhookEvent[] };
    res.sendStatus(200);
    for (const event of events) {
      handleEvent(client, event).catch((err) => console.error(err));
    }
  });
  const httpServer = http.createServer(app);
  httpServer.listen({ port }, () =>
    console.log(`ポート${port}でサーバーを起動しました`),
  );
}

main();
