R2 Uploader Setup Guide
Your Own Private Image & Video Host (No Coding Required)
This guide will walk you through creating a personal upload page where you can drag and drop images and videos, see them in a library, copy their links, and delete them. Everything is stored securely on Cloudflare R2 and served instantly via your own Railway app. You do not need a custom domain — the provided Railway URL works perfectly.

What You Will End Up With
A mobile‑friendly upload page with drag‑and‑drop and a progress bar.

A library tab that shows all your files with large thumbnails, a copy link button, and the ability to delete files.

Links you can use anywhere — in a store, website, or messages.

No monthly fees beyond your free Railway / Cloudflare usage (likely free for personal use).

Prerequisites
A Cloudflare account (free tier works).

A GitHub account (free).

A Railway account (free tier works).
You do not need to install anything on your computer — everything is done in your browser.

Step 1: Create Your R2 Bucket (Cloudflare)
Log in to your Cloudflare dashboard at dash.cloudflare.com.

In the left sidebar, click Storage & Databases → R2.

Click the Create bucket button.

Fill in:

Bucket name: my-store-images (or any name – write it down).

Location: Leave on Automatic.

Default Storage Class: Choose Standard.

Click Create bucket.
Your bucket is now ready, but it is private by default — only your app will access it.

Step 2: Create an API Token (Cloudflare)
This token allows your app to upload, list, and serve files from your bucket.

Still in the Cloudflare dashboard, go to R2 overview page.

Under Account Details, click Manage API tokens.

Click Create API token.

Choose Account API Tokens (recommended).

Set:

Token name: Uploader Token

Permissions: Object Read & Write

Specify bucket(s): Check the bucket you just created.

Leave Client IP Address Filtering empty.

Click Create API token.

You will see two values. Copy both immediately and save them somewhere safe (you will not see the Secret Key again):

Access Key ID

Secret Access Key

Step 3: Find Your S3 Endpoint (Cloudflare)
On the R2 overview page, you will see a box labelled Account Details.

Copy the full URL under S3 API. It looks like:
https://xxxxxxxxxxxxxxxxxxxxxxxxxx.r2.cloudflarestorage.com
This is your R2 Endpoint. Save it with the keys.

Step 4: Create a GitHub Repository and Add the App Files
Go to github.com and log in.

Click the + icon in the top right → New repository.

Name it r2-uploader (or whatever you like).
Do not check any boxes (no README, no .gitignore).
Keep visibility Public or Private – both work.

Click Create repository.

Now add three files using the Add file → Create new file button.

