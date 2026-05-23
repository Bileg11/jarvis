const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ID;
const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN_META;

// Дебаг хийх
console.log("Token check:", TELEGRAM_BOT_TOKEN ? "OK" : "MISSING");
console.log("ChatID check:", TELEGRAM_CHAT_ID ? "OK" : "MISSING");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function postToInstagram(imageUrl, caption) {
    try {
        const containerRes = await fetch(`https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${ACCESS_TOKEN}`, { method: 'POST' });
        const containerData = await containerRes.json();
        if (!containerData.id) return null;
        
        const publishRes = await fetch(`https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media_publish?creation_id=${containerData.id}&access_token=${ACCESS_TOKEN}`, { method: 'POST' });
        return await publishRes.json();
    } catch (e) { return null; }
}

async function sendDraft(imageUrl, keyword) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            chat_id: TELEGRAM_CHAT_ID, 
            photo: imageUrl, 
            caption: `*JARVIS GHOST MARKETER*\nСэдэв: ${keyword}`, 
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "✅ Постлох", callback_data: "approve" }]] }
        })
    });
    const data = await res.json();
    return data.result?.message_id;
}

async function mainProcess() {
    const keyword = "shanghai street food";
    const imageUrl = "https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg";
    const messageId = await sendDraft(imageUrl, keyword);

    if (!messageId) return;

    for (let i = 0; i < 30; i++) {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=-1`);
        const data = await res.json();
        if (data.result?.[0]?.callback_query?.data === "approve") {
            await postToInstagram(imageUrl, "Шанхай хот!");
            console.log("Амжилттай постлогдлоо!");
            return;
        }
        await sleep(4000);
    }
}
mainProcess();
