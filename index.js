require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const { connectDatabase } = require('./database.js');
const { handleMessages } = require('./commands.js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

// --- KEEP ALIVE WEB SERVER FOR 24/7 HOSTING ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is active and running 24/7!');
});

app.listen(PORT, () => {
    console.log(`🚀 Keep-alive server listening on port ${PORT}`);
});
// ----------------------------------------------

if (!BOT_TOKEN || !MONGO_URI) {
    console.error('❌ Error: BOT_TOKEN or MONGO_URI is missing in your environment configuration!');
    process.exit(1);
}

// Connect to MongoDB Atlas
connectDatabase(MONGO_URI);

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.on('error', error => console.error('⚠️ Discord Client Error:', error));
client.on('ready', () => console.log(`🚀 Bot logged in as ${client.user.tag}!`));

// Initialize message event listeners
handleMessages(client);

process.on('unhandledRejection', error => {
    console.error('⚠️ Unhandled Promise Rejection Detected:', error);
});

client.login(BOT_TOKEN);
