import express from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://wondrous-madeleine-dbdb38.netlify.app'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/', // For compatibility with Render and other cloud providers
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
  // Accept audio files or fallback if unsure
    if (
      (file.mimetype && file.mimetype.startsWith('audio/')) ||
      file.fieldname === 'audio' ||
      (file.originalname && file.originalname.match(/\.(mp3|wav|ogg|m4a|aac)$/i))
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// HuggingFace API configuration
const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODELS = {
  'whisper-large': 'openai/whisper-large-v3',
  'whisper-large-turbo': 'openai/whisper-large-v3-turbo',
};
// Then pick the model string (e.g., "openai/whisper-large-v3")

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

function getAudioMimeType(file: Express.Multer.File): string {
  // Fallback for common extensions if mimetype is missing or generic
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype;
  const ext = path.extname(file.originalname).toLowerCase();
  switch (ext) {
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.m4a': return 'audio/mp4'; // or audio/x-m4a
    case '.flac': return 'audio/flac';
    default: return 'audio/wav'; // safest fallback
  }
}

// Transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  console.log('📥 Transcription request received');
  
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No audio file uploaded',
      details: 'Please provide an audio file in the request'
    });
  }

  if (!HF_API_TOKEN) {
    return res.status(500).json({
      error: 'Server configuration error',
      details: 'HuggingFace API token not configured'
    });
  }

  const tempFilePath = req.file.path;
  
  try {
    console.log('🎵 Processing audio file:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Read the uploaded file
    const audioBuffer = fs.readFileSync(tempFilePath);
    
    // Choose model based on query parameter or default to tiny
    const modelKey = (req.query.model as string) || 'whisper-large';
    const modelName = HF_MODELS[modelKey as keyof typeof HF_MODELS] || HF_MODELS['whisper-large'];

    console.log('🤖 Using model:', modelName);

    // Call HuggingFace Inference API
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${modelName}`,
      audioBuffer,
      {
        headers: {
          'Authorization': `Bearer ${HF_API_TOKEN}`,
          'Content-Type': getAudioMimeType(req.file),
          'Accept': 'application/json', // <- THIS LINE IS IMPORTANT
        },
        maxBodyLength: 100 * 1024 * 1024, // 100MB limit
        timeout: 60000, // 60 second timeout
      }
    );

    console.log('✅ Transcription successful');

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Return transcription result
    res.json({
      success: true,
      transcription: response.data,
      metadata: {
        model: modelName,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        mimetype: req.file.mimetype,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Transcription error:', error.message);
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.error('Failed to clean up temp file:', cleanupError);
    }

    // Handle different types of errors
    if (error.response) {
      // HuggingFace API error
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        return res.status(500).json({
          error: 'Authentication failed',
          details: 'Invalid HuggingFace API token'
        });
      } else if (status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          details: 'Too many requests to HuggingFace API. Please try again later.'
        });
      } else if (status === 503) {
        return res.status(503).json({
          error: 'Model loading',
          details: 'The AI model is currently loading. Please try again in a few moments.',
          retryAfter: 20
        });
      } else {
        return res.status(500).json({
          error: 'Transcription failed',
          details: data?.error || 'HuggingFace API error',
          status
        });
      }
    } else if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        error: 'Request timeout',
        details: 'Transcription took too long. Please try with a shorter audio file.'
      });
    } else {
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// List available models endpoint
app.get('/api/models', (req, res) => {
  res.json({
    models: Object.keys(HF_MODELS).map(key => ({
      key,
      name: HF_MODELS[key as keyof typeof HF_MODELS],
      description: getModelDescription(key)
    }))
  });
});

function getModelDescription(modelKey: string): string {
  const descriptions: Record<string, string> = {
    'whisper-large': 'Best accuracy, standard speed (1.5GB)',
    'whisper-large-turbo': 'Best accuracy, faster and cheaper (newest, 1.5GB)'
  };
  return descriptions[modelKey] || 'Unknown model';
}

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        details: 'Audio file must be smaller than 100MB'
      });
    }
  }
  
  res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    details: `Route ${req.method} ${req.originalUrl} not found`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Voice Guardian API server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🎤 Transcription endpoint: POST http://localhost:${PORT}/api/transcribe`);
  console.log(`📚 Available models: GET http://localhost:${PORT}/api/models`);
  
  if (!HF_API_TOKEN) {
    console.warn('⚠️  Warning: HF_API_TOKEN not set. Please configure your HuggingFace API token.');
  }
});
