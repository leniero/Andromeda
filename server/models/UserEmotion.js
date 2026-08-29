// UserEmotion.js

const mongoose = require('mongoose');

const UserEmotionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String },
  emotion: { type: String, required: true },
  text_input: { type: String },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  local_time: { type: Date, required: true },
  isPublic: { type: Boolean, default: true },
  hasLocalVideo: { type: Boolean, default: false }
});

module.exports = mongoose.model('UserEmotion', UserEmotionSchema);