const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// CV generation route
router.post('/generate-cv', upload.single('logo'), (req, res) => {
  try {
    const { jobTitle } = req.body;
    const logoFile = req.file;
    
    console.log('Received CV generation request:');
    console.log('Job Title:', jobTitle);
    console.log('Logo File:', logoFile ? logoFile.filename : 'No logo uploaded');
    
    // TODO: Add LaTeX compilation here
    res.json({ 
      success: true,
      message: 'CV generation request received successfully!',
      data: {
        jobTitle: jobTitle,
        logoPath: logoFile ? logoFile.path : null,
        logoFilename: logoFile ? logoFile.filename : null,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error generating CV:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error generating CV',
      error: error.message 
    });
  }
});

// Multer error handling
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Max size is 5MB.'
      });
    }
  }
  next(error);
});

module.exports = router;