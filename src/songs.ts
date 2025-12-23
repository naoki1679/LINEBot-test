// --- 曲の候補をジャンルごとに用意 ---
export const songs: Record<string, string[]> = {
  Jpop: [
    "Lemon / 米津玄師", "Pretender / Official髭男dism", "マリーゴールド / あいみょん", "白日 / King Gnu", "夜に駆ける / YOASOBI", "ドライフラワー / 優里", "群青 / YOASOBI", "怪獣の花唄 / Vaundy", "Subtitle / Official髭男dism", "アイラブユー / back number",
    "さよならエレジー / 菅田将暉", "水平線 / back number", "新時代 / Ado", "感電 / 米津玄師", "シンデレラボーイ / Saucy Dog", "きらり / 藤井 風", "打上花火 / DAOKO × 米津玄師", "高嶺の花子さん / back number", "猫 / DISH//", "ベテルギウス / 優里",
    "Mela! / 緑黄色社会", "恋 / 星野源", "花束を君に / 宇多田ヒカル", "ハルノヒ / あいみょん", "パプリカ / Foorin", "宿命 / Official髭男dism", "カメレオン / King Gnu", "喜劇 / 星野源", "残響散歌 / Aimer", "私は最強 / Mrs. GREEN APPLE",
    "点描の唄 / Mrs. GREEN APPLE", "まちがいさがし / 菅田将暉", "死ぬのがいいわ / 藤井 風", "なんでもないよ、 / マカロニえんぴつ", "Habit / SEKAI NO OWARI", "虹 / 菅田将暉", "裸の心 / あいみょん", "勿忘 / Awesome City Club", "炎 / LiSA", "Cry Baby / Official髭男dism",
    "ダンスホール / Mrs. GREEN APPLE", "美しい鰭 / スピッツ", "唱 / Ado", "晩餐歌 / tuki.", "ケセラセラ / Mrs. GREEN APPLE", "幾億光年 / Omoinotake", "満ちてゆく / 藤井 風", "タイムパラドックス / Vaundy", "ビリミリオン / 優里", "花火 / aiko"
  ],

  Anime: [
    "紅蓮華 / LiSA", "アイドル / YOASOBI", "残酷な天使のテーゼ / 高橋洋子", "君の知らない物語 / supercell", "Only my railgun / fripSide", "コネクト / ClariS", "ピースサイン / 米津玄師", "crossing field / LiSA", "シュガーソングとビターステップ / UNISON SQUARE GARDEN", "God knows... / 涼宮ハルヒ(C.V.平野綾)",
    "心臓を捧げよ！ / Linked Horizon", "おどるポンポコリン / B.B.クイーンズ", "Butter-Fly / 和田光司", "ウィーアー！ / きただにひろし", "ムーンライト伝説 / DALI", "1/3の純情な感情 / SIAM SHADE", "そばかす / JUDY AND MARY", "サムライハート (Some Like It Hot!!) / SPYAIR", "紅蓮の弓矢 / Linked Horizon", "ライオン / May'n/中島愛",
    "名探偵コナン メイン・テーマ / 大野克夫", "魂のルフラン / 高橋洋子", "創聖のアクエリオン / AKINO", "COLORS / FLOW", "GO!!! / FLOW", "ブルーバード / いきものがかり", "シルエット / KANA-BOON", "サインはB / B小町 アイ(CV:高橋李依)", "勇者 / YOASOBI", "青のすみか / キタニタツヤ",
    "SPECIALZ / King Gnu", "廻廻奇譚 / Eve", "ミックスナッツ / Official髭男dism", "KICK BACK / 米津玄師", "Bling-Bang-Bang-Born / Creepy Nuts", "オレンジ / SPYAIR", "晴る / ヨルシカ", "インフェルノ / Mrs. GREEN APPLE", "Sincerely / TRUE", "名前のない怪物 / EGOIST",
    " unravel / TK from 凛として時雨", "炎 / LiSA", "朝が来る / Aimer", "ハレ晴レユカイ / 平野綾・茅原実里・後藤邑子", "マジLOVE1000% / ST☆RISH", "Snow halation / μ's", "うまぴょい伝説 / ウマ娘 プリティーダービー", "READY!! / 765PRO ALLSTARS", "oath sign / LiSA", "ignite / 藍井エイル"
  ],

  Rock: [
    "天体観測 / BUMP OF CHICKEN", "完全感覚Dreamer / ONE OK ROCK", "曇天 / DOES", "リライト / ASIAN KUNG-FU GENERATION", "小さな恋のうた / MONGOL800", "粉雪 / レミオロメン", "アゲハ蝶 / ポルノグラフィティ", "丸ノ内サディスティック / 椎名林檎", "Ultra Soul / B'z", "終わりなき旅 / Mr.Children",
    "The Beginning / ONE OK ROCK", "Wherever you are / ONE OK ROCK", "クロノスタシス / BUMP OF CHICKEN", "カルマ / BUMP OF CHICKEN", "ソラニン / ASIAN KUNG-FU GENERATION", "栞 / CreepHyp", "イト / クリープハイプ", "ないものねだり / KANA-BOON", "ワタリドリ / [Alexandros]", "閃光 / [Alexandros]",
    "逆光 / Vaundy", "一途 / King Gnu", "飛行艇 / King Gnu", "Black Cherry / Acid Black Cherry", "誘惑 / GLAY", "HONEY / L'Arc〜en〜Ciel", "Driver's High / L'Arc〜en〜Ciel", "紅 / X JAPAN", "リンダリンダ / THE BLUE HEARTS", "TRAIN-TRAIN / THE BLUE HEARTS",
    "15の夜 / 尾崎豊", "ズルい女 / シャ乱Q", "女々しくて / ゴールデンボンバー", "ともに / WANIMA", "シグナル / WANIMA", "大不正解 / back number", "青と夏 / Mrs. GREEN APPLE", "StaRt / Mrs. GREEN APPLE", "Walking with You / Novelbright", "ツキミソウ / Novelbright",
    "あつまれ！パーティーピーポー / ヤバイTシャツ屋さん", "狂乱 Hey Kids!! / THE ORAL CIGARETTES", "Deeper Deeper / ONE OK ROCK", "Re:make / ONE OK ROCK", "長く短い祭 / 椎名林檎", "本能 / 椎名林檎", "カサブタ / 千綿ヒデノリ", "Butterflies / BUMP OF CHICKEN", "新宝島 / サカナクション", "ミュージック / サカナクション"
  ],

  Ballad: [
    "奏（かなで） / スキマスイッチ", "First Love / 宇多田ヒカル", "ハナミズキ / 一青窈", "雪の華 / 中島美嘉", "366日 / HY", "Story / AI", "三日月 / 絢香", "愛唄 / GReeeeN", "キセキ / GReeeeN", "魔法の絨毯 / 川崎鷹也",
    "115万キロのフィルム / Official髭男dism", "瞬き / back number", "Happy Birthday / back number", "楓 / スピッツ", "チェリー / スピッツ", "糸 / 中島みゆき", "ひまわりの約束 / 秦 基博", "栄光の架橋 / ゆず", "家族になろうよ / 福山雅治", "桜坂 / 福山雅治",
    "未来予想図II / DREAMS COME TRUE", "LOVE LOVE LOVE / DREAMS COME TRUE", "レイニーブルー / 徳永英明", "瞳をとじて / 平井堅", "POP STAR / 平井堅", "たしかなこと / 小田和正", "言葉にできない / 小田和正", "Everything / MISIA", "アイノカタチ / MISIA feat.HIDE(GReeeeN)", "指輪 / back number",
    "別の人の彼女になったよ / wacci", "プロローグ / Uru", "それを愛と呼ぶなら / Uru", "点描の唄 (feat. 井上苑子) / Mrs. GREEN APPLE", "僕のこと / Mrs. GREEN APPLE", "そっけない / RADWIMPS", "正解 / RADWIMPS", "スパークル / RADWIMPS", "なんでもないや / RADWIMPS", "猫 ～THE FIRST TAKE ver.～ / DISH//",
    "まちがいさがし / 菅田将暉", "沈丁花 / DISH//", "レオ / 優里", "シャッター / 優里", "花束 / back number", "クリスマスソング / back number", "ハッピーエンド / back number", "シングルベッド / シャ乱Q", "壊れかけのRadio / 徳永英明", "I LOVE YOU / 尾崎豊"
  ],

  Idol: [
    "ヘビーローテーション / AKB48", "恋するフォーチュンクッキー / AKB48", "フライングゲット / AKB48", "365日の紙飛行機 / AKB48", "ポニーテールとシュシュ / AKB48", "シンクロニシティ / 乃木坂46", "インフルエンサー / 乃木坂46", "サヨナラの意味 / 乃木坂46", "帰り道は遠回りしたくなる / 乃木坂46", "裸足でSummer / 乃木坂46",
    "サイレントマジョリティー / 欅坂46", "不協和音 / 欅坂46", "黒い羊 / 欅坂46", "キュン / 日向坂46", "ドレミソラシド / 日向坂46", "行くぜっ！怪盗少女 / ももいろクローバーZ", "サラバ、愛しき悲しみたちよ / ももいろクローバーZ", "ニッポン饅頭 / LADYBABY", "チグハグ / THE SUPER FRUIT", "わたしの一番かわいいところ / FRUITS ZIPPER",
    "LOVEマシーン / モーニング娘。", "恋愛レボリューション21 / モーニング娘。", "ザ☆ピ〜ス！ / モーニング娘。", "世界に一つだけの花 / SMAP", "夜空ノムコウ / SMAP", "SHAKE / SMAP", "A・RA・SHI / 嵐", "Love so sweet / 嵐", "Happiness / 嵐", "Monster / 嵐",
    "One Love / 嵐", "カイト / 嵐", "koi-wazurai / King & Prince", "シンデレラガール / King & Prince", "ツキヨミ / King & Prince", "D.D. / Snow Man", "ブラザービート / Snow Man", "Dangerholic / Snow Man", "初心LOVE / なにわ男子", "サチアレ / なにわ男子",
    "Make you happy / NiziU", "Step and a step / NiziU", "CLAP CLAP / NiziU", "初心LOVE / なにわ男子", "LOVE TRIGGER / Snow Man", "GOAT / Number_i", "勇気100% / NYC", "仮面舞踏会 / 少年隊", "ガラスの十代 / 光GENJI", "DESIRE -情熱- / 中森明菜"
  ],

  y2000: [
    "TSUNAMI / サザンオールスターズ", "桜坂 / 福山雅治", "Wait & See ～リスク～ / 宇多田ヒカル", "Love, Day After Tomorrow / 倉木麻衣", "SEASONS / 浜崎あゆみ", "Everything / MISIA", "First Love / 宇多田ヒカル", "ちょこっとLOVE / プッチモニ", "今夜月の見える丘に / B'z", "らいおんハート / SMAP",
    "NEO UNIVERSE / L'Arc〜en〜Ciel", "HAPPINESS / GLAY", "サウダージ / ポルノグラフィティ", "あなたのキスを数えましょう / 小柳ゆき", "楽園 / 平井堅", "ギブス / 椎名林檎", "口笛 / Mr.Children", "Fly high / 浜崎あゆみ", "YAH YAH YAH / CHAGE and ASKA", "Automatic / 宇多田ヒカル",
    "Time goes by / Every Little Thing", "CAN YOU CELEBRATE? / 安室奈美恵", "Hello, Again ～昔からある場所～ / My Little Lover", "I LOVE YOU / 尾崎豊", "TRUE LOVE / 藤井フミヤ", "少年時代 / 井上陽水", "涙そうそう / 夏川りみ", "ZOO / 川村かおり", "Tomorrow never knows / Mr.Children", "楽園 / 平井堅"
  ],

  y2001: [
    "Can You Keep A Secret? / 宇多田ヒカル", "Everything / MISIA", "M / 浜崎あゆみ", "Pieces of a Dream / CHEMISTRY", "Evolution / 浜崎あゆみ", "ボクの背中には羽根がある / KinKi Kids", "Lifetime Respect / 三木道三", "fragile / Every Little Thing", "明日があるさ / ウルフルズ", "ultra soul / B'z",
    "恋愛レボリューション21 / モーニング娘。", "YATTA! / はっぱ隊", "LOVEマシーン / モーニング娘。", "RIDE ON TIME / 山下達郎", "ひとり / ゴスペラーズ", "Best Friend / Kiroro", "さくら / ケツメイシ", "I Will… / Sowelu", "ENDLESS STORY / REIRA starring YUNA ITO", "CANDY / KinKi Kids",
    "明日への扉 / I WiSH", "secret base ～君がくれたもの～ / ZONE", "風吹けば恋 / チャットモンチー", "One Love / 嵐", "真夜中は純潔 / 椎名林檎", "PIECES OF A DREAM / CHEMISTRY", "Stay by my side / 倉木麻衣", "Get Wild / TM NETWORK", "青春アミーゴ / 修二と彰", "白い恋人達 / 桑田佳祐"  
  ],

  y2002: [
    "H / 浜崎あゆみ", "Voyage / 浜崎あゆみ", "Sakura Drops / 宇多田ヒカル", "traveling / 宇多田ヒカル", "大きな古時計 / 平井堅", "ワダツミの木 / 元ちとせ", "亜麻色の髪の乙女 / 島谷ひとみ", "小さな恋のうた / MONGOL800", "VALENTI / BoA", "freebird / SMAP",
    "STARS / 中島美嘉", "Way of Difference / GLAY", "youthful days / Mr.Children", "Ring / 平井堅", "I’m here saying nothing / 矢井田瞳", "Feel My Soul / YUI", "secret base ～君がくれたもの～ / ZONE", "涙そうそう / 夏川りみ", "愛のうた / 倖田來未", "もらい泣き / 一青窈",
    "Your Name Never Gone / CHEMISTRY", "RIVER / 10-FEET", "Over Drive / JUDY AND MARY", "風吹けば恋 / チャットモンチー", "卒業写真 / 荒井由実", "TRUE LOVE / 藤井フミヤ", "PRIDE / 今井美樹", "夏祭り / Whiteberry", "Automatic / 宇多田ヒカル", "First Love / 宇多田ヒカル"
  ],

  y2003: [
    "世界に一つだけの花 / SMAP", "明日への扉 / I WiSH", "さくら（独唱） / 森山直太朗", "VALENTI / BoA", "涙そうそう / 夏川りみ", "Ring / 平井堅", "大切なもの / ロードオブメジャー", "桜 / 河口恭吾", "COLORS / 宇多田ヒカル", "No way to say / 浜崎あゆみ",
    "銀の龍の背に乗って / 中島みゆき", "風吹けば恋 / チャットモンチー", "My Sweet Darlin' / 矢井田瞳", "世界が終るまでは… / WANDS", "愛のうた / 倖田來未", "もらい泣き / 一青窈", "I believe / 絢香", "地上の星 / 中島みゆき", "WHITE BREATH / T.M.Revolution", "月光 / 鬼束ちひろ",
    "The Perfect Vision / MINMI", "Real Face / KAT-TUN", "さくらんぼ / 大塚愛", "らいおんハート / SMAP", "瞳をとじて / 平井堅", "明日があるさ / ウルフルズ", "島唄 / THE BOOM", "恋のマイアヒ / O-ZONE", "TSUNAMI / サザンオールスターズ", "First Love / 宇多田ヒカル"
  ],

  y2004: [
    "瞳をとじて / 平井堅", "Sign / Mr.Children", "Jupiter / 平原綾香", "さくら / ケツメイシ", "ハナミズキ / 一青窈", "愛が呼ぶほうへ / ポルノグラフィティ", "花 / ORANGE RANGE", "花 / 中孝介", "栄光の架橋 / ゆず", "ロコローション / ORANGE RANGE",
    "READY STEADY GO / L'Arc〜en〜Ciel", "Moments / 浜崎あゆみ", "CAROLS / 浜崎あゆみ", "INSPIRE / 浜崎あゆみ", "LIFE / キマグレン", "君こそスターだ / サザンオールスターズ", "風吹けば恋 / チャットモンチー", "Over Drive / JUDY AND MARY", "雪の華 / 中島美嘉", "pieces / L'Arc〜en〜Ciel",
    "瞳の住人 / L'Arc〜en〜Ciel", "全力少年 / スキマスイッチ", "涙がキラリ☆ / スピッツ", "スターゲイザー / スピッツ", "世界に一つだけの花 / SMAP", "Tomorrow never knows / Mr.Children", "島唄 / THE BOOM", "First Love / 宇多田ヒカル", "地上の星 / 中島みゆき", "TSUNAMI / サザンオールスターズ"
  ],

  y2005: [
    "さくら / ケツメイシ", "青春アミーゴ / 修二と彰", "粉雪 / レミオロメン", "花 / ORANGE RANGE", "CHE.R.RY / YUI", "ここにしか咲かない花 / コブクロ", "GLAMOROUS SKY / NANA starring MIKA NAKASHIMA", "NO MORE CRY / D-51", "リルラ リルハ / 木村カエラ", "プラネタリウム / 大塚愛",
    "DANDAN心魅かれてく / FIELD OF VIEW", "風吹けば恋 / チャットモンチー", "Sign / Mr.Children", "愛のうた / 倖田來未", "Story / AI", "未来予想図II / DREAMS COME TRUE", "世界が終るまでは… / WANDS", "ミュージック・アワー / ポルノグラフィティ", "風吹けば恋 / チャットモンチー", "LIFE / キマグレン",
    "三日月 / 絢香", "気分上々↑↑ / mihimaru GT", "さくらんぼ / 大塚愛", "栄光の架橋 / ゆず", "小さな恋のうた / MONGOL800", "Butterfly / 木村カエラ", "さよなら / オフコース", "TRUE LOVE / 藤井フミヤ", "涙そうそう / 夏川りみ", "TSUNAMI / サザンオールスターズ"
  ],

  y2006: [
    "Real Face / KAT-TUN", "粉雪 / レミオロメン", "青春アミーゴ / 修二と彰", "SIGNAL / KAT-TUN", "三日月 / 絢香", "タイヨウのうた / Kaoru Amane", "I believe / 絢香", "プラネタリウム / 大塚愛", "Story / AI", "気分上々↑↑ / mihimaru GT",
    "Lovers Again / EXILE", "純恋歌 / 湘南乃風", "花 / ORANGE RANGE", "ココロオドル / nobodyknows+", "千の夜をこえて / Aqua Timez", "風吹けば恋 / チャットモンチー", "366日 / HY", "さくら / ケツメイシ", "未来予想図II / DREAMS COME TRUE", "栄光の架橋 / ゆず",
    "HANABI / Mr.Children", "CHE.R.RY / YUI", "GOOD LUCKY!!!!! / グッキー", "Butterfly / 木村カエラ", "桜 / コブクロ", "TSUNAMI / サザンオールスターズ", "涙そうそう / 夏川りみ", "小さな恋のうた / MONGOL800", "地上の星 / 中島みゆき", "島唄 / THE BOOM"
  ],

  y2007: [
    "千の風になって / 秋川雅史", "Flavor Of Life / 宇多田ヒカル", "蕾（つぼみ） / コブクロ", "Love so sweet / 嵐", "Keep the faith / KAT-TUN", "喜びの歌 / KAT-TUN", "明日晴れるかな / 桑田佳祐", "旅立ちの唄 / Mr.Children", "関風ファイティング / 関ジャニ∞", "weeeek / NEWS",
    "WINDING ROAD / 絢香×コブクロ", "フェイク / Mr.Children", "星をめざして / NEWS", "Ultra Music Power / Hey! Say! JUMP", "Happiness / 嵐", "花の名 / BUMP OF CHICKEN", "Lovers Again / EXILE", "ズッコケ男道 / 関ジャニ∞", "SUPER LOVE SONG / B'z", "Beautiful World/Kiss & Cry / 宇多田ヒカル",
    "永遠に / KinKi Kids", "イッツ マイ ソウル / 関ジャニ∞", "BRAND NEW SONG / KinKi Kids", "愛唄 / GReeeeN", "メーデー / BUMP OF CHICKEN", "永遠の翼 / B'z", "We can make it! / 嵐", "Hey! Say! / Hey! Say! 7", "FREAKY / 倖田來未"
  ],

  y2008: [
    "truth / 嵐", "One Love / 嵐", "I AM YOUR SINGER / サザンオールスターズ", "キセキ / GReeeeN", "羞恥心 / 羞恥心", "HANABI / Mr.Children", "そばにいるね / 青山テルマ feat.Soulja", "DON'T U EVER STOP / KAT-TUN", "LIPS / KAT-TUN", "Beautiful days / 嵐",
    "無責任ヒーロー / 関ジャニ∞", "Step and Go / 嵐", "吾亦紅 / すぎもとまさと", "崖の上のポニョ / 藤岡藤巻と大橋のぞみ", "泣かないで / 羞恥心", "GIFT / Mr.Children", "『The Birthday ～Ti Amo～』 / EXILE", "『60s 70s 80s』 / 安室奈美恵", "太陽のナミダ / NEWS", "陽は、また昇る / アラジン",
    "真夜中のシャドーボーイ / Hey! Say! JUMP", "海雪 / ジェロ", "SUMMER TIME / NEWS", "White X'mas / KAT-TUN", "Dreams Come True / Hey! Say! JUMP", "Happy Birthday / NEWS", "ワッハッハー / 関ジャニ∞", "Secret Code / KinKi Kids", "時の足音 / コブクロ", "LAST CHRISTMAS / EXILE"
  ],

  y2009: [
    "Believe / 嵐", "明日の記憶 / 嵐", "マイガール / 嵐", "愛のままで… / 秋元順子", "Everything / 嵐", "イチブトゼンブ / B'z", "RESCUE / KAT-TUN", "ひまわり / 遊助", "ONE DROP / KAT-TUN", "急☆上☆Show!! / 関ジャニ∞",
    "恋のABO / NEWS", "THE HURRICANE ～FIREWORKS～ / EXILE", "悪魔な恋 / 中山優馬 w/B.I.Shadow/NYC boys", "THE MONSTER ～Someday～ / EXILE", "THE GENERATION ～ふたつの唇～ / EXILE", "Loveless / 山下智久", "たんぽぽ／海賊船／其の拳 / 遊助", "BANDAGE / LANDS", "弱虫サンタ / 羞恥心", "MY LONELY TOWN / B'z",
    "Stand by U / 東方神起", "RIVER / AKB48", "約束 / KinKi Kids", "化身 / 福山雅治", "浪曲一代 / 氷川きよし", "Days / 浜崎あゆみ", "ときめきのルンバ / 氷川きよし", "スワンソング / KinKi Kids", "R.I.P. / BUMP OF CHICKEN", "ニホンノミカタ-ネバダカラキマシタ / 矢島美容室"
  ],

  y2010: [
    "Beginner / AKB48", "ヘビーローテーション / AKB48", "ポニーテールとシュシュ / AKB48", "チャンスの順番 / AKB48", "Monster / 嵐", "Troublemaker / 嵐", "Løve Rainbow / 嵐", "Dear Snow / 嵐", "果てない空 / 嵐", "To be free / 嵐", 
    "会いたかった / AKB48", "ありがとう / いきものがかり", "トイレの神様 / 植村花菜", "VICTORY / EXILE", "もっと強く / EXILE", "I Wish For You / EXILE", "本当は怖い愛とロマンス / 桑田佳祐", "Okay / 稲葉浩志", "Going! / KAT-TUN", "Love yourself 〜君が嫌いな君が好き〜 / KAT-TUN", 
    "ミスター / KARA", "Gee / 少女時代", "ジャンピン / KARA", "GENIE / 少女時代", "Best Friend / 西野カナ", "会いたくて 会いたくて / 西野カナ", "if / 西野カナ", "タマシイレボリューション / Superfly", "春夏秋冬 / ヒルクライム", "ずっと好きだった / 斉藤和義"
  ],

  y2011: [
    "フライングゲット / AKB48", "Everyday、カチューシャ / AKB48", "風は吹いている / AKB48", "上からマリコ / AKB48", "桜の木になろう / AKB48", "Lotus / 嵐", "迷宮ラブソング / 嵐", "誰も知らない / 嵐", "マル・マル・モリ・モリ! / 薫と友樹、たまにムック。", "パレオはエメラルド / SKE48", 
    "オーマイガー! / NMB48", "絶滅黒髪少女 / NMB48", "Rising Sun / EXILE", "いつかできるから今日できる / 乃木坂46", "家族になろうよ / 福山雅治", "笑ってたいんだ / いきものがかり", "歩いていこう / いきものがかり", "GO GO サマー! / KARA", "ジェットコースターラブ / KARA", "MR.TAXI / 少女時代", 
    "たとえ どんなに… / 西野カナ", "Esperanza / 西野カナ", "花唄 / GReeeeN", "やさしくなりたい / 斉藤和義", "100万回の「I love you」 / Rake", "祈り 〜涙の軌道 / Mr.Children", "証 / flumpool", "あしたのジョー / 山下智久", "T.W.L / 関ジャニ∞", "カブトムシ / aiko"
  ],

  y2012: [
    "真夏のSounds good ! / AKB48", "GIVE ME FIVE! / AKB48", "ギンガムチェック / AKB48", "UZA / AKB48", "永遠プレッシャー / AKB48", "ワイルド アット ハート / 嵐", "Face Down / 嵐", "Your Eyes / 嵐", "祈り 〜涙の軌道 / Mr.Children", "足音 〜Be Strong / Mr.Children", 
    "アイシテラブル! / SKE48", "キスだって左利き / SKE48", "ヴァージニティー / NMB48", "北川謙二 / NMB48", "意気地なしマスカレード / 指原莉乃 with アンリレ", "制服のマネキン / 乃木坂46", "おいでシャンプー / 乃木坂46", "走れ!Bicycle / 乃木坂46", "ヒカルものたち / 渡辺麻友", "ER / エイトレンジャー", 
    "風が吹いている / いきものがかり", "やさしくなりたい / 斉藤和義", "生きてる生きてく / 福山雅治", "Beautiful life / 福山雅治", "Go my way / 三代目 J Soul Brothers", "花火 / 三代目 J Soul Brothers", "Be... / Ms.OOJA", "輝く月のように / Superfly", "つけまつける / きゃりーぱみゅぱみゅ", "ファッションモンスター / きゃりーぱみゅぱみゅ"
  ],

  y2013: [
    "さよならクロール / AKB48", "恋するフォーチュンクッキー / AKB48", "ハート・エレキ / AKB48", "So long ! / AKB48", "鈴懸の木の道で... / AKB48", "Calling / 嵐", "Breathless / 嵐", "Endless Game / 嵐", "JOY / 嵐", "ピースとハイライト / サザンオールスターズ", 
    "チョコの奴隷 / SKE48", "美しい稲妻 / SKE48", "賛成カワイイ! / SKE48", "僕らのユリイカ / NMB48", "カモネギックス / NMB48", "メロンジュース / HKT48", "スキ!スキ!スキップ! / HKT48", "ガールズルール / 乃木坂46", "バレッタ / 乃木坂46", "君の名は希望 / 乃木坂46", 
    "RPG / SEKAI NO OWARI", "潮騒のメモリー / 天野春子(小泉今日子)", "にんじゃりばんばん / きゃりーぱみゅぱみゅ", "インベーダーインベーダー / きゃりーぱみゅぱみゅ", "Joy!! / SMAP", "Mistake! / SMAP", "Preserved Roses / T.M.Revolution×水樹奈々", "VAMOLA! キョウリュウジャー / 鎌田章吾", "紅蓮の弓矢 / Linked Horizon", "高嶺の花子さん / back number"
  ],

  y2014: [
    "レット・イット・ゴー 〜ありのままで〜 / 松たか子", "ひまわりの約束 / 秦 基博", "R.Y.U.S.E.I. / 三代目 J Soul Brothers from EXILE TRIBE", "Dragon Night / SEKAI NO OWARI", "にじいろ / 絢香", "Darling / 西野カナ", "GUTS ! / 嵐", "麦の唄 / 中島みゆき", "日々 / 吉田山田", "ようかい体操第一 / Dream5", 
    "ゲラゲラポーのうた / キング・クリーム・ソーダ", "スノーマジックファンタジー / SEKAI NO OWARI", "NIPPON / 椎名林檎", "東京VICTORY / サザンオールスターズ", "足音 〜Be Strong / Mr.Children", "瞳の奥の銀河 / Flower", "炎と森のカーニバル / SEKAI NO OWARI", "高嶺の林檎 / NMB48", "何度目の青空か? / 乃木坂46", "365日の紙飛行機 / AKB48", 
    "Climax Jump / AAA", "サヨナラの前に / AAA", "ラストシーン / いきものがかり", "熱帯夜 / SHISHAMO", "フルドライブ / KANA-BOON", "オドループ / フレデリック", "シルエット / KANA-BOON", "イマジネーション / SPYAIR", "千本桜 / 黒うさP feat. 初音ミク", "生まれてはじめて / 神田沙也加"
  ],

  y2015: [
    "海の声 / 浦島太郎 (桐谷健太)", "SUN / 星野源", "クリスマスソング / back number", "トリセツ / 西野カナ", "私以外私じゃないの / ゲスの極み乙女。", "シュガーソングとビターステップ / UNISON SQUARE GARDEN", "新宝島 / サカナクション", "ひまわりの約束 / 秦 基博", "R.Y.U.S.E.I. / 三代目 J Soul Brothers from EXILE TRIBE", "Summer Madness / 三代目 J Soul Brothers from EXILE TRIBE", 
    "365日の紙飛行機 / AKB48", "長く短い祭 / 椎名林檎", "君がくれた夏 / 家入レオ", "夜空。feat.ハジ→ / miwa", "もしも運命の人がいるのなら / 西野カナ", "アイネクライネ / 米津玄師", "Flowerwall / 米津玄師", "全力少年 / スキマスイッチ", "大不正解 / back number", "ヒロイン / back number", 
    "あなた / 宇多田ヒカル", "明日はきっといい日になる / 高橋優", "おどるポンポコリン / E-girls", "あったかいんだからぁ♪ / クマムシ", "シェキナベイベー / 内田裕也 feat. 指原莉乃", "高嶺の花子さん / back number", "ワタリドリ / [Alexandros]", "君の知らない物語 / supercell", "Dragon Night / SEKAI NO OWARI", "千本桜 / 和楽器バンド"
  ],

  y2016: [
    "前前前世 / RADWIMPS", "恋 / 星野源", "SUN / 星野源", "海の声 / 浦島太郎（桐谷健太）", "トリセツ / 西野カナ", "花束を君に / 宇多田ヒカル", "Perfect Human / RADIO FISH", "シュガーソングとビターステップ / UNISON SQUARE GARDEN", "Wherever you are / ONE OK ROCK", "やさしさで溢れるように / JUJU",
    "ヒロイン / back number", "クリスマスソング / back number", "君の名は希望 / 乃木坂46", "サイレントマジョリティー / 欅坂46", "世界に一つだけの花 / SMAP", "糸 / 中島みゆき", "奏（かなで） / スキマスイッチ", "小さな恋のうた / MONGOL800", "キセキ / GReeeeN", "Story / AI",
    "R.Y.U.S.E.I. / 三代目 J Soul Brothers", "Summer Madness / 三代目 J Soul Brothers", "Dragon Night / SEKAI NO OWARI", "RPG / SEKAI NO OWARI", "女々しくて / ゴールデンボンバー", "栄光の架橋 / ゆず", "残酷な天使のテーゼ / 高橋洋子", "3月9日 / レミオロメン", "ハナミズキ / 一青窈", "チェリー / スピッツ"
  ],

  y2017: [
    "恋 / 星野源", "前前前世 / RADWIMPS", "海の声 / 浦島太郎 (桐谷健太)", "ハッピーエンド / back number", "Hero / 安室奈美恵", "花束を君に / 宇多田ヒカル", "サイレントマジョリティー / 欅坂46", "PPAP / ピコ太郎", "PERFECT HUMAN / RADIO FISH", "Soup / 藤原さくら", 
    "砂の塔 / THE YELLOW MONKEY", "Wherever you are / ONE OK ROCK", "道 / 宇多田ヒカル", "みなと / Mr.Children", "蝶々結び / Aimer", "LOSER / 米津玄師", "全力少年 / スキマスイッチ", "多分、風。 / サカナクション", "FLASH / Perfume", "明日も / SHISHAMO", 
    "なんでもないや / RADWIMPS", "世界に一つだけの花 / SMAP", "365日の紙飛行機 / AKB48", "サヨナラの意味 / 乃木坂46", "NANIMONO / 中田ヤスタカ feat. 米津玄師", "結 -ゆい- / miwa", "Mint / 安室奈美恵", "友よ 〜 この先もずっと… / ケツメイシ", "魔法って言っていいかな? / 平井堅", "ペンペン / ゲスの極み乙女。"
  ],

  y2018: [
    "Lemon / 米津玄師", "U.S.A. / DA PUMP", "打上花火 / DAOKO × 米津玄師", "ドラえもん / 星野源", "サザンカ / SEKAI NO OWARI", "ガラスを割れ! / 欅坂46", "シンクロニシティ / 乃木坂46", "ジコチューで行こう! / 乃木坂46", "Candy Pop / TWICE", "さよならエレジー / 菅田将暉", 
    "Teacher Teacher / AKB48", "NO WAY MAN / AKB48", "センチメンタルトレイン / AKB48", "世界はあなたに笑いかけている / Little Glee Monster", "マリーゴールド / あいみょん", "アイデア / 星野源", "LOSER / 米津玄師", "あなた / 宇多田ヒカル", "大不正解 / back number", "瞬き / back number", 
    "初恋 / 宇多田ヒカル", "帰り道は遠回りしたくなる / 乃木坂46", "アンビバレント / 欅坂46", "Wake Me Up / TWICE", "シンデレラガール / King & Prince", "零 -ZERO- / 福山雅治", "Flamingo / 米津玄師", "君はロックを聴かない / あいみょん", "HANABI / Mr.Children", "Hero / 安室奈美恵"
  ],

  y2019: [
    "Lemon / 米津玄師", "マリーゴールド / あいみょん", "Pretender / Official髭男dism", "白日 / King Gnu", "馬と鹿 / 米津玄師", "まちがいさがし / 菅田将暉", "宿命 / Official髭男dism", "パプリカ / Foorin", "今夜このまま / あいみょん", "U.S.A. / DA PUMP", 
    "打上花火 / DAOKO × 米津玄師", "アイノカタチ feat.HIDE(GReeeeN) / MISIA", "夜に駆ける / YOASOBI", "紅蓮華 / LiSA", "イエスタデイ / Official髭男dism", "君はロックを聴かない / あいみょん", "HAPPY BIRTHDAY / back number", "黒い羊 / 欅坂46", "Sing Out! / 乃木坂46", "夜明けまで強がらなくてもいい / 乃木坂46", 
    "Lights / BTS", "Boy With Luv (feat. Halsey) / BTS", "Brave Heart / 嵐", "Turning Up / 嵐", "Recollection / 桑田佳祐", "愛にできることはまだあるかい / RADWIMPS", "インフェルノ / Mrs. GREEN APPLE", "ハルノヒ / あいみょん", "プロローグ / Uru", "さよならエレジー / 菅田将暉"
  ],

  y2020: [
    "夜に駆ける / YOASOBI", "Pretender / Official髭男dism", "紅蓮華 / LiSA", "I LOVE... / Official髭男dism", "白日 / King Gnu", "香水 / 瑛人", "宿命 / Official髭男dism", "マリーゴールド / あいみょん", "炎 / LiSA", "裸の心 / あいみょん", 
    "イエスタデイ / Official髭男dism", "感電 / 米津玄師", "群青 / YOASOBI", "猫 / DISH//", "115万キロのフィルム / Official髭男dism", "Lemon / 米津玄師", "Dynamite / BTS", "馬と鹿 / 米津玄師", "パプリカ / Foorin", "まちがいさがし / 菅田将暉", 
    "ハルノヒ / あいみょん", "Make you happy / NiziU", "インフェルノ / Mrs. GREEN APPLE", "三文小説 / King Gnu", "カイト / 嵐", "虹 / 菅田将暉", "廻廻奇譚 / Eve", "怪物 / YOASOBI", "再会 (produced by Ayase) / LiSA×Uru", "Step and a step / NiziU"
  ],

  y2021: [
    "ドライフラワー / 優里", "夜に駆ける / YOASOBI", "怪物 / YOASOBI", "勿忘 / Awesome City Club", "うっせぇわ / Ado", "怪物 / YOASOBI", "群青 / YOASOBI", "虹 / 菅田将暉", "廻廻奇譚 / Eve", "Dynamite / BTS", 
    "炎 / LiSA", "Cry Baby / Official髭男dism", "Butter / BTS", "きらり / 藤井 風", "Permission to Dance / BTS", "踊 / Ado", "シャッター / 優里", "猫 / DISH//", "水平線 / back number", "名前を呼ぶよ / SUPER BEAVER", 
    "三原色 / YOASOBI", "不思議 / 星野源", "Presence / STUTS & 松たか子 with 3exes", "怪盗 / back number", "ベテルギウス / 優里", "Pale Blue / 米津玄師", "沈丁花 / DISH//", "なないろ / BUMP OF CHICKEN", "阿修羅ちゃん / Ado", "一途 / King Gnu"
  ],

  y2022: [
    "残響散歌 / Aimer", "W/X/Y / Tani Yuuki", "ベテルギウス / 優里", "ミックスナッツ / Official髭男dism", "新時代 (ウタ from ONE PIECE FILM RED) / Ado", "きらり / 藤井 風", "キャラクター / 緑黄色社会", "水平線 / back number", "逆光 (ウタ from ONE PIECE FILM RED) / Ado", "カメレオン / King Gnu", 
    "ドライフラワー / 優里", "なんでもないよ、 / マカロニえんぴつ", "シンデレラボーイ / Saucy Dog", "一途 / King Gnu", "ダンスホール / Mrs. GREEN APPLE", "Habit / SEKAI NO OWARI", "私は最強 (ウタ from ONE PIECE FILM RED) / Ado", "怪獣の花唄 / Vaundy", "Mela! / 緑黄色社会", "Cry Baby / Official髭男dism", 
    "Subtitle / Official髭男dism", "祝福 / YOASOBI", "トウキョウ・シャンディ・ランデヴ / MAISONdes feat. 花譜, ツミキ", "レオ / 優里", "クロノスタシス / BUMP OF CHICKEN", "喜劇 / 星野源", "POP! / NAYEON", "左右盲 / ヨルシカ", "ベルベットの詩 / back number", "KICK BACK / 米津玄師"
  ],

  y2023: [
    "アイドル / YOASOBI", "Subtitle / Official髭男dism", "怪獣の花唄 / Vaundy", "KICK BACK / 米津玄師", "怪獣のサイズ / back number", "新時代 (ウタ from ONE PIECE FILM RED) / Ado", "ダンスホール / Mrs. GREEN APPLE", "W/X/Y / Tani Yuuki", "第ゼロ感 / 10-FEET", "唱 / Ado", 
    "美しい鰭 / スピッツ", "ケセラセラ / Mrs. GREEN APPLE", "青のすみか / キタニタツヤ", "タペストリー / Snow Man", "SPECIALZ / King Gnu", "一途 / King Gnu", "強風オールバック / 強風オールバック (feat. 歌愛ユキ)", "絆ノ奇跡 / MAN WITH A MISSION × milet", "メフィスト / 女王蜂", "花束 / 中島美嘉", 
    "地球儀 / 米津玄師", "Magic / Mrs. GREEN APPLE", "Seven (feat. Latto) / Jung Kook", "Subtitle / Official髭男dism", "可愛くてごめん / HoneyWorks feat. かぴ", "オトナブルー / 新しい学校のリーダーズ", "唱 / Ado", "ホワイトノイズ / Official髭男dism", "勇者 / YOASOBI", "晩餐歌 / tuki."
  ],

  y2024: [
    "Bling-Bang-Bang-Born / Creepy Nuts", "晩餐歌 / tuki.", "幾億光年 / Omoinotake", "アイドル / YOASOBI", "唱 / Ado", "ケセラセラ / Mrs. GREEN APPLE", "タイムパラドックス / Vaundy", "ライラック / Mrs. GREEN APPLE", "怪獣の花唄 / Vaundy", "最高到達点 / SEKAI NO OWARI", 
    "勇者 / YOASOBI", "花になって / 緑黄色社会", "オレンジ / SPYAIR", "満ちてゆく / 藤井 風", "晴る / ヨルシカ", "SPECIALZ / King Gnu", "Subtitle / Official髭男dism", "さよーならまたいつか！ / 米津玄師", "ガッチュー! / ウルフルズ", "Magnetic / ILLIT", 
    "はいよろこんで / こっちのけんと", "BBBB / Creepy Nuts", "夢幻 / MY FIRST STORY × HYDE", "毎日 / 米津玄師", "コロンブス / Mrs. GREEN APPLE", "ファタール / GEMN", "新しい恋人達に / back number", "がらくた / 米津玄師", "Sharon / Official髭男dism", "We'll rise / 嵐"
  ],

  y2025: [
    "ライラック / Mrs. GREEN APPLE", "Bling-Bang-Bang-Born / Creepy Nuts", "幾億光年 / Omoinotake", "晩餐歌 / tuki.", "はいよろこんで / こっちのけんと", "アポロドロス / Mrs. GREEN APPLE", "familie / Mrs. GREEN APPLE", "がらくた / 米津玄師", "Azalea / 米津玄師", "新しい恋人達に / back number", 
    "カーテンコール / 優里", "モノトーン / YOASOBI", "New Look / MISAMO", "Whiplash / aespa", "APT. / ROSÉ & Bruno Mars", "僕さえいれば / back number", "太陽 / Vaundy", "風神 / 藤井 風", "エスカレーション / 菅田将暉", "UNDEAD / YOASOBI", 
    "Sharon / Official髭男dism", "Same Blue / Official髭男dism", "エンドレス / Official髭男dism", "15分 / tuki.", "ルル / Ado", "初夏 / あいみょん", "ざらめ / あいみょん", "忘レ敵 / スピッツ", "SOULSOUP / Official髭男dism", "タイムパラドックス / Vaundy"
  ],
};
