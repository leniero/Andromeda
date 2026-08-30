// Emotion.js

const mongoose = require('mongoose');

const emotionSchema = new mongoose.Schema({
    username: String,
    emotion: String,
    text_input: String,
    latitude: Number,
    longitude: Number,
    local_time: Date,
    hasLocalVideo: { type: Boolean, default: false },
    clientId: String,
});

module.exports = mongoose.model('Emotion', emotionSchema);