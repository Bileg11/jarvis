const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sampleKeywords = ["shanghai skyline", "china travel lifestyle", "shanghai night cyberpunk"];
const randomKeyword = sampleKeywords[Math.floor(Math.random() * sampleKeywords.length)];

async function fetchPexelsImage(keyword) {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1`, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        const data = await response.json();
        return data.photos?.[0]?.src?.large || "https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg";
    } catch (error) {
        return "https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg";
    }
}

async function sendInteractiveDraft(photoUrl, text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
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
                photo: photoUrl,
                caption: text,
                parse_mode: "Markdown",
                reply_markup: keyboard
            })
        });
        console.log("Драфт амжилттай илгээгдлөө!");
    } catch (error) {
        console.error("Алдаа:", error);
    }
}

async function start() {
    const imageUrl = await fetchPexelsImage(randomKeyword);
    const postText = `*🤖 JARVIS GHOST MARKETER [DRAFT]*\n\n` +
                     `🔍 *Хайсан сэдэв:* \`${randomKeyword}\`\n\n` +
                     `📝 *Постны текст:* "Амьдралдаа заавал үзэх ёстой Шанхайн дүр төрх. LFS-тэй хамт тухтай аялаарай. ✈️"\n\n` +
                     `👇 Доорх товчлуурыг ашиглан сошиал руу илгээх эсэхийг шийднэ үү.`;
    await sendInteractiveDraft(imageUrl, postText);
}

start();
