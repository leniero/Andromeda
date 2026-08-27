// emotionRoutes.js

const express = require('express');
const router = express.Router();
const Emotion = require('../models/Emotion');
const UserEmotion = require('../models/UserEmotion');
const User = require('../models/User');
const auth = require('../middleware/auth'); // Middleware to check authentication

// Submit an emotion (accessible to both logged-in and non-logged-in users)
router.post('/submit', auth.optional, async (req, res) => {
  try {
    const { emotion, text_input, latitude, longitude, isPublic } = req.body;

    const isPublicPost = req.user ? (isPublic !== false) : true;
    const now = new Date();

    let username = undefined;
    if (req.user) {
      const userDoc = await User.findById(req.user._id);
      if (userDoc) {
        username = userDoc.username;
      }
    }

    // Save to the collective emotions collection if public
    if (isPublicPost) {
      const newEmotion = new Emotion({
        username,
        emotion,
        text_input: text_input ? text_input.trim() : text_input,
        latitude,
        longitude,
        local_time: now
      });
      await newEmotion.save();
    }

    // If the user is logged in, save to their private emotions collection
    if (req.user) {
      const userEmotion = new UserEmotion({
        userId: req.user._id,
        username,
        emotion,
        text_input: text_input ? text_input.trim() : text_input,
        latitude,
        longitude,
        local_time: now,
        isPublic: isPublicPost
      });
      await userEmotion.save();
    }

    res.status(201).json({ 
      message: 'Emotion submitted successfully',
      username: username // Send back username for the frontend to use
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all public emotions (accessible to everyone)
router.get('/get_emotions', auth.optional, async (req, res) => {
  try {
    let publicEmotions = await Emotion.find().lean();
    let userPrivateEmotions = [];
    
    // If not logged in, scrub usernames to make them anonymous
    if (!req.user) {
      publicEmotions = publicEmotions.map(e => {
        const { username, ...rest } = e;
        return rest;
      });
    }
    
    if (req.user) {
      userPrivateEmotions = await UserEmotion.find({ userId: req.user._id, isPublic: false }).lean();
      
      const userDoc = await User.findById(req.user._id).select('username').lean();
      const username = userDoc ? userDoc.username : undefined;
      
      userPrivateEmotions = userPrivateEmotions.map(e => ({
        ...e,
        username: e.username || username
      }));
    }
    
    const allEmotions = [...publicEmotions, ...userPrivateEmotions];
    allEmotions.sort((a, b) => new Date(b.local_time).getTime() - new Date(a.local_time).getTime());
    
    res.status(200).json(allEmotions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get logged-in user's emotions (accessible only to logged-in users)
router.get('/get_user_emotions', auth.required, async (req, res) => {
  try {
    const userEmotions = await UserEmotion.find({ userId: req.user._id }).sort({ local_time: -1 }).lean();
    
    // Fallback to fetch username for older entries that don't have it stored
    const userDoc = await User.findById(req.user._id).select('username').lean();
    const username = userDoc ? userDoc.username : undefined;
    
    const enrichedEmotions = userEmotions.map(e => ({
      ...e,
      username: e.username || username
    }));
    
    res.status(200).json(enrichedEmotions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an emotion entry
router.delete('/:id', auth.required, async (req, res) => {
  try {
    const userEmotion = await UserEmotion.findOne({ _id: req.params.id, userId: req.user._id });
    if (!userEmotion) {
      return res.status(404).json({ error: 'Emotion not found' });
    }
    
    // Find and delete the corresponding public Emotion if it was public
    if (userEmotion.isPublic !== false) {
      await Emotion.findOneAndDelete({
        emotion: userEmotion.emotion,
        text_input: userEmotion.text_input,
        latitude: userEmotion.latitude,
        longitude: userEmotion.longitude,
        local_time: {
          $gte: new Date(userEmotion.local_time.getTime() - 2000),
          $lte: new Date(userEmotion.local_time.getTime() + 2000)
        }
      });
    }

    await UserEmotion.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Emotion deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;