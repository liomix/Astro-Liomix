import Key from "@/shared/i18n/i18nKey";
import type { Translation } from "@/shared/i18n/translation";

export const ru: Translation = {
	[Key.skipToContent]: "Перейти к содержимому",
	[Key.home]: "Главная",
	[Key.about]: "О нас",
	[Key.archive]: "Архив",
	[Key.search]: "Поиск",
	[Key.searchNoResults]: "Результаты не найдены.",
	[Key.searchTypeSomething]: "Введите ключевое слово для поиска...",
	[Key.searchLoading]: "Поиск...",
	[Key.searchContent]: "Содержание",
	[Key.searchViewMore]: "Показать еще ({count} шт)",

	// Группы меню навигации
	[Key.navArticles]: "Статьи",
	[Key.navSocial]: "Соцсети",
	[Key.navMine]: "Моё",
	[Key.navAbout]: "Обо мне",
	[Key.navLinks]: "Ссылки",
	[Key.all]: "Все",

	[Key.tags]: "Теги",
	[Key.categories]: "Категории",
	[Key.allCategories]: "Все категории",
	[Key.allTags]: "Все теги",
	[Key.allSeries]: "Все серии",
	[Key.postList]: "Список постов",
	[Key.tableOfContents]: "Содержание",
	[Key.tocEmpty]: "На этой странице нет оглавления",
	[Key.music]: "Музыка",
	[Key.books]: "Книги",
	[Key.booksDescription]: "Полка WeRead и статистика чтения",
	[Key.booksShelf]: "Книжная полка",
	[Key.booksEmpty]: "Нет данных о полке. Проверьте ключ API WeRead.",
	[Key.booksThisMonth]: "За месяц",
	[Key.booksAllTime]: "Всего",
	[Key.booksDailyAverage]: "В среднем за день",
	[Key.booksFinished]: "Дочитано",
	[Key.booksReading]: "Читаю",
	[Key.booksReadCount]: "Прочитано",
	[Key.booksWordCount]: "{n} тыс. слов",
	[Key.booksScore]: "{n} / 10",
	[Key.booksWordsLabel]: "Объём",
	[Key.booksScoreLabel]: "Оценка",
	[Key.booksRatingCount]: "{n} оценок",
	[Key.booksOpen]: "Открыть в WeRead",
	[Key.booksHeatmap]: "Звёздная карта книжного моря",
	[Key.booksHeatmapLess]: "Меньше",
	[Key.booksHeatmapMore]: "Больше",
	[Key.booksHeatmapSummary]: "{d} дн. с чтением · {h} ч всего",
	[Key.booksHeatmapEmpty]: "В этом году пока нет записей",
	[Key.dynamic]: "Моменты",
	[Key.latestDynamics]: "Последние публикации",
	[Key.moreDynamics]: "Больше публикаций",
	[Key.dynamicDescription]: "Короткие мысли и моменты повседневной жизни.",
	[Key.dynamicEmpty]: "Пока нет публикаций",
	[Key.dynamicNoResults]: "Подходящие публикации не найдены",
	[Key.dynamicLoading]: "Загрузка публикаций",
	[Key.dynamicAllYears]: "Все годы",
	[Key.dynamicProfile]: "Открыть профиль {name}",
	[Key.dynamicLike]: "Нравится",
	[Key.dynamicComment]: "Комментарии",
	[Key.dynamicLikes]: "Лайки",
	[Key.dynamicComments]: "Комментарии",
	[Key.dynamicCollapseGallery]: "Свернуть",
	[Key.dynamicViewOriginal]: "Открыть оригинал",
	[Key.dynamicPreviousImage]: "Предыдущее изображение",
	[Key.dynamicNextImage]: "Следующее изображение",
	[Key.dynamicViewImage]: "Открыть изображение {index}",
	[Key.dynamicSelectImage]: "Выбрать изображение {index}",
	[Key.musicNoPlaying]: "Ничего не воспроизводится",
	[Key.musicLyrics]: "Текст песни",
	[Key.musicVolume]: "Громкость",
	[Key.musicPlayMode]: "Переключить режим воспроизведения",
	[Key.musicPrev]: "Предыдущий трек",
	[Key.musicNext]: "Следующий трек",
	[Key.musicPlaylist]: "Плейлист",
	[Key.musicNoLyrics]: "Текст песни отсутствует",
	[Key.musicLoadingLyrics]: "Загрузка текста песни...",
	[Key.musicFailedLyrics]: "Ошибка загрузки текста песни",
	[Key.musicNoSongs]: "Нет песен",
	[Key.musicError]: "Ошибка плеера",
	[Key.musicPlay]: "Воспроизвести",
	[Key.musicPause]: "Пауза",
	[Key.musicProgress]: "Прогресс воспроизведения",
	[Key.musicCover]: "Обложка",
	[Key.musicNoCover]: "Нет обложки",

	// Объявление
	[Key.announcement]: "Объявление",
	[Key.announcementClose]: "Закрыть",

	[Key.commentNotConfigured]: "Система комментариев не настроена",
	[Key.commentChatToday]: "Сегодня",
	[Key.commentChatLoading]: "Загрузка…",
	[Key.commentChatEmpty]: "Комментариев пока нет",
	[Key.commentChatDisabled]: "Комментарии отключены",
	[Key.commentChatLoadFailed]: "Не удалось загрузить комментарии",
	[Key.commentChatLoadMore]: "Загрузить более ранние",
	[Key.commentChatSendFailed]: "Не удалось отправить, попробуйте позже",
	[Key.commentChatPending]: "На проверке",
	[Key.commentChatPlaceholder]: "Сообщение",
	[Key.commentChatSend]: "Отправить",
	[Key.commentChatEmoji]: "Эмодзи",
	[Key.commentChatAttach]: "Отправить изображение",
	[Key.commentChatCopy]: "Копировать",
	[Key.commentChatCopied]: "Скопировано",
	[Key.commentChatCode]: "Код",
	[Key.commentChatReply]: "Ответить",
	[Key.commentChatRetract]: "Удалить",
	[Key.commentChatRetracted]: "Удалено",
	[Key.commentChatRetractFailed]: "Не удалось удалить",
	[Key.commentChatRetractReplies]:
		"У этого комментария есть ответы. Они будут удалены вместе с ним. Продолжить?",
	[Key.commentChatMe]: "Вы",
	// 接口失败兜底：按 code 归类，不把后端的英文 title 直接给用户
	[Key.dynamicLoadFailed]:
		"Не удалось загрузить обновления. Обновите страницу.",
	[Key.commentChatSendUnconfirmed]:
		"Результат не подтверждён — обновите страницу, прежде чем отправлять снова",
	[Key.apiErrorNetwork]: "Похоже, есть проблемы с сетью. Попробуйте позже.",
	[Key.apiErrorRequest]:
		"Часть данных не прошла проверку. Исправьте и попробуйте снова.",
	[Key.apiErrorServer]: "Сервис временно недоступен. Попробуйте позже.",
	[Key.apiErrorUnknown]: "Что-то пошло не так. Попробуйте позже.",
	[Key.commentInfoTitle]: "Профиль комментатора",
	[Key.commentInfoOpen]: "Изменить профиль комментатора",
	[Key.commentInfoName]: "Имя",
	[Key.commentInfoNamePlaceholder]: "Как к вам обращаться?",
	[Key.commentInfoEmail]: "Email",
	[Key.commentInfoEmailPlaceholder]: "you@example.com",
	[Key.commentInfoSave]: "Сохранить",
	[Key.commentInfoCancel]: "Отмена",
	[Key.commentInfoLocked]: "Укажите имя и email, чтобы комментировать",
	[Key.commentInfoSubEmpty]: "Нажмите, чтобы указать имя и email",
	[Key.commentInfoNameRequired]: "Укажите имя",
	[Key.commentInfoEmailInvalid]: "Некорректный email",
	[Key.friends]: "Ссылки",
	[Key.friendsDescription]:
		"Вот мои друзья, добро пожаловать посетить и общаться друг с другом",
	[Key.searchFriends]: "Поиск друзей...",
	[Key.friendsEmpty]: "Друзей пока нет.",

	[Key.guestbook]: "Гостевая книга",
	[Key.guestbookDescription]:
		"Есть вещи, которые стоит записать, чтобы потом вспомнить",
	[Key.guestbookTitle]: "Стена сообщений",
	[Key.guestbookWrite]: "Оставить сообщение",
	[Key.guestbookEmpty]: "Сообщений пока нет — оставьте первое",
	[Key.guestbookRetry]: "Повторить",
	[Key.guestbookSubmitted]: "Сообщение отправлено и появится после проверки",
	[Key.guestbookDelete]: "Удалить сообщение",
	[Key.guestbookDeleteConfirm]: "Удалить это сообщение?",
	[Key.guestbookBodyRequired]: "Напишите что-нибудь перед отправкой",
	[Key.uncategorized]: "Без категории",
	[Key.noTags]: "Нет тегов",

	[Key.wordCount]: "слово",
	[Key.wordsCount]: "слова",
	[Key.minuteCount]: "минута",
	[Key.minutesCount]: "минуты",
	[Key.postCount]: "пост",
	[Key.postsCount]: "постов",
	[Key.tagChartTitle]: "Количество статей",
	[Key.tagChartAverage]: "Среднее",
	[Key.noData]: "Нет данных",

	[Key.themeColor]: "Цвет темы",

	[Key.lightMode]: "День",
	[Key.darkMode]: "Ночь",
	[Key.systemMode]: "Система",
	[Key.scheduledMode]: "По расписанию",
	[Key.themeMode]: "День и ночь",
	[Key.scheduleDayStart]: "Начало дня",
	[Key.scheduleNightStart]: "Начало ночи",

	[Key.more]: "Ещё",
	[Key.collapse]: "Свернуть",

	[Key.author]: "Автор",
	[Key.publishedAt]: "Опубликовано",
	[Key.updatedAt]: "Обновлено",
	[Key.readTime]: "Время чтения",
	[Key.license]: "Лицензия",

	[Key.paginationPrev]: "Предыдущая",
	[Key.paginationNext]: "Следующая",
	[Key.paginationPage]: "Страница",
	[Key.paginationJump]: "Перейти к странице",

	// 404 Страница
	[Key.notFound]: "404",
	[Key.notFoundTitle]: "Страница не найдена",
	[Key.notFoundDescription]:
		"Извините, страница, которую вы посетили, не существует или была перемещена.",
	[Key.backToHome]: "Вернуться на главную",

	// RSS Страница
	[Key.rss]: "RSS лента",
	[Key.rssDescription]: "Подпишитесь, чтобы получать последние обновления",
	[Key.rssSubtitle]:
		"Подписаться через RSS, чтобы сразу получать последние статьи и обновления",
	[Key.rssLink]: "RSS ссылка",
	[Key.rssCopyToReader]: "Скопировать ссылку в ваш RSS читатель",
	[Key.rssCopyLink]: "Скопировать ссылку",
	[Key.rssLatestPosts]: "Последние посты",
	[Key.rssWhatIsRSS]: "Что такое RSS?",
	[Key.rssWhatIsRSSDescription]:
		"RSS (Really Simple Syndication) — стандартный формат для публикации часто обновляемого контента. С RSS вы можете:",
	[Key.rssBenefit1]:
		"Получать последний контент сайта вовремя без ручного посещения",
	[Key.rssBenefit2]: "Управлять подписками на несколько сайтов в одном месте",
	[Key.rssBenefit3]: "Не пропускать важные обновления и статьи",
	[Key.rssBenefit4]: "Наслаждаться чистым чтением без рекламы",
	[Key.rssHowToUse]:
		"Рекомендуется использовать Feedly, Inoreader или другие RSS читатели для подписки на этот сайт.",
	[Key.rssCopied]: "RSS ссылка скопирована в буфер обмена!",
	[Key.rssCopyFailed]:
		"Ошибка копирования, пожалуйста, скопируйте ссылку вручную",

	// Atom Page
	[Key.atom]: "Atom-лента",
	[Key.atomDescription]: "Подпишитесь на последние обновления",
	[Key.atomSubtitle]:
		"Подпишитесь через Atom, чтобы сразу получать последние статьи и обновления",
	[Key.atomLink]: "Atom-ссылка",
	[Key.atomCopyToReader]: "Скопируйте ссылку в свой Atom-ридер",
	[Key.atomCopied]: "Atom-ссылка скопирована в буфер обмена!",

	// Последнее изменение
	[Key.lastModifiedPrefix]: "Последнее обновление: ",
	[Key.lastModifiedOutdated]: "Некоторый контент может быть устаревшим",
	[Key.lastModifiedDaysAgo]: "{days} дней назад",
	[Key.year]: "год",

	// Статистика просмотров
	[Key.pageViews]: "Просмотры",

	// Закреплено
	[Key.pinned]: "Закреплено",

	// Похожие статьи
	[Key.relatedPosts]: "Похожие статьи",
	[Key.randomPosts]: "Случайные статьи",
	[Key.smartRecommend]: "Умный",
	[Key.randomRecommend]: "Случайный",
	[Key.noRelatedPosts]: "Нет похожих статей",
	[Key.noRandomPosts]: "Нет случайных статей",

	// Серия статей
	[Key.series]: "Серии",
	[Key.seriesPartOf]: "Часть серии",
	[Key.seriesPart]: "Часть {n}",
	[Key.seriesThisArticle]: "Эта статья",
	[Key.noSeries]: "Пока нет серий",

	// Зашифровано
	[Key.postEncrypted]: "Эта статья зашифрована",

	// Режим обоев
	[Key.wallpaperMode]: "Режим обоев",
	[Key.wallpaperBannerMode]: "Баннер обои",
	[Key.wallpaperFullscreenMode]: "Полноэкранные обои",
	[Key.fullscreenLayout]: "Полноэкранный макет",
	[Key.fullscreenClassicLayout]: "Классический",
	[Key.fullscreenHeroLayout]: "Hero",
	[Key.wallpaperOverlayMode]: "Прозрачный",
	[Key.wallpaperNoneMode]: "Однотонный фон",

	// Настройки обоев
	[Key.wallpaperSettings]: "Настройки обоев",
	[Key.wallpaperTitle]: "Заголовок главных обоев",
	[Key.wallpaperCarousel]: "Карусель обоев",
	[Key.commentWallpaper]: "Обои комментариев",
	[Key.wavesAnimation]: "Анимация волн",
	[Key.gradientTransition]: "Градиентный переход",
	[Key.sakuraEffect]: "Эффект сакуры",
	[Key.effectsSettings]: "Эффекты",
	[Key.overlaySettings]: "Настройки прозрачности",
	[Key.overlayOpacity]: "Прозрачность обоев",
	[Key.overlayTransparency]: "Прозрачность фона",
	[Key.overlayCardOpacity]: "Прозрачность карточек",
	[Key.overlayPanelTransparency]: "Прозрачность попапа",

	// Вкладки панели настроек
	[Key.settingsTabAppearance]: "Оформление",
	[Key.settingsTabWallpaper]: "Обои",
	[Key.settingsTabBackground]: "Фон",

	// Стиль карточек
	[Key.cardSettings]: "Стиль карточек",
	[Key.cardBorder]: "Рамка и тень карточек",
	[Key.cardFollowTheme]: "Карточки跟随主题色",

	// Макет списка сообщений
	[Key.postListLayout]: "Макет списка сообщений",
	[Key.postListLayoutList]: "Список",
	[Key.postListLayoutGrid]: "Сетка",

	// Страница спонсоров
	[Key.sponsor]: "Спонсор",
	[Key.sponsorTitle]: "Поддержать меня",
	[Key.scanToSponsor]: "Сканировать для поддержки",
	[Key.sponsorButton]: "Поддержка и Поделиться",
	[Key.sponsorButtonText]:
		"Если эта статья помогла вам, пожалуйста, поделитесь или поддержите!",

	[Key.shareOnSocial]: "Поделиться статьей",
	[Key.shareOnSocialDescription]:
		"Если эта статья помогла вам, пожалуйста, поделитесь ею с другими!",

	// Статистика сайта
	[Key.siteStats]: "Статистика сайта",
	[Key.siteStatsPostCount]: "Статьи",
	[Key.siteStatsCategoryCount]: "Категории",
	[Key.siteStatsTagCount]: "Теги",
	[Key.siteStatsTotalWords]: "Всего слов",
	[Key.siteStatsViews]: "Просмотры",
	[Key.siteStatsVisitors]: "Посетители",
	[Key.siteStatsRunningDays]: "Дней работы",

	// Информация о сайте
	[Key.siteInfo]: "Информация о сайте",
	[Key.siteInfoBuildTime]: "Время сборки",
	[Key.siteInfoBuildPlatform]: "Платформа сборки",
	[Key.siteInfoBlogVersion]: "Версия блога",
	[Key.siteInfoAstroVersion]: "Astro",
	[Key.siteInfoNodeVersion]: "Node",
	[Key.siteInfoPnpmVersion]: "pnpm",
	[Key.siteInfoSystem]: "Система",
	[Key.siteInfoExpand]: "Показать информацию о сборке",
	[Key.siteInfoCollapse]: "Скрыть информацию о сборке",
	[Key.siteInfoDomain]: "Домен",
	[Key.siteInfoLicense]: "Лицензия",

	// Компонент календаря
	[Key.calendarSunday]: "Вс",
	[Key.calendarMonday]: "Пн",
	[Key.calendarTuesday]: "Вт",
	[Key.calendarWednesday]: "Ср",
	[Key.calendarThursday]: "Чт",
	[Key.calendarFriday]: "Пт",
	[Key.calendarSaturday]: "Сб",
	[Key.calendarJanuary]: "Янв",
	[Key.calendarFebruary]: "Фев",
	[Key.calendarMarch]: "Мар",
	[Key.calendarApril]: "Апр",
	[Key.calendarMay]: "Май",
	[Key.calendarJune]: "Июн",
	[Key.calendarJuly]: "Июл",
	[Key.calendarAugust]: "Авг",
	[Key.calendarSeptember]: "Сен",
	[Key.calendarOctober]: "Окт",
	[Key.calendarNovember]: "Ноя",
	[Key.calendarDecember]: "Дек",
	[Key.calendar]: "Календарь сайта",
	[Key.calendarHeatmapWeek]: "Неделя {week} {month}, {count} записей",
	[Key.advertisement]: "Реклама",

	[Key.shareArticle]: "Поделиться",
	[Key.generatingPoster]: "Создание постера...",
	[Key.copyLink]: "Копировать ссылку",
	[Key.sharePoster]: "Поделиться постером",
	[Key.scanToRead]: "Сканируйте, чтобы прочитать",

	// Защита паролем
	[Key.passwordProtected]: "Защищено паролем",
	[Key.passwordProtectedDesc]:
		"Этот контент защищён паролем. Пожалуйста, введите пароль для просмотра.",
	[Key.passwordHint]: "Подсказка",
	[Key.passwordPlaceholder]: "Введите пароль",
	[Key.passwordSubmit]: "Разблокировать",
	[Key.passwordError]: "Неверный пароль, попробуйте снова.",
	[Key.passwordProtectedRss]:
		"Эта статья зашифрована. Пожалуйста, посетите сайт для просмотра.",

	[Key.videoPrev]: "Предыдущее видео",
	[Key.videoNext]: "Следующее видео",
	[Key.videoLoadError]: "Не удалось загрузить видео",

	// Чтение без отвлечений
	[Key.immersiveReading]: "Чтение без отвлечений",
	[Key.enterImmersiveReading]: "Войти в режим чтения",
	[Key.exitImmersiveReading]: "Выйти из режима чтения",
	[Key.tocExpand]: "Развернуть оглавление",
	[Key.tocCollapse]: "Свернуть оглавление",

	// Приветствие посетителя (компонент Welcome)
	[Key.welcomeTitle]: "Информация о визите",
	[Key.welcomeTemplate]:
		"Вы зашли из {location}. {greeting} — сейчас {time}, около {distance} км от владельца сайта. IP: {ip}",
	[Key.welcomeTemplateNoDistance]:
		"Вы зашли из {location}. {greeting} — сейчас {time}. IP: {ip}",
	[Key.welcomeGreetingLateNight]: "Уже поздняя ночь",
	[Key.welcomeGreetingMorning]: "Доброе утро",
	[Key.welcomeGreetingAfternoon]: "Добрый день",
	[Key.welcomeGreetingEvening]: "Добрый вечер",

	// Панель вкладок
	[Key.tabBarLabel]: "Вкладки страниц",
	[Key.tabClose]: "Закрыть",
	[Key.tabRefresh]: "Обновить",
	[Key.tabCloseCurrent]: "Закрыть текущую",
	[Key.tabCloseOthers]: "Закрыть остальные",
	[Key.tabCloseAll]: "Закрыть все",
	[Key.tabCloseLeft]: "Закрыть слева",
	[Key.tabCloseRight]: "Закрыть справа",
	[Key.tabPin]: "Закрепить вкладку",
	[Key.tabUnpin]: "Открепить вкладку",
	[Key.tabUntitled]: "Без названия",
	[Key.settings]: "Настройки",
	[Key.settingsTheme]: "Настройки темы",
	[Key.settingsPlayback]: "Настройки воспроизведения",
	[Key.playModeList]: "Повтор списка",
	[Key.playModeOne]: "Повтор трека",
	[Key.playModeRandom]: "Перемешивание",
	[Key.playerSpeed]: "Скорость",
	[Key.playerGlass]: "Стекло плеера",
	[Key.playerPersistent]: "Оставлять плеер",
	[Key.playerPersistentHint]:
		"Карточка остаётся в углу после паузы или остановки",
	[Key.playerAutoPlay]: "Автовоспроизведение при входе",
	[Key.playerAutoPlayHint]:
		"Начинать воспроизведение при загрузке (со следующего визита); браузер может блокировать до первого клика",
	[Key.playerTapForSound]:
		"Играет без звука — щёлкните по странице, чтобы включить",
};
