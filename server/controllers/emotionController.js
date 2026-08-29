// emotionController.js

const Emotion = require('../models/Emotion');
const { Server } = require('socket.io');
const io = new Server();

exports.recordEmotion = async (req, res) => {
    const emotionData = req.body;

    try {
        const emotion = new Emotion(emotionData);
        await emotion.save();
        io.emit('new_emotion', emotionData);
        res.status(201).json({ status: "success", emotion: emotion });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getEmotions = async (req, res) => {
    try {
        const emotions = await Emotion.find({});
        res.status(200).json(emotions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};