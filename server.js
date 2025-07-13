const app = require('./app');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

// Start the server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://192.168.1.55:${PORT}`);
  console.log(`📁 Upload directory: ./uploads`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});