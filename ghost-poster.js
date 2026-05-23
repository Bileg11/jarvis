const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ID;
const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const PAGE_ID = process.env.PAGE_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const sampleKeywords = ["shanghai skyline", "shanghai street food", "china cyberpunk city", "shanghai traditional garden"];
const formats = ["SINGLE", "CAROUSEL", "VIDEO"];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Инстаграм руу постлох функц
async function postToInstagram(imageUrl, caption) {
    try {
        const containerUrl = `https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${ACCESS_TOKEN}`;
        const containerRes = await fetch(containerUrl, { method: 'POST' });
        const containerData = await containerRes.json();
        
        if (!containerData.id) throw new Error("Container үүсгэхэд алдаа гарлаа");

        const publishUrl = `https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media_publish?creation_id=${containerData.id}&access_token=${ACCESS_TOKEN}`;
        const publishRes = await fetch(publishUrl, { method: 'POST' });
        return await publishRes.json();
    } catch (e) {
        console.error("Instagram Error:", e);
        return null;
    }
}

// 1. Pexels-ээс зураг татах
async function fetchPexelsImages(keyword, count = 1) {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=${count}`, { headers: { 'Authorization': PEXELS_API_KEY } });
        const data = await response.json();
        if (data.photos && data.photos.length > 0) return data.photos.map(p => p.src.large);
    } catch (e) {}
    return ["https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg"];
}

// 2. Телеграм руу медиа илгээх
async function sendMedia(format, mediaUrls) {
    let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/`;
    let body = { chat_id: TELEGRAM_CHAT_ID };
    if (format === "SINGLE") {
        url += "sendPhoto"; body.photo = mediaUrls[0];
    } else {
        url += "sendMediaGroup"; body.media = mediaUrls.map(link => ({ type: "photo", media: link }));
    }
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await res.json();
}

// 3. Draft илгээх
async function sendDraftText(format, keyword) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const postText = `*🤖 JARVIS GHOST MARKETER*\n\nФормат: \`${format}\`\nСэдэв: \`${keyword}\`\n\nТекст: "Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️"`;
    const keyboard = { inline_keyboard: [[{ text: "✅ Постлох", callback_data: "approve" }, { text: "❌ Алгасах", callback_data: "reject" }]] };
    
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: postText, parse_mode: "Markdown", reply_markup: keyboard })
    });
    const data = await res.json();
    return data.result?.message_id;
}

// 4. ҮНДСЭН ПРОЦЕСС
async function mainProcess() {
    const randomKeyword = sampleKeywords[Math.floor(Math.random() * sampleKeywords.length)];
    const chosenFormat = "SINGLE"; // Одоогоор зөвхөн зураг постлох
    const mediaUrls = await fetchPexelsImages(randomKeyword, 1);

    await sendMedia(chosenFormat, mediaUrls);
    const textMessageId = await sendDraftText(chosenFormat, randomKeyword);

    // Телеграм дээрх товчлуурыг хүлээх
    let offset = 0;
    while (true) {
        const pollRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10`);
        const pollData = await pollRes.json();
        
        if (pollData.result) {
            for (const upd of pollData.result) {
                offset = upd.update_id + 1;
                if (upd.callback_query && upd.callback_query.message.message_id === textMessageId) {
                    const action = upd.callback_query.data;
                    
                    if (action === "approve") {
                        const res = await postToInstagram(mediaUrls[0], "Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️");
                        console.log("Post Result:", res);
                    }
                    return; // Процесс дуусах
                }
            }
        }
    }
}

mainProcess();
