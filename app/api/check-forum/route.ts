import { NextRequest, NextResponse } from "next/server"

interface ForumCheck {
  hasCategories: boolean
  hasTopics: boolean
  hasPosts: boolean
  hasPagination: boolean
  hasLastDates: boolean
  hasAuthors: boolean
  hasCounters: boolean
  countersFound: string[]
  lastDateFound?: string
  isDateFresh: boolean // true if last activity is in the current year or later
  latestYear?: number
}

function analyzeHtml(html: string): ForumCheck {
  // Check for categories/sections (multilingual)
  const categoryPatterns = [
    /forum[-_]?categor/i,
    /category[-_]?list/i,
    /<td[^>]*class="[^"]*forum[^"]*"/i,
    /class="[^"]*section[^"]*"/i,
    /class="[^"]*board[^"]*"/i,
    /class="[^"]*node[-_]?title/i,
    /data-type="forum"/i,
    /forumtitle/i,
    /forumrow/i,
    /subforum/i,
    // RU
    /(форум|раздел|категори)/i,
    // DE
    /(foren|kategorie|bereich|unterforum)/i,
    // FR
    /(catégorie|rubrique|sous-forum)/i,
    // ES
    /(categoría|foro|subforo|sección)/i,
    // IT
    /(categoria|sezione|sottoforum)/i,
    // PL
    /(kategoria|dział|podforum|sekcja)/i,
    // PT
    /(categoria|fórum|seção|subfórum)/i,
    // NL
    /(categorie|forum|sectie|subforum)/i,
    // TR
    /(kategori|forum|bölüm|alt forum)/i,
    // CZ/SK
    /(kategorie|fórum|sekce|podfórum)/i,
    // RO
    /(categorie|forum|secțiune)/i,
    // HU
    /(kategória|fórum|alfórum)/i,
    // SE/NO/DK
    /(kategori|forum|underforum|avdelning)/i,
    // FI
    /(kategoria|foorumi|alafoorumi)/i,
    // GR
    /(κατηγορία|φόρουμ|ενότητα)/i,
    // JP
    /(フォーラム|カテゴリ|掲示板)/i,
    // CN
    /(论坛|分区|版块|板块)/i,
    // KR
    /(포럼|게시판|카테고리)/i,
    // AR
    /(منتدى|قسم|فئة)/i,
    // HE
    /(פורום|קטגוריה|מדור)/i,
    // TH
    /(ฟอรั่ม|หมวดหมู่|กระดาน)/i,
    // VI
    /(diễn đàn|chuyên mục|danh mục)/i,
    // ID/MY
    /(forum|kategori|subforum)/i,
    // UK (Ukrainian)
    /(форум|розділ|категорія|підфорум)/i,
    // BG (Bulgarian)
    /(форум|раздел|категория|подфорум)/i,
    // SR/HR/BS (Serbian/Croatian/Bosnian)
    /(форум|forum|kategorija|sekcija|podforum)/i,
    // SL (Slovenian)
    /(forum|kategorija|razdelek|podforum)/i,
    // LT (Lithuanian)
    /(forumas|kategorija|skyrius|poforumas)/i,
    // LV (Latvian)
    /(forums|kategorija|sadaļa|apakšforums)/i,
    // ET (Estonian)
    /(foorum|kategooria|alamfoorum)/i,
    // KA (Georgian)
    /(ფორუმი|კატეგორია|განყოფილება)/i,
    // HY (Armenian)
    /( delays| delays|fordshire)/i,
    // AZ (Azerbaijani)
    /(forum|kateqoriya|bölmə|alt forum)/i,
    // KK (Kazakh)
    /(форум|санат|бөлім)/i,
    // UZ (Uzbek)
    /(forum|turkum|bo'lim)/i,
    // TG (Tajik)
    /(форум|категория|бахш)/i,
    // FA (Persian/Farsi)
    /(انجمن|دسته‌بندی|بخش|زیرانجمن)/i,
    // UR (Urdu)
    /(فورم|زمرہ|سیکشن)/i,
    // HI (Hindi)
    /(फोरम|श्रेणी|अनुभाग|मंच)/i,
    // BN (Bengali)
    /(ফোরাম|বিভাগ|শ্রেণী)/i,
    // TA (Tamil)
    /(மன்றம்|பிரிவு|வகை)/i,
    // TE (Telugu)
    /(ఫోరమ్|విభాగం|వర్గం)/i,
    // ML (Malayalam)
    /(ഫോറം|വിഭാഗം|വിഭജനം)/i,
    // KN (Kannada)
    /(ಫೋರಮ್|ವಿಭಾಗ|ವರ್ಗ)/i,
    // MR (Marathi)
    /(मंच|विभाग|श्रेणी)/i,
    // GU (Gujarati)
    /(ફોરમ|વિભાગ|શ્રેણી)/i,
    // PA (Punjabi)
    /(ਫੋਰਮ|ਸ਼੍ਰੇਣੀ|ਵਿਭਾਗ)/i,
    // NE (Nepali)
    /(फोरम|श्रेणी|खण्ड)/i,
    // SI (Sinhala)
    /(සංසදය|ප්‍රවර්ගය|කොටස)/i,
    // MS (Malay)
    /(forum|kategori|bahagian)/i,
    // TL/FIL (Filipino/Tagalog)
    /(forum|kategorya|seksyon)/i,
    // SW (Swahili)
    /(jukwaa|jamii|sehemu)/i,
    // AF (Afrikaans)
    /(forum|kategorie|afdeling)/i,
    // MT (Maltese)
    /(forum|kategorija|sezzjoni)/i,
    // CY (Welsh)
    /(fforwm|categori|adran)/i,
    // GA (Irish)
    /(fóram|catagóir|rannóg)/i,
    // EU (Basque)
    /(foroa|kategoria|atala)/i,
    // CA (Catalan)
    /(fòrum|categoria|secció)/i,
    // GL (Galician)
    /(foro|categoría|sección)/i,
    // IS (Icelandic)
    /(spjallborð|flokkur|hluti)/i,
    // MK (Macedonian)
    /(форум|категорија|дел)/i,
    // SQ (Albanian)
    /(forum|kategori|seksion)/i,
    // BS (Bosnian)
    /(forum|kategorija|odjeljak)/i,
    // MN (Mongolian)
    /(форум|ангилал|хэсэг)/i,
    // KM (Khmer)
    /(វេទិកា|ប្រភេទ|ផ្នែក)/i,
    // LO (Lao)
    /(ກະດານສົນທະນາ|ໝວດ|ພາກ)/i,
    // MY (Burmese)
    /(ဖိုရမ်|အမျိုးအစား|အပိုင်း)/i,
    // AM (Amharic)
    /(ፎረም|ምድብ|ክፍል)/i,
  ]
  const hasCategories = categoryPatterns.some((p) => p.test(html))

  // Check for topics/threads (multilingual)
  const topicPatterns = [
    /thread[-_]?title/i,
    /topic[-_]?title/i,
    /class="[^"]*thread[^"]*"/i,
    /class="[^"]*topic[^"]*"/i,
    /threadlist/i,
    /topiclist/i,
    /data-type="thread"/i,
    /class="[^"]*subject[^"]*"/i,
    /viewtopic/i,
    /showtopic/i,
    /showthread/i,
    // RU
    /(тема|темы|топик)/i,
    // DE
    /(thema|themen|beitrag)/i,
    // FR
    /(sujet|sujets|discussion|fil)/i,
    // ES
    /(tema|temas|hilo|hilos)/i,
    // IT
    /(discussione|argomento|topic)/i,
    // PL
    /(temat|tematy|wątek|wątki)/i,
    // PT
    /(tópico|assunto|discussão)/i,
    // NL
    /(onderwerp|discussie|draad)/i,
    // TR
    /(konu|konular|başlık)/i,
    // CZ/SK
    /(téma|témata|vlákno)/i,
    // RO
    /(subiect|discuție|topic)/i,
    // HU
    /(téma|témák|szál)/i,
    // SE/NO/DK
    /(ämne|tråd|emne)/i,
    // FI
    /(aihe|ketju|keskustelu)/i,
    // GR
    /(θέμα|συζήτηση|νήμα)/i,
    // JP
    /(トピック|スレッド|話題)/i,
    // CN
    /(主题|帖子|话题)/i,
    // KR
    /(주제|토픽|글타래)/i,
    // AR
    /(موضوع|مواضيع|نقاش)/i,
    // HE
    /(נושא|דיון|אשכול)/i,
    // TH
    /(กระทู้|หัวข้อ)/i,
    // VI
    /(chủ đề|bài viết)/i,
    // UK (Ukrainian)
    /(тема|теми|топік)/i,
    // BG (Bulgarian)
    /(тема|теми|топик)/i,
    // SR/HR/BS
    /(tema|teme|tema|нит)/i,
    // SL (Slovenian)
    /(tema|teme|nit)/i,
    // LT (Lithuanian)
    /(tema|temos|gija)/i,
    // LV (Latvian)
    /(tēma|tēmas|pavediens)/i,
    // ET (Estonian)
    /(teema|teemad|lõim)/i,
    // KA (Georgian)
    /(თემა|თემები)/i,
    // AZ (Azerbaijani)
    /(mövzu|mövzular|başlıq)/i,
    // KK (Kazakh)
    /(тақырып|тақырыптар)/i,
    // UZ (Uzbek)
    /(mavzu|mavzular)/i,
    // FA (Persian)
    /(موضوع|مباحث|تاپیک)/i,
    // UR (Urdu)
    /(موضوع|عنوان)/i,
    // HI (Hindi)
    /(विषय|थ्रेड|चर्चा)/i,
    // BN (Bengali)
    /(বিষয়|থ্রেড|আলোচনা)/i,
    // TA (Tamil)
    /(தலைப்பு|கருத்துக்கள்)/i,
    // TE (Telugu)
    /(అంశం|థ్రెడ్)/i,
    // ML (Malayalam)
    /(വിഷയം|ത്രെഡ്)/i,
    // KN (Kannada)
    /(ವಿಷಯ|ಥ್ರೆಡ್)/i,
    // MR (Marathi)
    /(विषय|चर्चा)/i,
    // MS (Malay)
    /(topik|tajuk|perbincangan)/i,
    // TL/FIL (Filipino)
    /(paksa|talakayan)/i,
    // SW (Swahili)
    /(mada|mazungumzo)/i,
    // AF (Afrikaans)
    /(onderwerp|bespreking)/i,
    // EU (Basque)
    /(gaia|eztabaida)/i,
    // CA (Catalan)
    /(tema|fil|discussió)/i,
    // GL (Galician)
    /(tema|fío|discusión)/i,
    // IS (Icelandic)
    /(umræðuefni|þráður)/i,
    // MK (Macedonian)
    /(тема|теми|дискусија)/i,
    // SQ (Albanian)
    /(temë|diskutim)/i,
    // MN (Mongolian)
    /(сэдэв|хэлэлцүүлэг)/i,
    // KM (Khmer)
    /(ប្រធានបទ|ការពិភាក្សា)/i,
    // LO (Lao)
    /(ຫົວຂໍ້|ການສົນທະນາ)/i,
    // MY (Burmese)
    /(ခေါင်းစ��်|ဆွေးနွေးမှု)/i,
    // AM (Amharic)
    /(ርዕስ|ውይይት)/i,
  ]
  const hasTopics = topicPatterns.some((p) => p.test(html))

  // Check for posts/messages (multilingual)
  const postPatterns = [
    /class="[^"]*post[^"]*"/i,
    /class="[^"]*message[^"]*"/i,
    /post[-_]?content/i,
    /message[-_]?body/i,
    /postbody/i,
    /messagelist/i,
    /class="[^"]*reply[^"]*"/i,
    /data-post/i,
    // RU
    /(сообщени|пост|ответ)/i,
    // DE
    /(nachricht|beitrag|antwort)/i,
    // FR
    /(message|réponse|publication)/i,
    // ES
    /(mensaje|respuesta|publicación)/i,
    // IT
    /(messaggio|risposta|post)/i,
    // PL
    /(wiadomość|post|odpowiedź)/i,
    // PT
    /(mensagem|resposta|postagem)/i,
    // NL
    /(bericht|antwoord|reactie)/i,
    // TR
    /(mesaj|yanıt|gönderi)/i,
    // CZ/SK
    /(zpráva|příspěvek|odpověď)/i,
    // RO
    /(mesaj|răspuns|postare)/i,
    // HU
    /(üzenet|hozzászólás|válasz)/i,
    // SE/NO/DK
    /(inlägg|svar|meddelande)/i,
    // FI
    /(viesti|vastaus)/i,
    // GR
    /(μήνυμα|απάντηση|δημοσίευση)/i,
    // JP
    /(投稿|返信|メッセージ)/i,
    // CN
    /(回复|发帖|留言)/i,
    // KR
    /(게시물|답글|메시지)/i,
    // AR
    /(رسالة|رد|مشاركة)/i,
    // HE
    /(הודעה|תגובה|פוסט)/i,
    // TH
    /(โพสต์|ข้อความ|ตอบกลับ)/i,
    // VI
    /(bài đăng|tin nhắn|trả lời)/i,
    // UK (Ukrainian)
    /(повідомлення|пост|відповідь)/i,
    // BG (Bulgarian)
    /(съобщение|пост|отговор)/i,
    // SR/HR/BS
    /(poruka|objava|odgovor|одговор)/i,
    // SL (Slovenian)
    /(sporočilo|objava|odgovor)/i,
    // LT (Lithuanian)
    /(žinutė|pranešimas|atsakymas)/i,
    // LV (Latvian)
    /(ziņojums|ieraksts|atbilde)/i,
    // ET (Estonian)
    /(sõnum|postitus|vastus)/i,
    // KA (Georgian)
    /(შეტყობინება|პოსტი|პასუხი)/i,
    // AZ (Azerbaijani)
    /(mesaj|yazı|cavab)/i,
    // KK (Kazakh)
    /(хабарлама|жазба|жауап)/i,
    // UZ (Uzbek)
    /(xabar|post|javob)/i,
    // FA (Persian)
    /(پیام|پست|پاسخ)/i,
    // UR (Urdu)
    /(پیغام|پوسٹ|جواب)/i,
    // HI (Hindi)
    /(संदेश|पोस्ट|जवाब|उत्तर)/i,
    // BN (Bengali)
    /(বার্তা|পোস্ট|উত্তর)/i,
    // TA (Tamil)
    /(செய்தி|பதிவு|பதில்)/i,
    // TE (Telugu)
    /(సందేశం|పోస్ట్|సమాధానం)/i,
    // ML (Malayalam)
    /(സന്ദേശം|പോസ്റ്റ്|മറുപടി)/i,
    // KN (Kannada)
    /(ಸಂದೇಶ|ಪೋಸ್ಟ್|ಉತ್ತರ)/i,
    // MR (Marathi)
    /(संदेश|पोस्ट|उत्तर)/i,
    // MS (Malay)
    /(mesej|pos|balas)/i,
    // TL/FIL (Filipino)
    /(mensahe|post|sagot)/i,
    // SW (Swahili)
    /(ujumbe|chapisho|jibu)/i,
    // AF (Afrikaans)
    /(boodskap|pos|antwoord)/i,
    // EU (Basque)
    /(mezua|argitalpena|erantzuna)/i,
    // CA (Catalan)
    /(missatge|publicació|resposta)/i,
    // GL (Galician)
    /(mensaxe|publicación|resposta)/i,
    // IS (Icelandic)
    /(skilaboð|færsla|svar)/i,
    // MK (Macedonian)
    /(порака|објава|одговор)/i,
    // SQ (Albanian)
    /(mesazh|postim|përgjigje)/i,
    // MN (Mongolian)
    /(мессеж|бичлэг|хариулт)/i,
    // KM (Khmer)
    /(សារ|ការប្រកាស|ចម្លើយ)/i,
    // LO (Lao)
    /(ຂໍ້ຄວາມ|ໂພສ|ຄຳຕອບ)/i,
    // MY (Burmese)
    /(မက်ဆေ့ချ်|ပို့စ်|အဖြေ)/i,
    // AM (Amharic)
    /(መልእክት|ልጥፍ|መልስ)/i,
  ]
  const hasPosts = postPatterns.some((p) => p.test(html))

  // Check for pagination
  const paginationPatterns = [
    /class="[^"]*pagination[^"]*"/i,
    /class="[^"]*pager[^"]*"/i,
    /class="[^"]*page[-_]?nav/i,
    /page=[0-9]/i,
    /start=[0-9]/i,
    /pagenum/i,
    /<a[^>]*>\s*[0-9]+\s*<\/a>\s*<a[^>]*>\s*[0-9]+\s*<\/a>/i,
    /»|«|›|‹|&raquo;|&laquo;/,
    /next.*page|prev.*page/i,
  ]
  const hasPagination = paginationPatterns.some((p) => p.test(html))

  // Check for dates (multilingual)
  const datePatterns = [
    /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/,
    /\d{4}[./-]\d{1,2}[./-]\d{1,2}/,
    // EN months
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i,
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    // RU months
    /(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i,
    // DE months
    /(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)/i,
    // FR months
    /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i,
    // ES months
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
    // IT months
    /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i,
    // PL months
    /(styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień)/i,
    // PT months
    /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i,
    // NL months
    /(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/i,
    // TR months
    /(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/i,
    // Today/Yesterday multilingual (extended)
    /today|yesterday|сегодня|вчера|heute|gestern|aujourd'hui|hier|hoy|ayer|oggi|ieri|dzisiaj|wczoraj|hoje|ontem|vandaag|gisteren|bugün|dün|idag|igår|tänään|eilen|σήμερα|χθες|今日|昨日|今天|昨天|오늘|어제|сьогодні|вчора|днес|вчера|danes|včeraj|šodien|vakar|täna|eile|dnes|včera|ma|tegnap|bu gün|dünən|бүгін|кеше|bugun|kecha|امروز|دیروز|آج|کل|आज|कल|আজ|গতকাল|இன்று|நேற்று|ఈరోజు|నిన్న|ഇന്ന്|ഇന്നലെ|ಇಂದು|ನಿನ್ನೆ|hari ini|semalam|ngayon|kahapon|leo|jana|vandag|gister|gaur|atzo|avui|ahir|hoxe|onte|í dag|í gær|денес|вчера|sot|dje|өнөөдөр|өчигдөр|ថ្ងៃនេះ|ម្សិលមិញ|ມື້ນີ້|ມື້ວານນີ້|ယနေ့|မနေ့|ዛሬ|ትናንት/i,
    // Time ago patterns (extended)
    /\d+\s*(minute|hour|day|week|month|year|год|мин��т|час|дн|недел|месяц|stunde|tag|woche|monat|jahr|heure|jour|semaine|mois|an|hora|día|semana|mes|año|ora|giorno|settimana|mese|anno|minuta|godzin|dzień|tydzień|miesiąc|rok|valanda|diena|savaitė|mėnuo|metai|stunda|diena|nedēļa|mēnesis|gads|tund|päev|nädal|kuu|aasta|hodina|den|týden|měsíc|rok|perc|óra|nap|hét|hónap|év|saat|gün|hafta|ay|yıl|сағат|күн|апта|ай|жыл|soat|kun|hafta|oy|yil|ساعت|روز|هفته|ماه|سال|گھنٹہ|دن|ہفتہ|مہینہ|سال|मिनट|घंटा|दिन|सप्ताह|महीना|साल|মিনিট|ঘন্টা|দিন|সপ্তাহ|মাস|বছর|நிமிடம்|மணி|நாள்|வாரம்|மாதம்|வருடம்)s?\s*(ago|назад|vor|il y a|hace|fa|temu|atrás|geleden|önce|sedan|sitten|πριν|前|전|тому|преди|nazaj|atpakaļ|tagasi|zpět|ezelőtt|əvvəl|бұрын|oldin|پیش|قبل|पहले|আগে|முன்|క్రితం|മുമ്പ്|ಹಿಂದೆ|lalu|nakalipas|iliyopita|gelede|duela|enrere|atrás|síðan|пред|më parë|өмнө|មុន|ກ່ອນ|အရင်|በፊት)/i,
    /class="[^"]*date[^"]*"/i,
    /class="[^"]*time[^"]*"/i,
    /datetime="/i,
  ]
  const hasLastDates = datePatterns.some((p) => p.test(html))

  // Extract dates from "Last post" / "Последнее сообщение" sections
  let lastDateFound: string | undefined
  let latestYear: number | undefined
  let isDateFresh = false
  
  const currentYear = new Date().getFullYear()
  
  // ── LANGUAGE-AGNOSTIC approach ──
  // Instead of maintaining 52+ language-specific "last post" translations,
  // we use structural/CSS clues and date+time co-occurrence to find post dates.
  
  // Strategy 1: CSS class-based — look for year inside elements whose class
  // contains "last", "latest", "recent", or common forum engine class names
  const cssLastPostPatterns = [
    /class="[^"]*(?:last[-_]?post|lastpost|latest|recent|newest)[^"]*"[^>]*>[\s\S]{0,500}?(202[0-9])/gi,
    // phpBB, vBulletin, XenForo, IPB, SMF common patterns
    /class="[^"]*(?:lastsubject|last_post|latestThreadTitle|ipsDataItem_lastPoster|smalltext)[^"]*"[\s\S]{0,500}?(202[0-9])/gi,
  ]
  
  // Strategy 2: Table-row co-occurrence — a year 202X appearing near a time
  // pattern (HH:MM) within the same table row or small HTML block is very
  // likely a post timestamp, not a page header or copyright.
  // Match: "202X" within 200 chars of "HH:MM" inside a <tr> or short block
  const dateTimeCoPattern = /<tr[\s\S]{0,2000}?<\/tr>/gi
  
  // Strategy 3: Multilingual "last post" header keywords (kept as a bonus,
  // but now much shorter — just the most common languages)
  const lastPostKeywordPatterns = [
    /last\s*(?:post|message|reply|activity)[^<]{0,200}(202[0-9])/gi,
    /latest\s*(?:post|message|reply)[^<]{0,200}(202[0-9])/gi,
    /последн[а-яё]*\s*(?:сообщени|пост|ответ|активност|комментари)[^<]{0,200}(202[0-9])/gi,
    /letzt(?:er|e|es)?\s*(?:beitrag|nachricht)[^<]{0,200}(202[0-9])/gi,
    /dernier\s*(?:message|post)[^<]{0,200}(202[0-9])/gi,
    /últim[oa]?\s*(?:mensaje|post|mensagem)[^<]{0,200}(202[0-9])/gi,
  ]
  
  let postYears: number[] = []
  
  // Run Strategy 1: CSS-based
  for (const pattern of cssLastPostPatterns) {
    for (const match of html.matchAll(pattern)) {
      const y = match[0].match(/(202[0-9])/)
      if (y) postYears.push(parseInt(y[1], 10))
    }
  }
  
  // Run Strategy 2: Table rows containing both a year and a time (HH:MM)
  for (const rowMatch of html.matchAll(dateTimeCoPattern)) {
    const row = rowMatch[0]
    const yearInRow = row.match(/\b(202[0-9])\b/)
    const timeInRow = row.match(/\d{1,2}:\d{2}/)
    if (yearInRow && timeInRow) {
      postYears.push(parseInt(yearInRow[1], 10))
    }
  }
  
  // Run Strategy 3: Keyword-based (covers common languages)
  for (const pattern of lastPostKeywordPatterns) {
    for (const match of html.matchAll(pattern)) {
      const y = match[0].match(/(202[0-9])/)
      if (y) postYears.push(parseInt(y[1], 10))
    }
  }
  
  // Deduplicate and determine freshness
  if (postYears.length > 0) {
    latestYear = Math.max(...postYears)
    isDateFresh = latestYear >= currentYear
  } else {
    // Last resort: look for years anywhere — display only, NOT used for freshness.
    const yearMatches = html.match(/\b(202[0-9])\b/g)
    if (yearMatches) {
      const years = yearMatches.map(y => parseInt(y, 10))
      latestYear = Math.max(...years)
      // isDateFresh stays false
    }
  }
  
  // Check for "today/yesterday/X ago" inside last-post CSS containers
  const recentInContainer = /class="[^"]*(?:last[-_]?post|lastpost|latest|recent)[^"]*"[^>]*>[\s\S]{0,500}?(today|yesterday|сегодня|вчера|heute|gestern|aujourd'hui|hier|hoy|ayer|oggi|ieri|\d+\s*(?:minute|hour|min|час|минут)s?\s*(?:ago|назад|vor|il y a|hace|fa|temu))/i
  if (!isDateFresh && recentInContainer.test(html)) {
    isDateFresh = true
    if (!latestYear) latestYear = currentYear
  }
  
  // Extract a sample date for display
  const lastPostDateMatch = html.match(
    /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})/
  )
  if (lastPostDateMatch) {
    lastDateFound = lastPostDateMatch[1] || lastPostDateMatch[0]
  }

  // Check for authors/usernames (multilingual)
  const authorPatterns = [
    /class="[^"]*author[^"]*"/i,
    /class="[^"]*username[^"]*"/i,
    /class="[^"]*user[-_]?name[^"]*"/i,
    /class="[^"]*member[^"]*"/i,
    /class="[^"]*poster[^"]*"/i,
    /by\s*<a[^>]*>/i,
    /profile\.php\?/i,
    /member\.php\?/i,
    /users?\//i,
    /memberlist/i,
    // Multilingual "posted by" / "author" (extended)
    /posted\s*by|автор|autor|auteur|verfasser|geplaatst\s*door|yazar|postado\s*por|publicado\s*por|inviato\s*da|dodał|napisał|skrevet\s*af|skrivet\s*av|kirjoittanut|συγγραφέας|作者|投稿者|작성자|الكاتب|מחבר|ผู้เขียน|tác giả|аўтар|автор|avtor|autors|autor|szerző|müəllif|автор|muallif|نویسنده|مصنف|लेखक|লেখক|ஆசிரியர்|రచయిత|രചയിതാവ്|ಲೇಖಕ|pengarang|may-akda|mwandishi|outeur|egilea|autor|höfundur|автор|autor|зохиогч|អ្នកនិពន្ធ|ຜູ້ຂຽນ|စာရေးသူ|ደራሲ/i,
    // Multilingual "member" / "user" (extended)
    /member|участник|пользовател|mitglied|benutzer|membre|utilisateur|miembro|usuario|membro|utente|członek|użytkownik|lid|gebruiker|üye|kullanıcı|membro|usuário|člen|uživatel|tag|felhasználó|medlem|användare|jäsen|käyttäjä|μέλος|χρήστης|会员|用户|メンバー|ユーザー|회원|사용자|عضو|مستخدم|חבר|משתמש|สมาชิก|ผู้ใช้|thành viên|người dùng|удзельнік|карыстальнік|член|потребител|član|uporabnik|narys|vartotojas|biedrs|lietotājs|liige|kasutaja|člen|používateľ|üzv|istifadəçi|мүше|қолданушы|a'zo|foydalanuvchi|عضو|کاربر|رکن|صارف|सदस्य|उपयोगकर्ता|সদস্য|ব্যবহারকারী|உறுப்பினர்|பயனர்|సభ్యుడు|వినియోగదారు|അംഗം|ഉപയോക്താവ്|ಸದಸ್ಯ|ಬಳಕೆದಾರ|ahli|pengguna|miyembro|gumagamit|mwanachama|mtumiaji|lid|gebruiker|kide|erabiltzaile|membre|usuari|membro|usuario|meðlimur|notandi|член|корисник|anëtar|përdorues|гишүүн|хэрэглэгч|សមាជិក|អ្នកប្រើប្រាស់|ສະມາຊິກ|ຜູ້ໃຊ້|အဖွဲ့ဝင်|အသုံးပြုသူ|አባል|ተጠቃሚ/i,
  ]
  const hasAuthors = authorPatterns.some((p) => p.test(html))

  // Check for counters (multilingual)
  const countersFound: string[] = []
  const counterChecks = [
    { pattern: /(thread|тем|topic|thema|themen|sujet|tema|wątek|tópico|onderwerp|konu|téma|ämne|tråd|aihe|θέμα|主题|トピック|주제|موضوع|נושא|กระทู้|chủ đề|тэма|тема|nit|tēma|teema|téma|mövzu|тақырып|mavzu|موضوع|विषय|বিষয়|தலைப்பு|అంశం|വിഷയം|ವಿಷಯ|topik|paksa|mada|onderwerp|gaia|tema|umræðuefni|тема|temë|сэдэв|ប្រធានបទ|ຫົວຂໍ້|ခေါင်းစဉ်|ርዕስ)s?\s*[:\-]?\s*[\d,.']+/i, name: "Threads" },
    { pattern: /(post|сообщени|message|beitrag|nachricht|mensaje|messaggio|wiadomość|mensagem|bericht|mesaj|üzenet|inlägg|viesti|μήνυμα|帖子|投稿|게시물|مشاركة|הודעה|โพสต์|bài đăng|паведамленне|съобщение|sporočilo|ziņojums|sõnum|zpráva|příspěvek|mesaj|хабарлама|xabar|پیام|پیغام|संदेश|বার্তা|செய்தி|సందేశం|സന്ദേശം|ಸಂದೇಶ|mesej|mensahe|ujumbe|boodskap|mezua|missatge|skilaboð|порака|mesazh|мессеж|សារ|ຂໍ້ຄວາມ|မက်ဆေ့ချ်|መልእክት)s?\s*[:\-]?\s*[\d,.']+/i, name: "Posts" },
    { pattern: /(member|участник|пользовател|user|mitglied|benutzer|membre|utilisateur|miembro|usuario|membro|utente|członek|lid|gebruiker|üye|tag|medlem|jäsen|μέλος|会员|メンバー|회원|عضو|חבר|สมาชิก|thành viên|удзельнік|член|član|biedrs|liige|člen|üzv|мүше|a'zo|عضو|सदस्य|সদস্য|உறுப்பினர்|సభ్యుడు|അംഗം|ಸದಸ್ಯ|ahli|miyembro|mwanachama|lid|kide|membre|meðlimur|член|anëtar|гишүүн|សមាជិក|ສ��ມາຊິກ|အဖွဲ့ဝင်|አባል)s?\s*[:\-]?\s*[\d,.']+/i, name: "Members" },
    { pattern: /(view|просмотр|hit|ansicht|vue|vista|visualizzazione|wyświetleń|visualização|weergave|görüntüleme|megtekintés|visning|näyttökerta|προβολή|浏览|閲覧|조회|مشاهدة|צפייה|ดู|lượt xem|прагляд|преглед|ogled|skatījums|vaatamine|zobrazení|baxış|көру|ko'rish|بازدید|دیکھیں|देखें|দেখা|பார்வை|చూపు|കാഴ്ച|ವೀಕ್ಷಣೆ|lihat|tanawin|maoni|kyky|ikusi|visualització|skoðun|прегледи|shikime|үзэлт|ការមើល|ການເບິ່ງ|ကြည့်ရှု|እይታ)s?\s*[:\-]?\s*[\d,.']+/i, name: "Views" },
    { pattern: /(repl|ответ|antwort|réponse|respuesta|risposta|odpowiedź|resposta|antwoord|yanıt|válasz|svar|vastaus|απάντηση|回复|返信|답글|رد|תגובה|ตอบ|trả lời|адказ|отговор|odgovor|atbilde|vastus|odpověď|cavab|жауап|javob|پاسخ|جواب|उत्तर|উত্তর|பதில்|సమాధానం|മറുപടി|ಉತ್ತರ|balas|sagot|jibu|antwoord|erantzun|resposta|svar|одговор|përgjigje|хариулт|ចម្លើយ|ຄຳຕອບ|အဖြေ|መልስ)i?e?s?\s*[:\-]?\s*[\d,.']+/i, name: "Replies" },
  ]

  for (const check of counterChecks) {
    if (check.pattern.test(html)) {
      countersFound.push(check.name)
    }
  }

  const hasCounters = countersFound.length > 0

  return {
    hasCategories,
    hasTopics,
    hasPosts,
    hasPagination,
    hasLastDates,
    hasAuthors,
    hasCounters,
    countersFound,
    lastDateFound,
    isDateFresh,
    latestYear,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
      },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}` },
        { status: 400 }
      )
    }

    const html = await response.text()
    const result = analyzeHtml(html)

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
