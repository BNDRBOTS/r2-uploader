const express = require('express');
const multer  = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');

const app = express();

// ---------- Configuration from environment ----------
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'bndrllc-store-images';
const PUBLIC_BASE  = process.env.PUBLIC_BASE_URL || 'https://images.bndrllc.com';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) * 1024 * 1024; // 100 MB default
const ALLOWED_MIMES = /^(image\/(jpeg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime|x-msvideo))$/i;

// ---------- Validate env vars ----------
if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
  console.error('Missing required environment variables: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

// ---------- S3 client ----------
const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
  forcePathStyle: true, // required for R2
});

// ---------- Multer (memory storage) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.test(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(`Unsupported file type: ${file.mimetype}. Only images and videos are allowed.`);
      error.status = 400;
      cb(error, false);
    }
  },
});

// ---------- Serve static UI ----------
app.use(express.static('public'));

// ---------- Upload endpoint ----------
app.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          error: `Multer error: ${err.message} (field name must be "file")`,
        });
      }
      return res.status(err.status || 500).json({
        success: false,
        error: err.message,
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided. Use form-data with field name "file".' });
    }

    // Generate a unique, safe filename
    const ext = path.extname(file.originalname) || `.${file.mimetype.split('/')[1]}`;
    const safeName = `${crypto.randomUUID()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: safeName,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3.send(command);

    const publicUrl = `${PUBLIC_BASE}/${safeName}`;

    res.json({
      success: true,
      url: publicUrl,
      filename: safeName,
      size: file.size,
    });
  } catch (s3Error) {
    console.error('R2 upload failed:', s3Error);
    res.status(500).json({
      success: false,
      error: `Upload to storage failed: ${s3Error.message || 'Unknown error'}`,
    });
  }
});

// ---------- Health check ----------
app.get('/health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`R2 Uploader listening on port ${PORT}`));
