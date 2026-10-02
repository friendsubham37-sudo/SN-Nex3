// database.js
const mongoose = require('mongoose');

// Define the schema for custom prefixes per server
const GuildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, default: '$' }
});

const Guild = mongoose.model('Guild', GuildSchema);

function connectDatabase(uri) {
    mongoose.connect(uri)
        .then(() => console.log('Successfully connected to MongoDB Atlas ✅'))
        .catch(err => console.error('MongoDB Connection Error ❌:', err));
}

// Export both the connection function and the Guild model
module.exports = { connectDatabase, Guild };
