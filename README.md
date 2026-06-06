# R2 Uploader Storage

**A private file portal to upload, preview, rename, and share images, videos, docs, and archives — all stored securely on your own Cloudflare R2 bucket, with password protection, dark mode, and drag‑and‑drop ease.**

### REAL QUICK → I’m using Railway's $5 Hobby Membership here because it’s the method I personally used for this setup and it's worked well for me so far.
→ Feel free to use whatever host you want.
- This guide follows the Railway path because that's the path that’s worked for me.
- Any other links provided in this setup are purely there for your convenience.
- I gain nothing from the clicks or any sign-ups of other links provided below.

### Full disclosure: the Railway links below are attached to my affliate link with them.
- You get $20 in Railway credits when you sign up through it.
- If you later become a paying Railway customer, I’ll earn 15% commission on the invoices you pay for
the first 12 months. 

## Deploy in Minutes

You don’t need to be a developer – just follow these super simple steps!

### 1. Get a Cloudflare R2 Bucket (Free Storage)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and sign up (it's free).
2. On the left menu, click **R2**.
3. Click **Create bucket**, give it a name (like `my-uploads`), and leave the default settings.
4. Click **Create bucket**.
5. In the R2 menu, click **Manage R2 API Tokens**.
6. Click **Create API Token**.
7. Give it a name, set permissions to **Object Read & Write**, then click **Create Token**.
8. **Copy and save these three values** somewhere safe:
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint** (looks like `https://<accountid>.r2.cloudflarestorage.com`)

### 2. Deploy on Railway (Free Hosting)
1. Go to [Railway.app](https://railway.com?referralCode=jARGAL) and sign up with GitHub (it's free).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Paste this repository’s URL: `https://github.com/your-username/r2-uploader` (or fork it first).
4. Click **Deploy Now** – Railway will build and run the app automatically.

### 3. Add the Secret Environment Variables
1. In your Railway project, click the **Variables** tab.
2. Click **New Variable** and add these:
   - `R2_ENDPOINT` = the Endpoint you saved
   - `R2_ACCESS_KEY_ID` = the Access Key ID
   - `R2_SECRET_ACCESS_KEY` = the Secret Access Key
   - `R2_BUCKET_NAME` = the bucket name you created (default is `bndrllc-store-images`)
   - `ACCESS_PASSWORD` = a password you will use to login (optional; if empty, no password needed)
3. Railway will **redeploy automatically** – wait 30 seconds.

### 4. Open Your Uploader!
1. In [Railway.app](https://railway.com?referralCode=jARGAL), click the **Deploy** tab, then click the **public URL** (looks like `https://...up.railway.app`).
2. If you set a password, you’ll see a login screen. Enter your `ACCESS_PASSWORD`.
3. Start uploading by dragging files or clicking the drop zone. That’s it! 🎉

---

## Features

- **Password protection** – keep your files private (or leave it open if you want).
- **Drag‑and‑drop uploads** – images, videos, PDFs, ZIPs (up to 5 GB each).
- **Real‑time progress bars** for every file.
- **Instant previews** – click any image/video to view it full size.
- **Rename & delete** files directly from the gallery.
- **Copy file links** with one click to share with anyone.
- **Dark mode** – switch between light and dark with a button.
- **Search & sort** your library instantly.
- **Select multiple files** and delete them in bulk.
- Works perfectly on **phones, tablets, and computers**.

---

## Customising the Setup

- **Change the max file size**: Add a variable `MAX_FILE_SIZE_MB` (number, e.g. `10` for 10 MB). Default is 5000 MB.
- **No password**: simply remove the `ACCESS_PASSWORD` variable – anyone can access the page.
- **Custom bucket name**: set `R2_BUCKET_NAME` to whatever you want.

---

## 🧑‍💻 Running Locally (for Nerds 🤓)

```bash
git clone https://github.com/your-username/r2-uploader
cd r2-uploader
npm install
# create a .env file with the 4 variables above
npm start
```
Open `http://localhost:3000`.

---

## 📜 License

MIT – do whatever you want, but don’t blame me if your cat deletes your files.

---
