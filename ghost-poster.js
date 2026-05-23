const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sampleKeywords = ["shanghai skyline", "shanghai street food", "china cyberpunk city", "shanghai traditional garden"];
const randomKeyword = sampleKeywords[Math.floor(Math.random() * sampleKeywords.length)];

// Систем өөрөө форматыг санамсаргүйгээр сонгоно: SINGLE (1 зураг), CAROUSEL (3 зураг), VIDEO (Рээлс бичлэг)
const formats = ["SINGLE", "CAROUSEL", "VIDEO"];
const chosenFormat = formats[Math.floor(Math.random() * formats.length)];

// 1. Pexels-ээс зураг хайх
async function fetchPexelsImages(keyword, count = 1) {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=${count}`, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            return data.photos.map(p => p.src.large);
        }
        return ["https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg"];
    } catch (e) {
        return ["https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg"];
    }
}

// 2. Pexels-ээс видео хайх
async function fetchPexelsVideo(keyword) {
    try {
        const response = await fetch(`https://api.api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=1`, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        const data = await response.json();
        if (data.videos && data.videos.length > 0) {
            return data.videos[0].video_files[0].link; // Видеоны шууд линк
        }
        return null;
    } catch (e) {
        return null;
    }
}

// 3. Телеграм руу Медиаг нь шидэх
async function sendMedia(format, mediaUrls, videoUrl) {
    let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/`;
    let body = { chat_id: TELEGRAM_CHAT_ID };

    if (format === "SINGLE") {
        url += "sendPhoto";
        body.photo = mediaUrls[0];
    } else if (format === "VIDEO" && videoUrl) {
        url += "sendVideo";
        body.video = videoUrl;
    } else {
        // CAROUSEL буюу олон зураг илгээх бүтэц
        url += "sendMediaGroup";
        body.media = mediaUrls.map(link => ({ type: "photo", media: link }));
    }

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (error) {
        console.error("Медиа илгээхэд алдаа гарлаа:", error);
    }
}

// 4. Доороос нь постын текст болон шийдвэрлэх товчлуурыг залгаж илгээх
async function sendDraftText(format, keyword) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const postText = `*🤖 JARVIS GHOST MARKETER [DRAFT]*\n\n` +
                     `📊 *Контентын формат:* \`${format}\`\n` +
                     `🔍 *Хайсан трэнд сэдэв:* \`${keyword}\`\n\n` +
                     `📝 *Постны текст:* "Амьдралдаа заавал үзэх ёстой Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️"\n\n` +
                     `👇 Доорх товчлуураар сошиал руу нийтлэх эсэхийг шийднэ үү.`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ Постлох", callback_data: "approve_post" },
                { text: "❌ Алгасах", callback_data: "reject_post" }
            ]
        ]
    };

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: postText,
                parse_mode: "Markdown",
                reply_markup: keyboard
            })
        });
        console.log("Драфт текстийг товчлууртай нь амжилттай явууллаа!");
    } catch (e) {
        console.error("Текст илгээхэд алдаа гарлаа:", e);
    }
}

async function start() {
    console.log(`🚀 Мотор ажиллаж байна. Сонгосон формат: ${chosenFormat}`);
    
    let mediaUrls = [];
    let videoUrl = null;

    if (chosenFormat === "CAROUSEL") {
        mediaUrls = await fetchPexelsImages(randomKeyword, 3); // 3 зураг татна
    } else if (chosenFormat === "VIDEO") {
        videoUrl = await fetchPexelsVideo(randomKeyword);
        if (!videoUrl) mediaUrls = await fetchPexelsImages(randomKeyword, 1); // Видео олдохгүй бол зураг руу шилжинэ
    } else {
        mediaUrls = await fetchPexelsImages(randomKeyword, 1); // 1 зураг татна
    }

    // Телеграм руу медиа болон текстийг дарааллаар нь шидэх
    await sendMedia(chosenFormat, mediaUrls, videoUrl);
    await sendDraftText(chosenFormat, randomKeyword);
}

start();
