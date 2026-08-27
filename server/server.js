// server.js
require('dotenv').config({ path: '.env.development' });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const emotionRoutes = require('./routes/emotionRoutes');
const userRoutes = require('./routes/userRoutes');

mongoose.set('debug', true);

const app = express();

// Add the frontend URL to the allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4200',
  'https://andromeda-inky.vercel.app',
  'https://andromeda-server.vercel.app',
  'https://client-pink-three-98.vercel.app',
  'https://client-sojcrekxn-leandros-projects-ac28bf0b.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  preflightContinue: true, // Allow preflight requests
  optionsSuccessStatus: 204
}));

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/emotions', emotionRoutes);
app.use('/api/users', userRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('Welcome to the Andromeda Server API');
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

const startServer = (port, host) => {
  app.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
  });
};

// Adding error handling for uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
  console.error('There was an uncaught error', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection', err);
  process.exit(1);
});

connectDB().then(() => {
  startServer(process.env.PORT || 5001, '0.0.0.0');
}).catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});

module.exports = app;