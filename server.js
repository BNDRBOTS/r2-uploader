const express = require('express');
const multer  = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, NoSuchKey } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');

const app = express();

// ---------- Config from environment ----------
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'bndrllc-store-images';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) * 1024 * 1024;
const ALLOWED_MIMES = /^(image\/(jpeg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime|x-msvideo))$/i;

if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
  console.error('Missing R2 credentials in environment variables.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
  forcePathStyle: true,
});

// ---------- Multer (memory storage) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

// ---------- Serve static files ----------
app.use(express.static('public'));

// ---------- Upload endpoint ----------
app.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided.' });
    }

    const ext = path.extname(file.originalname) || `.${file.mimetype.split('/')[1]}`;
    const safeName = `${crypto.randomUUID()}${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: safeName,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const publicUrl = `https://${req.hostname}/files/${safeName}`;

    res.json({ success: true, url: publicUrl, filename: safeName, size: file.size });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ success: false, error: 'Upload to storage failed.' });
  }
});

// ---------- File serving proxy (from R2) ----------
app.get('/files/:key', async (req, res) => {
  const key = req.params.key;
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });
    const response = await s3.send(command);
    res.set('Content-Type', response.ContentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Access-Control-Allow-Origin', '*');
    response.Body.pipe(res);
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return res.status(404).send('File not found');
    }
    console.error('Proxy error:', error);
    res.status(500).send('Internal server error');
  }
});

// ---------- Library endpoint (list all files) ----------
app.get('/list', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
    });
    const data = await s3.send(command);
    const files = (data.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      url: `https://${req.hostname}/files/${obj.Key}`
    }));
    // Sort newest first
    files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json({ success: true, files });
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ success: false, error: 'Failed to list files.' });
  }
});

// ---------- Health check ----------
app.get('/health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
