const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    await bot.sendMessage(chatId, 'Farm our tokens', {
        reply_markup: {
            inline_keyboard: [[{ text: 'web app', web_app: { url: 'https://tap-clicekr.netlify.app' } }]],
        },
    })
});