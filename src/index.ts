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
  activeGroupId?: string; // ← 追加：現在参加中（最後に参加した）グループのID
  mySongs: string[]; // "曲名 / アーティスト名"のリスト
  myArtists: string[]; // ★追加：アーティスト名だけのリスト
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

// --- 変更前 ---
interface TempState {
  genreKey?: string;
  searchCache?: any[];
  lastQuery?: string;
  rouletteCandidates?: string[]; // ★これを追加してください！
}

// --- 変更後：compareTargets（比較対象IDリスト）を追加 ---
interface TempState {
  genreKey?: string;
  searchCache?: any[];
  lastQuery?: string;
  compareTargets?: string[]; // ★追加：共通曲チェック用に選んだ人のIDを入れる
  rouletteCandidates?: string[]; // ★これを追加してください！
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
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=jp&lang=ja_jp&media=music&limit=100`;
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
//　---グループ招待時メッセージ--
function startMessages(): line.messagingApi.Message[] {
  return [
    {
      type: "flex",
      altText: "はじめまして！カラキンです",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "🎤 KARA-KIN",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md",
          contents: [
            // 1. 挨拶テキスト
            {
              type: "text",
              text: "初めまして、カラキンだよ！\n歌う順番や曲を提案して、\nカラオケを盛り上げるよ！🎵",
              wrap: true,
              align: "center",
              size: "md",
              color: "#333333"
            },
            { type: "separator", margin: "lg" },
            
            // 2. 警告テキスト（赤文字で強調）
            {
              type: "text",
              text: "⚠️ 重要なお知らせ",
              weight: "bold",
              color: "#FF6B6B",
              size: "sm",
              margin: "lg"
            },
            {
              type: "text",
              text: "メンバー全員が「カラキン」を友だち登録していないと正しく動きません！",
              wrap: true,
              size: "xs",
              color: "#666666"
            },
            
            // 3. 説明画像エリア（2枚を縦に並べる）
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "image",
                  url: "https://github.com/naoki1679/LINEBot-test/blob/main/participate.png?raw=true",
                  size: "full",
                  aspectMode: "cover",
                  aspectRatio: "20:13", // 画像の比率に合わせて調整可
                  action: {
                    type: "uri",
                    uri: "https://github.com/naoki1679/LINEBot-test/blob/main/participate.png?raw=true"
                  }
                },
                {
                  type: "image",
                  url: "https://github.com/naoki1679/LINEBot-test/blob/main/addSong.png?raw=true",
                  size: "full",
                  aspectMode: "cover",
                  aspectRatio: "20:13",
                  action: {
                    type: "uri",
                    uri: "https://github.com/naoki1679/LINEBot-test/blob/main/addSong.png?raw=true"
                  }
                }
              ]
            },
            
            // 4. アクションボタン
            { type: "separator", margin: "xl" },
            {
              type: "text",
              text: "まずはここからスタート！",
              size: "xs",
              color: "#aaaaaa",
              align: "center",
              margin: "lg"
            },
            {
              type: "button",
              style: "primary",
              color: "#1DB954",
              height: "sm",
              action: { type: "message", label: "⚙️ メンバー登録（必須）", text: "メンバー登録を開始" }
            }
          ]
        }
      }
    }
  ];
}

//　---個チャ登録時用メッセージ---
function getPrivateMenu(): line.messagingApi.Message[] {
  return [
    {
      type: "flex",
      altText: "初期設定メニュー",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "🎤 カラキン",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        hero: {
          type: "image",
          url: "https://github.com/naoki1679/LINEBot-test/blob/main/addSong.png?raw=true",
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
          action: {
            type: "uri",
            uri: "https://github.com/naoki1679/LINEBot-test/blob/main/addSong.png?raw=true"
          }
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md",
          contents: [
            {
              type: "text",
              text: "まずは簡易設定で\n歌える曲を追加しよう！",
              wrap: true,
              align: "center",
              weight: "bold",
              color: "#666666"
            },
            {
              type: "button",
              style: "primary",
              color: "#1DB954",
              height: "sm",
              action: { type: "message", label: "🎵 簡易設定を始める", text: "簡易設定を始める" }
            },
            {
              type: "button",
              style: "primary",
              color: "#1DB954",
              height: "sm",
              action: { type: "message", label: "❓ カラキンの使い方", text: "カラキンの使い方" }
            }
          ]
        }
      }
    }
  ];
}

//　---個チャ用メニュー画面---
function getFullPrivateMenu(): line.messagingApi.Message[] {
  return [
  {
    type: "flex",
    altText: "個人メニュー",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1DB954", // ヘッダーだけ色を付けてブランド感を出す
        paddingAll: "lg",
        contents: [
          {
            type: "text",
            text: "🎤 個人メニュー",
            color: "#ffffff",
            weight: "bold",
            size: "xl",
            align: "center"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "lg",
        spacing: "md", // 仕切り線の代わりに、ここでボタン同士の隙間を作る
        contents: [
          // 1. 曲の登録
          {
            type: "button",
            style: "secondary", // 全てこのスタイルで統一
            height: "sm",
            action: { type: "message", label: "🎵 曲の登録", text: "曲の登録" }
          },
          // 2. マイリスト
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "message", label: "📋 マイリスト確認・編集", text: "マイリストの確認、編集" }
          },
          // 3. 履歴
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "message", label: "🕒 カラキン履歴", text: "カラキン履歴" }
          },
          // 4. 説明
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "message", label: "❓ カラキンの説明", text: "カラキンの説明" }
          }
        ]
      }
    }
  }];
}

// --- 1. 定番10曲の定義 ---
const BEGINNER_SONGS = [
    "Lemon / 米津玄師",
    "マリーゴールド / あいみょん",
    "小さな恋のうた / MONGOL800",
    "怪獣の花唄 / Vaundy",
    "キセキ / GReeeeN",
    "残酷な天使のテーゼ / 高橋洋子",
    "アイドル / YOASOBI",
    "糸 / 中島みゆき",
    "丸ノ内サディスティック / 椎名林檎",
    "チェリー / スピッツ"
];

// --- 2. 共通の保存ロジック（関数の外に出す） ---
async function saveToMyList(userId: string, target: string, db: any) {
  const artistName = target.split(" / ")[1]?.trim();
  let isDuplicate = false;
  await db.update((data: Data) => {
    let user = data.users.find((u: UserData) => u.userId === userId);
    if (user) {
      if (!user.myArtists) user.myArtists = [];
      if (user.mySongs.includes(target)) {
        isDuplicate = true;
      } else {
        user.mySongs.push(target);
        if (artistName && !user.myArtists.includes(artistName)) {
          user.myArtists.push(artistName);
        }
      }
    }
  });
  return isDuplicate;
}

// --- 3. 質問を表示する共通関数 ---
async function sendSetupQuestion(client: line.messagingApi.MessagingApiClient, replyToken: string, index: number) {
    const song = BEGINNER_SONGS[index];
    const progress = `(${index + 1} / ${BEGINNER_SONGS.length})`;
    return client.replyMessage({
        replyToken: replyToken,
        messages: [{
            type: "template",
            altText: "簡易設定",
            template: {
                type: "confirm",
                text: `${progress}\n「${song}」は歌えますか？`,
                actions: [
                    { type: "postback", label: "歌える！", data: `setup_save:${index}`, displayText: "歌える！" },
                    { type: "postback", label: "歌えない", data: `setup_skip:${index}`, displayText: "歌えない" }
                ]
            }
        }]
    });
}

// --- 共通曲判定ロジック（関数化） ---
function calculateCommonSongs(db: any, teams: string[][]): string {
  // チーム分けがまだされていない場合のガード
  if (!teams || teams.length === 0) {
    return "（まだグループで「順番の提案」をしていないようです。\nグループチャットで「順番の提案」をしてペアを決めてね！）";
  }

  let resultMessages: string[] = [];
  const usersInDb = db.data.users;

  teams.forEach((teamIds: string[]) => {
    // チーム全員の最新データを取得
    const teamMembers = teamIds.map(id => {
      const u = usersInDb.find((x: UserData) => x.userId === id);
      return { 
        name: u?.displayName || "不明", 
        songs: u?.mySongs || [],
        artists: u?.myArtists || [] 
      };
    });

    // 1. 共通の「曲」を抽出
    // 最初の人の曲リストを基準に、他の全員が持っている曲だけを残す
    let commonSongs = teamMembers[0].songs;
    for (let i = 1; i < teamMembers.length; i++) {
      commonSongs = commonSongs.filter((song: string) => teamMembers[i].songs.includes(song));
    }

    // 2. 共通の「アーティスト」を抽出
    let commonArtists = teamMembers[0].artists;
    for (let i = 1; i < teamMembers.length; i++) {
      commonArtists = commonArtists.filter((artist: string) => teamMembers[i].artists.includes(artist));
    }

    const memberNames = teamMembers.map(m => m.name).join(" ＆ ");

    // 結果のテキスト作成
    if (commonSongs.length > 0) {
      resultMessages.push(`▼ ${memberNames}\n🎵 一致曲！\n・${commonSongs.join("\n・")}`);
    } else if (commonArtists.length > 0) {
      resultMessages.push(`▼ ${memberNames}\n🎤 一致アーティスト\n・${commonArtists.join("\n・")}`);
    } else {
      resultMessages.push(`▼ ${memberNames}\n（一致なし💦）`);
    }
  });

  return resultMessages.join("\n\n");
}

// --- ★ 分析＆カルーセル生成用関数（完全一致1枚・最大50件版） ---
function generateTrendCarousel(db: any, memberIds: string[]): line.messagingApi.FlexMessage {
  const users = db.data.users.filter((u: UserData) => memberIds.includes(u.userId));
  const total = users.length;

  // 1. 集計
  const songCounts: Record<string, number> = {};
  const artistCounts: Record<string, number> = {};

  users.forEach((u: UserData) => {
    u.mySongs.forEach((song) => { songCounts[song] = (songCounts[song] || 0) + 1; });
    u.myArtists.forEach((artist) => { artistCounts[artist] = (artistCounts[artist] || 0) + 1; });
  });

  // 2. ソート
  const getRanked = (counts: Record<string, number>) => {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  };

  const rankedSongs = getRanked(songCounts);
  const rankedArtists = getRanked(artistCounts);

  // 3. データ抽出（完全一致）
  const perfectSongs = rankedSongs.filter(x => x.count === total).map(x => x.name);
  const perfectArtists = rankedArtists.filter(x => x.count === total).map(x => x.name);

  // 4. 混合リスト作成（トレンド用）
  const createMixedList = (rankedItems: { name: string, count: number }[]) => {
    const myUser = users.find((u: UserData) => u.userId === memberIds[0]);
    const mySongSet = new Set(myUser?.mySongs || []);
    const myArtistSet = new Set(myUser?.myArtists || []);

    const candidates = rankedItems.filter(x => x.count < total);
    
    // A. 準一致
    const trends = candidates
      .filter(x => x.count > 1) 
      .map(x => `${x.name}__${x.count}`);
      
    // B. シングル（自分除外）
    const singles = candidates
      .filter(x => x.count === 1) 
      .filter(x => {
          if (x.name.includes(" / ")) {
              return !mySongSet.has(x.name); 
          } else {
              return !myArtistSet.has(x.name); 
          }
      })
      .map(x => `${x.name}__1`);

    let result = [...trends];
    const MAX_LIMIT = 50; 
    const PAGE_SIZE = 10;

    // トレンドの方は「読みやすさ」重視で10件刻みにするロジックを維持
    let targetCount = Math.ceil(result.length / PAGE_SIZE) * PAGE_SIZE;
    if (targetCount < PAGE_SIZE) targetCount = PAGE_SIZE;
    if (targetCount > MAX_LIMIT) targetCount = MAX_LIMIT;

    if (result.length < targetCount) {
        const needed = targetCount - result.length;
        result = result.concat(singles.slice(0, needed));
    } else {
        result = result.slice(0, MAX_LIMIT);
    }

    let footer = "";
    const totalTrendCount = trends.length;
    if (totalTrendCount > 0) {
        if (result.length > totalTrendCount) {
            footer = `準一致${totalTrendCount}件 + 相手の曲`;
        } else {
            footer = `準一致: 全${totalTrendCount}件`;
        }
    } else if (result.length > 0) {
        footer = "相手の持ち歌など";
    } else {
        result = ["データなし"];
        footer = "すべて完全一致です";
    }

    return { displayList: result, footerText: footer };
  };

  const mixedSongs = createMixedList(rankedSongs);
  const mixedArtists = createMixedList(rankedArtists);

  // 5. バブル作成ヘルパー
  const createStylishBubble = (title: string, color: string, items: string[], footerText: string, iconChar: string, isBoldMode: boolean = false): line.messagingApi.FlexBubble => {
    const rowContents: line.messagingApi.FlexComponent[] = items.map(text => {
        const parts = text.split("__");
        const hasCount = parts.length === 2;
        const name = hasCount ? parts[0] : text;
        const count = hasCount ? parts[1] : "";

        if (name === "データなし") {
            return { type: "text", text: "（該当なし）", size: "xs", color: "#aaaaaa", align: "center", margin: "md" };
        }

        const isHighRank = (hasCount && count !== "1") || isBoldMode;
        const nameColor = isHighRank ? "#333333" : "#555555";
        const nameWeight = isHighRank ? "bold" : "regular";
        const badgeBgColor = isHighRank ? "#f7b500" : "#eeeeee";
        const badgeTextColor = isHighRank ? "#ffffff" : "#888888";

        return {
            type: "box", layout: "horizontal", spacing: "sm", margin: "sm", alignItems: "center",
            contents: [
                { type: "text", text: iconChar, size: "xs", flex: 0 },
                { type: "text", text: name, size: "xs", color: nameColor, weight: nameWeight, wrap: true, flex: 1 },
                ...(hasCount ? [{
                    type: "box", layout: "vertical", backgroundColor: badgeBgColor, cornerRadius: "sm", paddingAll: "xs", flex: 0,
                    contents: [{ type: "text", text: `${count}人登録中`, size: "xxs", color: badgeTextColor, weight: "bold" }]
                } as line.messagingApi.FlexComponent] : [])
            ]
        };
    });

    return {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: color,
        contents: [{ type: "text", text: title, color: "#ffffff", weight: "bold", align: "center" }]
      },
      body: { type: "box", layout: "vertical", spacing: "xs", contents: rowContents },
      footer: {
        type: "box", layout: "vertical",
        contents: [{ type: "text", text: footerText, size: "xxs", color: "#aaaaaa", align: "center" }]
      }
    };
  };

  // 6. トレンド用：ページ分割するヘルパー（10件ごと）
  const createPagedBubbles = (baseTitle: string, color: string, dataObj: { displayList: string[], footerText: string }, iconChar: string) => {
      const items = dataObj.displayList;
      const footer = dataObj.footerText;
      if (items.length === 0 || (items.length === 1 && items[0] === "データなし")) {
          const displayItems = items.length === 0 ? ["データなし"] : items;
          return [createStylishBubble(baseTitle, color, displayItems, footer, iconChar, false)];
      }
      const pageSize = 10;
      const chunks = [];
      for (let i = 0; i < items.length; i += pageSize) {
          chunks.push(items.slice(i, i + pageSize));
      }
      return chunks.map((chunk, index) => {
          const pageNum = index + 1;
          const totalPages = chunks.length;
          const title = totalPages > 1 ? `${baseTitle} (${pageNum}/${totalPages})` : baseTitle;
          return createStylishBubble(title, color, chunk, footer, iconChar, false);
      });
  };

  // 7. ★ 完全一致用：ページ分割せず1枚にするヘルパー（最大50件）
  const createPerfectBubbleOnePage = (title: string, color: string, items: string[], iconChar: string) => {
      // LINEのFlex Bubbleの制限上、Bodyに入れられる要素は最大50個程度
      // そのため、50件を超えたらカットする安全策を入れる
      let displayItems = items;
      let footer = "全員の十八番！";

      if (items.length === 0) {
          displayItems = ["データなし"];
          footer = "もっと曲を登録しよう！";
      } else if (items.length > 50) {
          displayItems = items.slice(0, 50);
          footer = `全員一致: 全${items.length}件 (TOP50)`;
      }

      // 最後の引数(isBoldMode)を true にして、1枚のバブルを作成して返す
      return createStylishBubble(title, color, displayItems, footer, iconChar, true);
  };

  // 8. 最終的なカルーセル組み立て
  return {
    type: "flex",
    altText: "分析結果",
    contents: {
      type: "carousel",
      contents: [
        // 曲（完全一致は1枚ドカンと表示）
        createPerfectBubbleOnePage("🎵 全員の一致曲", "#1DB954", perfectSongs, "🎵"),
        // 曲（トレンドはページ送りで見やすく）
        ...createPagedBubbles("📈 隠れ人気曲", "#FF9900", mixedSongs, "🔸"),
        
        // 歌手（完全一致は1枚ドカンと表示）
        createPerfectBubbleOnePage("🎤 全員の一致アーティスト", "#1DB954", perfectArtists, "🎤"),
        // 歌手（トレンドはページ送りで見やすく）
        ...createPagedBubbles("📊 隠れ人気アーティスト", "#333399", mixedArtists, "🔹")
      ]
    }
  };
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

// --- ロック管理用の変数をグローバル（ハンドラーの外）に宣言 ---
const activeLocks = new Set<string>();

// --- 5. メインハンドラー ---
async function handleEvent(client: line.messagingApi.MessagingApiClient, event: line.WebhookEvent, db: any) {
  const stateKey = getStateKey(event);
  const currentState = tempStates[stateKey] || (tempStates[stateKey] = {});
  const userId = event.source.userId!;

  if (activeLocks.has(stateKey)) {
    console.log(`Lock active for: ${stateKey}, ignored.`);
    return;
  }

  try {
    // ★ ロックをかける
    activeLocks.add(stateKey);

  // A. 自動挨拶イベント
  if (event.type === "join") {
    return client.replyMessage({ replyToken: event.replyToken, messages: startMessages() });
  }

  if (event.type === "follow") {
    // ★ 友達登録されたタイミングでプロフィールを取得してDBに登録する
    const profile = await client.getProfile(userId);
    await db.update((data: Data) => {
      let u = data.users.find((x: UserData) => x.userId === userId);
      if (!u) {
        // 新規ユーザーをDBに追加
        data.users.push({ 
          userId, 
          displayName: profile.displayName, 
          mySongs: [], 
          myArtists: [], 
          isRegisteringSong: false 
        });
        console.log(`New user registered: ${profile.displayName}`);
      }
    });
    return client.replyMessage({ replyToken: event.replyToken, messages: getPrivateMenu() });
  }

  // B. ポストバック（検索結果の登録）
  if (event.type === "postback") {
    const userId = event.source.userId!;
    let songData: string = event.postback.data;
    const userData = db.data.users.find((u: UserData) => u.userId === userId);
    const data = event.postback.data;


    // ★★★ 新機能：共通曲チェックの処理（ここに追加！） ★★★

    // 1. メンバー選択処理（個別トグル ＆ 全員一括）
    if (songData.startsWith("toggle_compare:") || songData === "toggle_all") {
      const activeGroup = db.data.groups.find((g: GroupData) => g.groupId === userData?.activeGroupId);
      if (!activeGroup) return; 

      // 自分以外のターゲットID一覧
      const targetIds = activeGroup.memberIds.filter((id: string) => id !== userId);
      if (!currentState.compareTargets) currentState.compareTargets = [];

      // --- A. 全員選択/解除のロジック ---//
      if (songData === "toggle_all") {
        // 「全員」がすでに含まれているかチェック
        // ★★★ 修正箇所：(id: string) と型を明記 ★★★
        const isAllSelected = targetIds.every((id: string) => currentState.compareTargets!.includes(id));
              
        if (isAllSelected) {
          // すでに全員選択済みなら → 全解除
          currentState.compareTargets = [];
        } else {
          // まだ全員ではないなら → 全員追加
          currentState.compareTargets = [...targetIds];
        }
      } 
      // --- B. 個別選択/解除のロジック ---
      else {
        const targetId = songData.split(":")[1];
        const idx = currentState.compareTargets.indexOf(targetId);
        if (idx >= 0) currentState.compareTargets.splice(idx, 1);
        else currentState.compareTargets.push(targetId);
      }

      // --- 共通：再描画ロジック ---
          
      // 「全員選択されているか」を再確認（ボタンの見た目用）
      // ★★★ 修正箇所：ここも (id: string) と型を明記 ★★★
      const isAllSelectedNow = targetIds.length > 0 && targetIds.every((id: string) => currentState.compareTargets!.includes(id));

      // ボタンの行を作成（2列表示）
      const rows: any[] = [];
      for (let i = 0; i < targetIds.length; i += 2) {
        const rowContents = [];
              
        // 左
        const id1 = targetIds[i];
        const name1 = activeGroup.memberNames[activeGroup.memberIds.indexOf(id1)] || "不明";
        const isSelected1 = currentState.compareTargets.includes(id1);
        rowContents.push({
          type: "button", 
          style: isSelected1 ? "primary" : "secondary", 
          color: isSelected1 ? "#1DB954" : undefined,   
          height: "sm", flex: 1, margin: "sm",
          action: { type: "postback", label: isSelected1 ? `✅ ${name1}` : name1, data: `toggle_compare:${id1}`, displayText: `${name1}さんを${isSelected1 ? "解除" : "選択"}` }
        });

        // 右
        if (i + 1 < targetIds.length) {
          const id2 = targetIds[i + 1];
          const name2 = activeGroup.memberNames[activeGroup.memberIds.indexOf(id2)] || "不明";
          const isSelected2 = currentState.compareTargets.includes(id2);
          rowContents.push({
            type: "button", 
            style: isSelected2 ? "primary" : "secondary", 
            color: isSelected2 ? "#1DB954" : undefined,
            height: "sm", flex: 1, margin: "sm",
            action: { type: "postback", label: isSelected2 ? `✅ ${name2}` : name2, data: `toggle_compare:${id2}`, displayText: `${name2}さんを${isSelected2 ? "解除" : "選択"}` }
          });
        } else {
          rowContents.push({ type: "spacer", size: "sm" });
        }
        rows.push({ type: "box", layout: "horizontal", spacing: "md", contents: rowContents });
      }

      const count = currentState.compareTargets.length;

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "flex",
          altText: "メンバー選択中",
          contents: {
            type: "bubble",
            body: {
              type: "box", layout: "vertical",
              contents: [
                { type: "text", text: `🎵 比較相手を選択中 (${count}人)`, weight: "bold", size: "sm", color: "#1DB954", align: "center" },
                { type: "separator", margin: "md" },                     
                // ★ 再描画時の全員選択ボタン（状態によって見た目を変える）
                {
                  type: "button",
                  style: isAllSelectedNow ? "secondary" : "primary", // 全選択済みならグレー、まだなら黒
                  color: isAllSelectedNow ? "#aaaaaa" : "#333333",
                  height: "sm",
                  margin: "lg",
                  action: { 
                    type: "postback", 
                    label: isAllSelectedNow ? "❌ 全員解除" : "✅ 全員を選択", 
                    data: "toggle_all",
                    displayText: isAllSelectedNow ? "全員解除！" : "全員選択！"
                  }
                },
                { type: "box", layout: "vertical", margin: "md", spacing: "sm", contents: rows }
              ]
            },
            footer: {
              type: "box", layout: "vertical", spacing: "sm",
              contents: [
                { type: "button", style: "primary", color: "#1DB954", height: "sm", action: { type: "postback", label: "決定", data: "exec_compare", displayText: "共通曲を計算！" } }
              ]
            }
          }
        }]
      });
    }

    // 2. 計算実行処理 【統合版】
      if (songData === "exec_compare") {
          const targets = currentState.compareTargets || [];
          if (targets.length === 0) {
               return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "誰も選んでないよ！誰か選んでね。" }] });
          }
          
          const compareGroupIds = [userId, ...targets];
          
          // ① 1つのFlexMessageを受け取る
          const trendFlex = generateTrendCarousel(db, compareGroupIds);

          currentState.compareTargets = []; 

          const activeGroup = db.data.groups.find((g: GroupData) => g.groupId === userData?.activeGroupId);
          if (!activeGroup) return; 

          const targetIds = activeGroup.memberIds.filter((id: string) => id !== userId);
          const rows: any[] = [];
          
          for (let i = 0; i < targetIds.length; i += 2) {
              const rowContents = [];
              const id1 = targetIds[i];
              const name1 = activeGroup.memberNames[activeGroup.memberIds.indexOf(id1)] || "不明";
              rowContents.push({
                  type: "button", style: "secondary", height: "sm", flex: 1, margin: "sm",
                  action: { type: "postback", label: name1, data: `toggle_compare:${id1}`, displayText: `${name1}さんを選択` }
              });

              if (i + 1 < targetIds.length) {
                  const id2 = targetIds[i + 1];
                  const name2 = activeGroup.memberNames[activeGroup.memberIds.indexOf(id2)] || "不明";
                  rowContents.push({
                      type: "button", style: "secondary", height: "sm", flex: 1, margin: "sm",
                      action: { type: "postback", label: name2, data: `toggle_compare:${id2}`, displayText: `${name2}さんを選択` }
                  });
              } else {
                  rowContents.push({ type: "spacer", size: "sm" });
              }
              rows.push({ type: "box", layout: "horizontal", spacing: "md", contents: rowContents });
          }

          // ② メッセージ送信
          return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                  // ★★★ 変更点：配列ではないので ... を消す ★★★
                  trendFlex,
                  
                  // 続けて比較メニュー
                  {
                    type: "flex",
                    altText: "続けて比較",
                    contents: {
                      type: "bubble",
                      header: {
                        type: "box", layout: "vertical", backgroundColor: "#333333",
                        contents: [{ type: "text", text: "🔄 続けて誰と比べる？", color: "#ffffff", weight: "bold", align: "center" }]
                      },
                      body: {
                        type: "box", layout: "vertical",
                        contents: [
                          { type: "text", text: "選択をリセットしたよ！\nまた比較したい人を選んでね。", wrap: true, size: "sm", color: "#666666" },
                          { type: "separator", margin: "md" },
                          {
                            type: "button", style: "primary", color: "#333333", height: "sm", margin: "lg",
                            action: { type: "postback", label: "✅ 全員を選択", data: "toggle_all", displayText: "全員を選択！" }
                          },
                          { type: "box", layout: "vertical", margin: "md", spacing: "sm", contents: rows }
                        ]
                      },
                      footer: {
                        type: "box", layout: "vertical", spacing: "sm",
                        contents: [
                          { type: "button", style: "primary", color: "#1DB954", height: "sm", action: { type: "postback", label: "決定", data: "exec_compare", displayText: "共通曲を計算！" } },
                          { type: "button", style: "link", height: "sm", color: "#888888", action: { type: "message", label: "終了", text: "メニュー" } }
                        ]
                      }
                    }
                  }
              ]
          });
      }
    
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

      //　---曲登録中メニュー---
      const getRegMenu = (infoText: string): line.messagingApi.Message[] => [
        {
          type: "flex",
          altText: "登録中メニュー",
          contents: {
            type: "bubble",
            size: "kilo",
            header: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#1DB954",
              paddingAll: "lg",
              contents: [
                {
                  type: "text",
                  text: "🎵 登録モード", // 登録中であることがわかるタイトル
                  color: "#ffffff",
                  weight: "bold",
                  size: "xl",
                  align: "center"
                }
              ]
            },
            body: {
              type: "box",
              layout: "vertical",
              paddingAll: "lg",
              spacing: "md",
              contents: [
                // 1. 通知メッセージ表示エリア（結果をここに表示）
                {
                  type: "text",
                  text: infoText,
                  wrap: true,
                  align: "center",
                  weight: "bold",
                  color: "#333333",
                  size: "md"
                },
                // 余白を開けてボタンエリアへ
                {
                  type: "box",
                  layout: "vertical",
                  margin: "xl",
                  spacing: "sm",
                  contents: [
                    // 2. 一曲消す
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: { type: "message", label: "↩️ 直前の一曲消す", text: "一曲消す" }
                    },
                    // 3. リスト確認
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: { type: "message", label: "📋 リスト確認", text: "リスト確認" }
                    },
                    // 4. 登録終了（区切りとして色を変えるか、統一するか。今回は統一）
                    {
                      type: "button",
                      style: "primary", // 終了は重要なので緑（primary）にして目立たせる
                      color: "#1DB954",
                      height: "sm",
                      action: { type: "message", label: "✅ 登録終了", text: "登録終了" }
                    }
                  ]
                }
              ]
            }
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
  
    if (songData.startsWith("setup_")) {
    const [action, indexStr] = songData.split(":");
    const index = parseInt(indexStr);
    const nextIndex = index + 1;

    if (action === "setup_save") {
      // 既存の save ロジックを動かすためにデータを書き換え
      songData = `save:${BEGINNER_SONGS[index]}`;
    } else if (action === "setup_skip") {
      // 「知らない（スキップ）」を押した場合は直接次の質問へ
      if (nextIndex < BEGINNER_SONGS.length) {
        return sendSetupQuestion(client, event.replyToken, nextIndex);
      } else {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "✨ お疲れ様！これで簡易設定は終わりだよ。" }, ...getFullPrivateMenu()]
        });
      }
    }
  }

    //曲の保存処理
    if (songData.startsWith("save:")) {
      const target = songData.replace("save:", "");
      const artistName = target.split(" / ")[1]?.trim();
      const isSetup = event.postback.data.startsWith("setup_save:"); // 判定用

      let isDuplicate = false;

      await db.update((data: Data) => {
        let user = data.users.find((u: UserData) => u.userId === userId);
        if (user) {
          if (!user.myArtists) user.myArtists = [];
          if (user.mySongs.includes(target)) {
            isDuplicate = true;
          } else {
            user.mySongs.push(target);
            if (artistName && !user.myArtists.includes(artistName)) {
              user.myArtists.push(artistName);
            }
          }
        }
      });

      // --- 1. 重複時の処理 ---
      if (isDuplicate) {
        // ★ 簡易設定中の場合は、重複していても次の質問へ誘導する
        if (isSetup) {
          const currentIndex = parseInt(event.postback.data.split(":")[1]);
          const nextIndex = currentIndex + 1;

          if (nextIndex < BEGINNER_SONGS.length) {
            return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                { type: "text", text: `⚠️「${target}」はすでに登録済みだったよ！` },
                {
                  type: "template",
                  altText: "簡易設定",
                  template: {
                    type: "confirm",
                    text: `(${nextIndex + 1} / ${BEGINNER_SONGS.length})\n「${BEGINNER_SONGS[nextIndex]}」は歌えますか？`,
                    actions: [
                      { type: "postback", label: "歌える！", data: `setup_save:${nextIndex}`, displayText: "歌える！" },
                      { type: "postback", label: "歌えない", data: `setup_skip:${nextIndex}`, displayText: "歌えない" }
                    ]
                  }
                }
              ]
            });
          } else {
            // 重複していた曲が最後の10曲目だった場合
            return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                { type: "text", text: `⚠️「${target}」はすでに登録済みだったよ！\n\n✨ お疲れ様！これで簡易設定は終わりだよ。` },
                ...getFullPrivateMenu()
              ]
            });
          }
        }

        //通常時の処理
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            { type: "text", text: `⚠️「${target}」はすでにマイリストに入っているよ！` },
            {
              type: "flex",
              altText: "登録中メニュー",
              contents: {
                type: "bubble",
                size: "kilo",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#1DB954",
                  paddingAll: "lg",
                  contents: [
                    {
                      type: "text",
                      text: "🎵 登録モード",
                      color: "#ffffff",
                      weight: "bold",
                      size: "xl",
                      align: "center"
                    }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "lg",
                  spacing: "md",
                  contents: [
                    // 1. 通知メッセージ表示エリア
                    {
                      type: "text",
                      text: "続けて登録するか、操作を選んでね",
                      wrap: true,
                      align: "center",
                      weight: "bold",
                      color: "#333333",
                      size: "md"
                    },
                    // 余白を開けてボタンエリアへ
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "xl",
                      spacing: "sm",
                      contents: [
                        // 1. 再検索
                        {
                          type: "button",
                          style: "secondary",
                          height: "sm",
                          action: { type: "message", label: `🔍 ${artistName} で再検索`, text: artistName }
                        },
                        // 2. 一曲消す
                        {
                          type: "button",
                          style: "secondary",
                          height: "sm",
                          action: { type: "message", label: "↩️ 直前の一曲消す", text: "一曲消す" }
                        },
                        // 3. リスト確認
                        {
                          type: "button",
                          style: "secondary",
                          height: "sm",
                          action: { type: "message", label: "📋 リスト確認", text: "リスト確認" }
                        },
                        // 4. 登録終了
                        {
                          type: "button",
                          style: "primary",
                          color: "#1DB954",
                          height: "sm",
                          action: { type: "message", label: "✅ 登録終了", text: "登録終了" }
                        }
                      ]
                    }
                  ]
                }
              }
            }
          ]
        });
      }

      // --- 2. グループ内での登録（簡易設定以外） ---
      const isGroupPostback = event.source.type !== "user";
      if (isGroupPostback) {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: `✅ ${target} を登録したよ！` }]
        });
      }

      // --- 3. 【本番】簡易設定中の出し分け ---
      if (isSetup) {
        const currentIndex = parseInt(event.postback.data.split(":")[1]);
        const nextIndex = currentIndex + 1;

        if (nextIndex < BEGINNER_SONGS.length) {
          // 次の曲がある場合
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              { type: "text", text: isDuplicate ? `⚠️「${target}」は登録済みだったよ！` : `✅「${target}」を登録したよ！` },
              {
                type: "template",
                altText: "簡易設定",
                template: {
                  type: "confirm",
                  text: `(${nextIndex + 1} / ${BEGINNER_SONGS.length})\n「${BEGINNER_SONGS[nextIndex]}」は歌えますか？`,
                  actions: [
                    { type: "postback", label: "歌える！", data: `setup_save:${nextIndex}`, displayText: "歌える！" },
                    { type: "postback", label: "歌えない", data: `setup_skip:${nextIndex}`, displayText: "歌えない" }
                  ]
                }
              }
            ]
          });
        } else {
          // 全10曲終了した場合
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              { type: "text", text: `✅「${target}」を登録したよ！\n\n✨ お疲れ様！これで簡易設定は終わりだよ。` },
              ...getFullPrivateMenu()
            ]
          });
        }
      }

      // --- 4. 通常の個人チャットでの登録完了 ---
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          { type: "text", text: `✅「${target}」を登録したよ！` },
          {
            type: "flex",
            altText: "登録中メニュー",
            contents: {
              type: "bubble",
              size: "kilo",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#1DB954",
                paddingAll: "lg",
                contents: [
                  {
                    type: "text",
                    text: "🎵 登録モード",
                    color: "#ffffff",
                    weight: "bold",
                    size: "xl",
                    align: "center"
                  }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                paddingAll: "lg",
                spacing: "md",
                contents: [
                  // 1. 通知メッセージ表示エリア
                  {
                    type: "text",
                    text: "続けて登録するか、操作を選んでね。\nさらに検索したいときは、曲名や歌手名を入力して送ってね！",
                    wrap: true,
                    align: "center",
                    weight: "bold",
                    color: "#333333",
                    size: "md"
                  },
                  // 余白を開けてボタンエリアへ
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xl",
                    spacing: "sm",
                    contents: [
                      // 1. 再検索
                      {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: { type: "message", label: `🔍 ${artistName} で再検索`, text: artistName }
                      },
                      // 2. 一曲消す
                      {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: { type: "message", label: "↩️ 直前の一曲消す", text: "一曲消す" }
                      },
                      // 3. リスト確認
                      {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: { type: "message", label: "📋 リスト確認", text: "リスト確認" }
                      },
                      // 4. 登録終了
                      {
                        type: "button",
                        style: "primary",
                        color: "#1DB954",
                        height: "sm",
                        action: { type: "message", label: "✅ 登録終了", text: "登録終了" }
                      }
                    ]
                  }
                ]
              }
            }
          }
        ]
      });
    }

    const getMyListMenu = (): line.messagingApi.Message[] => [{
      type: "flex",
      altText: "マイリスト管理メニュー",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
        type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "📋 マイリスト管理",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md",
          contents: [
            // 1. リスト確認ボタン
            {
            type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "👀 リストを確認する", text: "マイリスト確認" }
            },
            // 2. リスト編集ボタン
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "✂️ リストを編集する", text: "マイリスト編集" }
            },
            // セパレーター（区切り線）
            { type: "separator", margin: "lg" },
            // 3. 戻るボタン
            {
              type: "button",
              style: "link", // 戻るボタンはリンクスタイルで控えめに
              height: "sm",
              margin: "md",
              color: "#888888",
              action: { type: "message", label: "🏠 メニューに戻る", text: "メニュー" }
            }
          ]
        }
      }
    }];

    // --- 削除処理 ---
    // 削除ロジック
    if (songData.startsWith("delete:")) {
      const target = songData.replace("delete:", "");
      // 削除する曲からアーティスト名を抽出
      const artistName = target.split(" / ")[1]?.trim();
      
      await db.update((data: Data) => {
        const u = data.users.find((x: UserData) => x.userId === userId);
        if (u) {
          // 1. 指定された曲を削除
          u.mySongs = u.mySongs.filter((song: string) => song !== target);

          // 2. 他にそのアーティストの曲が残っているかチェック
          // 「 / アーティスト名」で終わる、あるいは含む曲があるか確認
          const isArtistStillPresent = u.mySongs.some((song: string) => 
            song.includes(` / ${artistName}`)
          );

          // 3. 他に曲が1つもなければ、アーティストリストからも削除
          if (!isArtistStillPresent && artistName && u.myArtists) {
            u.myArtists = u.myArtists.filter((a: string) => a !== artistName);
          }
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
  const userData = db.data.users.find((u: UserData) => u.userId === userId);



  // ----------------------------------------
  // --- グループ専用ロジック ---
  // ----------------------------------------
  if (isGroup) {
    const getGroupMainMenu = (): line.messagingApi.Message[] => [{
      type: "flex",
      altText: "グループメニュー",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "🎤 グループメニュー",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md",
          contents: [
            // 1. メンバー管理
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "⚙️ メンバー管理", text: "メンバー管理" }
            },
            // 2. 順番
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "🎤 順番の提案・確認", text: "順番の提案、確認" }
            },
            // 3. 共通曲
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "🎵 共通曲の提案", text: "共通曲の提案" }
            },
            // 4. 遊び方
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "🎮 遊び方の提案", text: "遊び方の提案" }
            }
          ]
        }
      }
    }];

    const getMemberAdminMenu = (info: string): line.messagingApi.Message[] => [{
      type: "flex",
      altText: "メンバー管理メニュー",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "⚙️ MEMBER ADMIN",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md",
          contents: [
            // 情報テキスト表示エリア
            {
              type: "text",
              text: info,
              wrap: true,
              align: "center",
              size: "md",
              color: "#333333",
              weight: "bold"
            },
            { type: "separator", margin: "lg" },
            // ボタンエリア
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "primary", // 登録はメインアクションなので緑
                  color: "#1DB954",
                  height: "sm",
                  action: { type: "message", label: "👥 メンバー登録(開始)", text: "メンバー登録を開始" }
                },
                {
                  type: "button",
                  style: "secondary",
                  height: "sm",
                  action: { type: "message", label: "👀 登録状況を確認", text: "登録状況を確認" }
                },
                {
                  type: "button",
                  style: "secondary",
                  height: "sm",
                  action: { type: "message", label: "♻️ メンバーリセット", text: "メンバーリセット" }
                }
              ]
            },
            // 戻るボタン
            {
              type: "button",
              style: "link",
              height: "sm",
              margin: "md",
              color: "#888888",
              action: { type: "message", label: "↩️ メニューに戻る", text: "メニュー" }
            }
          ]
        }
      }
    }];

    const getOrderMenu = (): line.messagingApi.Message[] => [{
      type: "flex",
      altText: "順番メニュー",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "🎤 ORDER SELECT",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md",
          contents: [
            {
              type: "text",
              text: "どんな形式で歌う？",
              align: "center",
              color: "#666666",
              size: "sm"
            },
            // ソロ
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "👤 ひとりで歌う", text: "ソロ順番提案" }
            },
            // ペア
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "👫 ペアで歌う", text: "ペア順番提案" }
            },
            { type: "separator", margin: "lg" },
            // 確認ボタン
            {
              type: "button",
              style: "secondary",
              height: "sm",
              margin: "lg",
              action: { type: "message", label: "👀 今の順番を確認", text: "今の順番を確認" }
            },
            // 戻る
            {
              type: "button",
              style: "link",
              height: "sm",
              color: "#888888",
              action: { type: "message", label: "↩️ メニューに戻る", text: "メニュー" }
            }
          ]
        }
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
      let currentNames: string[] = [];
      let updatedNames: string[] = []; // ここに最新のリストを入れる

      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          g.isRegistering = true; 
          currentNames = g.memberNames;
          updatedNames = g.memberNames; // ★追加：既存のメンバーをセット
        } else {
          const newGroup = { groupId: stateKey, memberIds: [], memberNames: [], isRegistering: true };
          data.groups.push(newGroup);
          updatedNames = []; // 新規の場合は空
        }
      });
      
      // メンバーがいればそのリスト、いなければ「未登録」などの文字を入れる
      const memberListText = updatedNames.length > 0 ? updatedNames.join("、") : "（まだ誰もいないよ）";

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "flex",
          altText: "メンバー受付中",
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                { type: "text", text: "👥 メンバー受付中", weight: "bold", size: "lg", color: "#1DB954" },
                { type: "separator", margin: "md" },
                { type: "text", text: `現在 ${updatedNames.length} 名：`, margin: "md", size: "sm", color: "#888888" },
                { type: "text", text: memberListText, margin: "sm", wrap: true, size: "md" },
          
                // --- ボタンエリアの開始 ---
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "md",
                  margin: "xl",
                  contents: [
                    // 1段目：メイン登録（単独）
                    {
                      type: "button",
                      style: "primary",
                      color: "#1DB954",
                      height: "sm",
                      action: {
                        type: "message",
                        label: "🙋‍♂️ 参加する",
                        text: "参加！"
                      }
                    }, 
                    // 2段目：抜けるとリセットを横並び
                    {
                      type: "box",
                      layout: "horizontal",
                      spacing: "md",
                      contents: [
                        {
                          type: "button",
                          style: "primary",
                          color: "#FF6B6B", // 抜ける（赤系）
                          flex: 1,
                          height: "sm",
                          action: {
                            type: "message",
                            label: "🏃 抜ける",
                            text: "メンバーから抜ける"
                          }
                        },
                        {
                          type: "button",
                          style: "primary",
                          color: "#68e694", // リセット（緑系）
                          flex: 1,
                          height: "sm",
                          action: {
                            type: "message",
                            label: "♻️ リセット",
                            text: "メンバーリセット"
                          }
                        }
                      ]
                    },
                    // 3段目：終了ボタン（単独）
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: {
                        type: "message",
                        label: "🔙 決定してメニューへ",
                        text: "メニュー"
                      }
                    }
                  ]
                }
              ]
            }
          }
        }]
      });
    }

    // 「登録を開始」を「追加受付」の挙動に変更
    if (text === "メンバー登録を開始") {
      let currentNames: string[] = [];
      let updatedNames: string[] = []; // ここに最新のリストを入れる

      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          g.isRegistering = true; 
          currentNames = g.memberNames;
          updatedNames = g.memberNames; // ★追加：既存のメンバーをセット
        } else {
          const newGroup = { groupId: stateKey, memberIds: [], memberNames: [], isRegistering: true };
          data.groups.push(newGroup);
          updatedNames = []; // 新規の場合は空
        }
      });
      
      // メンバーがいればそのリスト、いなければ「未登録」などの文字を入れる
      const memberListText = updatedNames.length > 0 ? updatedNames.join("、") : "（まだ誰もいないよ）";

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "flex",
          altText: "メンバー受付中",
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                { type: "text", text: "👥 メンバー受付中", weight: "bold", size: "lg", color: "#1DB954" },
                { type: "separator", margin: "md" },
                { type: "text", text: `現在 ${updatedNames.length} 名：`, margin: "md", size: "sm", color: "#888888" },
                { type: "text", text: memberListText, margin: "sm", wrap: true, size: "md" },
          
                // --- ボタンエリアの開始 ---
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "md",
                  margin: "xl",
                  contents: [
                    // 1段目：メイン登録（単独）
                    {
                      type: "button",
                      style: "primary",
                      color: "#1DB954",
                      height: "sm",
                      action: {
                        type: "message",
                        label: "🙋‍♂️ 参加する",
                        text: "参加！"
                      }
                    }, 
                    // 2段目：抜けるとリセットを横並び
                    {
                      type: "box",
                      layout: "horizontal",
                      spacing: "md",
                      contents: [
                        {
                          type: "button",
                          style: "primary",
                          color: "#FF6B6B", // 抜ける（赤系）
                          flex: 1,
                          height: "sm",
                          action: {
                            type: "message",
                            label: "🏃 抜ける",
                            text: "メンバーから抜ける"
                          }
                        },
                        {
                          type: "button",
                          style: "primary",
                          color: "#68e694", // リセット（緑系）
                          flex: 1,
                          height: "sm",
                          action: {
                            type: "message",
                            label: "♻️ リセット",
                            text: "メンバーリセット"
                          }
                        }
                      ]
                    },
                    // 3段目：終了ボタン（単独）
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: {
                        type: "message",
                        label: "🔙 決定してメニューへ",
                        text: "メニュー"
                      }
                    }
                  ]
                }
              ]
            }
          }
        }]
      });
    }

    // 現在のメンバー確認
    if (text === "登録状況を確認") {
      const names = groupData?.memberNames || [];
      const listText = names.length > 0 ? names.join("、") : "まだ誰もいないよ";
      
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
      let updatedNames: string[] = [];

      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          g.memberIds = [];
          g.memberNames = [];
          // 受付を継続したい場合は true にします
          g.isRegistering = true; 
          updatedNames = g.memberNames;
        }
      });

      // 空文字エラー回避のためのガード
      const memberListText = updatedNames.length > 0 ? updatedNames.join("、") : "（リセットされました）";

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "flex",
          altText: "メンバーリセット完了",
          contents: {
            type: "bubble",
            body: {
              type: "box", layout: "vertical", contents: [
                { type: "text", text: "♻️ メンバーをリセットしました", weight: "bold", size: "md", color: "#FF6B6B" },
                { type: "separator", margin: "md" },
                { type: "text", text: `現在 ${updatedNames.length} 名：`, margin: "md", size: "sm", color: "#888888" },
                { type: "text", text: memberListText, margin: "sm", wrap: true, size: "md" },
                // --- ボタンエリアの開始 ---
                // --- ボタンエリア（3段構成）の開始 ---
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "md",
                  margin: "xl",
                  contents: [
                    // 1段目：メイン登録（単独）
                    {
                      type: "button",
                      style: "primary",
                      color: "#1DB954",
                      height: "sm",
                      action: {
                        type: "message",
                        label: "🙋‍♂️ 参加する",
                        text: "参加！"
                      }
                    }, 
                    // 2段目：抜けるとリセットを横並び
                    {
                      type: "box",
                      layout: "horizontal",
                      spacing: "md",
                      contents: [
                        {
                          type: "button",
                          style: "primary",
                          color: "#FF6B6B", // 抜ける（赤系）
                          flex: 1,
                          height: "sm",
                          action: {
                            type: "message",
                            label: "🏃 抜ける",
                            text: "メンバーから抜ける"
                          }
                        },
                        {
                          type: "button",
                          style: "primary",
                          color: "#68e694", // リセット（緑系）
                          flex: 1,
                          height: "sm",
                          action: {
                            type: "message",
                            label: "♻️ リセット",
                            text: "メンバーリセット"
                          }
                        }
                      ]
                    },
                    // 3段目：終了ボタン（単独）
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: {
                        type: "message",
                        label: "🔙 決定してメニューへ",
                        text: "メニュー"
                      }
                    }
                  ]
                }
              ]
            }
          }
        }]
      });
    }

    // --- メンバーから抜ける処理 ---
    if (text === "メンバーから抜ける") {
      let updatedNames: string[] = [];
      let removedName: string = ""; // 抜けた人の名前を保持する変数

      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          const index = g.memberIds.indexOf(userId);
          // ★登録されている場合のみ処理を行う
          if (index > -1) {
            removedName = g.memberNames[index];
            g.memberIds.splice(index, 1);
            g.memberNames.splice(index, 1);
            updatedNames = g.memberNames;
          }
        }
      });

      // ★名前が取れなかった（登録されていなかった）場合は、何もせずに終了
      if (!removedName) return;

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          { type: "text", text: `🏃 ${removedName} さんがメンバーから抜けました。` },
          {
            type: "flex",
            altText: "メンバー更新",
            contents: {
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "👥 メンバー受付中", weight: "bold", size: "lg", color: "#1DB954" },
                  { type: "separator", margin: "md" },
                  { type: "text", text: `現在 ${updatedNames.length} 名：`, margin: "md", size: "sm", color: "#888888" },
                  { type: "text", text: updatedNames.length > 0 ? updatedNames.join("、") : "（まだ誰もいないよ）", margin: "sm", wrap: true, size: "md" },
                  
                  // --- ボタンエリア（3段構成） ---
                  {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    margin: "xl",
                    contents: [
                      {
                        type: "button",
                        style: "primary",
                        color: "#1DB954",
                        height: "sm",
                        action: { type: "message", label: "🙋‍♂️参加する", text: "参加！" }
                      },
                      {
                        type: "box",
                        layout: "horizontal",
                        spacing: "md",
                        contents: [
                          {
                            type: "button",
                            style: "primary",
                            color: "#FF6B6B",
                            flex: 1,
                            height: "sm",
                            action: { type: "message", label: "🏃 抜ける", text: "メンバーから抜ける" }
                          },
                          {
                            type: "button",
                            style: "primary",
                            color: "#68e694",
                            flex: 1,
                            height: "sm",
                            action: { type: "message", label: "♻️ リセット", text: "メンバーリセット" }
                          }
                        ]
                      },
                      {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: { type: "message", label: "🔙 決定してメニューへ", text: "メニュー" }
                      }
                    ]
                  }
                ]
              }
            }
          }
        ]
      });
    }
    
    // --- 登録（追加）中の自動受付ロジック ---
    if (groupData?.isRegistering && !["メンバー登録を開始", "登録状況を確認", "メンバーリセット", "メニュー"].includes(text)) {
      const userData = db.data.users.find((u: UserData) => u.userId === userId);
      let profile;
      let memberList: string[] = [];
      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        // profile.displayName を安全に使用
        if (g) memberList = g.memberNames;
      });
  
      try {
        profile = await client.getProfile(userId);
      } catch (error) {
        // 【ステップ1】友だち追加が必要な人への案内
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: "flex",
            altText: "メンバー登録のお願い",
            contents: {
              type: "bubble",
              body: {
                type: "box", layout: "vertical", spacing: "md", contents: [
                  // タイトル
                  { type: "text", text: "⚠️ メンバー登録ができなかったよ", weight: "bold", size: "md", color: "#FF6B6B" },
                  // 理由の説明
                  { type: "text", text: "メンバー登録をするためには、以下の2ステップの準備が必要だよ！", wrap: true, size: "sm", margin: "md" },
                  // ステップの明記
                  {
                    type: "box", layout: "vertical", margin: "lg", spacing: "sm", backgroundColor: "#f8f8f8", paddingAll: "md", cornerRadius: "sm",
                    contents: [
                      { type: "text", text: "① カラキンを「友だち追加」", size: "xs", weight: "bold" },
                      { type: "text", text: "② 個チャで「簡易設定」に回答", size: "xs", weight: "bold" }
                    ]
                  },
                  // アクションボタン
                  {
                    type: "button", style: "primary", color: "#06C755", margin: "xl",
                    action: { 
                      type: "uri", label: "🤝 友達追加する", 
                      uri: "https://line.me/R/ti/p/@988bebmh"
                    }
                  },
                  { type: "text", text: "※追加したら、個チャで簡易設定をしてね！", size: "xxs", color: "#aaaaaa", align: "center" }
                ]
              }
            }
          },
          {
            type: "flex",
            altText: "メンバー更新",
            contents: {
              type: "bubble",
              body: {
                type: "box", layout: "vertical", contents: [
                  { type: "text", text: "👥 メンバー追加中", weight: "bold", size: "lg", color: "#1DB954" },
                  { type: "separator", margin: "md" },
                  { type: "text", text: `現在 ${memberList.length} 名：`, margin: "md", size: "sm", color: "#888888" },
                  { type: "text", text: memberList.length > 0 ? memberList.join("、") : "（まだ誰もいないよ）", margin: "sm", wrap: true, size: "md" },
                  // --- ボタンエリアの開始 ---
                  {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    margin: "xl",
                    contents: [
                      // 1段目：メイン登録（単独）
                      {
                        type: "button",
                        style: "primary",
                        color: "#1DB954",
                        height: "sm",
                        action: {
                          type: "message",
                          label: "🙋‍♂️ 参加する",
                          text: "参加！"
                        }
                      }, 
                      // 2段目：抜けるとリセットを横並び
                      {
                        type: "box",
                        layout: "horizontal",
                        spacing: "md",
                        contents: [
                          {
                            type: "button",
                            style: "primary",
                            color: "#FF6B6B", // 抜ける（赤系）
                            flex: 1,
                            height: "sm",
                            action: {
                              type: "message",
                              label: "🏃 抜ける",
                              text: "メンバーから抜ける"
                            }
                          },
                          {
                            type: "button",
                            style: "primary",
                            color: "#68e694", // リセット（緑系）
                            flex: 1,
                            height: "sm",
                            action: {
                              type: "message",
                              label: "♻️ リセット",
                              text: "メンバーリセット"
                            }
                          }
                        ]
                      },
                      // 3段目：終了ボタン（単独）
                      {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: {
                          type: "message",
                          label: "🔙 決定してメニューへ",
                          text: "メニュー"
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }]
        });
      }

      // 【ステップ2】友だち追加済みだが、曲が0曲（設定未完了）の人への案内
      if (!userData || !userData.mySongs || userData.mySongs.length === 0) {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: "flex",
            altText: "簡易設定のお願い",
            contents: {
              type: "bubble",
              body: {
                type: "box", layout: "vertical", spacing: "md", contents: [
                  { type: "text", text: "🎫 簡易設定のお願い！", weight: "bold", size: "md", color: "#FF6B6B" },
                  { type: "text", text: `みんなとの一致曲を見つけるために、${profile.displayName}さんの歌える曲が知りたいな。`, wrap: true, size: "sm" },
                  { type: "text", text: "個チャで30秒の簡易設定をしてきてね！", size: "xs", color: "#888888", wrap: true },
                  {
                    type: "button", style: "primary", color: "#06C755", margin: "md",
                    action: { 
                      type: "uri", label: "💬 簡易設定（30秒）を始める", 
                      uri: "https://line.me/R/ti/p/@988bebmh" // ←そのまま診断開始
                    }
                  }
                ]
              }
            }
          },
          {
            type: "flex",
            altText: "メンバー更新",
            contents: {
              type: "bubble",
              body: {
                type: "box", layout: "vertical", contents: [
                  { type: "text", text: "👥 メンバー追加中", weight: "bold", size: "lg", color: "#1DB954" },
                  { type: "separator", margin: "md" },
                  { type: "text", text: `現在 ${memberList.length} 名：`, margin: "md", size: "sm", color: "#888888" },
                  { type: "text", text: memberList.length > 0 ? memberList.join("、") : "（まだ誰もいないよ）", margin: "sm", wrap: true, size: "md" },
                  // --- ボタンエリアの開始 ---
                  {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    margin: "xl",
                    contents: [
                      // 1段目：メイン登録（単独）
                      {
                        type: "button",
                        style: "primary",
                        color: "#1DB954",
                        height: "sm",
                        action: {
                          type: "message",
                          label: "🙋‍♂️ 参加する",
                          text: "参加！"
                        }
                      }, 
                      // 2段目：抜けるとリセットを横並び
                      {
                        type: "box",
                        layout: "horizontal",
                        spacing: "md",
                        contents: [
                          {
                            type: "button",
                            style: "primary",
                            color: "#FF6B6B", // 抜ける（赤系）
                            flex: 1,
                            height: "sm",
                            action: {
                              type: "message",
                              label: "🏃 抜ける",
                              text: "メンバーから抜ける"
                            }
                          },
                          {
                            type: "button",
                            style: "primary",
                            color: "#68e694", // リセット（緑系）
                            flex: 1,
                            height: "sm",
                            action: {
                              type: "message",
                              label: "♻️ リセット",
                              text: "メンバーリセット"
                            }
                          }
                        ]
                      },
                      // 3段目：終了ボタン（単独）
                      {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: {
                          type: "message",
                          label: "🔙 決定してメニューへ",
                          text: "メニュー"
                        }
                      }
                    ]
                  }
                ]
              }
            }
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

        // 2. ユーザー側の「現在地（activeGroupId）」を更新
        let u = data.users.find((x: UserData) => x.userId === userId);
        if (u) {
          u.activeGroupId = stateKey; // 今参加したグループIDを「アクティブ」として保存
        }
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
                  // --- ボタンエリアの開始 ---
                  {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    margin: "xl",
                    contents: [
                      // 1段目：メイン登録（単独）
                      {
                        type: "button",
                        style: "primary",
                        color: "#1DB954",
                        height: "sm",
                        action: {
                          type: "message",
                          label: "🙋‍♂️ 参加する",
                          text: "参加！"
                        }
                      }, 
                      // 2段目：抜けるとリセットを横並び
                      {
                        type: "box",
                        layout: "horizontal",
                        spacing: "md",
                        contents: [
                          {
                            type: "button",
                            style: "primary",
                            color: "#FF6B6B", // 抜ける（赤系）
                            flex: 1,
                            height: "sm",
                            action: {
                              type: "message",
                              label: "🏃 抜ける",
                              text: "メンバーから抜ける"
                            }
                          },
                          {
                            type: "button",
                            style: "primary",
                            color: "#68e694", // リセット（緑系）
                            flex: 1,
                            height: "sm",
                            action: {
                              type: "message",
                              label: "♻️ リセット",
                              text: "メンバーリセット"
                            }
                          }
                        ]
                      },
                      // 3段目：終了ボタン（単独）
                      {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: {
                          type: "message",
                          label: "🔙 決定してメニューへ",
                          text: "メニュー"
                        }
                      }
                    ]
                  }
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
        // ✅ 登録モードをOFFにする
        await db.update((data: Data) => {
            let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
            if (g) g.isRegistering = false;
        });

        const orderText = groupData?.lastOrder || "まだ順番を決めていないよ！";

        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
                type: "flex",
                altText: "順番の確認・提案",
                contents: {
                    type: "bubble",
                    body: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            // タイトル
                            { type: "text", text: "📋 現在の順番・提案", weight: "bold", size: "lg", color: "#1DB954" },
                            { type: "separator", margin: "md" },
                            // 順番表示エリア
                            {
                                type: "box",
                                layout: "vertical",
                                margin: "lg",
                                backgroundColor: "#f0f0f0",
                                paddingAll: "md",
                                cornerRadius: "sm",
                                contents: [
                                    { type: "text", text: orderText, wrap: true, size: "sm", color: "#333333" }
                                ]
                            },
                            // ボタンエリア（3段構成）
                            {
                                type: "box",
                                layout: "vertical",
                                spacing: "md",
                                margin: "xl",
                                contents: [
                                    // 1段目：ソロとペアを横並び
                                    {
                                        type: "box",
                                        layout: "horizontal",
                                        spacing: "md",
                                        contents: [
                                            {
                                                type: "button",
                                                style: "primary",
                                                color: "#1DB954",
                                                flex: 1,
                                                height: "sm",
                                                action: { type: "message", label: "👤 一人で", text: "ソロ順番提案" }
                                            },
                                            {
                                                type: "button",
                                                style: "primary",
                                                color: "#1DB954",
                                                flex: 1,
                                                height: "sm",
                                                action: { type: "message", label: "👫 ペアで", text: "ペア順番提案" }
                                            }
                                        ]
                                    },
                                    // 2段目：戻るボタン
                                    {
                                        type: "button",
                                        style: "secondary",
                                        height: "sm",
                                        action: { type: "message", label: "🔙 戻る", text: "メニュー" }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }]
        });
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

      return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
                type: "flex",
                altText: "順番の確認・提案",
                contents: {
                    type: "bubble",
                    body: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            // タイトル
                            { type: "text", text: "📋 新しい順番", weight: "bold", size: "lg", color: "#1DB954" },
                            { type: "separator", margin: "md" },
                            // 順番表示エリア
                            {
                                type: "box",
                                layout: "vertical",
                                margin: "lg",
                                backgroundColor: "#f0f0f0",
                                paddingAll: "md",
                                cornerRadius: "sm",
                                contents: [
                                    { type: "text", text: orderText, wrap: true, size: "sm", color: "#333333" }
                                ]
                            },
                            // ボタンエリア（3段構成）
                            {
                                type: "box",
                                layout: "vertical",
                                spacing: "md",
                                margin: "xl",
                                contents: [
                                    // 1段目：ソロとペアを横並び
                                    {
                                        type: "box",
                                        layout: "horizontal",
                                        spacing: "md",
                                        contents: [
                                            {
                                                type: "button",
                                                style: "primary",
                                                color: "#1DB954",
                                                flex: 1,
                                                height: "sm",
                                                action: { type: "message", label: "👤 一人で", text: "ソロ順番提案" }
                                            },
                                            {
                                                type: "button",
                                                style: "primary",
                                                color: "#1DB954",
                                                flex: 1,
                                                height: "sm",
                                                action: { type: "message", label: "👫 ペアで", text: "ペア順番提案" }
                                            }
                                        ]
                                    },
                                    // 2段目：戻るボタン
                                    {
                                        type: "button",
                                        style: "secondary",
                                        height: "sm",
                                        action: { type: "message", label: "🔙 戻る", text: "メニュー" }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }]
      });
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
      const combined = names.map((name: string, i: number) => ({ id: ids[i], name }));
      combined.sort(() => Math.random() - 0.5);

      const sIds = combined.map((c: { id: string; name: string }) => c.id);
      const sNames = combined.map((c: { id: string; name: string }) => c.name);

      let teamsTexts: string[] = [];
      let teamsIds: string[][] = []; 
      let teamCount = 1; // ★追加：順番カウント用の変数

      // --- チーム分けロジック ---
      if (sNames.length === 3) {
        // 全員で3人の場合はいきなりトリオ
        teamsTexts.push(`${teamCount}. ${sNames.join(" ＆ ")} (トリオ)`); // ★変更
        teamsIds.push([sIds[0], sIds[1], sIds[2]]);
      } else {
        for (let i = 0; i < sNames.length; i += 2) {
          // 残りが3人になったらトリオにして終了
          if (sNames.length - i === 3) {
            teamsTexts.push(`${teamCount}. ${sNames.slice(i).join(" ＆ ")} (トリオ)`); // ★変更
            teamsIds.push([sIds[i], sIds[i+1], sIds[i+2]]);
            break;
          } 
          
          if (sNames[i + 1]) {
            // ペア作成
            teamsTexts.push(`${teamCount}. ${sNames[i]} ＆ ${sNames[i + 1]}`); // ★変更
            teamsIds.push([sIds[i], sIds[i+1]]);
          } else {
            // 余りが出たらソロ
            teamsTexts.push(`${teamCount}. ${sNames[i]} (ソロ)`); // ★変更
            teamsIds.push([sIds[i]]);
          }
          
          teamCount++; // ★追加：次の番号へ
        }
      }

      const orderText = `👫 チームの順番：\n${teamsTexts.join("\n")}`;

      await db.update((data: Data) => {
        let g = data.groups.find((x: GroupData) => x.groupId === stateKey);
        if (g) {
          g.lastOrder = orderText;
          g.lastTeams = teamsIds; 
        }
      });

      return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
                type: "flex",
                altText: "順番の確認・提案",
                contents: {
                    type: "bubble",
                    body: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            // タイトル
                            { type: "text", text: "📋 新しい順番", weight: "bold", size: "lg", color: "#1DB954" },
                            { type: "separator", margin: "md" },
                            // 順番表示エリア
                            {
                                type: "box",
                                layout: "vertical",
                                margin: "lg",
                                backgroundColor: "#f0f0f0",
                                paddingAll: "md",
                                cornerRadius: "sm",
                                contents: [
                                    { type: "text", text: orderText, wrap: true, size: "sm", color: "#333333" }
                                ]
                            },
                            // ボタンエリア（3段構成）
                            {
                                type: "box",
                                layout: "vertical",
                                spacing: "md",
                                margin: "xl",
                                contents: [
                                    // 1段目：ソロとペアを横並び
                                    {
                                        type: "box",
                                        layout: "horizontal",
                                        spacing: "md",
                                        contents: [
                                            {
                                                type: "button",
                                                style: "primary",
                                                color: "#1DB954",
                                                flex: 1,
                                                height: "sm",
                                                action: { type: "message", label: "👤 一人で", text: "ソロ順番提案" }
                                            },
                                            {
                                                type: "button",
                                                style: "primary",
                                                color: "#1DB954",
                                                flex: 1,
                                                height: "sm",
                                                action: { type: "message", label: "👫 ペアで", text: "ペア順番提案" }
                                            }
                                        ]
                                    },
                                    // 2段目：戻るボタン
                                    {
                                        type: "button",
                                        style: "secondary",
                                        height: "sm",
                                        action: { type: "message", label: "🔙 戻る", text: "メニュー" }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }]
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

      const usersInDb = db.data.users;

      // ★【追加】マイリストが空のメンバーがいないか事前にチェック
      const allTeamUserIds = teams.flat(); 
      const emptyListUsers = allTeamUserIds
        .map((id: string) => usersInDb.find((u: UserData) => u.userId === id))
        .filter((u: UserData | undefined): u is UserData => {
          // uが存在し、かつmySongsが0件の場合
          return !!u && (!u.mySongs || u.mySongs.length === 0);
        });

      if (emptyListUsers.length > 0) {
        // mapの引数 u にも型 (u: UserData) を指定し、? を外してスッキリさせる
        const names = emptyListUsers.map((u: UserData) => u.displayName).join("さん、");
        
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ 
            type: "text", 
            text: `⚠️ 提案ができないよ！\n\n${names}さんのマイリストが空っぽです。個人チャットの「簡易設定」などで曲を登録してから、もう一度提案してね！` 
          },
          {
            type: "image",
            // HTTPSの直リンクである必要があります
            originalContentUrl: "https://github.com/naoki1679/LINEBot-test/blob/main/addSong.png?raw=true", 
            previewImageUrl: "https://github.com/naoki1679/LINEBot-test/blob/main/addSong.png?raw=true"
          },...getGroupMainMenu()]
        });
      }

      teams.forEach((teamIds: string[], index: number) => {
        // チーム全員のプロフィール、曲リスト、アーティストリストを取得
        const teamMembers = teamIds.map(id => {
          const u = usersInDb.find((x: UserData) => x.userId === id);
          return { 
            name: u?.displayName || "不明", 
            songs: u?.mySongs || [],
            artists: u?.myArtists || [] // ★アーティストリストを追加
          };
        });

        // 1. 共通の「曲」を抽出
        let commonSongs = teamMembers[0].songs;
        for (let i = 1; i < teamMembers.length; i++) {
          commonSongs = commonSongs.filter((song: string) => teamMembers[i].songs.includes(song));
        }

        // 2. 共通の「アーティスト」を抽出
        let commonArtists = teamMembers[0].artists;
        for (let i = 1; i < teamMembers.length; i++) {
          commonArtists = commonArtists.filter((artist: string) => teamMembers[i].artists.includes(artist));
        }

        const memberNames = teamMembers.map(m => m.name).join("＆");

        if (commonSongs.length > 0) {
          // 曲が一致した場合
          resultMessages.push(`\n▼ ${memberNames}\n【一致曲】\n・${commonSongs.join("\n・")}`);
        } else if (commonArtists.length > 0) {
          // 曲は一致しないが、アーティストが一致した場合
          resultMessages.push(`\n▼ ${memberNames}\n【一致アーティスト】\n・${commonArtists.join("\n・")}\n（この人の曲なら共通の持ち歌があるかも！）`);
        } else {
          // どちらも一致しなかった場合
          resultMessages.push(`\n▼ ${memberNames}\n（一致する曲もアーティストもなかったよ…💦）`);
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
      type: "flex",
      altText: "個人メニュー",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954", // ヘッダーだけ色を付けてブランド感を出す
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "🎤 個人メニュー",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md", // 仕切り線の代わりに、ここでボタン同士の隙間を作る
          contents: [
            // 1. 曲の登録
            {
              type: "button",
              style: "secondary", // 全てこのスタイルで統一
              height: "sm",
              action: { type: "message", label: "🎵 曲の登録", text: "曲の登録" }
            },
            // 2. マイリスト
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "📋 マイリスト確認・編集", text: "マイリストの確認、編集" }
            },
            // 3. 履歴
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "🕒 カラキン履歴", text: "カラキン履歴" }
            },
            // 4. 説明
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "❓ カラキンの説明", text: "カラキンの説明" }
            }
          ]
        }
      }
    }];

    //　---曲登録中メニュー---
    const getRegMenu = (infoText: string): line.messagingApi.Message[] => [
        {
          type: "flex",
          altText: "登録中メニュー",
          contents: {
            type: "bubble",
            size: "kilo",
            header: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#1DB954",
              paddingAll: "lg",
              contents: [
                {
                  type: "text",
                  text: "🎵 登録モード", // 登録中であることがわかるタイトル
                  color: "#ffffff",
                  weight: "bold",
                  size: "xl",
                  align: "center"
                }
              ]
            },
            body: {
              type: "box",
              layout: "vertical",
              paddingAll: "lg",
              spacing: "md",
              contents: [
                // 1. 通知メッセージ表示エリア（結果をここに表示）
                {
                  type: "text",
                  text: infoText,
                  wrap: true,
                  align: "center",
                  weight: "bold",
                  color: "#333333",
                  size: "md"
                },
                // 余白を開けてボタンエリアへ
                {
                  type: "box",
                  layout: "vertical",
                  margin: "xl",
                  spacing: "sm",
                  contents: [
                    // 2. 一曲消す
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: { type: "message", label: "↩️ 直前の一曲消す", text: "一曲消す" }
                    },
                    // 3. リスト確認
                    {
                      type: "button",
                      style: "secondary",
                      height: "sm",
                      action: { type: "message", label: "📋 リスト確認", text: "リスト確認" }
                    },
                    // 4. 登録終了（区切りとして色を変えるか、統一するか。今回は統一）
                    {
                      type: "button",
                      style: "primary", // 終了は重要なので緑（primary）にして目立たせる
                      color: "#1DB954",
                      height: "sm",
                      action: { type: "message", label: "✅ 登録終了", text: "登録終了" }
                    }
                  ]
                }
              ]
            }
          }
        }
      ];

    // マイリスト管理用メニュー（Flex または Buttons）
    const getMyListMenu = (): line.messagingApi.Message[] => [{
      type: "flex",
      altText: "マイリスト管理メニュー",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
        type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "📋 マイリスト管理",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md",
          contents: [
            // 1. リスト確認ボタン
            {
            type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "👀 リストを確認する", text: "マイリスト確認" }
            },
            // 2. リスト編集ボタン
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "✂️ リストを編集する", text: "マイリスト編集" }
            },
            // セパレーター（区切り線）
            { type: "separator", margin: "lg" },
            // 3. 戻るボタン
            {
              type: "button",
              style: "link", // 戻るボタンはリンクスタイルで控えめに
              height: "sm",
              margin: "md",
              color: "#888888",
              action: { type: "message", label: "🏠 メニューに戻る", text: "メニュー" }
            }
          ]
        }
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

    // --- 1.5 簡易設定 ---
    if (text === "簡易設定を始める") {
        return sendSetupQuestion(client, event.replyToken, 0);
    }

    if (text === "カラキンの使い方") {
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          { type: "text", text: "カラキンはカラオケを盛り上げるためのBotだよ！" },
          {
            type: "flex",
            altText: "カラキン操作ガイド",
            contents: {
              type: "carousel",
              contents: [
                // 1枚目：個人チャット（準備編）
                {
                  type: "bubble",
                  size: "kilo",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#3b5998", // 青色で区別
                    contents: [
                      { type: "text", text: "🏠 個チャ：自分専用の歌本", color: "#ffffff", weight: "bold", size: "sm" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    contents: [
                      { type: "text", text: "曲を増やすほど提案精度がUP！", weight: "bold", size: "sm", color: "#333333" },
                      { type: "separator" },
                      {
                        type: "text",
                        text: "⚡ 簡易設定（30秒）\n最初の10曲診断でベースを作成！\n\n🎵 曲の登録\n「検索」から持ち歌をどんどん追加！\n\n📋 リストの確認・編集\n自分の「十八番」をいつでも管理！\n\n🕒 カラキン履歴\n参加しているグループの状況を確認！",
                        wrap: true,
                        size: "xs",
                        color: "#555555"
                        // lineSpacing は削除しました
                      }
                    ]
                  },
                  footer: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      { type: "text", text: "💡 空いた時間にリストを充実させよう", size: "xxs", color: "#888888", align: "center" }
                    ]
                  }
                },
                // 2枚目：グループチャット（本番編）
                {
                  type: "bubble",
                  size: "kilo",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#1DB954", // 緑色で区別
                    contents: [
                      { type: "text", text: "👥 グループ：みんなで遊ぶ", color: "#ffffff", weight: "bold", size: "sm" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    contents: [
                      { type: "text", text: "本番で盛り上がる4つの機能", weight: "bold", size: "sm", color: "#333333" },
                      { type: "separator" },
                      {
                        type: "text",
                        text: "⚙️ メンバー管理\n「参加！」で歌本をみんなと同期！\n\n🎤 順番の提案\nソロやペアの歌唱順を自動作成！\n\n🎵 共通曲の提案\n2人の共通曲やアーティストを抽出！\n\n🎮 遊び方の提案\nもっと楽しくなる企画をボットが提案！",
                        wrap: true,
                        size: "xs",
                        color: "#555555"
                        // lineSpacing は削除しました
                      }
                    ]
                  },
                  footer: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      { type: "text", text: "💡 迷ったらまず「参加！」から", size: "xxs", color: "#888888", align: "center" }
                    ]
                  }
                }
              ]
            }
          },
          {
            type: "image",
            // HTTPSの直リンクである必要があります
            originalContentUrl: "https://github.com/naoki1679/LINEBot-test/blob/main/Gemini_Generated_Image_l71s4bl71s4bl71s.png?raw=true", 
            previewImageUrl: "https://github.com/naoki1679/LINEBot-test/blob/main/Gemini_Generated_Image_l71s4bl71s4bl71s.png?raw=true"
          },
          ...getPrivateMenu()
        ]
      });
    }


    // --- 3. 質問を表示する共通関数 ---
    async function sendSetupQuestion(client: any, replyToken: string, index: number) {
        const song = BEGINNER_SONGS[index];
        const progress = `(${index + 1} / ${BEGINNER_SONGS.length})`;

        return client.replyMessage({
            replyToken: replyToken,
            messages: [{
                type: "template",
                altText: "簡易設定",
                template: {
                    type: "confirm",
                    text: `${progress}\n「${song}」は歌えますか？`,
                    actions: [
                        { type: "postback", label: "歌える！", data: `setup_save:${index}`, displayText: "歌える！" },
                        { type: "postback", label: "歌えない", data: `setup_skip:${index}`, displayText: "次へ" }
                    ]
                }
            }]
        });
    }

    // --- 2. 子階層：曲の登録モード開始 ---
    if (text === "曲の登録") {
      const profile = await client.getProfile(userId);
      await db.update((data: Data) => {
        let u = data.users.find((x: UserData) => x.userId === userId);
        if (!u) data.users.push({ userId, displayName: profile.displayName, mySongs: [], myArtists: [], isRegisteringSong: true });
        else u.isRegisteringSong = true;
      });
      return client.replyMessage({ replyToken: event.replyToken, messages: getRegMenu("【曲の登録】\n登録したい曲名や歌手名を入力して送ってね！") });
    }

    // --- 3. 登録モード中の処理 ---
    if (userData?.isRegisteringSong) {
      if (text === "一曲消す") {
        let deletedSong = ""; // ① 消えた曲名を保存する変数を用意

        await db.update((data: Data) => {
          let u = data.users.find((x: UserData) => x.userId === userId);
          if (u && u.mySongs.length > 0) {
             // ② pop()の結果（消えた曲名）を変数に入れる
             const popped = u.mySongs.pop();
             if (popped) deletedSong = popped;
          }
        });

        // ③ メッセージに組み込む
        const infoText = deletedSong 
            ? `🗑️「${deletedSong}」を削除したよ！` 
            : "削除できる曲がなかったよ！";

        return client.replyMessage({ 
            replyToken: event.replyToken, 
            messages: getRegMenu(`${infoText}\n\n【曲の登録】\n登録したい曲名や歌手名を入力して送ってね！`) 
        });
      }

      if (text === "リスト確認") {
        const hasSongs = userData.mySongs.length > 0;
        const listText = hasSongs 
            ? `【現在のリスト】\n・${userData.mySongs.join("\n・")}` 
            : "登録はまだないよ！";
        
        return client.replyMessage({ 
            replyToken: event.replyToken, 
            messages: [
                // 1通目：リストをただのテキストとして表示（見やすい）
                { type: "text", text: listText },
                // 2通目：操作メニューを別で表示
                ...getRegMenu("【曲の登録】\n登録したい曲名や歌手名を入力して送ってね！") 
            ] 
        });
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

    // ★ 履歴メニュー（Flex Message版）
    const getHistorySelectMenu = (): line.messagingApi.Message[] => [{
      type: "flex",
      altText: "履歴メニュー",
      contents: {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#1DB954",
          paddingAll: "lg",
          contents: [
            {
              type: "text",
              text: "📜 履歴メニュー",
              color: "#ffffff",
              weight: "bold",
              size: "xl",
              align: "center"
            }
          ]
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "lg",
          spacing: "md",
          contents: [
            // 1. グループ情報
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "📊 グループ情報", text: "グループ情報" }
            },
            // 2. 共通曲確認
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "🎵 任意の人との共通曲", text: "共通曲確認" }
            },
            // 区切り線
            { type: "separator", margin: "lg" },
            // 3. 戻るボタン
            {
              type: "button",
              style: "link",
              height: "sm",
              color: "#888888",
              margin: "md",
              action: { type: "message", label: "🏠 メニューに戻る", text: "メニュー" }
            }
          ]
        }
      }
    }];

    // [分岐] カラキン履歴ボタンが押されたら選択肢を出す
    if (text === "カラキン履歴") {
       return client.replyMessage({ replyToken: event.replyToken, messages: getHistorySelectMenu() });
    }

    // --- ★修正版（完成形）：都度計算ロジック ---
    if (text === "グループ情報" || text === "情報更新") {
      const activeGroupId = userData?.activeGroupId;
      
      // 1. 参加中のグループIDがない場合
      if (!activeGroupId) {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "履歴がないよ💦\nグループで「参加！」を押してね。" }]
        });
      }

      // 2. グループデータを取得
      const activeGroup = db.data.groups.find((g: GroupData) => g.groupId === activeGroupId);
      if (!activeGroup) {
         return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "グループが見つからないよ💦" }]
        });
      }

      // 3. ★都度計算！（ここがポイント）
      // 保存してある「チーム分け(lastTeams)」を使って、今この瞬間の最新データで計算する
      const currentTeams = activeGroup.lastTeams || [];
      const realtimeCommonSongs = calculateCommonSongs(db, currentTeams);
      
      // ※ ここで DBへの save は行いません！

      // 4. 表示用データの準備
      const members = activeGroup.memberNames.length > 0 ? activeGroup.memberNames.join("、") : "（なし）";
      const orderText = activeGroup.lastOrder || "（まだ決めていません）";
      
      // 5. Flexメッセージで表示
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "flex",
          altText: "現在の参加状況",
          contents: {
            type: "bubble",
            size: "mega",
            header: {
              type: "box", layout: "vertical", backgroundColor: "#333333",
              contents: [
                { type: "text", text: "📱 カラキン履歴", color: "#ffffff", weight: "bold", size: "md" },
                { type: "text", text: "現在のデータで再計算しました", color: "#aaaaaa", size: "xxs" }
              ]
            },
            body: {
              type: "box", layout: "vertical", spacing: "lg",
              contents: [
                // セクション：メンバー
                {
                  type: "box", layout: "vertical", spacing: "sm",
                  contents: [
                    { type: "text", text: "👥 参加メンバー", size: "xs", color: "#888888", weight: "bold" },
                    { type: "text", text: members, wrap: true, size: "sm", color: "#333333" }
                  ]
                },
                { type: "separator" },
                // セクション：次の順番
                {
                  type: "box", layout: "vertical", spacing: "sm",
                  contents: [
                    { type: "text", text: "🎲 現在の順番", size: "xs", color: "#888888", weight: "bold" },
                    { type: "text", text: orderText, wrap: true, size: "sm", color: "#333333" }
                  ]
                },
                { type: "separator" },
                // セクション：共通曲（都度計算の結果）
                {
                  type: "box", layout: "vertical", spacing: "sm",
                  contents: [
                    { type: "text", text: "🎵 共通曲", size: "xs", color: "#888888", weight: "bold" },
                    { type: "text", text: realtimeCommonSongs, wrap: true, size: "sm", color: "#333333" }
                  ]
                }
              ]
            },
            // フッター：更新ボタン
            footer: {
              type: "box", layout: "horizontal", spacing: "md", 
              contents: [
                { 
                  type: "button", style: "secondary", height: "sm", flex: 1,
                  action: { type: "message", label: "↩️ メニュー", text: "メニュー" } 
                },
                { 
                  type: "button", style: "primary", height: "sm", flex: 1, color: "#1DB954",
                  action: { type: "message", label: "🔄 最新に更新", text: "情報更新" } 
                }
              ]
            }
          }
        }]
      });
    }

    // [B] 共通曲チェック（新機能） - 全員選択ボタン付き
    if (text === "共通曲確認") {
      const activeGroupId = userData?.activeGroupId;
      if (!activeGroupId) return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "まずはグループに参加してね！" }] });
      
      const activeGroup = db.data.groups.find((g: GroupData) => g.groupId === activeGroupId);
      if (!activeGroup || activeGroup.memberIds.length === 0) return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "メンバーがまだいないみたいだよ。" }] });

      // 初期化
      currentState.compareTargets = [];

      // 自分以外のメンバーIDリスト
      const targetIds = activeGroup.memberIds.filter((id: string) => id !== userId);

      if (targetIds.length === 0) {
        return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "自分以外にメンバーがいないみたい💦" }] });
      }

      // メンバーグリッド作成
      const rows: any[] = [];
      for (let i = 0; i < targetIds.length; i += 2) {
          const rowContents = [];
          
          // 左
          const id1 = targetIds[i];
          const name1 = activeGroup.memberNames[activeGroup.memberIds.indexOf(id1)] || "不明";
          rowContents.push({
              type: "button", style: "secondary", height: "sm", flex: 1, margin: "sm",
              action: { type: "postback", label: name1, data: `toggle_compare:${id1}`, displayText: `${name1}さんを選択` }
          });

          // 右
          if (i + 1 < targetIds.length) {
              const id2 = targetIds[i + 1];
              const name2 = activeGroup.memberNames[activeGroup.memberIds.indexOf(id2)] || "不明";
              rowContents.push({
                  type: "button", style: "secondary", height: "sm", flex: 1, margin: "sm",
                  action: { type: "postback", label: name2, data: `toggle_compare:${id2}`, displayText: `${name2}さんを選択` }
              });
          } else {
              rowContents.push({ type: "spacer", size: "sm" });
          }
          rows.push({ type: "box", layout: "horizontal", spacing: "md", contents: rowContents });
      }

      return client.replyMessage({ 
        replyToken: event.replyToken, 
        messages: [{
          type: "flex",
          altText: "共通曲チェック",
          contents: {
            type: "bubble",
            header: {
              type: "box", layout: "vertical", backgroundColor: "#1DB954",
              contents: [{ type: "text", text: "🎵 誰と比べる？", color: "#ffffff", weight: "bold", align: "center" }]
            },
            body: {
              type: "box", layout: "vertical",
              contents: [
                { type: "text", text: "比較したい人をタップしてね。\n最後に「決定」を押すと共通曲が出るよ！", wrap: true, size: "sm", color: "#666666" },
                { type: "separator", margin: "md" },
                
                // ★追加：全員選択ボタン
                {
                    type: "button",
                    style: "primary", // 目立つように
                    color: "#333333", // 黒っぽい色で引き締め
                    height: "sm",
                    margin: "lg",
                    action: { type: "postback", label: "✅ 全員を選択", data: "toggle_all", displayText: "全員を選択！" }
                },

                // メンバー一覧グリッド
                { type: "box", layout: "vertical", margin: "md", spacing: "sm", contents: rows }
              ]
            },
            footer: {
              type: "box", layout: "vertical", spacing: "sm",
              contents: [
                { type: "button", style: "primary", color: "#1DB954", height: "sm", action: { type: "postback", label: "✅ 決定", data: "exec_compare", displayText: "共通曲を計算！" } },
                { type: "button", style: "link", height: "sm", color: "#888888", action: { type: "message", label: "キャンセル", text: "メニュー" } }
              ]
            }
          }
        }]
      });
    }

    if (text === "カラキンの説明") {
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          { type: "text", text: "カラキンはカラオケを盛り上げるためのBotだよ！" },
          {
            type: "flex",
            altText: "カラキン操作ガイド",
            contents: {
              type: "carousel",
              contents: [
                // 1枚目：個人チャット（準備編）
                {
                  type: "bubble",
                  size: "kilo",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#3b5998", // 青色で区別
                    contents: [
                      { type: "text", text: "🏠 個チャ：自分専用の歌本", color: "#ffffff", weight: "bold", size: "sm" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    contents: [
                      { type: "text", text: "曲を増やすほど提案精度がUP！", weight: "bold", size: "sm", color: "#333333" },
                      { type: "separator" },
                      {
                        type: "text",
                        text: "⚡ 簡易設定（30秒）\n最初の10曲診断でベースを作成！\n\n🎵 曲の登録\n「検索」から持ち歌をどんどん追加！\n\n📋 リストの確認・編集\n自分の「十八番」をいつでも管理！\n\n🕒 カラキン履歴\n参加しているグループの状況を確認！",
                        wrap: true,
                        size: "xs",
                        color: "#555555"
                        // lineSpacing は削除しました
                      }
                    ]
                  },
                  footer: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      { type: "text", text: "💡 空いた時間にリストを充実させよう", size: "xxs", color: "#888888", align: "center" }
                    ]
                  }
                },
                // 2枚目：グループチャット（本番編）
                {
                  type: "bubble",
                  size: "kilo",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#1DB954", // 緑色で区別
                    contents: [
                      { type: "text", text: "👥 グループ：みんなで遊ぶ", color: "#ffffff", weight: "bold", size: "sm" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    spacing: "md",
                    contents: [
                      { type: "text", text: "本番で盛り上がる4つの機能", weight: "bold", size: "sm", color: "#333333" },
                      { type: "separator" },
                      {
                        type: "text",
                        text: "⚙️ メンバー管理\n「参加！」で歌本をみんなと同期！\n\n🎤 順番の提案\nソロやペアの歌唱順を自動作成！\n\n🎵 共通曲の提案\n2人の共通曲やアーティストを抽出！\n\n🎮 遊び方の提案\nもっと楽しくなる企画をボットが提案！",
                        wrap: true,
                        size: "xs",
                        color: "#555555"
                        // lineSpacing は削除しました
                      }
                    ]
                  },
                  footer: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      { type: "text", text: "💡 迷ったらまず「参加！」から", size: "xxs", color: "#888888", align: "center" }
                    ]
                  }
                }
              ]
            }
          },
          {
            type: "image",
            // HTTPSの直リンクである必要があります
            originalContentUrl: "https://github.com/naoki1679/LINEBot-test/blob/main/Gemini_Generated_Image_l71s4bl71s4bl71s.png?raw=true", 
            previewImageUrl: "https://github.com/naoki1679/LINEBot-test/blob/main/Gemini_Generated_Image_l71s4bl71s4bl71s.png?raw=true"
          },
          ...getMainMenu()
        ]
      });
    }
  }
  } finally {
    // ★ 処理が終わったらロックを解除
    // 通信の遅延などを考慮して、500ミリ秒（0.5秒）後に解除するとより安定します
    setTimeout(() => {
      activeLocks.delete(stateKey);
    }, 500);
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