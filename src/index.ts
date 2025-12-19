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

type Reply = line.messagingApi.Message | line.messagingApi.Message[];

// ===== MVP: RoomIdなし（グローバル1進行） =====

// 「何番目のPhaseか」＋「Phase内で何を待っているか」だけを状態として持つ
type Step = "IDLE" | "AWAIT_ACK" | "AWAIT_CHOOSE" | "AWAIT_FINISH" | "ENDED";

let step: Step = "IDLE";
let phaseIndex = 0;        // phases の何番目を処理中か
let moreCounts: number[] = []; // phases[i] に対する「他の曲」回数

function ensureMoreCountsSize(n: number) {
  while (moreCounts.length < n) moreCounts.push(0);
}

function resetFlow() {
  step = "IDLE";
  phaseIndex = 0;
  moreCounts = [];
}

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

// ===== Phase定義（ここを配列で増やしていく） =====

type Phase = {
  // ルール本文（あなたが編集する想定）
  descriptionLines: string[];

  // 順番/ペアなど（任意）
  orderLines?: string[];

  // 最後に出す促し文（任意に編集）
  choosePrompt: string;

  // 「他の曲」ローテ用候補プール
  songPools: string[][];
};

const phases: Phase[] = [
  {
    descriptionLines: [
      "最初は、、、",
      "みんなで1曲歌おう！",
      "",
      "この3曲の中から歌う曲をえらんでね",
    ],
    choosePrompt: "曲は決まったかな？\n「決まった！」「他の曲を教えて」",
    songPools: [
      ["キセキ", "新宝島", "さくらんぼ"],
      ["小さな恋のうた", "前前前世", "残酷な天使のテーゼ"],
    ],
  },
  {
    descriptionLines: [
      "いい歌いっぱいだったね！",
      "",
      "次は、、、",
      "それぞれ1曲ずつ歌おう！",
      "",
      "「点数勝負（小数点以下）」をしよう。",
      "採点の点数で小数点以下の数字が大きいほうが勝ちだよ",
      "たとえば、87.621 と 89.199 だったら、87.621 の勝ちだよ！",
    ],
    // 順番は必要ならここに書く（任意）
    // orderLines: ["1 おのちゃん", "2 てつお", "3 りょうせい"],
    choosePrompt: "曲は決まったかな？\n「決まった！」「他の曲を教えて」",
    songPools: [
      ["シンデレラボーイ", "ライラック", "怪獣の花唄"],
      ["怪獣のはなうた", "Lemon", "マリーゴールド"],
      ["睡蓮花", "マツケンサンバ", "アンパンマンマーチ"],
    ],
  },
  {
    descriptionLines: [
      "いい歌いっぱいだったね！",
      "",
      "次は、、、",
      "ペアを組んで1曲ずつ歌おう！",
    ],
    // ペアや順番（任意）
    orderLines: ["① A＆B", "② C＆D"],
    choosePrompt: "曲は決まったかな？\n「決まった！」「他の曲を教えて」",
    songPools: [
      ["シンデレラボーイ", "ライラック", "怪獣の花唄"],
      ["さよならエレジー", "チェリー", "世界が終るまでは…"],
    ],
  },
];

// ===== 文言テンプレ =====
// ボタン生成関数
function renderSongButtons(question: string, songs: string[]): line.messagingApi.TemplateMessage {
  const actions = songs.slice(0, 4).map((s) => ({
    type: "message" as const,
    label: s.length > 20 ? s.slice(0, 20) : s,
    text: s,
  }));
  return {
    type: "template",
    altText: `${question} ${songs.join(" / ")}`,
    template: {
      type: "buttons",
      text: question,
      actions,
    },
  };
}

function pickSongs(phase: Phase, moreCount: number): string[] {
  const idx = Math.min(moreCount, phase.songPools.length - 1);
  return phase.songPools[idx];
}

//String→Messageに変換するヘルパー
function textMsg(text: string): line.messagingApi.Message {
  return { type: "text", text };
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

function renderChoose(phase: Phase, songs: string[]): Reply {
  const lines: string[] = [];
  lines.push(...phase.descriptionLines);
  lines.push("");

  if (phase.orderLines && phase.orderLines.length > 0) {
    lines.push("順番はこれだよ");
    lines.push(...phase.orderLines);
    lines.push("");
  }

  // ① ルール説明はテキスト
  const ruleText: line.messagingApi.Message = {
    type: "text",
    text: lines.join("\n"),
  };

  // ② 曲選択はボタン（最大4件）
  const buttons = renderSongButtons("次は何を歌いますか？", songs);

  // ③ 促しはテキスト（「決まった！」「他の曲を教えて」等）
  const promptText: line.messagingApi.Message = {
    type: "text",
    text: phase.choosePrompt,
  };

  return [ruleText, buttons, promptText];
}

function renderReserve(): string {
  return [
    "早速デンモクで予約しよう！",
    "",
    "全員歌い終わったら誰か一人が「おわった」って言ってね",
  ].join("\n");
}

function renderEnd(): string {
  return [
    "またいっしょに遊びたいときは「カラキン」って呼んでね",
    "",
    "また会おうぜ",
  ].join("\n");
}

function renderUnknown(): string {
  switch (step) {
    case "AWAIT_ACK":
      return "今は「わかった」って言ってね";
    case "AWAIT_CHOOSE":
      return "今は「決まった！」か「他の曲を教えて」を送ってね";
    case "AWAIT_FINISH":
      return "歌い終わったら「おわった」って言ってね";
    default:
      return "始めるときは「カラキン」って呼んでね";
  }
}

/**
 * MVP版 createReply：RoomIdなし（グローバル状態のみ）
 * Phaseは配列 phases を増やすだけで拡張可能
 * 末尾Phaseが終わったら終了（あなたの指定：選択肢2）
 */
function createReply(message: string): Reply | undefined {
  const intent = detectIntent(message);

  // 共通終了
  if (intent === "EXIT") {
    step = "ENDED";
    return textMsg(renderEnd());
  }

  // 開始（IDLE/ENDEDのみ）
  if ((step === "IDLE" || step === "ENDED") && intent === "START") {
    step = "AWAIT_ACK";
    phaseIndex = 0;
    moreCounts = [];
    return textMsg(renderStart());
  }

  // 以降、ステップごとに処理
  if (step === "AWAIT_ACK") {
    if (intent !== "ACK") return textMsg(renderUnknown());
    step = "AWAIT_CHOOSE";
    ensureMoreCountsSize(phases.length);
    const phase = phases[phaseIndex];
    return renderChoose(phase, pickSongs(phase, moreCounts[phaseIndex]));
  }

if (step === "AWAIT_CHOOSE") {
  ensureMoreCountsSize(phases.length);
  const phase = phases[phaseIndex];
  const currentSongs = pickSongs(phase, moreCounts[phaseIndex]);

  if (intent === "MORE") {
    moreCounts[phaseIndex] += 1;
    return renderChoose(phase, pickSongs(phase, moreCounts[phaseIndex]));
  }

  // ★追加：ボタンで送信された「曲名」を決定扱いにする
  const norm = normalize(message);
  const isSongSelected = currentSongs.some((s) => normalize(s) === norm);
  if (isSongSelected) {
    step = "AWAIT_FINISH";
    return textMsg(renderReserve());
  }

  if (intent === "DECIDED") {
    step = "AWAIT_FINISH";
    return textMsg(renderReserve());
  }

  return textMsg(renderUnknown());
}

  if (step === "AWAIT_FINISH") {
    if (intent !== "FINISHED") return textMsg(renderUnknown());

    // 次のPhaseへ
    phaseIndex += 1;

    // 末尾まで行ったら終了（選択肢2）
    if (phaseIndex >= phases.length) {
      step = "ENDED";
      return textMsg(renderEnd());
    }

    step = "AWAIT_CHOOSE";
    ensureMoreCountsSize(phases.length);
    const nextPhase = phases[phaseIndex];
    return renderChoose(nextPhase, pickSongs(nextPhase, moreCounts[phaseIndex]));
  }

  return textMsg(renderUnknown());
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
      const messages = Array.isArray(reply) ? reply : [reply];
      await client.replyMessage({
        replyToken: event.replyToken,
        messages,
      });
      console.log(`メッセージ「${event.message.text}」に返信しました`);
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
