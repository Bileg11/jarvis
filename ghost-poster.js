const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ID;
const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN_META;

const sampleKeywords = ["shanghai skyline", "shanghai street food", "china cyberpunk city", "shanghai traditional garden"];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Инстаграм руу зураг постлох
async function postToInstagram(imageUrl, caption) {
    try {
        // 1. Container үүсгэх
        const containerRes = await fetch(`https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${ACCESS_TOKEN}`, { method: 'POST' });
        const containerData = await containerRes.json();
        
        if (!containerData.id) throw new Error("Container үүсгэхэд алдаа гарлаа: " + JSON.stringify(containerData));

        // 2. Publish хийх
        const publishRes = await fetch(`https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media_publish?creation_id=${containerData.id}&access_token=${ACCESS_TOKEN}`, { method: 'POST' });
        return await publishRes.json();
    } catch (e) {
        console.error("Instagram Error:", e);
        return null;
    }
}

// Pexels-ээс зураг татах
async function fetchPexelsImage(keyword) {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1`, { headers: { 'Authorization': PEXELS_API_KEY } });
        const data = await response.json();
        if (data.photos && data.photos.length > 0) return data.photos[0].src.large;
    } catch (e) {}
    return "https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg";
}

// Телеграм руу ноорог (Draft) илгээх
async function sendDraft(imageUrl, keyword) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const caption = `*🤖 JARVIS GHOST MARKETER*\n\n🔍 Сэдэв: \`${keyword}\`\n\nТекст: "Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️"`;
    const keyboard = { inline_keyboard: [[{ text: "✅ Постлох", callback_data: "approve" }, { text: "❌ Алгасах", callback_data: "reject" }]] };
    
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, photo: imageUrl, caption: caption, parse_mode: "Markdown", reply_markup: keyboard })
    });
    const data = await res.json();
    return data.result?.message_id;
}

// Үндсэн үйл явц
async function mainProcess() {
    const randomKeyword = sampleKeywords[Math.floor(Math.random() * sampleKeywords.length)];
    const imageUrl = await fetchPexelsImage(randomKeyword);
    const messageId = await sendDraft(imageUrl, randomKeyword);

    if (!messageId) return console.log("Телеграм мессеж илгээж чадсангүй!");

    console.log("Товчлуур хүлээж байна (2 минут)...");
    const startTime = Date.now();
    let offset = 0;

    while (Date.now() - startTime < 120000) {
        const pollRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=5`);
        const pollData = await pollRes.json();
        
        if (pollData.result) {
            for (const upd of pollData.result) {
                offset = upd.update_id + 1;
                if (upd.callback_query && upd.callback_query.message.message_id === messageId) {
                    const action = upd.callback_query.data;
                    
                    if (action === "approve") {
                        const res = await postToInstagram(imageUrl, "Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️");
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=✅ Амжилттай постлогдлоо!`);
                        console.log("Post Result:", res);
                    } else {
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=❌ Постыг цуцаллаа.`);
                    }
                    return;
                }
            }
        }
        await sleep(2000);
    }
}

mainProcess();
