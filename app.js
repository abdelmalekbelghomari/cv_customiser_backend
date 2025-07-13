const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import routes
const cvRoutes = require('./routes/cv');

const app = express();

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'CV Customizer Backend is running!',
    version: '1.0.0',
    endpoints: [
      'GET /',
      'POST /api/generate-cv'
    ]
  });
});

// Use CV routes
app.use('/api', cvRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = app;