import Key from "@/shared/i18n/i18nKey";
import type { Translation } from "@/shared/i18n/translation";

export const en: Translation = {
	[Key.skipToContent]: "Skip to content",
	[Key.home]: "Home",
	[Key.about]: "About",
	[Key.archive]: "Archive",
	[Key.search]: "Search",
	[Key.searchNoResults]: "No results found.",
	[Key.searchTypeSomething]: "Type something to search...",
	[Key.searchLoading]: "Searching...",
	[Key.searchContent]: "Content",
	[Key.searchViewMore]: "View more results ({count} more)",

	// Navbar menu groups
	[Key.navArticles]: "Articles",
	[Key.navSocial]: "Social",
	[Key.navMine]: "Mine",
	[Key.navAbout]: "About",
	[Key.navLinks]: "Links",
	[Key.all]: "All",

	[Key.tags]: "Tags",
	[Key.categories]: "Categories",
	[Key.allCategories]: "All Categories",
	[Key.allTags]: "All Tags",
	[Key.allSeries]: "All Series",
	[Key.postList]: "Post List",
	[Key.tableOfContents]: "Table of Contents",
	[Key.tocEmpty]: "No table of contents on this page",
	[Key.music]: "Music",
	[Key.books]: "Books",
	[Key.booksDescription]: "My WeRead shelf and reading stats",
	[Key.booksShelf]: "Bookshelf",
	[Key.booksEmpty]: "No shelf data. Check the WeRead API key.",
	[Key.booksThisMonth]: "This month",
	[Key.booksAllTime]: "All time",
	[Key.booksDailyAverage]: "Daily average",
	[Key.booksFinished]: "Finished",
	[Key.booksReading]: "Reading",
	[Key.booksReadCount]: "Read",
	[Key.booksWordCount]: "{n}k words",
	[Key.booksScore]: "{n} / 10",
	[Key.booksWordsLabel]: "Words",
	[Key.booksScoreLabel]: "Rating",
	[Key.booksRatingCount]: "{n} ratings",
	[Key.booksOpen]: "Open in WeRead",
	[Key.booksHeatmap]: "Star Map of the Book Sea",
	[Key.booksHeatmapLess]: "Less",
	[Key.booksHeatmapMore]: "More",
	[Key.booksHeatmapSummary]: "{d} days read · {h} h total",
	[Key.booksHeatmapEmpty]: "No reading activity this year",
	[Key.dynamic]: "Moments",
	[Key.latestDynamics]: "Latest Moments",
	[Key.moreDynamics]: "More moments",
	[Key.dynamicDescription]: "Short thoughts and everyday moments.",
	[Key.dynamicEmpty]: "No moments have been posted yet",
	[Key.dynamicNoResults]: "No matching moments found",
	[Key.dynamicLoading]: "Loading moments",
	[Key.dynamicAllYears]: "All years",
	[Key.dynamicProfile]: "View {name}'s profile",
	[Key.dynamicLike]: "Like",
	[Key.dynamicComment]: "Comment",
	[Key.dynamicLikes]: "Likes",
	[Key.dynamicComments]: "Comments",
	[Key.dynamicCollapseGallery]: "Collapse",
	[Key.dynamicViewOriginal]: "View full size",
	[Key.dynamicPreviousImage]: "Previous image",
	[Key.dynamicNextImage]: "Next image",
	[Key.dynamicViewImage]: "View image {index}",
	[Key.dynamicSelectImage]: "Select image {index}",
	[Key.musicNoPlaying]: "No playing",
	[Key.musicLyrics]: "Lyrics",
	[Key.musicVolume]: "Volume",
	[Key.musicPlayMode]: "Switch Play Mode",
	[Key.musicPrev]: "Previous",
	[Key.musicNext]: "Next",
	[Key.musicPlaylist]: "Playlist",
	[Key.musicNoLyrics]: "No lyrics available",
	[Key.musicLoadingLyrics]: "Loading lyrics...",
	[Key.musicFailedLyrics]: "Failed to load lyrics",
	[Key.musicNoSongs]: "No songs",
	[Key.musicError]: "Player Error",
	[Key.musicPlay]: "Play",
	[Key.musicPause]: "Pause",
	[Key.musicProgress]: "Playback Progress",
	[Key.musicCover]: "Cover",
	[Key.musicNoCover]: "No cover available",

	// Announcement
	[Key.announcement]: "Announcement",
	[Key.announcementClose]: "Close",

	[Key.commentNotConfigured]: "Comment system not configured",
	[Key.commentChatToday]: "Today",
	[Key.commentChatLoading]: "Loading…",
	[Key.commentChatEmpty]: "No comments yet. Say something!",
	[Key.commentChatDisabled]: "Comments are closed",
	[Key.commentChatLoadFailed]: "Could not load comments",
	[Key.commentChatLoadMore]: "Load earlier comments",
	[Key.commentChatSendFailed]: "Could not send, please retry",
	[Key.commentChatPending]: "Awaiting review",
	[Key.commentChatPlaceholder]: "Message",
	[Key.commentChatSend]: "Send",
	[Key.commentChatEmoji]: "Emoji",
	[Key.commentChatAttach]: "Attach image",
	[Key.commentChatCopy]: "Copy",
	[Key.commentChatCopied]: "Copied",
	[Key.commentChatCode]: "Code",
	[Key.commentChatReply]: "Reply",
	[Key.commentChatRetract]: "Delete",
	[Key.commentChatRetracted]: "Deleted",
	[Key.commentChatRetractFailed]: "Couldn't delete, try again",
	[Key.commentChatRetractReplies]:
		"This comment has replies. Deleting it removes them too. Continue?",
	[Key.commentChatMe]: "You",
	// 接口失败兜底：按 code 归类，不把后端的英文 title 直接给用户
	[Key.dynamicLoadFailed]:
		"Failed to load updates. Please refresh and try again.",
	[Key.commentChatSendUnconfirmed]:
		"Result unconfirmed — refresh before sending again",
	[Key.apiErrorNetwork]:
		"The network seems to be having trouble. Please try again.",
	[Key.apiErrorRequest]:
		"Some of the information was rejected. Please check it and try again.",
	[Key.apiErrorServer]:
		"The service is unavailable right now. Please try again later.",
	[Key.apiErrorUnknown]: "Something went wrong. Please try again.",
	[Key.commentInfoTitle]: "Comment profile",
	[Key.commentInfoOpen]: "Edit comment profile",
	[Key.commentInfoName]: "Name",
	[Key.commentInfoNamePlaceholder]: "What should we call you?",
	[Key.commentInfoEmail]: "Email",
	[Key.commentInfoEmailPlaceholder]: "you@example.com",
	[Key.commentInfoSave]: "Save",
	[Key.commentInfoCancel]: "Cancel",
	[Key.commentInfoLocked]: "Add your name and email to comment",
	[Key.commentInfoSubEmpty]: "Tap to add your name and email",
	[Key.commentInfoNameRequired]: "Please enter a name",
	[Key.commentInfoEmailInvalid]: "That email doesn't look valid",
	[Key.friends]: "Friends",
	[Key.friendsDescription]:
		"Here are my friends, welcome to visit and communicate with each other",
	[Key.searchFriends]: "Search friends...",
	[Key.friendsEmpty]: "No friends yet.",

	[Key.guestbook]: "Guestbook",
	[Key.guestbookDescription]:
		"Many things are worth recording, and worth recalling afterwards",
	[Key.guestbookTitle]: "Message Wall",
	[Key.guestbookWrite]: "Leave a message",
	[Key.guestbookEmpty]: "No messages yet — be the first to leave one",
	[Key.guestbookRetry]: "Retry",
	[Key.guestbookSubmitted]:
		"Your message was submitted and will appear after review",
	[Key.guestbookDelete]: "Delete message",
	[Key.guestbookDeleteConfirm]: "Delete this message?",
	[Key.guestbookBodyRequired]: "Write something before sending",
	[Key.uncategorized]: "Uncategorized",
	[Key.noTags]: "No Tags",

	[Key.wordCount]: "word",
	[Key.wordsCount]: "words",
	[Key.minuteCount]: "minute",
	[Key.minutesCount]: "minutes",
	[Key.postCount]: "post",
	[Key.postsCount]: "posts",
	[Key.tagChartTitle]: "Article count",
	[Key.tagChartAverage]: "Average",
	[Key.noData]: "No data yet",

	[Key.themeColor]: "Theme Color",

	[Key.lightMode]: "Day",
	[Key.darkMode]: "Night",
	[Key.systemMode]: "System",
	[Key.scheduledMode]: "Scheduled",
	[Key.themeMode]: "Day & Night",
	[Key.scheduleDayStart]: "Day starts",
	[Key.scheduleNightStart]: "Night starts",

	[Key.more]: "More",
	[Key.collapse]: "Collapse",

	[Key.author]: "Author",
	[Key.publishedAt]: "Published at",
	[Key.updatedAt]: "Updated at",
	[Key.readTime]: "Read time",
	[Key.license]: "License",

	[Key.paginationPrev]: "Previous",
	[Key.paginationNext]: "Next",
	[Key.paginationPage]: "Page",
	[Key.paginationJump]: "Jump to page",

	// 404 Page
	[Key.notFound]: "404",
	[Key.notFoundTitle]: "Page Not Found",
	[Key.notFoundDescription]:
		"Sorry, the page you visited does not exist or has been moved.",
	[Key.backToHome]: "Back to Home",

	// RSS Page
	[Key.rss]: "RSS Feed",
	[Key.rssDescription]: "Subscribe to get latest updates",
	[Key.rssSubtitle]:
		"Subscribe via RSS to get the latest articles and updates imediately",
	[Key.rssLink]: "RSS Link",
	[Key.rssCopyToReader]: "Copy link to your RSS reader",
	[Key.rssCopyLink]: "Copy Link",
	[Key.rssLatestPosts]: "Latest Posts",
	[Key.rssWhatIsRSS]: "What is RSS?",
	[Key.rssWhatIsRSSDescription]:
		"RSS (Really Simple Syndication) is a standard format for publishing frequently updated content. With RSS, you can:",
	[Key.rssBenefit1]:
		"Get the latest website content in time without manually visiting",
	[Key.rssBenefit2]: "Manage subscriptions to multiple websites in one place",
	[Key.rssBenefit3]: "Avoid missing important updates and articles",
	[Key.rssBenefit4]: "Enjoy an ad-free, clean reading experience",
	[Key.rssHowToUse]:
		"It is recommended to use Feedly, Inoreader or other RSS readers to subscribe to this site.",
	[Key.rssCopied]: "RSS link copied to clipboard!",
	[Key.rssCopyFailed]: "Copy failed, please copy the link manually",

	// Atom Page
	[Key.atom]: "Atom Feed",
	[Key.atomDescription]: "Subscribe to get latest updates",
	[Key.atomSubtitle]:
		"Subscribe via Atom to get the latest articles and updates immediately",
	[Key.atomLink]: "Atom Link",
	[Key.atomCopyToReader]: "Copy link to your Atom reader",
	[Key.atomCopied]: "Atom link copied to clipboard!",

	// Last Modified Time Card
	[Key.lastModifiedPrefix]: "Last updated on ",
	[Key.lastModifiedOutdated]: "Some content may be outdated",
	[Key.lastModifiedDaysAgo]: "{days} days ago",
	[Key.year]: "year",

	// Page Views Statistics
	[Key.pageViews]: "Views",

	// Pinned
	[Key.pinned]: "Pinned",

	// Related Posts
	[Key.relatedPosts]: "Related Posts",
	[Key.randomPosts]: "Random Posts",
	[Key.smartRecommend]: "Smart",
	[Key.randomRecommend]: "Random",
	[Key.noRelatedPosts]: "No related posts",
	[Key.noRandomPosts]: "No random posts",

	// Article Series
	[Key.series]: "Series",
	[Key.seriesPartOf]: "Part of series",
	[Key.seriesPart]: "Part {n}",
	[Key.seriesThisArticle]: "This article",
	[Key.noSeries]: "No series yet",

	// Encrypted
	[Key.postEncrypted]: "This post is encrypted",

	// Wallpaper Mode
	[Key.wallpaperMode]: "Wallpaper Mode",
	[Key.wallpaperBannerMode]: "Banner Wallpaper",
	[Key.wallpaperFullscreenMode]: "Fullscreen Wallpaper",
	[Key.fullscreenLayout]: "Fullscreen Layout",
	[Key.fullscreenClassicLayout]: "Classic",
	[Key.fullscreenHeroLayout]: "Hero",
	[Key.wallpaperOverlayMode]: "Overlay Wallpaper",
	[Key.wallpaperNoneMode]: "None Wallpaper",

	// Wallpaper Settings
	[Key.wallpaperSettings]: "Wallpaper Settings",
	[Key.wallpaperTitle]: "Home Wallpaper Title",
	[Key.wallpaperCarousel]: "Wallpaper Carousel",
	[Key.commentWallpaper]: "Comment Wallpaper",
	[Key.wavesAnimation]: "Waves Animation",
	[Key.gradientTransition]: "Gradient Transition",
	[Key.sakuraEffect]: "Sakura Effect",
	[Key.effectsSettings]: "Effects",
	[Key.overlaySettings]: "Transparency Settings",
	[Key.overlayOpacity]: "Wallpaper Opacity",
	[Key.overlayTransparency]: "Background Opacity",
	[Key.overlayCardOpacity]: "Card Opacity",
	[Key.overlayPanelTransparency]: "Popup opacity",

	// Settings Panel Tabs
	[Key.settingsTabAppearance]: "Appearance",
	[Key.settingsTabWallpaper]: "Wallpaper",
	[Key.settingsTabBackground]: "Background",

	// Card Style
	[Key.cardSettings]: "Card Style",
	[Key.cardBorder]: "Card Border & Shadow",
	[Key.cardFollowTheme]: "Card Follow Theme Color",

	// Post List Layout
	[Key.postListLayout]: "Post List Layout",
	[Key.postListLayoutList]: "List",
	[Key.postListLayoutGrid]: "Grid",

	// Sponsor Page
	[Key.sponsor]: "Sponsor",
	[Key.sponsorTitle]: "Support Me",
	[Key.scanToSponsor]: "Scan to Sponsor",
	[Key.sponsorButton]: "Support & Share",
	[Key.sponsorButtonText]:
		"If this article helped you, please share or support!",

	[Key.shareOnSocial]: "Share Article",
	[Key.shareOnSocialDescription]:
		"If this article helped you, please share it with others!",

	// Site Statistics
	[Key.siteStats]: "Site Statistics",
	[Key.siteStatsPostCount]: "Posts",
	[Key.siteStatsCategoryCount]: "Categories",
	[Key.siteStatsTagCount]: "Tags",
	[Key.siteStatsTotalWords]: "Total Words",
	[Key.siteStatsViews]: "Page Views",
	[Key.siteStatsVisitors]: "Visitors",
	[Key.siteStatsRunningDays]: "Running Days",

	// Site Info
	[Key.siteInfo]: "Site Info",
	[Key.siteInfoBuildTime]: "Build Time",
	[Key.siteInfoBuildPlatform]: "Build Platform",
	[Key.siteInfoBlogVersion]: "Blog Version",
	[Key.siteInfoAstroVersion]: "Astro Version",
	[Key.siteInfoNodeVersion]: "Node Version",
	[Key.siteInfoPnpmVersion]: "pnpm Version",
	[Key.siteInfoSystem]: "System",
	[Key.siteInfoExpand]: "Show build info",
	[Key.siteInfoCollapse]: "Hide build info",
	[Key.siteInfoDomain]: "Domain",
	[Key.siteInfoLicense]: "License",

	// Calendar Component
	[Key.calendarSunday]: "Sun",
	[Key.calendarMonday]: "Mon",
	[Key.calendarTuesday]: "Tue",
	[Key.calendarWednesday]: "Wed",
	[Key.calendarThursday]: "Thu",
	[Key.calendarFriday]: "Fri",
	[Key.calendarSaturday]: "Sat",
	[Key.calendarJanuary]: "Jan",
	[Key.calendarFebruary]: "Feb",
	[Key.calendarMarch]: "Mar",
	[Key.calendarApril]: "Apr",
	[Key.calendarMay]: "May",
	[Key.calendarJune]: "Jun",
	[Key.calendarJuly]: "Jul",
	[Key.calendarAugust]: "Aug",
	[Key.calendarSeptember]: "Sep",
	[Key.calendarOctober]: "Oct",
	[Key.calendarNovember]: "Nov",
	[Key.calendarDecember]: "Dec",
	[Key.calendar]: "Site Calendar",
	[Key.calendarHeatmapWeek]: "Week {week} of {month}, {count} posts",
	[Key.advertisement]: "Advertisement",

	[Key.shareArticle]: "Share",
	[Key.generatingPoster]: "Generating Poster...",
	[Key.copyLink]: "Copy Link",
	[Key.sharePoster]: "Share Poster",
	[Key.scanToRead]: "Scan to Read",

	// Password Protection
	[Key.passwordProtected]: "Password Protected",
	[Key.passwordProtectedDesc]:
		"This content is password protected. Please enter the password to view.",
	[Key.passwordHint]: "Hint",
	[Key.passwordPlaceholder]: "Enter password",
	[Key.passwordSubmit]: "Unlock",
	[Key.passwordError]: "Incorrect password, please try again.",
	[Key.passwordProtectedRss]:
		"This article is encrypted. Please visit the website to view it.",

	[Key.videoPrev]: "Previous video",
	[Key.videoNext]: "Next video",
	[Key.videoLoadError]: "Video failed to load",

	// Immersive Reading
	[Key.immersiveReading]: "Immersive Reading",
	[Key.enterImmersiveReading]: "Enter Immersive Reading",
	[Key.exitImmersiveReading]: "Exit Immersive Reading",
	[Key.tocExpand]: "Expand directory",
	[Key.tocCollapse]: "Collapse directory",

	// Visitor welcome (Welcome widget)
	[Key.welcomeTitle]: "Visitor Info",
	[Key.welcomeTemplate]:
		"A visitor from {location}. {greeting} — it's {time}, about {distance} km from the site owner. IP: {ip}",
	[Key.welcomeTemplateNoDistance]:
		"A visitor from {location}. {greeting} — it's {time}. IP: {ip}",
	[Key.welcomeGreetingLateNight]: "Late at night",
	[Key.welcomeGreetingMorning]: "Good morning",
	[Key.welcomeGreetingAfternoon]: "Good afternoon",
	[Key.welcomeGreetingEvening]: "Good evening",

	// Tab bar
	[Key.tabBarLabel]: "Page tabs",
	[Key.tabClose]: "Close",
	[Key.tabRefresh]: "Refresh",
	[Key.tabCloseCurrent]: "Close current",
	[Key.tabCloseOthers]: "Close others",
	[Key.tabCloseAll]: "Close all",
	[Key.tabCloseLeft]: "Close to the left",
	[Key.tabCloseRight]: "Close to the right",
	[Key.tabPin]: "Pin tab",
	[Key.tabUnpin]: "Unpin tab",
	[Key.tabUntitled]: "Untitled",
	[Key.settings]: "Settings",
	[Key.settingsTheme]: "Theme settings",
	[Key.settingsPlayback]: "Playback settings",
	[Key.playModeList]: "Repeat list",
	[Key.playModeOne]: "Repeat one",
	[Key.playModeRandom]: "Shuffle",
	[Key.playerSpeed]: "Playback speed",
	[Key.playerGlass]: "Player glass",
	[Key.playerPersistent]: "Keep player visible",
	[Key.playerPersistentHint]: "Keep the card in the corner after pause or stop",
	[Key.playerAutoPlay]: "Autoplay on visit",
	[Key.playerAutoPlayHint]:
		"Start playing as the page loads (from next visit); browsers may block it until you interact",
	[Key.playerTapForSound]: "Playing muted — click the page to turn on sound",
};
