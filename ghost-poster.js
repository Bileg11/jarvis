const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sampleKeywords = ["shanghai skyline", "shanghai street food", "china cyberpunk city", "shanghai traditional garden"];
const randomKeyword = sampleKeywords[Math.floor(Math.random() * sampleKeywords.length)];

const formats = ["SINGLE", "CAROUSEL", "VIDEO"];
const chosenFormat = formats[Math.floor(Math.random() * formats.length)];

async function fetchPexelsImages(keyword, count = 1) {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=count`, {
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

async function fetchPexelsVideo(keyword) {
    try {
        const response = await fetch(`https://api.api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=1`, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        const data = await response.json();
        if (data.videos && data.videos.length > 0) {
            return data.videos[0].video_files[0].link;
        }
        return null;
    } catch (e) {
        return null;
    }
}

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
        console.error("Error sending media:", error);
    }
}

async function sendDraftText(format, keyword) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const postText = `*🤖 JARVIS GHOST MARKETER [DRAFT]*\n\n` +
                     `📊 *Контентын формат:* \`${format}\`\n` +
                     `🔍 *Хайсан трэнд сэдэв:* \`${keyword}\`\n\n` +
                     `📝 *Постны текст:* "Амьдралдаа заавал үзэх ёстой Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️"\n\n` +
                     `👇 Доорх товчлууруудаар сошиал руу нийтлэх эсэхийг шийднэ үү.`;

    // Энд 4 товчлуурыг бүгдийг нь гоёор өрж тавилаа
    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ Постлох", callback_data: "approve_post" },
                { text: "❌ Алгасах", callback_data: "reject_post" }
            ],
            [
                { text: "🔄 Зураг солих", callback_data: "change_image" },
                { text: "✍️ Текст солих", callback_data: "change_text" }
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
        console.log("Draft text sent!");
    } catch (e) {
        console.error("Error sending text:", e);
    }
}

async function start() {
    let mediaUrls = [];
    let videoUrl = null;

    if (chosenFormat === "CAROUSEL") {
        mediaUrls = await fetchPexelsImages(randomKeyword, 3);
    } else if (chosenFormat === "VIDEO") {
        videoUrl = await fetchPexelsVideo(randomKeyword);
        if (!videoUrl) mediaUrls = await fetchPexelsImages(randomKeyword, 1);
    } else {
        mediaUrls = await fetchPexelsImages(randomKeyword, 1);
    }

    await sendMedia(chosenFormat, mediaUrls, videoUrl);
    await sendDraftText(chosenFormat, randomKeyword);
}

start();
