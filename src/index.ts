import * as line from "@line/bot-sdk";
import express from "express";
import http from "node:http";
import { env } from "process";
import { JSONFilePreset } from 'lowdb/node';

import { songs } from "./songs.js";
import { gameRules, orderRules } from "./rules.js";

const { MessagingApiClient } = line.messagingApi;

// --- 1. データベース・状態の型定義 ---
type UserData = {
  userId: string;
  displayName: string;
  mySongs: string[];
  isRegisteringSong?: boolean; 
};

interface GroupData {
  groupId: string;
  memberIds: string[];
  memberNames: string[];
  isRegistering: boolean;
  lastOrder?: string;
  lastTeams?: string[][]; // ★追加：[['ID1', 'ID2'], ['ID3', 'ID4', 'ID5']] の形式で保存
}

type Data = { users: UserData[]; groups: GroupData[]; };
const defaultData: Data = { users: [], groups: [] };

interface TempState { genreKey?: string; }
const tempStates: Record<string, TempState> = {};

interface TempState {
  genreKey?: string;
  searchCache?: any[]; // 検索結果50件を保存する場所
  lastQuery?: string;  // 今何のワードで検索しているか
}

// --- 2. ユーティリティ ---
function getStateKey(event: line.WebhookEvent): string {
  const source = event.source;
  if ("groupId" in source) return source.groupId;
  if ("userId" in source) return source.userId || "unknown";
  return "unknown";
}

async function searchSongs(query: string) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=jp&lang=ja_jp&media=music&limit=50`;
    const response = await fetch(url);
    const data: any = await response.json();
    return data.results.map((track: any) => ({
      fullName: `${track.trackName} / ${track.artistName}`,
      trackName: track.trackName, 
      artistName: track.artistName
    }));
  } catch (e) { return []; }
}

// --- 3. メッセージ・ボタンテンプレート群 ---
function startMessages(): line.messagingApi.Message[] {
  return [
    { type: "text", text: "カラキンだよ！歌う順番や曲を提案して、カラオケを盛り上げるよ！🎵" },
    { type: "text", text: "⚠️カラキンを使うためには、メンバーみんなが”カラキン”を友だち登録していないといけないよ！！" },
    { type: "template", altText: "メインメニュー", template: { type: "buttons", text: "友だち登録が済んだら、まずはメニューを選んでね", actions: [
      { type: "message", label: "⚙️ メニューを表示", text: "メニュー" },
      { type: "message", label: "カラキンの説明", text: "カラキンの説明" },
    ]}}
  ];
}

function songDecisionButtons(): line.messagingApi.Message[] { return [{ type: "template", altText: "決定", template: { type: "buttons", text: "どうする？", actions: [{ type: "message", label: "1曲に決める", text: "1曲に決める" }, { type: "message", label: "候補を出す", text: "候補を出す" }] } }]; }
function songAfterCandidateButtons(): line.messagingApi.Message[] { return [{ type: "template", altText: "候補", template: { type: "buttons", text: "どうかな？", actions: [{ type: "message", label: "もう一度候補", text: "候補を出す" }, { type: "message", label: "1曲に決める", text: "1曲に決める" }, { type: "message", label: "決まった", text: "決まった" }] } }]; }
function genreButtons1(): line.messagingApi.Message[] { return [{ type: "template", altText: "G1", template: { type: "buttons", text: "どのジャンルにする？", actions: [{ type: "message", label: "JPOP", text: "ジャンル：JPOP" }, { type: "message", label: "ロック", text: "ジャンル：ロック" }, { type: "message", label: "アニメ", text: "ジャンル：アニメ" }, { type: "message", label: "他...", text: "ジャンル選択(他)" }] } }]; }
function genreButtons2(): line.messagingApi.Message[] { return [{ type: "template", altText: "G2", template: { type: "buttons", text: "他には...", actions: [{ type: "message", label: "バラード", text: "ジャンル：バラード" }, { type: "message", label: "アイドル", text: "ジャンル：アイドル" }] } }]; }
function yearButtons1(): line.messagingApi.Message[] { return [{ type: "template", altText: "Y1", template: { type: "buttons", text: "どの時代？(1/2)", actions: [{ type: "message", label: "2000-2003", text: "年代：2000～2003" }, { type: "message", label: "2004-2007", text: "年代：2004～2007" }, { type: "message", label: "2008-2011", text: "年代：2008～2011" }, { type: "message", label: "2012-2015", text: "年代：2012～2015" }] } }]; }
function yearButtons2(): line.messagingApi.Message[] { return [{ type: "template", altText: "Y2", template: { type: "buttons", text: "どの時代？(2/2)", actions: [{ type: "message", label: "2016-2019", text: "年代：2016～2019" }, { type: "message", label: "2020-2023", text: "年代：2020～2023" }, { type: "message", label: "2024-2025", text: "年代：2024～2025" }] } }]; }

// --- 4. マッピングデータ ---
const genreMap: Record<string, string> = { "ジャンル：JPOP": "Jpop", "ジャンル：ロック": "Rock", "ジャンル：アニメ": "Anime", "ジャンル：バラード": "Ballad", "ジャンル：アイドル": "Idol" };
const yearMap: Record<string, string> = {};
for (let y = 2000; y <= 2025; y++) { yearMap[`年：${y}`] = `y${y}`; }

const eraButtonHandlers: Record<string, () => line.messagingApi.Message[]> = {
  "2000～2003": () => [{ type: "template", altText: "選", template: { type: "buttons", text: "どの年？", actions: [{ type: "message", label: "2000", text: "年：2000" }, { type: "message", label: "2001", text: "年：2001" }, { type: "message", label: "2002", text: "年：2002" }, { type: "message", label: "2003", text: "年：2003" }] } }],
  "2004～2007": () => [{ type: "template", altText: "選", template: { type: "buttons", text: "どの年？", actions: [{ type: "message", label: "2004", text: "年：2004" }, { type: "message", label: "2005", text: "年：2005" }, { type: "message", label: "2006", text: "年：2006" }, { type: "message", label: "2007", text: "年：2007" }] } }],
  "2008～2011": () => [{ type: "template", altText: "選", template: { type: "buttons", text: "どの年？", actions: [{ type: "message", label: "2008", text: "年：2008" }, { type: "message", label: "2009", text: "年：2009" }, { type: "message", label: "2010", text: "年：2010" }, { type: "message", label: "2011", text: "年：2011" }] } }],
  "2012～2015": () => [{ type: "template", altText: "選", template: { type: "buttons", text: "どの年？", actions: [{ type: "message", label: "2012", text: "年：2012" }, { type: "message", label: "2013", text: "年：2013" }, { type: "message", label: "2014", text: "年：2014" }, { type: "message", label: "2015", text: "年：2015" }] } }],
  "2016～2019": () => [{ type: "template", altText: "選", template: { type: "buttons", text: "どの年？", actions: [{ type: "message", label: "2016", text: "年：2016" }, { type: "message", label: "2017", text: "年：2017" }, { type: "message", label: "2018", text: "年：2018" }, { type: "message", label: "2019", text: "年：2019" }] } }],
  "2020～2023": () => [{ type: "template", altText: "選", template: { type: "buttons", text: "どの年？", actions: [{ type: "message", label: "2020", text: "年：2020" }, { type: "message", label: "2021", text: "年：2021" }, { type: "message", label: "2022", text: "年：2022" }, { type: "message", label: "2023", text: "年：2023" }] } }],
  "2024～2025": () => [{ type: "template", altText: "選", template: { type: "buttons", text: "どの年？", actions: [{ type: "message", label: "2024", text: "年：2024" }, { type: "message", label: "2025", text: "年：2025" }] } }],
};

// --- 5. メインハンドラー ---
async function handleEvent(client: line.messagingApi.MessagingApiClient, event: line.WebhookEvent, db: any) {
  const stateKey = getStateKey(event);
  const currentState = tempStates[stateKey] || (tempStates[stateKey] = {});

  // A. 自動挨拶イベント
  if (event.type === "follow" || event.type === "join") {
    return client.replyMessage({ replyToken: event.replyToken, messages: startMessages() });
  }

  // B. ポストバック（検索結果の登録）
  if (event.type === "postback") {
    const userId = event.source.userId!;
    const songData = event.postback.data; 
    const userData = db.data.users.find((u: UserData) => u.userId === userId);
    
    // --- 【追加】すでに登録済みのボタンが押された場合 (ignore) ---
    if (songData === "ignore") {
      const query = currentState.lastQuery || "検索結果";
      const currentIndex = (currentState as any).currentIndex || 0;
      // キャッシュから現在の5件を取得
      const displaySongs = currentState.searchCache?.slice(currentIndex, currentIndex + 5) || [];

      // 再表示用のFlexアイテム作成（handleEvent内のロジックと同じ）
      const songItems = displaySongs.map((c: any) => {
        const isAdded = userData?.mySongs.includes(c.fullName);
        return {
          type: "box", layout: "horizontal", margin: "lg", contents: [
            { type: "box", layout: "vertical", flex: 4, contents: [
              { type: "text", text: c.trackName, weight: "bold", wrap: true, color: isAdded ? "#aaaaaa" : "#000000" },
              { type: "text", text: c.artistName, size: "xs", color: "#888888" }
            ]},
            { 
              type: "button", style: isAdded ? "secondary" : "primary", height: "sm", flex: 2,
              action: { 
                type: "postback", 
                label: isAdded ? "登録済" : "登録", 
                data: isAdded ? "ignore" : `save:${c.fullName}`,
                displayText: isAdded ? `「${c.fullName}」を登録！` : `✅ ${c.fullName} を登録！`
              }
            }
          ]
        };
      });

      const footerContents = [];
      if (currentState.searchCache && (currentIndex + 5) < currentState.searchCache.length) {
        footerContents.push({ type: "separator", margin: "xl" });
        footerContents.push({
          type: "button", style: "secondary", margin: "md",
          action: { type: "message", label: "🔍 次の5曲を表示", text: "次の5曲を表示" }
        });
      }

      const getRegMenu = (infoText: string): line.messagingApi.Message[] => [
        { type: "text", text: infoText },
        { type: "template", altText: "登録中メニュー",
          template: {
            type: "buttons", text: "リストの操作や確認はこちらから",
            actions: [
              { type: "message", label: "↩️ 直前の一曲消す", text: "一曲消す" },
              { type: "message", label: "📋 リスト確認", text: "リスト確認" },
              { type: "message", label: "✅ 登録終了", text: "登録終了" },
            ]
          }
        }
      ];

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          { type: "text", text: `⚠️その曲は、すでに登録済みだよ！` },
          {
            type: "flex", altText: "検索結果の再表示",
            contents: {
              type: "bubble",
              body: {
                type: "box", layout: "vertical",
                contents: [
                  { type: "text", text: `🎵 ${query} (${currentIndex + 1}〜${currentIndex + 5}位)`, weight: "bold", size: "md", color: "#1DB954" },
                  ...songItems as any,
                  ...footerContents as any
                ]
              }
            }
          },
          ...getRegMenu("お目当ての曲はあるかな？")
        ]
      });
    }

  
    //曲の保存処理
    if (songData.startsWith("save:")) {
      const target = songData.replace("save:", "");
      let isDuplicate = false; // ★ 重複フラグ

      await db.update((data: Data) => {
        let user = data.users.find((u: UserData) => u.userId === userId);
        if (user) {
          if (user.mySongs.includes(target)) {
            isDuplicate = true; // ★ すでにある場合はフラグを立てる
          } else {
            user.mySongs.push(target);
          }
        }
      });

      // --- 重複していた場合の返信 ---
      if (isDuplicate) {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            { type: "text", text: `⚠️「${target}」はすでにマイリストに入っているよ！` },
            {
              type: "template",
              altText: "登録中メニュー",
              template: {
                type: "buttons",
                text: "続けて登録するか、操作を選んでね",
                actions: [
                  { type: "message", label: "↩️ 直前の一曲消す", text: "一曲消す" },
                  { type: "message", label: "📋 リスト確認", text: "リスト確認" },
                  { type: "message", label: "✅ 登録終了", text: "登録終了" },
                ]
              }
            }
          ]
        });
      }

      // --- 成功時の出し分け判定 ---
      const isGroupPostback = event.source.type !== "user";

      if (isGroupPostback) {
        //グループチャットで登録ボタンが押されたとき
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: `✅ ${target} を登録したよ！` }]
        });
      } else {
        //個人チャットで登録ボタンが押されたとき
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            { type: "text", text: `✅「${target}」を登録したよ！` },
            {
              type: "template",
              altText: "登録中メニュー",
              template: {
                type: "buttons",
                text: "続けて登録するか、操作を選んでね",
                actions: [
                  { type: "message", label: "↩️ 直前の一曲消す", text: "一曲消す" },
                  { type: "message", label: "📋 リスト確認", text: "リスト確認" },
                  { type: "message", label: "✅ 登録終了", text: "登録終了" },
                ]
              }
            }
          ]
        });
      }
    }

    const getMyListMenu = (): line.messagingApi.Message[] => [{
      type: "template",
      altText: "マイリスト管理メニュー",
      template: {
        type: "buttons",
        text: "マイリスト管理",
        actions: [
          { type: "message", label: "📋 リストを確認する", text: "マイリスト確認" },
          { type: "message", label: "✂️ リストを編集する", text: "マイリスト編集" },
          { type: "message", label: "🏠 戻る", text: "メニュー" }
        ]
      }
    }];

    // --- 削除処理 ---
    if (songData.startsWith("delete:")) {
      const target = songData.replace("delete:", "");
      
      await db.update((data: Data) => {
        const u = data.users.find((x: UserData) => x.userId === userId);
        if (u) {
          // targetと一致しない曲だけを残す（＝targetを消す）
          u.mySongs = u.mySongs.filter((song: string) => song !== target);
        }
      });

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `🗑️「${target}」をリストから削除したよ。` }, ...getMyListMenu()]
      });
    }

    return;
  }

  // C. メッセージ判定
  if (event.type !== "message" || event.message.type !== "text") return;
  const text = event.message.text.trim();
  const isGroup = event.source.type !== "user";
  const groupData = db.data.groups.find((g: any) => g.groupId === stateKey);
  const userId = event.source.userId!;
  const userData = db.data.users.find((u: UserData) => u.userId === userId);



  // ----------------------------------------
  // --- グループ専用ロジック ---
  // ----------------------------------------
  if (isGroup) {
    const getGroupMainMenu = (): line.messagingApi.Message[] => [{
      type: "template", altText: "グループメニュー",
      template: {
        type: "buttons", text: "【グループメニュー】\nみんなで楽しもう！",
        actions: [
          { type: "message", label: "⚙️ メンバー管理", text: "メンバー管理" },
          { type: "message", label: "🎤 順番の提案、確認", text: "順番の提案、確認" },
          { type: "message", label: "🎵 共通曲の提案", text: "共通曲の提案" }, // 既存のロジックへ
          { type: "message", label: "🎮 遊び方の提案", text: "遊び方の提案" }, // 既存のロジックへ
        ]
      }
    }];

    const getMemberAdminMenu = (info: string): line.messagingApi.Message[] => [
      { type: "text", text: info },
      { type: "template", altText: "管理メニュー",
        template: {
          type: "buttons", text: "メンバー管理",
          actions: [
            { type: "message", label: "👥 登録（開始）", text: "メンバー登録を開始" },
            { type: "message", label: "👀 メンバー確認", text: "登録状況を確認" },
            { type: "message", label: "♻️ リセット", text: "メンバーリセット" },
            { type: "message", label: "↩️ 戻る", text: "メニュー" },
          ]
        }
      }
    ];

    const getOrderMenu = (): line.messagingApi.Message[] => [{
      type: "template", altText: "順番メニュー",
      template: {
        type: "buttons", text: "順番の提案・確認",
        actions: [
          { type: "message", label: "👤 ひとりで歌う", text: "ソロ順番提案" },
          { type: "message", label: "👫 ペアで歌う", text: "ペア順番提案" },
          { type: "message", label: "👀 今の順番を確認", text: "今の順番を確認" }, // ★追加
          { type: "message", label: "↩️ 戻る", text: "メニュー" },
        ]
      }
    }];

    // --- ルート判定 ---
    if (["カラキン", "メニュー", "管理終了", "戻る"].includes(text)) {
      // ✅ ここで登録モードをOFFにする
      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) g.isRegistering = false;
      });
      return client.replyMessage({ replyToken: event.replyToken, messages: getGroupMainMenu() });
    }

    // --- 1. メンバー管理 階層 ---
    if (text === "メンバー管理") {
      return client.replyMessage({ replyToken: event.replyToken, messages: getMemberAdminMenu("メンバーの追加や確認ができます。") });
    }

    // 「登録を開始」を「追加受付」の挙動に変更
    if (text === "メンバー登録を開始") {
      let currentNames: string[] = [];
      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          // ★ここから [] (空にする処理) を削除しました
          g.isRegistering = true; 
          currentNames = g.memberNames;
        } else {
          data.groups.push({ groupId: stateKey, memberIds: [], memberNames: [], isRegistering: true });
        }
      });
      
      const info = currentNames.length > 0 
        ? `【追加受付中】\n現在のメンバー：${currentNames.join("、")}\n\nさらに追加する人はスタンプを送ってね！`
        : "【新規受付中】コメントを送った人を登録するよ！";

      return client.replyMessage({ replyToken: event.replyToken, messages: getMemberAdminMenu(info) });
    }

    // 現在のメンバー確認
    if (text === "登録状況を確認") {
      const names = groupData?.memberNames || [];
      const listText = names.length > 0 ? names.join("、") : "まだ誰も登録されていません。";
      
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "flex",
          altText: "メンバー確認",
          contents: {
            type: "bubble",
            body: {
              type: "box", layout: "vertical", contents: [
                { type: "text", text: "👀 現在の登録メンバー", weight: "bold", size: "lg", color: "#1DB954" },
                { type: "separator", margin: "md" },
                { type: "text", text: `${names.length} 名：`, margin: "md", size: "sm", color: "#888888" },
                { type: "text", text: listText, margin: "sm", wrap: true, size: "md" },
                { type: "button", style: "primary", margin: "xl", color: "#1DB954", action: { type: "message", label: "✅ メニューに戻る", text: "メニュー" } }
              ]
            }
          }
        }]
      });
    }

    // メンバーリセット（空にしたい時だけ明示的に使う）
    if (text === "メンバーリセット") {
      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          g.memberIds = [];
          g.memberNames = [];
          g.isRegistering = false; // リセット時は受付も終了する
        }
      });
      return client.replyMessage({ replyToken: event.replyToken, messages: getMemberAdminMenu("メンバーをリセットしました。") });
    }

    // --- 登録（追加）中の自動受付ロジック ---
    // --- 登録（追加）中の自動受付ロジック ---
    if (groupData?.isRegistering && !["メンバー登録を開始", "登録状況を確認", "メンバーリセット", "メニュー"].includes(text)) {
        let profile;
        try {
          // ★ プロフィール取得を試みる
          profile = await client.getProfile(userId);
        } catch (error) {
          // ★ 友達登録していない場合、ここでエラーをキャッチして警告を出す
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ 
              type: "text", 
              text: "⚠️ メンバー登録ができなかったよ！\n\nカラキン を「追加（友達登録）」してから、もう一度メッセージを送ってね！" 
            }]
          });
        }

        // --- 以下、友達登録されている場合の正常処理 ---
        let updatedNames: string[] = [];
        let isNew = false;

        await db.update((data: Data) => {
          let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
          // profile.displayName を安全に使用
          if (g && !g.memberIds.includes(userId)) {
            g.memberIds.push(userId); 
            g.memberNames.push(profile.displayName);
            isNew = true;
          }
          if (g) updatedNames = g.memberNames;
        });

        if (isNew) {
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
              type: "flex",
              altText: "メンバー更新",
              contents: {
                type: "bubble",
                body: {
                  type: "box", layout: "vertical", contents: [
                    { type: "text", text: "👥 メンバー追加完了", weight: "bold", size: "lg", color: "#1DB954" },
                    { type: "separator", margin: "md" },
                    { type: "text", text: `現在 ${updatedNames.length} 名：`, margin: "md", size: "sm", color: "#888888" },
                    { type: "text", text: updatedNames.join("、"), margin: "sm", wrap: true, size: "md" },
                    { type: "button", style: "primary", margin: "xl", color: "#1DB954", action: { type: "message", label: "✅ 登録を終了してメニューへ", text: "メニュー" } }
                  ]
                }
              }
            }]
          });
        }
        return; 
    }

    // --- 2. 順番の提案 階層 ---
    if (text === "順番の提案、確認") {
      // ✅ ここで登録モードをOFFにする
      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) g.isRegistering = false;
      });
      return client.replyMessage({ replyToken: event.replyToken, messages: getOrderMenu() });
    }

    // --- 順番提案ロジックの修正 ---
    if (text === "ソロ順番提案") {
      const names = groupData?.memberNames || [];
      if (names.length === 0) return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "まずはメンバー登録をしてね！" }] });
      
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      const orderText = `🎤 ソロの順番：\n${shuffled.join(" → ")}`;

      // ★結果を保存
      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          g.lastOrder = orderText;
          g.lastTeams = []; // ★ ここでリセット！
        }
      });

      return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: orderText }, ...getOrderMenu()] });
    }

    if (text === "ペア順番提案") {
      const ids = groupData?.memberIds || [];
      const names = groupData?.memberNames || [];
      
      if (names.length < 2) {
        return client.replyMessage({ 
          replyToken: event.replyToken, 
          messages: [{ type: "text", text: "ペアを作るには2人以上の登録が必要だよ！" }, ...getMemberAdminMenu("登録はこちら")] 
        });
      }

      // --- 名前とIDをセットにしてシャッフル ---
      // ★ name: string, i: number と型を明示
      const combined = names.map((name: string, i: number) => ({ id: ids[i], name }));
      combined.sort(() => Math.random() - 0.5);

      // ★ c: {id: string, name: string} のように型を明示
      const sIds = combined.map((c: { id: string; name: string }) => c.id);
      const sNames = combined.map((c: { id: string; name: string }) => c.name);

      let teamsTexts: string[] = [];
      let teamsIds: string[][] = []; 

      // --- チーム分けロジック ---
      if (sNames.length === 3) {
        teamsTexts.push(`🎵 ${sNames.join(" ＆ ")} (トリオ)`);
        teamsIds.push([sIds[0], sIds[1], sIds[2]]);
      } else {
        for (let i = 0; i < sNames.length; i += 2) {
          if (sNames.length - i === 3) {
            teamsTexts.push(`🎵 ${sNames.slice(i).join(" ＆ ")} (トリオ)`);
            teamsIds.push([sIds[i], sIds[i+1], sIds[i+2]]);
            break;
          } 
          if (sNames[i + 1]) {
            teamsTexts.push(`👫 ${sNames[i]} ＆ ${sNames[i + 1]}`);
            teamsIds.push([sIds[i], sIds[i+1]]);
          } else {
            teamsTexts.push(`👤 ${sNames[i]} (ソロ)`);
            teamsIds.push([sIds[i]]);
          }
        }
      }

      const orderText = `👫 チームの順番：\n${teamsTexts.join("\n")}`;

      await db.update((data: Data) => {
        // ★ x: GroupData と型を明示
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          g.lastOrder = orderText;
          g.lastTeams = teamsIds; 
        }
      });

      return client.replyMessage({ 
        replyToken: event.replyToken, 
        messages: [{ type: "text", text: orderText }, ...getOrderMenu()] 
      });
    }

    // ★追加：今の順番を確認
    if (text === "今の順番を確認") {
      const orderText = groupData?.lastOrder || "まだ順番を決めていないよ！";
      return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: `【現在の順番】\n\n${orderText}` }, ...getOrderMenu()] });
    }


    if (text === "共通曲の提案" || text === "ペアに合う曲の提案") {
      const teams = groupData?.lastTeams || [];
      if (teams.length === 0) {
        return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "まずは「順番の提案」でペアを決めてね！" }] });
      }

      let resultMessages: string[] = ["【ペア別の一致曲】"];

      // db.data.users を直接参照します
      const usersInDb = db.data.users;

      teams.forEach((teamIds: string[], index: number) => {
        // チーム全員のプロフィール名を取得
        const teamMembers = teamIds.map(id => {
          const u = usersInDb.find((x: UserData) => x.userId === id);
          return { name: u?.displayName || "不明", songs: u?.mySongs || [] };
        });

        // 全員のリストに共通して存在する曲を抽出
        let commonSongs = teamMembers[0].songs;
        for (let i = 1; i < teamMembers.length; i++) {
          commonSongs = commonSongs.filter((song: string) => teamMembers[i].songs.includes(song));
        }

        const memberNames = teamMembers.map(m => m.name).join("＆");
        if (commonSongs.length > 0) {
          resultMessages.push(`\n▼ ${memberNames}\n・${commonSongs.join("\n・")}`);
        } else {
          resultMessages.push(`\n▼ ${memberNames}\n（一致する曲がなかったよ…💦）`);
        }
      });

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: resultMessages.join("\n") }, ...getGroupMainMenu()]
      });
    }

    // 選曲提案
    /*
    if (text === "共通曲の提案") return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "template", altText: "選曲", template: { type: "buttons", text: "どう決める？", actions: [{ type: "message", label: "ランダム", text: "ランダム1曲"}, { type: "message", label: "ジャンル", text: "ジャンルから選ぶ"}, { type: "message", label: "年代", text: "年別ヒット曲から選ぶ"}] }}] });
    if (text === "ジャンルから選ぶ") return client.replyMessage({ replyToken: event.replyToken, messages: genreButtons1() });
    if (text === "ジャンル選択(他)") return client.replyMessage({ replyToken: event.replyToken, messages: genreButtons2() });
    if (text.startsWith("ジャンル：")) { currentState.genreKey = genreMap[text]; return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: `${text.replace("ジャンル：","")}だね！` }, ...songDecisionButtons()] }); }
    if (text === "年別ヒット曲から選ぶ") return client.replyMessage({ replyToken: event.replyToken, messages: [...yearButtons1(), ...yearButtons2()] });
    if (text.startsWith("年代：")) {
      const h = eraButtonHandlers[text.replace("年代：", "")];
      if (h) return client.replyMessage({ replyToken: event.replyToken, messages: h() });
    }
    if (text.startsWith("年：")) { currentState.genreKey = yearMap[text]; return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: `${text.replace("年：", "")}年だね！` }, ...songDecisionButtons()] }); }
    if (text === "1曲に決める" && currentState.genreKey) {
      const list = (songs as any)[currentState.genreKey];
      return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: `決定！🎵 ${list[Math.floor(Math.random()*list.length)]}` }] });
    }
    if (text === "候補を出す" && currentState.genreKey) {
      const list = (songs as any)[currentState.genreKey]; const c = [...list].sort(() => Math.random() - 0.5).slice(0, 3);
      return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: `候補：\n${c.join("\n")}` }, ...songAfterCandidateButtons()] });
    }*/
    if (text === "遊び方の提案") {
      const ks = Object.keys(gameRules); const t = ks[Math.floor(Math.random()*ks.length)];
      return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: `【${t}】\n${gameRules[t]}` }, ...getGroupMainMenu()] });
    }
  } 

  
  //---------------------------------
  // --- 個人専用ロジック ---
  //---------------------------------
  else {
    const getMainMenu = (): line.messagingApi.Message[] => [{
      type: "template", altText: "個人メニュー",
      template: {
        type: "buttons", text: "【個人メニュー】\n何をする？",
        actions: [
          { type: "message", label: "🎵 曲の登録", text: "曲の登録" },
          { type: "message", label: "📋 マイリストの確認、編集", text: "マイリストの確認、編集" },
          { type: "message", label: "カラキンの説明", text: "カラキンの説明" },
        ]
      }
    }];

    const getRegMenu = (infoText: string): line.messagingApi.Message[] => [
      { type: "text", text: infoText },
      { type: "template", altText: "登録中メニュー",
        template: {
          type: "buttons", text: "リストの操作や確認はこちらから",
          actions: [
            { type: "message", label: "↩️ 直前の一曲消す", text: "一曲消す" },
            { type: "message", label: "📋 リスト確認", text: "リスト確認" },
            { type: "message", label: "✅ 登録終了", text: "登録終了" },
          ]
        }
      }
    ];

    // マイリスト管理用メニュー（Flex または Buttons）
    const getMyListMenu = (): line.messagingApi.Message[] => [{
      type: "template",
      altText: "マイリスト管理メニュー",
      template: {
        type: "buttons",
        text: "マイリスト管理",
        actions: [
          { type: "message", label: "📋 リストを確認する", text: "マイリスト確認" },
          { type: "message", label: "✂️ リストを編集する", text: "マイリスト編集" },
          { type: "message", label: "🏠 戻る", text: "メニュー" }
        ]
      }
    }];

    // --- 1. 最優先：メニューに戻る・終了する処理 ---
    if (["カラキン", "メニュー", "登録終了", "戻る"].includes(text)) {
      await db.update((data: Data) => {
        let u = data.users.find((x: UserData) => x.userId === userId);
        if (u) u.isRegisteringSong = false;
      });
      return client.replyMessage({ replyToken: event.replyToken, messages: getMainMenu() });
    }

    // --- 2. 子階層：曲の登録モード開始 ---
    if (text === "曲の登録") {
      const profile = await client.getProfile(userId);
      await db.update((data: Data) => {
        let u = data.users.find((x: UserData) => x.userId === userId);
        if (!u) data.users.push({ userId, displayName: profile.displayName, mySongs: [], isRegisteringSong: true });
        else u.isRegisteringSong = true;
      });
      return client.replyMessage({ replyToken: event.replyToken, messages: getRegMenu("【曲の登録】\n登録したい曲名や歌手名を入力して送ってね！") });
    }

    // --- 3. 登録モード中の処理 ---
    // --- 3. 登録モード中の処理 ---
    if (userData?.isRegisteringSong) {
      if (text === "一曲消す") {
        await db.update((data: Data) => {
          let u = data.users.find((x: UserData) => x.userId === userId);
          if (u && u.mySongs.length > 0) u.mySongs.pop();
        });
        return client.replyMessage({ replyToken: event.replyToken, messages: getRegMenu("直前の1曲を消したよ！") });
      }

      if (text === "リスト確認") {
        const listText = userData.mySongs.length > 0 ? `【現在のリスト】\n・${userData.mySongs.join("\n・")}` : "登録はまだないよ！";
        return client.replyMessage({ replyToken: event.replyToken, messages: getRegMenu(listText) });
      }

      // ガード
      if (text === "曲の登録") return;

      let displaySongs: any[] = [];
      let currentIndex = 0;

      // --- ページング判定 (次へ・前へ) ---
      const isPaging = text === "次の5曲を表示" || text === "前の5曲を表示";
      
      if (isPaging && currentState.searchCache) {
        currentIndex = (currentState as any).currentIndex || 0;
        
        if (text === "次の5曲を表示") {
          currentIndex += 5;
        } else {
          currentIndex -= 5;
        }

        // 範囲外ガード
        if (currentIndex < 0) currentIndex = 0;
        displaySongs = currentState.searchCache.slice(currentIndex, currentIndex + 5);
        (currentState as any).currentIndex = currentIndex;

      } else {
        // 新規検索の場合
        const allCandidates = await searchSongs(text);
        if (allCandidates.length === 0) {
          return client.replyMessage({ replyToken: event.replyToken, messages: getRegMenu(`「${text}」は見つからなかったよ💦`) });
        }
        currentState.searchCache = allCandidates;
        currentState.lastQuery = text;
        currentIndex = 0;
        (currentState as any).currentIndex = 0;
        displaySongs = allCandidates.slice(0, 5);
      }

      // --- 検索結果のアイテム作成 ---
      const songItems = displaySongs.map((c: any) => {
        const isAdded = userData?.mySongs.includes(c.fullName);
        return {
          type: "box", layout: "horizontal", margin: "lg", contents: [
            { type: "box", layout: "vertical", flex: 4, contents: [
              { type: "text", text: c.trackName, weight: "bold", wrap: true, color: isAdded ? "#aaaaaa" : "#000000" },
              { type: "text", text: c.artistName, size: "xs", color: "#888888" }
            ]},
            { 
              type: "button", style: isAdded ? "secondary" : "primary", height: "sm", flex: 2,
              action: { 
                type: "postback", 
                label: isAdded ? "登録済" : "登録", 
                data: isAdded ? "ignore" : `save:${c.fullName}`,
                displayText: isAdded ? `「${c.fullName}」を登録！` : `✅ ${c.fullName} を登録！`
              }
            }
          ]
        };
      });

      // --- フッターボタンの作成 (ここがエラーの修正ポイント) ---
      const pagingButtons: any[] = [];
      if (currentIndex > 0) {
        pagingButtons.push({
          type: "button", style: "secondary", height: "sm", margin: "sm",
          action: { type: "message", label: "◀️ 前の5曲", text: "前の5曲を表示" }
        });
      }
      if (currentState.searchCache && (currentIndex + 5) < currentState.searchCache.length) {
        pagingButtons.push({
          type: "button", style: "secondary", height: "sm", margin: "sm",
          action: { type: "message", label: "次の5曲 ▶️", text: "次の5曲を表示" }
        });
      }

      const searchResultFooter = []; // 名前を固有のものに変更して再宣言エラーを回避
      if (pagingButtons.length > 0) {
        searchResultFooter.push({ type: "separator", margin: "xl" });
        searchResultFooter.push({
          type: "box", layout: "horizontal", spacing: "md", contents: pagingButtons
        });
      }

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "flex", altText: "検索結果",
            contents: {
              type: "bubble",
              body: {
                type: "box", layout: "vertical",
                contents: [
                  { type: "text", text: `🎵 ${currentState.lastQuery} (${currentIndex + 1}〜${currentIndex + 5}位)`, weight: "bold", size: "md", color: "#1DB954" },
                  ...songItems as any,
                  ...searchResultFooter as any
                ]
              }
            }
          },
          ...getRegMenu(currentIndex > 0 ? "もっと候補を出したよ！" : "お目当ての曲はあるかな？")
        ]
      });
    }

    // --- マイリスト管理（入り口） ---
    if (text === "マイリストの確認、編集") {
      return client.replyMessage({ replyToken: event.replyToken, messages: getMyListMenu() });
    }

    // --- 📋 確認のみ ---
    if (text === "マイリスト確認") {
      const listText = userData?.mySongs.length ? `【現在のリスト】\n・${userData.mySongs.join("\n・")}` : "登録はないよ！";
      return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: listText }, ...getMyListMenu()] });
    }

    // --- ✂️ マイリスト編集・表示（前後ページング対応） ---
    const isMyListText = ["マイリスト編集", "次のマイリストを表示", "前のマイリストを表示"].includes(text);
    
    if (isMyListText) {
      const mySongs = userData?.mySongs || [];
      if (mySongs.length === 0) {
        return client.replyMessage({ 
          replyToken: event.replyToken, 
          messages: [{ type: "text", text: "登録されている曲がないよ！" }, ...getMainMenu()] 
        });
      }

      // --- 1. インデックスの計算 ---
      let currentIndex = (currentState as any).listIndex || 0;
      if (text === "次のマイリストを表示") {
        currentIndex += 5;
      } else if (text === "前のマイリストを表示") {
        currentIndex -= 5;
      } else {
        currentIndex = 0;
      }

      if (currentIndex < 0) currentIndex = 0;
      if (currentIndex >= mySongs.length) currentIndex = Math.floor((mySongs.length - 1) / 5) * 5;
      (currentState as any).listIndex = currentIndex;

      // --- 2. リストアイテム（曲名と削除ボタン）の作成 ---
      const displaySongs = mySongs.slice(currentIndex, currentIndex + 5);
      const songEditItems = displaySongs.map((song: string) => ({
        type: "box", layout: "horizontal", margin: "md", contents: [
          { type: "text", text: song, flex: 4, size: "sm", gravity: "center", wrap: true },
          { 
            type: "button", style: "secondary", color: "#FF6B6B", height: "sm", flex: 2,
            action: { type: "postback", label: "削除", data: `delete:${song}` }
          }
        ]
      }));

      // --- 3. フッターボタン（前へ・次へ）の作成 ---
      const footerButtons: any[] = [];
      if (currentIndex > 0) {
        footerButtons.push({
          type: "button", style: "secondary", height: "sm", margin: "sm",
          action: { type: "message", label: "◀️ 前へ", text: "前のマイリストを表示" }
        });
      }
      if (mySongs.length > currentIndex + 5) {
        footerButtons.push({
          type: "button", style: "secondary", height: "sm", margin: "sm",
          action: { type: "message", label: "次へ ▶️", text: "次のマイリストを表示" }
        });
      }

      const myListFooter = []; // searchFooter と被らない名前
      if (footerButtons.length > 0) {
        myListFooter.push({ type: "separator", margin: "xl" });
        myListFooter.push({
          type: "box", layout: "horizontal", spacing: "md", contents: footerButtons
        });
      }

      // --- 4. メッセージ送信 ---
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "flex", altText: "マイリスト管理",
            contents: {
              type: "bubble",
              body: {
                type: "box", layout: "vertical",
                contents: [
                  { 
                    type: "text", 
                    text: `📋 マイリスト (${currentIndex + 1}〜${Math.min(currentIndex + 5, mySongs.length)} / ${mySongs.length}曲)`, 
                    weight: "bold", size: "md", color: "#1DB954" 
                  },
                  ...songEditItems as any, // 編集用のアイテムを展開
                  ...myListFooter as any   // 前へ・次へボタンを展開
                ]
              }
            }
          },
          ...getMyListMenu() // マイリスト用のメニューを表示
        ]
      });
    }

    if (text === "カラキンの説明") {
      return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "カラキンは歌本管理と選曲を助けるBotだよ！" }, ...getMainMenu()] });
    }
  }
}

async function main() {
  const db = await JSONFilePreset<Data>('db.json', defaultData);
  const client = new MessagingApiClient({ channelAccessToken: env.CHANNEL_ACCESS_TOKEN! });
  const app = express();
  app.post("/", line.middleware({ channelSecret: env.CHANNEL_SECRET! }), (req, res) => {
    res.sendStatus(200); 
    const { events } = req.body as { events: line.WebhookEvent[] };
    events.forEach(e => handleEvent(client, e, db));
  });
  http.createServer(app).listen(21153, () => console.log("カラキンReady"));
}
main();