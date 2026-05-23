const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ID;
const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN_META;

const sampleKeywords = ["shanghai skyline", "shanghai street food", "china city"];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function postToInstagram(imageUrl, caption) {
    try {
        const containerRes = await fetch(`https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${ACCESS_TOKEN}`, { method: 'POST' });
        const containerData = await containerRes.json();
        if (!containerData.id) return null;
        await fetch(`https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media_publish?creation_id=${containerData.id}&access_token=${ACCESS_TOKEN}`, { method: 'POST' });
        return true;
    } catch (e) { return false; }
}

async function sendDraft(imageUrl, keyword) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const caption = `🤖 JARVIS GHOST MARKETER [DRAFT]\n\n📊 Контентын формат: SINGLE\n🔍 Хайсан трэнд сэдэв: ${keyword}\n\n📝 Постны текст: "Амьдралдаа заавал үзэх ёстой Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️"\n\n👇 Доорх товчлуураар сошиал руу нийтлэх эсэхийг шийднэ үү.`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            chat_id: TELEGRAM_CHAT_ID, 
            photo: imageUrl, 
            caption: caption,
            reply_markup: { inline_keyboard: [[{ text: "✅ Постлох", callback_data: "approve" }, { text: "❌ Алгасах", callback_data: "reject" }]] }
        })
    });
    const data = await res.json();
    return data.result?.message_id;
}

async function main() {
    const keyword = sampleKeywords[Math.floor(Math.random() * sampleKeywords.length)];
    const imageUrl = "https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg";
    const messageId = await sendDraft(imageUrl, keyword);

    if (!messageId) return;

    // 5 минут хүлээх (Polling)
    for (let i = 0; i < 150; i++) {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=-1`);
        const data = await res.json();
        const action = data.result?.[0]?.callback_query?.data;
        
        if (action === "approve") {
            await postToInstagram(imageUrl, "Амьдралдаа заавал үзэх ёстой Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️");
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=✅ Амжилттай постлогдлоо!`);
            return;
        } else if (action === "reject") {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=❌ Постыг цуцаллаа.`);
            return;
        }
        await sleep(2000);
    }
}
main();
