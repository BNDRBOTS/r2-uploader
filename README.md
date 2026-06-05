# R2 Uploader

A simple, mobile-friendly tool that lets you upload images, videos, PDFs, and ZIP files, get permanent public links, and manage them all in a private library. No custom domain needed – the Railway‑provided URL works perfectly.  
Optionally add a password to lock the upload page and management features while your file links stay open and usable anywhere.

---

## Features

- **Two‑tab interface**: Upload (drag‑and‑drop, progress bars, multiple files) and Library (thumbnails, full‑screen preview, video playback)
- **Multi‑file upload** – pick several files at once or drag a whole folder; they upload one after another with live progress
- **True streaming** – even files up to 5 GB upload without slowing down your browser
- **File library with thumbnails**
  - Images and videos show a preview; click to see them full‑screen
  - PDFs and ZIPs appear with a file icon; click to open/download directly
- **Copy link button** – every file gets a stable, public URL. Tap the **Copy** button to copy it instantly.
- **Rename files** – click the pencil icon, type a new name (extension optional), and the link updates without breaking existing links
- **Delete files** – click the trash icon; a confirmation pop‑up prevents accidental deletion
- **Optional password protection** – add an `ACCESS_PASSWORD` environment variable and the upload page, library, rename, and delete will require that password. **All direct file links (e.g., `…/files/photo.jpg`) remain fully public**, so you can use them in websites, emails, builders, etc.
- **Forgot password helper** – a “Forgot password?” link on the login screen shows simple steps to reset the password via Railway
- **Pagination** – when you have many files, the library shows 20 per page with Previous/Next buttons, keeping it fast and responsive
- **Mobile‑first design** – works great on phones, tablets, and desktops
- **No hidden costs** – runs on Cloudflare R2 (free storage and bandwidth for personal use) and Railway ($5 Hobby plan or free credits)

---

## What You’ll Need

- A **Cloudflare** account (free tier is enough)
- A **GitHub** account (free)
- A **Railway** account (the $5 Hobby plan works, free credits may also work – I use the Hobby plan)
- About 15 minutes – everything is done in your browser, nothing to install

**Disclaimer:** I use a $5 Railway Hobby Membership. I’m still testing how much of my credits this uses.  
*(Full disclosure: the Railway link below is my affiliate link. You get $20 in Railway credits when you sign up through it. If you later become a paying Railway customer, I may earn a commission for the first 12 months. I’m using Railway because it worked well for me. Feel free to use any host you want – this guide follows the Railway path.)*

---

## Quick Setup (One‑Click)

1. Click the green **“Use this template”** button at the top of this repository to create your own copy on GitHub.
2. Log in to [Railway]([https://railway.app?referral=…](https://railway.com?referralCode=jARGAL)) and click **New Project → Deploy from GitHub repo**.
3. Select your new repository. Railway will start building (it might show “Application failed to respond” at first – that’s okay).
4. Add the required environment variables (see below).
5. Set the public port to **8080**.
6. Open the generated Railway URL – your uploader is live!

## Manual Setup (Step‑by‑Step)

If you prefer a detailed walkthrough, follow these steps.

### Step 1: Create an R2 Bucket (Cloudflare)

1. Log in to your Cloudflare dashboard at [dash.cloudflare.com](https://dash.cloudflare.com).
2. In the left sidebar, click **Storage & Databases** → **R2**.
3. Click the **Create bucket** button.
4. Fill in:
   - **Bucket name:** anything you like (write it down – e.g., `my-store-images`)
   - **Location:** leave on **Automatic**
   - **Default Storage Class:** choose **Standard**
5. Click **Create bucket**.  
   Your bucket is ready but private – only your app will access it.

### Step 2: Create an API Token (Cloudflare)

This token lets your app upload, list, and serve files.

1. Still on the R2 overview page, under **Account Details**, click **Manage API tokens**.
2. Click **Create API token**.
3. Choose **Account API Tokens** (recommended).
4. Fill in:
   - **Token name:** `Uploader Token`
   - **Permissions:** **Object Read & Write**
   - **Specify bucket(s):** check the bucket you just created
5. Leave **Client IP Address Filtering** empty.
6. Click **Create API token**.
7. **Copy both values immediately** and save them somewhere safe (you won’t see the Secret Key again):
   - **Access Key ID**
   - **Secret Access Key**

### Step 3: Find Your R2 Endpoint URL

On the same R2 overview page, under **Account Details**, copy the full URL under **S3 API**. It looks like:  
`https://xxxxxxxxxxxxxxxxxxxxxxxxxx.r2.cloudflarestorage.com`  
This is your **R2 Endpoint**. Save it with the keys.

### Step 4: Create a GitHub Repository with the App Files

1. If you used the “Use this template” button, you already have the files. Skip to Step 5.  
   Otherwise, create a new repository on GitHub and manually add the three files from this repository:
   - `package.json`
   - `server.js`
   - `public/index.html` (make sure to create the `public` folder by typing `public/index.html` as the filename)

   Copy the exact contents from the corresponding files in this template repository.  
   *If you are unsure, just use the “Use this template” button – it’s the simplest way.*

### Step 5: Deploy to Railway

1. Go to [Railway]([https://railway.app?referral=…](https://railway.com?referralCode=jARGAL)) and log in.
2. Click **New Project → Deploy from GitHub repo**.
3. Choose the repository you just created.
4. Railway will start building. The first attempt may show “Application failed to respond” – don’t worry, we need to add the secret keys and fix the port.

#### Add Environment Variables

1. Inside your Railway project, click on the **service card** (it has a name like `r2-uploader`).
2. Go to the **Variables** tab.
3. Click **New Variable** and add the following exactly as typed (case‑sensitive):

   | Variable | Value |
   |---|---|
   | `R2_ENDPOINT` | Your S3 endpoint (e.g., `https://...r2.cloudflarestorage.com`) |
   | `R2_ACCESS_KEY_ID` | The Access Key ID from Step 2 |
   | `R2_SECRET_ACCESS_KEY` | The Secret Access Key from Step 2 |
   | `R2_BUCKET_NAME` | The name of your bucket (e.g., `my-store-images`) |
   | `ACCESS_PASSWORD` | *(optional)* Set a password to protect the uploader. If left empty, no password is required. |
   | `MAX_FILE_SIZE_MB` | *(optional)* Maximum upload size in MB (default is 5000). Set a lower value (e.g., 500) to avoid accidental giant uploads. |

   After adding them, Railway will redeploy automatically.

#### Fix the Port

1. Still in the service page, click the **Settings** tab.
2. In the **Public Networking** section, you’ll see a generated domain and a port field.
3. Click the pencil/edit icon next to the port and change it to **`8080`**.
4. Save. Railway will restart the app.

After a few seconds, the domain should show a green checkmark. If it still says “failed to respond”, check the **Deployments** tab → **View Logs** for errors (usually a missing or misspelled environment variable).

---

## Using Your Uploader

1. Open the Railway domain (e.g., `https://your-app.up.railway.app`) in any browser – phone, tablet, or desktop.
2. If you set an `ACCESS_PASSWORD`, you’ll see a login screen. Enter the password to unlock the uploader.
3. You’ll see two tabs: **Upload** and **Library**.

### Upload Tab
- Drag one or more files onto the dashed area, or click to choose files.
- Each file shows a progress bar as it uploads.
- When finished, a green success message appears with a direct link to the file.

### Library Tab
- Shows all your uploaded files, 20 per page.
- For images/videos: click the thumbnail to see a full‑screen preview.
- For PDFs/ZIPs: click the file icon to open or download the file.
- Each file has:
  - A **Copy** button – tap to copy the public URL.
  - A **Rename** button (pencil icon) – change the filename. If you don’t type an extension, the original one is kept.
  - A **Delete** button (trash icon) – removes the file permanently after confirmation.

**Important:** If you set a password, the upload page and library are protected, but the file links (e.g., `https://your-app.up.railway.app/files/photo.jpg`) are always public. You can paste them anywhere and they’ll work.

---

## What to Do If You Forgot Your Password

1. On the login screen, click **Forgot password?**.
2. A message will appear with instructions:
   - Go to your Railway dashboard → your service → **Variables** tab.
   - Find the `ACCESS_PASSWORD` variable and change it to a new value.
   - Railway will redeploy automatically.
3. Go back to your upload page and log in with the new password.

No need to change any code.

---

## Allowed File Types

By default, you can upload these file types:
- **Images:** JPEG, PNG, GIF, WebP, SVG
- **Videos:** MP4, WebM, MOV, AVI
- **Documents/Archives:** PDF, ZIP

The app automatically detects file types and displays them properly in the library.

---

## Common Pitfalls (If Something Goes Wrong)

- **Port mismatch:** The app must be exposed on port **8080**. If you see “Application failed to respond”, double‑check the port in Railway’s Public Networking settings.
- **Environment variable typos:** Variable names are case‑sensitive. They must be exactly `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`. Even a missing letter will crash the app.
- **Unsupported file type error:** The app will reject files with extensions not in the allowed list. If you need additional types (like RAR, 7z, DOCX), you’ll need to modify the `server.js` file.
- **Upload stalls at a few percent:** This is a known issue with some older browsers. The code uses true streaming to avoid buffering; if you encounter it, try a different browser or check your internet connection.
- **Railway free tier limits:** The app uses very few resources. With the free trial credits ($5) or the Hobby plan ($5/month), you’ll likely stay within the limits. If you’re concerned, set `MAX_FILE_SIZE_MB` to a smaller value (e.g., 500) to avoid accidental giant uploads.

---

## Optional: Use Your Own Domain

If you own a domain like `images.yourdomain.com`, you can attach it to your Railway service instead of the `railway.app` URL:

1. In your service’s **Settings → Public Networking**, click **+ Custom Domain**.
2. Enter `images.yourdomain.com`.
3. Railway will show a CNAME and TXT record. Add these to your domain’s DNS settings (wherever you bought the domain).
4. Once verified, your uploader will work under your own domain, and all generated links will automatically use it.

---

## License

MIT – do whatever you want with it.

---

You’re all set! You now have a professional, private media host that you control completely. Share the Railway URL (or your custom domain) with yourself only – the uploader is password‑protected (if you enabled it), but your file links remain open to use wherever you need them.
