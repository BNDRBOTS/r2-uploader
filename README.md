# R2 Uploader

A clean, mobile‑first upload page for Cloudflare R2.  
Drag and drop images or videos, get instant public links, and manage your library — with optional password protection that keeps your management interface private while leaving your file links wide open.

## Features

- **Multi‑file upload** (sequential, with progress bars)
- **True streaming** – handles files up to 5 GB without buffering
- **File library** with thumbnails, full‑screen preview, and video playback
- **Copy link button** for every file
- **Rename files** directly from the library (preserves original extension if omitted)
- **Delete files** with confirmation
- **Optional password protection** – add an `ACCESS_PASSWORD` environment variable to lock the uploader, library, rename, and delete. Your direct file links (`/files/...`) remain **fully public** so they work anywhere (websites, builders, Substack, etc.)
- No custom domain required – works perfectly with the Railway‑generated URL
- Free to run on Railway and Cloudflare R2

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](YOUR_TEMPLATE_URL)

Click the button, then set the required environment variables (see below).  
If you don’t set `ACCESS_PASSWORD`, the whole app stays open.

## Manual Setup

1. Create an R2 bucket in your Cloudflare dashboard (Storage & Databases → R2).
2. Generate an API token with **Object Read & Write** permission, scoped to that bucket.  
   Copy the **Access Key ID**, **Secret Access Key**, and your **S3 endpoint**.
3. Clone or fork this repository, then deploy it to Railway.
4. In your Railway service, go to the **Variables** tab and add the following environment variables:

| Variable | Required | Description |
|---|---|---|
| `R2_ENDPOINT` | Yes | Your R2 S3 endpoint (e.g., `https://<id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | Yes | The Access Key ID from your API token |
| `R2_SECRET_ACCESS_KEY` | Yes | The Secret Access Key from your API token |
| `R2_BUCKET_NAME` | Yes | The name of your R2 bucket |
| `ACCESS_PASSWORD` | No | If set, the uploader and all management actions will require this password. Direct file links remain public. |
| `MAX_FILE_SIZE_MB` | No | Maximum upload size in MB (default: 5000). |

5. In the service **Settings** → **Public Networking**, set the port to **8080** (the app listens on that port by default).
6. Open the generated Railway URL – you’re done.

## How It Works

- The app serves a frontend (`public/index.html`) for uploading and managing files.
- Uploaded files are streamed directly to your **private R2 bucket** using the S3‑compatible API.
- A built‑in proxy (`GET /files/:key`) fetches files from R2 and serves them publicly – even when password protection is on.
- If `ACCESS_PASSWORD` is set, all other routes (`/upload`, `/list`, `PATCH /files/:key`, `DELETE /files/:key`) require authentication via cookie.

## Password Protection Detail

When you define `ACCESS_PASSWORD`:
- Visiting the app shows a login screen.
- After entering the correct password, you get full access to the uploader, library, rename, and delete functions.
- **Copied file links** (like `https://your-app.up.railway.app/files/photo.jpg`) still work without any login – they are always public.

If you leave `ACCESS_PASSWORD` unset, the app behaves completely open, exactly like the original version.

## License

MIT – do whatever you want with it.
