const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) =>
    ctx.reply('Welcome', {
        reply_markup: {
            keyboard: [[{ text: 'web app', web_app: { url: 'https://tap-clicekr.netlify.app' } }]],
        },
    }),
);

bot.launch();
