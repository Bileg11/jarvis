const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ID;
const INSTAGRAM_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN_META;

console.log("Checking Secrets...");
console.log("Token:", TELEGRAM_BOT_TOKEN ? "Found" : "MISSING");
console.log("ChatID:", TELEGRAM_CHAT_ID ? "Found" : "MISSING");

async function run() {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("Secrets алдаатай байна!");
        return;
    }
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: "🤖 Jarvis Ghost Marketer: Ажиллаж байна!"
        })
    });
    const data = await res.json();
    console.log("Telegram Response:", data);
}

run();
