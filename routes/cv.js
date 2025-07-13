const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const router = express.Router();

const execAsync = promisify(exec);

let jobTitlePdf = '';

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

// Create necessary directories
const createDirectories = () => {
  const dirs = ['uploads', 'temp', 'output'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Function to compile LaTeX
const compileLatex = async (texFilePath, outputDir) => {
  try {
    // Run pdflatex twice to ensure proper compilation (for references, etc.)
    const command = `pdflatex -interaction=nonstopmode -output-directory="${outputDir}" "${texFilePath}"`;
    
    console.log('Running LaTeX compilation...');
    await execAsync(command);
    
    // Run again to resolve references
    await execAsync(command);
    
    console.log('LaTeX compilation completed successfully');
    return true;
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    throw new Error(`LaTeX compilation failed: ${error.message}`);
  }
};

// CV generation route
router.post('/generate-cv', upload.single('logo'), async (req, res) => {
  let tempDir = null;
  
  try {
    const { jobTitle } = req.body;
    jobTitlePdf = jobTitle || '';
    const logoFile = req.file;
    
    console.log('Received CV generation request:');
    console.log('Job Title:', jobTitle);
    console.log('Logo File:', logoFile ? logoFile.filename : 'No logo uploaded');
    
    // Create necessary directories
    createDirectories();
    
    // Create a unique temporary directory for this compilation
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    tempDir = path.join('temp', `cv-${uniqueId}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Read the LaTeX template
    const templatePath = path.join('templates', 'cv_template.tex');
    if (!fs.existsSync(templatePath)) {
      throw new Error('LaTeX template not found. Please ensure cv_template.tex exists in the template folder.');
    }
    
    let latexContent = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders in the template
    if (jobTitle) {
      latexContent = latexContent.replace('JOB_TITLE_PLACEHOLDER', jobTitle);
    } else {
      latexContent = latexContent.replace('JOB_TITLE_PLACEHOLDER', '');
    }
    
    if (logoFile) {
      // Copy logo to temp directory
      const logoDestPath = path.join(tempDir, logoFile.filename);
      fs.copyFileSync(logoFile.path, logoDestPath);
      latexContent = latexContent.replace('LOGO_PLACEHOLDER', logoFile.filename);
    } else {
      latexContent = latexContent.replace('LOGO_PLACEHOLDER', '');
    }
    
    // Write the modified LaTeX file
    const texFilePath = path.join(tempDir, 'cv.tex');
    fs.writeFileSync(texFilePath, latexContent);
    
    // Compile LaTeX to PDF
    await compileLatex(texFilePath, tempDir);
    
    // Check if PDF was generated
    const pdfPath = path.join(tempDir, 'cv.pdf');
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF generation failed - output file not found');
    }
    
    // Move PDF to output directory with unique name
    const outputFileName = `cv_${jobTitle}-${uniqueId}.pdf`;
    const finalPdfPath = path.join('output', outputFileName);
    fs.copyFileSync(pdfPath, finalPdfPath);
    
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Generate download URL
    const downloadUrl = `/api/download/${outputFileName}`;
    
    res.json({ 
      success: true,
      message: 'CV generated successfully!',
      data: {
        jobTitle: jobTitle || 'Not specified',
        logoPath: logoFile ? logoFile.path : null,
        logoFilename: logoFile ? logoFile.filename : null,
        pdfUrl: downloadUrl,
        pdfPath: finalPdfPath,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error generating CV:', error);
    
    // Clean up temporary directory in case of error
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error generating CV',
      error: error.message 
    });
  }
});

// Route for downloading generated PDFs
router.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join('output', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found'
      });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume-${jobTitlePdf}.pdf"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading PDF',
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