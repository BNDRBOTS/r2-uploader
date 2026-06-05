const express = require('express');
const { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, CopyObjectCommand, NoSuchKey } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');
const crypto = require('crypto');
const Busboy = require('busboy');

const app = express();

// ---------- Config from environment ----------
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'bndrllc-store-images';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '5000', 10) * 1024 * 1024;
const ALLOWED_MIMES = /^(image\/(jpeg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime|x-msvideo)|application\/(pdf|zip|x-zip-compressed))$/i;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD; // if not set, no protection

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
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

// ---------- Helper: sanitize a user-supplied filename ----------
function sanitizeFilename(raw) {
  let safe = raw.replace(/[^a-zA-Z0-9_\-.]/g, '_');
  safe = safe.replace(/\.{2,}/g, '.');
  safe = safe.replace(/^\./, '');
  if (!safe) safe = 'file';
  return safe;
}

// ---------- Authentication middleware ----------
function authMiddleware(req, res, next) {
  if (!ACCESS_PASSWORD) return next(); // no password set, skip

  const token = req.cookies?.auth_token;
  const validToken = crypto
    .createHmac('sha256', ACCESS_PASSWORD)
    .update('auth')
    .digest('hex');
  if (token && token === validToken) return next();

  // Allow public access only to GET /files/:key so links work everywhere
  if (req.method === 'GET' && req.path.startsWith('/files/')) {
    return next();
  }

  // Everything else (upload, list, delete, rename) requires auth
  if (
    req.path === '/upload' ||
    req.path === '/list' ||
    req.path.startsWith('/files')
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Cookie parser (simple)
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(c => {
      const parts = c.split('=');
      if (parts.length >= 2) {
        req.cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });
  }
  next();
});

// ---------- Login endpoint ----------
app.post('/login', express.json(), (req, res) => {
  if (!ACCESS_PASSWORD) {
    return res.json({ success: true, message: 'No password set.' });
  }
  const { password } = req.body;
  if (password === ACCESS_PASSWORD) {
    const token = crypto.createHmac('sha256', ACCESS_PASSWORD).update('auth').digest('hex');
    res.cookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Incorrect password.' });
});

// ---------- Logout endpoint ----------
app.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ success: true });
});

// ---------- Serve static files (public folder) ----------
app.use(express.static('public'));

// ---------- Protect routes ----------
app.use(authMiddleware);

// ---------- Upload endpoint (streaming) ----------
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
        const upload = new Upload({
          client: s3,
          params: {
            Bucket: R2_BUCKET,
            Key: safeName,
            Body: fileStream,
            ContentType: mimeType,
          },
          leavePartsOnError: false,
        });
        await upload.done();
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

  req.on('aborted', () => { aborted = true; });
  req.pipe(busboy);
});

// ---------- File serving proxy (PUBLIC, even with password) ----------
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

// ---------- Delete file (protected) ----------
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

// ---------- Rename file (protected) ----------
app.patch('/files/:key', express.json(), async (req, res) => {
  const oldKey = req.params.key;
  const { newName } = req.body;

  if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'A valid new name is required.' });
  }

  const oldExt = path.extname(oldKey);
  const newExt = path.extname(newName);
  let newKey;
  if (newExt) {
    newKey = sanitizeFilename(newName);
  } else {
    const baseName = sanitizeFilename(newName);
    newKey = baseName + oldExt;
  }

  if (newKey === oldKey) {
    return res.json({ success: true, newKey, message: 'Name unchanged.' });
  }

  try {
    await s3.send(new CopyObjectCommand({
      Bucket: R2_BUCKET,
      CopySource: `${R2_BUCKET}/${oldKey}`,
      Key: newKey,
    }));
    await s3.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: oldKey,
    }));
    const newUrl = `https://${req.hostname}/files/${newKey}`;
    res.json({ success: true, newKey, url: newUrl });
  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).json({ success: false, error: 'Failed to rename file.' });
  }
});

// ---------- Library (with pagination) ----------
app.get('/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const command = new ListObjectsV2Command({ Bucket: R2_BUCKET });
    const data = await s3.send(command);
    const allFiles = (data.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      url: `https://${req.hostname}/files/${obj.Key}`
    }));
    // Sort newest first
    allFiles.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    const total = allFiles.length;
    const startIndex = (page - 1) * limit;
    const pageFiles = allFiles.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      files: pageFiles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ success: false, error: 'Failed to list files.' });
  }
});

app.get('/health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
