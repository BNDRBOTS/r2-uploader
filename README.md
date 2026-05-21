# R2 Uploader

A clean, mobile‑first upload page for Cloudflare R2.  
Drag and drop images or videos, get instant public links, and manage your library.

## Features
- Drag‑and‑drop upload with progress bar
- Supports images (JPEG, PNG, GIF, WebP, SVG) and videos (MP4, WebM, MOV, AVI)
- File library with large thumbnails, full‑screen preview, and video playback
- Copy link button for every file
- Delete files directly from the library
- Works great on phones, tablets, and desktops

## How to Deploy
1. Use this repository as a template or copy the files.
2. Deploy to [Railway](https://railway.app) (or any Node.js host).
3. Add these environment variables:

   | Variable | Description |
   |---|---|
   | `R2_ENDPOINT` | Your Cloudflare R2 S3 endpoint (e.g., `https://<id>.r2.cloudflarestorage.com`) |
   | `R2_ACCESS_KEY_ID` | Access Key ID from an R2 API token with **Object Read & Write** permission |
   | `R2_SECRET_ACCESS_KEY` | Secret Access Key from the same token |
   | `R2_BUCKET_NAME` | The name of your R2 bucket |

4. Set the application port to **8080** (or the port your host assigns – the app listens on `process.env.PORT`).
5. Open the public URL – you’re ready to upload!

## No Custom Domain Required
The app uses its own URL to serve files. If you later want a custom domain like `images.yourdomain.com`, you can add it in Railway’s settings – the app will automatically use that domain in the generated links.

## Security
- Your R2 bucket remains **private**; the app proxies requests, so your credentials are never exposed to the browser.
- The upload page does **not** require a login – host it privately or protect it if needed.

## License
MIT – do whatever you want with it.
