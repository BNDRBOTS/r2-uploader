const express = require('express');
const { S3Client, GetObjectCommand, NoSuchKey } = require('@aws-sdk/client-s3');

const app = express();

// --- Configuration ---
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Validate essential environment variables
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    console.error("Missing required environment variables. Please check your Railway configuration.");
    process.exit(1);
}

// --- S3 Client ---
const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
});

// --- Routes ---
app.get('/:key', async (req, res) => {
    const key = req.params.key; // The filename in your bucket

    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });
        const response = await s3.send(command);

        // Set headers for long-term caching and CORS
        res.set({
            'Content-Type': response.ContentType || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        });

        if (response.ContentLength) {
            res.set('Content-Length', response.ContentLength.toString());
        }

        // Stream the file directly to the client
        response.Body.pipe(res);
    } catch (error) {
        if (error instanceof NoSuchKey) {
            return res.status(404).send('File not found');
        }
        console.error(`Error fetching file "${key}":`, error);
        res.status(500).send('Internal Server Error');
    }
});

// Handle CORS preflight requests
app.options('/:key', (req, res) => {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=86400',
    });
    res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`R2 proxy server listening on port ${PORT}`);
});
