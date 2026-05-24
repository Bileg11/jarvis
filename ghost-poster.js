const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ID;
const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN_META;

const sampleKeywords = ["shanghai skyline", "shanghai street food", "china cyberpunk city", "shanghai traditional garden"];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Pexels-ээс зураг хайх функц
async function fetchPexelsImage(keyword) {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1`, { 
            headers: { 'Authorization': PEXELS_API_KEY } 
        });
        const data = await response.json();
        return data.photos[0].src.large;
    } catch (e) {
        return "https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg";
    }
}

// 2. Инстаграм руу постлох (Алдаа баригчтай хувилбар)
async function postToInstagram(imageUrl, caption) {
    try {
        const containerRes = await fetch(`https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${ACCESS_TOKEN}`, { method: 'POST' });
        const containerData = await containerRes.json();
        
        // Хэрэв Meta-аас алдаа ирвэл алдааны мессежийг буцаана
        if (containerData.error) {
            return { success: false, error: containerData.error.message };
        }
        if (!containerData.id) {
            return { success: false, error: "Media container ID үүссэнгүй." };
        }

        const publishRes = await fetch(`https://graph.facebook.com/v25.0/${INSTAGRAM_BUSINESS_ID}/media_publish?creation_id=${containerData.id}&access_token=${ACCESS_TOKEN}`, { method: 'POST' });
        const publishData = await publishRes.json();

        if (publishData.error) {
            return { success: false, error: publishData.error.message };
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// 3. Телеграм руу товчлууртай Draft илгээх
async function sendDraft(imageUrl, keyword) {
    const caption = `🤖 JARVIS GHOST MARKETER [DRAFT]\n\n📊 Контентын формат: SINGLE\n🔍 Хайсан трэнд сэдэв: ${keyword}\n\n📝 Постны текст: "Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️"\n\n👇 Доорх товчлуураар сошиал руу нийтлэх эсэхийг шийднэ үү.`;
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
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
    const imageUrl = await fetchPexelsImage(keyword); 
    const messageId = await sendDraft(imageUrl, keyword); 

    if (!messageId) return;

    let offset = 0; // Зөв поллингийн тулд offset ашиглана

    // 10 минут хүлээх (Polling)
    for (let i = 0; i < 300; i++) {
        try {
            const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}`);
            const data = await res.json();
            
            if (data.result && data.result.length > 0) {
                for (const update of data.result) {
                    // Дараагийн дуудлагад өмнөх мессежүүдийг давтахгүйн тулд offset-ийг шинэчилнэ
                    offset = update.update_id + 1;

                    if (update.callback_query && update.callback_query.message.message_id === messageId) {
                        const action = update.callback_query.data;
                        
                        if (action === "approve") {
                            // Илгээх төлөвийг мэдэгдэх
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=⏳ Инстаграм руу нийтэлж байна, түр хүлээнэ үү...`);
                            
                            const result = await postToInstagram(imageUrl, "Шанхай хотын гайхамшиг. LFS Shanghai-тай хамт дурсамжаа бүтээгээрэй. ✈️");
                            
                            if (result.success) {
                                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=✅ Амжилттай постлогдлоо!`);
                            } else {
                                // Meta API-аас ирсэн бодит алдааг Telegram руу илгээнэ
                                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=❌ Инстаграм руу постлогдсонгүй!\n\n⚠️ Алдаа: ${result.error}`);
                            }
                        } else {
                            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=❌ Постыг цуцаллаа.`);
                        }
                        return; // Процесс дууссан тул main функцийг хаана
                    }
                }
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
        await sleep(2000);
    }
}

main();
