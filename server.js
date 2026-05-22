const express = require('express');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, NoSuchKey } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');
const Busboy = require('busboy');

const app = express();

// ---------- Config from environment ----------
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'bndrllc-store-images';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '5000', 10) * 1024 * 1024; // default 5 GB
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
  // Disable checksums entirely – required for streaming uploads from busboy
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// ---------- Helper: map extension to MIME type ----------
function guessMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  return map[ext] || 'application/octet-stream';
}

// ---------- Serve static files ----------
app.use(express.static('public'));

// ---------- Upload endpoint (streaming, multiple files) ----------
app.post('/upload', (req, res) => {
  const results = [];
  let aborted = false;

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: MAX_FILE_SIZE, files: 20 },
  });

  busboy.on('file', (fieldname, fileStream, info) => {
    const { filename } = info;
    let mimeType = info.mimeType;

    if (!mimeType || !ALLOWED_MIMES.test(mimeType)) {
      mimeType = guessMimeType(filename);
    }

    if (!ALLOWED_MIMES.test(mimeType)) {
      fileStream.resume();
      results.push({ originalName: filename, success: false, error: `Unsupported file type: ${mimeType}` });
      return;
    }

    const ext = path.extname(filename) || `.${mimeType.split('/')[1]}`;
    const safeName = `${crypto.randomUUID()}${ext}`;

    const uploadPromise = (async () => {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: safeName,
          Body: fileStream,
          ContentType: mimeType,
        }));
        const publicUrl = `https://${req.hostname}/files/${safeName}`;
        results.push({ originalName: filename, success: true, url: publicUrl, filename: safeName });
      } catch (err) {
        console.error(`Upload failed for ${filename}:`, err);
        fileStream.resume();
        results.push({ originalName: filename, success: false, error: 'Upload to storage failed.' });
      }
    })();

    results.__promises = results.__promises || [];
    results.__promises.push(uploadPromise);
  });

  busboy.on('field', () => {});

  busboy.on('finish', async () => {
    if (aborted) return;
    const promises = results.__promises || [];
    delete results.__promises;
    await Promise.allSettled(promises);
    res.json({ success: results.length > 0, files: results });
  });

  busboy.on('error', (err) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large.' });
    }
    console.error('Busboy error:', err);
    return res.status(500).json({ success: false, error: 'Upload failed.' });
  });

  req.on('aborted', () => {
    aborted = true;
  });

  req.pipe(busboy);
});

// ---------- File serving proxy ----------
app.get('/files/:key', async (req, res) => {
  const key = req.params.key;
  try {
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const response = await s3.send(command);
    res.set('Content-Type', response.ContentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Access-Control-Allow-Origin', '*');
    response.Body.pipe(res);
  } catch (error) {
    if (error instanceof NoSuchKey) return res.status(404).send('File not found');
    console.error('Proxy error:', error);
    res.status(500).send('Internal server error');
  }
});

// ---------- Delete file ----------
app.delete('/files/:key', async (req, res) => {
  const key = req.params.key;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete file.' });
  }
});

// ---------- Library ----------
app.get('/list', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({ Bucket: R2_BUCKET });
    const data = await s3.send(command);
    const files = (data.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      url: `https://${req.hostname}/files/${obj.Key}`
    }));
    files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json({ success: true, files });
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ success: false, error: 'Failed to list files.' });
  }
});

app.get('/health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
