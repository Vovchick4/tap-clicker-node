const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('@supabase/supabase-js');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const supabaseClient = supabase.createClient(process.env.SUPBASE_URL, process.env.SUPBASE_KEY);

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text !== '/getlink') {
        await bot.sendMessage(chatId, 'Farm our tokens, write /help check all commands', {
            reply_markup: {
                inline_keyboard: [[{ text: 'web app', web_app: { url: 'https://tap-clicekr.netlify.app' } }]],
            },
        })
    }
});

// Handle the /start command
bot.onText(/\/start (.+)/, async (msg, match) => {
    try {
        const chatId = msg.chat.id;
        const referralId = match[1]; // Extract the referral ID from the command
        const telegramId = msg.from.id;

        if (referralId) {
            if (Number(referralId) === Number(telegramId)) {
                return bot.sendMessage(chatId, 'Cannot be referral yourself');
            }

            const { data: clientWhoReffered } = await supabaseClient.from('client').select('*, game ( * )').filter('telegram_id', 'eq', Number(telegramId)).limit(1);

            if (!clientWhoReffered) {
                const { data: createdClient } = await supabaseClient.from('client').insert({ nickname: null, telegram_id: Number(telegramId) });
                const { data: gameInsertData } = await gameInsert({
                    client_id: createdClient.id,
                });
            }

            const { data } = await supabaseClient.from('ref').select('*').filter('client_id', 'eq', Number(telegramId));
            if (data[0]) {
                return bot.sendMessage(chatId, 'This referral already exists');
            }

            const { data: ownerClient } = await supabaseClient.from('client').select('*, game ( * )').filter('telegram_id', 'eq', Number(telegramId)).limit(1);
            if (ownerClient) {
                const { error } = await supabaseClient.from('ref').insert({ owner_id: Number(referralId), client_id: Number(telegramId), game_id: ownerClient.game.id }).select('*').single();

                if (error) {
                    return bot.sendMessage(chatId, 'Error: ' + error.message);
                }

                bot.sendMessage(chatId, 'Welcome! You were referred by user ID: ' + referralId);
            }
        } else {
            bot.sendMessage(chatId, 'Welcome back!');
        }
    } catch (error) {
        console.log("🚀 ~ bot.onText ~ error:", error)
        bot.sendMessage(chatId, error.message ?? "Error");
    }
});

// Handle the /getlink command
bot.onText(/\/getlink/, async (msg) => {
    try {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        const { data: clientWhoReffered } = await supabaseClient.from('client').select('*, game ( * )').filter('telegram_id', 'eq', Number(telegramId)).limit(1);
        if (!clientWhoReffered) {
            const { data: createdClient } = await supabaseClient.from('client').insert({ nickname: null, telegram_id: Number(telegramId) });
            const { data: gameInsertData } = await gameInsert({
                client_id: createdClient.id,
            });
        }

        const referralLink = `https://t.me/tabcclicker_bot?start=${telegramId}`;
        bot.sendMessage(chatId, `Share this link to refer others: ${referralLink}`);
    } catch (error) {
        console.log("🚀 ~ bot.onText ~ error:", error)
    }
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
Available commands:
/start - Start the bot
/help - List available commands
/getlink - Get reffs
    `;
    bot.sendMessage(chatId, helpMessage);
});

const runWeeklyCommand = async () => {
    try {
        // Fetch all relevant data at once
        const { data: refData } = await supabaseClient
            .from('ref')
            .select('game_id, client ( game ( amount ) )');

        if (refData) {
            const formattedData = refData.reduce((acc, curr) => {
                if (!acc[curr.game_id]) {
                    acc[curr.game_id] = 0;
                }
                acc[curr.game_id] += Math.ceil(curr.client?.game?.amount / 10) ?? 0;
                return acc;
            }, {});

            // Fetch all games at once
            const gameIds = Object.keys(formattedData);
            const { data: gameDataList, error } = await supabaseClient
                .from('game')
                .select('id, amount')
                .in('id', gameIds);

            if (gameDataList && !error) {
                const updates = gameDataList.map(game => {
                    const updatedAmount = game.amount + (formattedData[game.id] || 0);
                    return {
                        id: game.id,
                        amount: updatedAmount,
                    };
                });

                // Perform bulk update
                const { error: updateError } = await supabaseClient
                    .from('game')
                    .update(updates).in('id', updates.map(({ id }) => (id)));

                if (updateError) {
                    console.error('Error updating game amounts:', updateError);
                }
            } else {
                console.error('Error retrieving game data:', error);
            }
        }
    } catch (error) {
        console.log("🚀 ~ runWeeklyCommand ~ error:", error)
    }
}

// Schedule the task to run every Monday at 00:00
cron.schedule('0 0 * * 1', async () => {
    await runWeeklyCommand();
    console.log('Weekly task executed at:', new Date().toLocaleString());
});

const gameInsert = async (data) => {
    return await supabaseClient.from('game').insert(data).select('*').single();
};