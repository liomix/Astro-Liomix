import Key from "@/shared/i18n/i18nKey";
import type { Translation } from "@/shared/i18n/translation";

export const ja: Translation = {
	[Key.skipToContent]: "本文へスキップ",
	[Key.home]: "ホーム",
	[Key.about]: "について",
	[Key.archive]: "アーカイブ",
	[Key.search]: "検索",
	[Key.searchNoResults]: "結果が見つかりません。",
	[Key.searchTypeSomething]: "検索キーワードを入力してください。",
	[Key.searchLoading]: "検索中...",
	[Key.searchContent]: "内容",
	[Key.searchViewMore]: "さらに結果を表示 ({count} 件)",

	// ナビバーメニューグループ
	[Key.navArticles]: "記事",
	[Key.navSocial]: "ソーシャル",
	[Key.navMine]: "マイ",
	[Key.navAbout]: "について",
	[Key.navLinks]: "リンク",
	[Key.all]: "すべて",

	[Key.tags]: "タグ",
	[Key.categories]: "カテゴリ",
	[Key.allCategories]: "すべてのカテゴリ",
	[Key.allTags]: "すべてのタグ",
	[Key.allSeries]: "すべてのシリーズ",
	[Key.postList]: "投稿リスト",
	[Key.tableOfContents]: "目次",
	[Key.tocEmpty]: "このページには目次がありません",
	[Key.music]: "音楽",
	[Key.books]: "読書",
	[Key.booksDescription]: "WeRead の本棚と読書時間の記録",
	[Key.booksShelf]: "本棚",
	[Key.booksEmpty]: "本棚データがありません。WeRead API キーを確認してください",
	[Key.booksThisMonth]: "今月の読書",
	[Key.booksAllTime]: "累計の読書",
	[Key.booksDailyAverage]: "1日平均",
	[Key.booksFinished]: "読了",
	[Key.booksReading]: "読書中",
	[Key.booksReadCount]: "読んだ",
	[Key.booksWordCount]: "{n}万字",
	[Key.booksScore]: "{n}点",
	[Key.booksWordsLabel]: "文字数",
	[Key.booksScoreLabel]: "評価",
	[Key.booksRatingCount]: "{n}人が評価",
	[Key.booksOpen]: "WeRead で開く",
	[Key.booksHeatmap]: "書海の星図",
	[Key.booksHeatmapLess]: "少ない",
	[Key.booksHeatmapMore]: "多い",
	[Key.booksHeatmapSummary]: "{d} 日記録 · 計 {h} 時間",
	[Key.booksHeatmapEmpty]: "この年はまだ読書記録がありません",
	[Key.dynamic]: "つぶやき",
	[Key.latestDynamics]: "最新の投稿",
	[Key.moreDynamics]: "もっと見る",
	[Key.dynamicDescription]: "日々の短い思いや出来事を記録します。",
	[Key.dynamicEmpty]: "まだ投稿がありません",
	[Key.dynamicNoResults]: "一致する投稿がありません",
	[Key.dynamicLoading]: "投稿を読み込んでいます",
	[Key.dynamicAllYears]: "すべての年",
	[Key.dynamicProfile]: "{name}のプロフィールを見る",
	[Key.dynamicLike]: "いいね",
	[Key.dynamicComment]: "コメント",
	[Key.dynamicLikes]: "いいね",
	[Key.dynamicComments]: "コメント",
	[Key.dynamicCollapseGallery]: "閉じる",
	[Key.dynamicViewOriginal]: "拡大表示",
	[Key.dynamicPreviousImage]: "前の画像",
	[Key.dynamicNextImage]: "次の画像",
	[Key.dynamicViewImage]: "画像 {index} を表示",
	[Key.dynamicSelectImage]: "画像 {index} に切り替え",
	[Key.musicNoPlaying]: "再生中なし",
	[Key.musicLyrics]: "歌詞",
	[Key.musicVolume]: "音量",
	[Key.musicPlayMode]: "再生モードを切り替え",
	[Key.musicPrev]: "前の曲",
	[Key.musicNext]: "次の曲",
	[Key.musicPlaylist]: "プレイリスト",
	[Key.musicNoLyrics]: "歌詞なし",
	[Key.musicLoadingLyrics]: "歌詞を読み込み中...",
	[Key.musicFailedLyrics]: "歌詞の読み込みに失敗しました",
	[Key.musicNoSongs]: "曲なし",
	[Key.musicError]: "プレーヤーエラー",
	[Key.musicPlay]: "再生",
	[Key.musicPause]: "一時停止",
	[Key.musicProgress]: "再生の進捗",
	[Key.musicCover]: "カバー",
	[Key.musicNoCover]: "カバーなし",

	// お知らせ
	[Key.announcement]: "お知らせ",
	[Key.announcementClose]: "閉じる",

	[Key.commentNotConfigured]: "コメントシステムが設定されていません",
	[Key.commentChatToday]: "今日",
	[Key.commentChatLoading]: "読み込み中…",
	[Key.commentChatEmpty]: "まだコメントはありません",
	[Key.commentChatDisabled]: "コメント機能は停止中です",
	[Key.commentChatLoadFailed]: "コメントを読み込めませんでした",
	[Key.commentChatLoadMore]: "以前のコメントを読み込む",
	[Key.commentChatSendFailed]: "送信できませんでした。後でもう一度",
	[Key.commentChatPending]: "承認待ち",
	[Key.commentChatPlaceholder]: "メッセージ",
	[Key.commentChatSend]: "送信",
	[Key.commentChatEmoji]: "絵文字",
	[Key.commentChatAttach]: "画像を送信",
	[Key.commentChatCopy]: "コピー",
	[Key.commentChatCopied]: "コピーしました",
	[Key.commentChatCode]: "コード",
	[Key.commentChatReply]: "返信",
	[Key.commentChatRetract]: "削除",
	[Key.commentChatRetracted]: "削除しました",
	[Key.commentChatRetractFailed]: "削除できませんでした",
	[Key.commentChatRetractReplies]:
		"このコメントには返信があります。削除すると返信も一緒に消えます。よろしいですか？",
	[Key.commentChatMe]: "あなた",
	// 接口失败兜底：按 code 归类，不把后端的英文 title 直接给用户
	[Key.dynamicLoadFailed]:
		"更新の読み込みに失敗しました。再読み込みしてください。",
	[Key.commentChatSendUnconfirmed]:
		"結果を確認できませんでした。再読み込みしてから送信し直してください",
	[Key.apiErrorNetwork]:
		"ネットワークに問題が発生しているようです。しばらくしてから再度お試しください。",
	[Key.apiErrorRequest]:
		"入力内容が受け付けられませんでした。修正してもう一度お試しください。",
	[Key.apiErrorServer]:
		"サービスが一時的に利用できません。しばらくしてから再度お試しください。",
	[Key.apiErrorUnknown]:
		"問題が発生しました。しばらくしてから再度お試しください。",
	[Key.commentInfoTitle]: "コメント情報",
	[Key.commentInfoOpen]: "コメント情報を編集",
	[Key.commentInfoName]: "名前",
	[Key.commentInfoNamePlaceholder]: "呼び名を入力",
	[Key.commentInfoEmail]: "メールアドレス",
	[Key.commentInfoEmailPlaceholder]: "you@example.com",
	[Key.commentInfoSave]: "保存",
	[Key.commentInfoCancel]: "キャンセル",
	[Key.commentInfoLocked]: "名前とメールアドレスを入力するとコメントできます",
	[Key.commentInfoSubEmpty]: "タップして名前とメールアドレスを入力",
	[Key.commentInfoNameRequired]: "名前を入力してください",
	[Key.commentInfoEmailInvalid]: "メールアドレスの形式が正しくありません",
	[Key.friends]: "友達",
	[Key.friendsDescription]:
		"ここは私の友達です、お互いに訪問して交流することを歓迎します",
	[Key.searchFriends]: "友達を検索...",
	[Key.friendsEmpty]: "まだ友達がいません",

	[Key.guestbook]: "ゲストブック",
	[Key.guestbookDescription]:
		"記録しておきたいこと、あとで思い返したいことがあります",
	[Key.guestbookTitle]: "メッセージウォール",
	[Key.guestbookWrite]: "メッセージを書く",
	[Key.guestbookEmpty]: "まだメッセージはありません。最初の一人になりませんか",
	[Key.guestbookRetry]: "再試行",
	[Key.guestbookSubmitted]: "メッセージを送信しました。承認後に表示されます",
	[Key.guestbookDelete]: "メッセージを削除",
	[Key.guestbookDeleteConfirm]: "このメッセージを削除しますか？",
	[Key.guestbookBodyRequired]: "何か書いてから送信してください",
	[Key.uncategorized]: "未分類",
	[Key.noTags]: "タグなし",

	[Key.wordCount]: "語",
	[Key.wordsCount]: "語",
	[Key.minuteCount]: "分",
	[Key.minutesCount]: "分",
	[Key.postCount]: "投稿",
	[Key.postsCount]: "投稿",
	[Key.tagChartTitle]: "記事数",
	[Key.tagChartAverage]: "平均",
	[Key.noData]: "データなし",

	[Key.themeColor]: "テーマカラー",

	[Key.lightMode]: "日中",
	[Key.darkMode]: "夜間",
	[Key.systemMode]: "システム",
	[Key.scheduledMode]: "タイマー",
	[Key.themeMode]: "昼夜",
	[Key.scheduleDayStart]: "日中開始",
	[Key.scheduleNightStart]: "夜間開始",

	[Key.more]: "もっと",
	[Key.collapse]: "折りたたむ",

	[Key.author]: "著者",
	[Key.publishedAt]: "公開日",
	[Key.updatedAt]: "更新日",
	[Key.readTime]: "読了時間",
	[Key.license]: "ライセンス",

	[Key.paginationPrev]: "前へ",
	[Key.paginationNext]: "次へ",
	[Key.paginationPage]: "",
	[Key.paginationJump]: "指定ページへ移動",

	// 404ページ
	[Key.notFound]: "404",
	[Key.notFoundTitle]: "ページが見つかりません",
	[Key.notFoundDescription]:
		"申し訳ありませんが、アクセスしたページは存在しないか、移動されています。",
	[Key.backToHome]: "ホームに戻る",

	// RSSページ
	[Key.rss]: "RSSフィード",
	[Key.rssDescription]: "最新の更新を購読する",
	[Key.rssSubtitle]: "RSSで購読して、最新の記事と更新を第一时间で取得する",
	[Key.rssLink]: "RSSリンク",
	[Key.rssCopyToReader]: "RSSリンクをリーダーにコピー",
	[Key.rssCopyLink]: "リンクをコピー",
	[Key.rssLatestPosts]: "最新の投稿",
	[Key.rssWhatIsRSS]: "RSSとは？",
	[Key.rssWhatIsRSSDescription]:
		"RSS（Really Simple Syndication）は、頻繁に更新されるコンテンツを公開するための標準形式です。RSSを使用すると：",
	[Key.rssBenefit1]:
		"手動で訪問することなく、最新のウェブサイトコンテンツを及时に取得",
	[Key.rssBenefit2]: "1か所で複数のウェブサイトの購読を管理",
	[Key.rssBenefit3]: "重要な更新や記事を見逃すことを回避",
	[Key.rssBenefit4]: "広告なしのクリーンな読書体験を楽しむ",
	[Key.rssHowToUse]:
		"Feedly、Inoreaderまたは他のRSSリーダーを使用してこのサイトを購読することを推奨します。",
	[Key.rssCopied]: "RSSリンクがクリップボードにコピーされました！",
	[Key.rssCopyFailed]: "コピーに失敗しました。手動でリンクをコピーしてください",

	// Atom ページ
	[Key.atom]: "Atom フィード",
	[Key.atomDescription]: "最新の更新を購読",
	[Key.atomSubtitle]: "Atom で購読すると、最新の記事と更新をすぐに受け取れます",
	[Key.atomLink]: "Atom リンク",
	[Key.atomCopyToReader]: "Atom リーダーにリンクをコピー",
	[Key.atomCopied]: "Atom リンクをクリップボードにコピーしました！",

	// 最終更新時間カード
	[Key.lastModifiedPrefix]: "最終更新日：",
	[Key.lastModifiedOutdated]: "一部の内容が古くなっている可能性があります",
	[Key.lastModifiedDaysAgo]: "{days}日前",
	[Key.year]: "年",

	// ページビュー統計
	[Key.pageViews]: "閲覧数",

	// ピン留め
	[Key.pinned]: "ピン留め",

	// 関連記事
	[Key.relatedPosts]: "関連記事",
	[Key.randomPosts]: "ランダム記事",
	[Key.smartRecommend]: "スマート",
	[Key.randomRecommend]: "ランダム",
	[Key.noRelatedPosts]: "関連記事がありません",
	[Key.noRandomPosts]: "ランダム記事がありません",

	// 記事シリーズ
	[Key.series]: "シリーズ",
	[Key.seriesPartOf]: "シリーズの一部",
	[Key.seriesPart]: "パート {n}",
	[Key.seriesThisArticle]: "この記事",
	[Key.noSeries]: "シリーズはありません",

	// 暗号化
	[Key.postEncrypted]: "この記事は暗号化されています",

	// 壁紙モード
	[Key.wallpaperMode]: "壁紙モード",
	[Key.wallpaperBannerMode]: "バナー壁紙",
	[Key.wallpaperFullscreenMode]: "フルスクリーン壁紙",
	[Key.fullscreenLayout]: "フルスクリーンレイアウト",
	[Key.fullscreenClassicLayout]: "クラシック",
	[Key.fullscreenHeroLayout]: "ヒーロー",
	[Key.wallpaperOverlayMode]: "透明",
	[Key.wallpaperNoneMode]: "単色背景",

	// 壁紙設定
	[Key.wallpaperSettings]: "壁紙設定",
	[Key.wallpaperTitle]: "ホーム壁紙タイトル",
	[Key.wallpaperCarousel]: "壁紙カルーセル",
	[Key.commentWallpaper]: "コメント欄の壁紙",
	[Key.wavesAnimation]: "波アニメーション",
	[Key.gradientTransition]: "グラデーション遷移",
	[Key.sakuraEffect]: "桜エフェクト",
	[Key.effectsSettings]: "エフェクト",
	[Key.overlaySettings]: "透明設定",
	[Key.overlayOpacity]: "壁紙の透明度",
	[Key.overlayTransparency]: "背景の透明度",
	[Key.overlayCardOpacity]: "カード透明度",
	[Key.overlayPanelTransparency]: "ポップアップの透明度",

	// 設定パネルタブ
	[Key.settingsTabAppearance]: "外観",
	[Key.settingsTabWallpaper]: "壁紙",
	[Key.settingsTabBackground]: "背景",

	// カードスタイル
	[Key.cardSettings]: "カードスタイル",
	[Key.cardBorder]: "カードのボーダーと影",
	[Key.cardFollowTheme]: "カードのテーマカラー追随",

	// 投稿リストレイアウト
	[Key.postListLayout]: "投稿リストレイアウト",
	[Key.postListLayoutList]: "リスト",
	[Key.postListLayoutGrid]: "グリッド",

	// スポンサーページ
	[Key.sponsor]: "スポンサー",
	[Key.sponsorTitle]: "サポート",
	[Key.scanToSponsor]: "スキャンしてスポンサー",
	[Key.sponsorButton]: "サポートと共有",
	[Key.sponsorButtonText]:
		"この記事が役に立ったなら、共有またはサポートをお願いします！",

	[Key.shareOnSocial]: "記事を共有",
	[Key.shareOnSocialDescription]:
		"この記事が役に立ったなら、ぜひ他の人と共有してください！",

	// サイト統計
	[Key.siteStats]: "サイト統計",
	[Key.siteStatsPostCount]: "記事",
	[Key.siteStatsCategoryCount]: "カテゴリー",
	[Key.siteStatsTagCount]: "タグ",
	[Key.siteStatsTotalWords]: "総文字数",
	[Key.siteStatsViews]: "閲覧数",
	[Key.siteStatsVisitors]: "訪問者数",
	[Key.siteStatsRunningDays]: "運用日数",

	// サイト情報
	[Key.siteInfo]: "サイト情報",
	[Key.siteInfoBuildTime]: "ビルド日時",
	[Key.siteInfoBuildPlatform]: "ビルドプラットフォーム",
	[Key.siteInfoBlogVersion]: "ブログバージョン",
	[Key.siteInfoAstroVersion]: "Astro バージョン",
	[Key.siteInfoNodeVersion]: "Node バージョン",
	[Key.siteInfoPnpmVersion]: "pnpm バージョン",
	[Key.siteInfoSystem]: "システム情報",
	[Key.siteInfoExpand]: "ビルド情報を展開",
	[Key.siteInfoCollapse]: "ビルド情報を折畳む",
	[Key.siteInfoDomain]: "ドメイン",
	[Key.siteInfoLicense]: "ライセンス",

	// カレンダーコンポーネント
	[Key.calendarSunday]: "日",
	[Key.calendarMonday]: "月",
	[Key.calendarTuesday]: "火",
	[Key.calendarWednesday]: "水",
	[Key.calendarThursday]: "木",
	[Key.calendarFriday]: "金",
	[Key.calendarSaturday]: "土",
	[Key.calendarJanuary]: "1月",
	[Key.calendarFebruary]: "2月",
	[Key.calendarMarch]: "3月",
	[Key.calendarApril]: "4月",
	[Key.calendarMay]: "5月",
	[Key.calendarJune]: "6月",
	[Key.calendarJuly]: "7月",
	[Key.calendarAugust]: "8月",
	[Key.calendarSeptember]: "9月",
	[Key.calendarOctober]: "10月",
	[Key.calendarNovember]: "11月",
	[Key.calendarDecember]: "12月",
	[Key.calendar]: "サイトカレンダー",
	[Key.calendarHeatmapWeek]: "{month}月第{week}週、{count}記事",
	[Key.advertisement]: "広告",

	[Key.shareArticle]: "共有",
	[Key.generatingPoster]: "ポスター生成中...",
	[Key.copyLink]: "リンクをコピー",
	[Key.sharePoster]: "ポスターをシェア",
	[Key.scanToRead]: "QRコードで読む",

	// パスワード保護
	[Key.passwordProtected]: "パスワード保護",
	[Key.passwordProtectedDesc]:
		"このコンテンツはパスワードで保護されています。表示するにはパスワードを入力してください。",
	[Key.passwordHint]: "ヒント",
	[Key.passwordPlaceholder]: "パスワードを入力",
	[Key.passwordSubmit]: "ロック解除",
	[Key.passwordError]: "パスワードが間違っています。もう一度お試しください。",
	[Key.passwordProtectedRss]:
		"この記事は暗号化されています。ウェブサイトにアクセスしてご覧ください。",

	[Key.videoPrev]: "前の動画",
	[Key.videoNext]: "次の動画",
	[Key.videoLoadError]: "動画の読み込みに失敗しました",

	// 没入型リーディング
	[Key.immersiveReading]: "没入型リーディング",
	[Key.enterImmersiveReading]: "没入型リーディングに入る",
	[Key.exitImmersiveReading]: "没入型リーディングを終了する",
	[Key.tocExpand]: "目錄を開く",
	[Key.tocCollapse]: "目錄をたたむ",

	// 訪問者ウェルカム（Welcome コンポーネント）
	[Key.welcomeTitle]: "訪問者情報",
	[Key.welcomeTemplate]:
		"{location} からアクセスしています。{greeting}。現在 {time}、サイト管理者まで約 {distance} km、IP アドレス：{ip}",
	[Key.welcomeTemplateNoDistance]:
		"{location} からアクセスしています。{greeting}。現在 {time}、IP アドレス：{ip}",
	[Key.welcomeGreetingLateNight]: "深夜ですね",
	[Key.welcomeGreetingMorning]: "おはようございます",
	[Key.welcomeGreetingAfternoon]: "こんにちは",
	[Key.welcomeGreetingEvening]: "こんばんは",

	// タブバー
	[Key.tabBarLabel]: "ページタブ",
	[Key.tabClose]: "閉じる",
	[Key.tabRefresh]: "再読み込み",
	[Key.tabCloseCurrent]: "現在のタブを閉じる",
	[Key.tabCloseOthers]: "他のタブを閉じる",
	[Key.tabCloseAll]: "すべて閉じる",
	[Key.tabCloseLeft]: "左側を閉じる",
	[Key.tabCloseRight]: "右側を閉じる",
	[Key.tabPin]: "タブを固定",
	[Key.tabUnpin]: "固定を解除",
	[Key.tabUntitled]: "無題",
	[Key.settings]: "設定",
	[Key.settingsTheme]: "テーマ設定",
	[Key.settingsPlayback]: "再生設定",
	[Key.playModeList]: "リストループ",
	[Key.playModeOne]: "1曲リピート",
	[Key.playModeRandom]: "シャッフル",
	[Key.playerSpeed]: "再生速度",
	[Key.playerGlass]: "プレイヤーのガラス",
	[Key.playerPersistent]: "プレイヤーを常時表示",
	[Key.playerPersistentHint]: "一時停止・停止後もカードを左下に残します",
	[Key.playerAutoPlay]: "サイト訪問時に自動再生",
	[Key.playerAutoPlayHint]:
		"ページを開くと自動で再生します（次回の訪問から）。ブラウザにブロックされた場合はクリック後に再生",
	[Key.playerTapForSound]: "ミュートで再生中 — ページをクリックで音が出ます",
};
