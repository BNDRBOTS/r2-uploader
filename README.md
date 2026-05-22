# R2 Uploader

A clean, mobile‑first upload page for Cloudflare R2. Drag and drop images or videos, get instant public links, and manage your library.

## Features
- Multi‑file upload (sequential)
- True streaming – handles files up to 5 GB without buffering
- File library with thumbnails, full‑screen preview, video playback
- Copy link button, delete files
- No custom domain required – works with the Railway URL

## One‑Click Deploy
[![Deploy on Railway](https://railway.app/button.svg)](YOUR_TEMPLATE_URL)

Click the button, then set these environment variables:
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## Manual Setup
1. Create an R2 bucket and API token (Object Read & Write).
2. Deploy this repo to Railway.
3. Add the environment variables above.
4. Set the public port to **8080**.
5. Open the generated URL.
