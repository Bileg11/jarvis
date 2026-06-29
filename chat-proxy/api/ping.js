// Health check — chat proxy амьд эсэх + token тавигдсан эсэхийг шалгана
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    ok: true,
    chat: !!(process.env.SYSTEM_USE_TOKEN || process.env.META_BOT_TOKEN),
    gemini: !!process.env.GEMINI_API_KEY,
    ts: new Date().toISOString(),
  });
};
