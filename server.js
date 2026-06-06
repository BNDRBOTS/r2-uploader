const express = require('express');
const compression = require('compression');
const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  CopyObjectCommand,
  NoSuchKey
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');
const crypto = require('crypto');
const Busboy = require('busboy');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs');

// ── App Initialisation ──
const app = express();
app.use(morgan('dev'));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// ── Config from environment ──
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'bndrllc-store-images';
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB || '5000', 10) || 5000) * 1024 * 1024;
const ALLOWED_MIMES = /^(image\/(jpeg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime|x-msvideo)|application\/(pdf|zip|x-zip-compressed))$/i;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;

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

// ── Security: Helmet & CSP ──
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cookieParser());

// ── Rate Limiting ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ success: false, error: 'Too many requests, please try again later.' }),
});

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
  handler: (_req, res) => res.status(429).json({ success: false, error: 'Upload limit reached. Please wait.' }),
});

const actionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  handler: (_req, res) => res.status(429).json({ success: false, error: 'Too many actions. Please wait.' }),
});

// ── Helpers ──
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

function sanitizeFilename(raw, maxLen = 200) {
  let safe = raw.replace(/[^a-zA-Z0-9_\-.]/g, '_');
  safe = safe.replace(/\.{2,}/g, '.');
  safe = safe.replace(/^\./, '');
  if (!safe) safe = 'file';
  return safe.slice(0, maxLen);
}

function getPublicUrl(req, key) {
  return `https://${req.hostname}/files/${encodeURIComponent(key)}`;
}

function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── CSRF Protection ──
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

// ── Authentication Middleware ──
function authMiddleware(req, res, next) {
  // if no password configured, everything is public
  if (!ACCESS_PASSWORD) return next();

  // always allow public access to the main page (login form)
  if (req.method === 'GET' && req.path === '/') return next();

  // allow public access to the health endpoint
  if (req.method === 'GET' && req.path === '/health') return next();

  const token = req.cookies?.auth_token;
  const validToken = crypto.createHmac('sha256', ACCESS_PASSWORD).update('auth').digest('hex');
  if (token && token === validToken) return next();

  // file serving is public
  if ((req.method === 'GET' || req.method === 'HEAD') && req.path.startsWith('/files/')) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

// ── Serve index.html with nonce-based CSP ──
function serveIndexWithCSP(_req, res) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (err) {
    console.error('Failed to read index.html:', err);
    return res.status(500).send('Internal Server Error');
  }
  html = html.replace(/NONCE_PLACEHOLDER/g, nonce);
  res.set(
    'Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'nonce-${nonce}' 'strict-dynamic'; ` +
    `style-src 'nonce-${nonce}'; ` +
    `img-src 'self' data: blob: https:; ` +
    `media-src 'self' blob: https:; ` +
    `connect-src 'self'; ` +
    `frame-ancestors 'none'; ` +
    `base-uri 'self'; ` +
    `form-action 'self';`
  );
  res.set('Cache-Control', 'no-store');
  res.send(html);
}

// ── Login (no CSRF needed) ──
app.post('/login', authLimiter, express.json(), (req, res) => {
  if (!ACCESS_PASSWORD) {
    const csrfToken = generateCSRFToken();
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure,
      path: '/',
    });
    return res.json({ success: true, message: 'No password set.', csrfToken });
  }
  const { password } = req.body;
  if (password === ACCESS_PASSWORD) {
    const token = crypto.createHmac('sha256', ACCESS_PASSWORD).update('auth').digest('hex');
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    const csrfToken = generateCSRFToken();
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.json({ success: true, csrfToken });
  }
  res.status(401).json({ success: false, error: 'Incorrect password.' });
});

// ── Apply global auth and CSRF ──
app.use(authMiddleware);
app.use(csrfProtection);

// ── Logout (now protected) ──
app.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
  res.json({ success: true });
});

// ── Upload (streaming, multi‑file) ──
app.post('/upload', uploadLimiter, (req, res) => {
  const results = [];
  const uploadPromises = [];
  const activeStreams = new Set();
  let aborted = false;

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: MAX_FILE_SIZE, files: 20 },
  });

  busboy.on('file', (_fieldname, fileStream, info) => {
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

    activeStreams.add(fileStream);

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
        const publicUrl = getPublicUrl(req, safeName);
        results.push({ originalName: filename, success: true, url: publicUrl, filename: safeName });
      } catch (err) {
        console.error(`Upload failed for ${filename}:`, err);
        results.push({ originalName: filename, success: false, error: 'Upload to storage failed.' });
      } finally {
        activeStreams.delete(fileStream);
        if (!fileStream.destroyed) fileStream.resume();
      }
    })();

    uploadPromises.push(uploadPromise);
  });

  busboy.on('finish', async () => {
    if (aborted) return;
    await Promise.allSettled(uploadPromises);
    res.json({ success: results.length > 0, files: results });
  });

  busboy.on('error', (err) => {
    if (aborted) return;
    aborted = true;
    for (const stream of activeStreams) {
      if (!stream.destroyed) stream.destroy();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large.' });
    }
    if (err.code === 'LIMIT_FILES') {
      return res.status(400).json({ success: false, error: 'Too many files. Maximum 20 per upload.' });
    }
    console.error('Busboy error:', err);
    return res.status(500).json({ success: false, error: 'Upload failed.' });
  });

  req.on('aborted', () => {
    aborted = true;
    for (const stream of activeStreams) {
      if (!stream.destroyed) stream.destroy();
    }
    busboy.destroy();
  });

  req.pipe(busboy);
});

// ── File serving with conditional requests ──
async function serveFile(req, res, method) {
  const key = req.params.key;
  try {
    const headCmd = new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const headResp = await s3.send(headCmd);

    res.set('Content-Type', headResp.ContentType || 'application/octet-stream');
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Access-Control-Allow-Origin', '*');
    if (headResp.ETag) res.set('ETag', headResp.ETag);
    if (headResp.LastModified) res.set('Last-Modified', headResp.LastModified.toUTCString());

    if (method === 'GET' && headResp.ETag && req.headers['if-none-match'] === headResp.ETag) {
      return res.status(304).end();
    }

    if (method === 'HEAD') {
      if (headResp.ContentLength !== undefined) {
        res.set('Content-Length', headResp.ContentLength.toString());
      }
      return res.status(200).end();
    }

    const getParams = { Bucket: R2_BUCKET, Key: key };
    if (req.headers.range) getParams.Range = req.headers.range;

    const getCmd = new GetObjectCommand(getParams);
    const getResp = await s3.send(getCmd);

    const statusCode = getResp.$metadata.httpStatusCode || 200;
    res.status(statusCode);

    if (getResp.ContentRange) res.set('Content-Range', getResp.ContentRange);
    if (getResp.ContentLength !== undefined) res.set('Content-Length', getResp.ContentLength.toString());

    let streamEnded = false;
    getResp.Body.on('end', () => { streamEnded = true; });
    getResp.Body.on('error', () => { streamEnded = true; });

    req.on('close', () => {
      if (!streamEnded) getResp.Body.destroy();
    });

    getResp.Body.pipe(res);
  } catch (error) {
    if (error instanceof NoSuchKey) return res.status(404).send('File not found');
    if (error.$metadata?.httpStatusCode === 416) return res.status(416).send('Range Not Satisfiable');
    console.error('Proxy error:', error);
    res.status(500).send('Internal server error');
  }
}

app.get('/files/:key', (req, res) => serveFile(req, res, 'GET'));
app.head('/files/:key', (req, res) => serveFile(req, res, 'HEAD'));

// ── Delete ──
app.delete('/files/:key', actionLimiter, async (req, res) => {
  const key = req.params.key;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete file.' });
  }
});

// ── Rename (with collision check) ──
app.patch('/files/:key', actionLimiter, express.json(), async (req, res) => {
  const oldKey = req.params.key;
  const { newName, overwrite } = req.body;
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

  if (newKey.length > 1024) {
    return res.status(400).json({ success: false, error: 'New name is too long.' });
  }
  if (newKey === oldKey) {
    return res.json({ success: true, newKey, message: 'Name unchanged.' });
  }

  try {
    if (!overwrite) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: newKey }));
        return res.status(409).json({ success: false, error: 'A file with that name already exists.' });
      } catch (e) {
        if (!(e instanceof NoSuchKey)) throw e;
      }
    }

    await s3.send(new CopyObjectCommand({
      Bucket: R2_BUCKET,
      CopySource: `${R2_BUCKET}/${oldKey}`,
      Key: newKey,
    }));
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: oldKey }));
    const newUrl = getPublicUrl(req, newKey);
    res.json({ success: true, newKey, url: newUrl });
  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).json({ success: false, error: 'Failed to rename file.' });
  }
});

// ── Library (paginated) ──
app.get('/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const token = req.query.token || undefined;
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      MaxKeys: limit,
      ContinuationToken: token,
    });
    const data = await s3.send(command);
    const files = (data.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      url: getPublicUrl(req, obj.Key),
    }));
    res.json({
      success: true,
      files,
      nextContinuationToken: data.NextContinuationToken || null,
      isTruncated: data.IsTruncated || false,
    });
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ success: false, error: 'Failed to list files.' });
  }
});

// ── Health check ──
app.get('/health', (_req, res) => res.send('ok'));

// ── Index route ──
app.get('/', serveIndexWithCSP);

// ── Global error handler ──
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Graceful shutdown & timeouts ──
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

server.timeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 0;

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => process.exit(0));
});
