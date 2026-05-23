const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sampleKeywords = ["shanghai skyline", "shanghai street food", "china cyberpunk city", "shanghai traditional garden"];
const formats = ["SINGLE", "CAROUSEL", "VIDEO"];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Pexels-ээс зураг татах
async function fetchPexelsImages(keyword, count = 1) {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=${count}`, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        const data = await response.json();
        if (data.photos && data.photos.length > 0) return data.photos.map(p => p.src.large);
    } catch (e) {}
    return ["https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg"];
}

// 2. Pexels-ээс видео татах (Алдаа гарвал найдвартай бэлэн видео линк рүү шилжинэ)
async function fetchPexelsVideo(keyword) {
    try {
        const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=1`, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        const data = await response.json();
        if (data.videos && data.videos.length > 0) return data.videos[0].video_files[0].link;
    } catch (e) {}
    return "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054ba2d1eebde1704ada16be97aaaf4&profile_id=165&oauth2_token_id=57447761";
}

// 3. Телеграм руу медиа илгээх
async function sendMedia(format, mediaUrls, videoUrl) {
    let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/`;
    let body = { chat_id: TELEGRAM_CHAT_ID };
    if (format === "SINGLE") {
        url += "sendPhoto"; body.photo = mediaUrls[0];
    } else if (format === "VIDEO") {
        url += "sendVideo"; body.video = videoUrl;
    } else {
        url += "sendMediaGroup"; body.media = mediaUrls.map(link => ({ type: "photo", media: link }));
    }
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await res.json();
}

// 4. Текст болон 4 ухаалаг товчлуурыг илгээх
async function sendDraftText(format, keyword) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const postText = `*🤖 JARVIS GHOST MARKETER [DRAFT]*\n\n` +
                     `📊 *Контентын формат:* \`${format}\`\n` +
                     `🔍 *Хайсан трэнд сэдэв:* \`${keyword}\`\n\n` +
                     `📝 *Постны текст:* "Амьдралдаа заавал үзэх ёстой Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️"\n\n` +
                     `👇 Доорх товчлууруудаар удирдоорой (Идэвхтэй хугацаа: 2 минут):`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "✅ Постлох", callback_data: "approve" }, { text: "❌ Алгасах", callback_data: "reject" }],
            [{ text: "🔄 Зураг солих", callback_data: "change_image" }, { text: "✍️ Текст солих", callback_data: "change_text" }]
        ]
    };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: postText, parse_mode: "Markdown", reply_markup: keyboard })
    });
    const data = await res.json();
    return data.result?.message_id;
}

// 5. ҮНДСЭН ПРОЦЕСС БОЛОН ТОВЧЛУУР ХҮЛЭЭХ ЛОГИК (POLLING)
async function mainProcess() {
    let offset = 0;
    try {
        const upRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=-1`);
        const upData = await upRes.json();
        if (upData.result && upData.result.length > 0) {
            offset = upData.result[upData.result.length - 1].update_id + 1;
        }
    } catch(e){}

    const randomKeyword = sampleKeywords[Math.floor(Math.random() * sampleKeywords.length)];
    const chosenFormat = formats[Math.floor(Math.random() * formats.length)];

    let mediaUrls = []; let videoUrl = null;
    if (chosenFormat === "CAROUSEL") mediaUrls = await fetchPexelsImages(randomKeyword, 3);
    else if (chosenFormat === "VIDEO") videoUrl = await fetchPexelsVideo(randomKeyword);
    else mediaUrls = await fetchPexelsImages(randomKeyword, 1);

    await sendMedia(chosenFormat, mediaUrls, videoUrl);
    const textMessageId = await sendDraftText(chosenFormat, randomKeyword);

    if (!textMessageId) return;

    console.log("🚀 Бот амьд байна. Чиний товчлуур даралтыг 2 минут хүлээнэ...");
    const startTime = Date.now();
    
    while (Date.now() - startTime < 120000) { 
        try {
            const pollRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=5`);
            const pollData = await pollRes.json();
            
            if (pollData.result && pollData.result.length > 0) {
                for (const upd of pollData.result) {
                    offset = upd.update_id + 1;
                    if (upd.callback_query && upd.callback_query.message.message_id === textMessageId) {
                        const callback = upd.callback_query;
                        const action = callback.data;
                        
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ callback_query_id: callback.id })
                        });

                        let updatedText = "";
                        if (action === "approve") {
                            updatedText = `*✅ АМЖИЛТТАЙ ПОСТЛОГДЛОО!*\n\n🚀 Контент амжилттай Инстаграм руу илгээгдлөө! (Маргааш хоёулаа Meta API холбохоор яг жинхэнэ Инстаграм руу чинь шууд ордог болно. Өнөөдөртөө систем маань амжилттай ажиллаж дууслаа!).`;
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, message_id: textMessageId, text: updatedText, parse_mode: "Markdown" })
                            });
                            return;
                        } else if (action === "reject") {
                            updatedText = `*❌ ПОСТЫГ АЛГАСЛАА.*\n\nСистем энэ удаагийн драфтыг устгаж, цуцаллаа.`;
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, message_id: textMessageId, text: updatedText, parse_mode: "Markdown" })
                            });
                            return;
                        } else if (action === "change_image" || action === "change_text") {
                            updatedText = `*🔄 ШИНЭ ХУВИЛБАР БЭЛДЭЖ БАЙНА...*\n\nТүр хүлээнэ үү, шинэ контентыг доороос дахин үүсгэж байна.`;
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, message_id: textMessageId, text: updatedText, parse_mode: "Markdown" })
                            });
                            setTimeout(mainProcess, 1000);
                            return;
                        }
                    }
                }
            }
        } catch (e) {}
        await sleep(2000);
    }
    
    // Хугацаа дуусах
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, message_id: textMessageId, text: `*⏰ ХУГАЦАА ДУУСЛАА*\n\n2 минутын дотор шийдвэр гаргаагүй тул робот унтлаа.`, parse_mode: "Markdown" })
    });
}

mainProcess();
