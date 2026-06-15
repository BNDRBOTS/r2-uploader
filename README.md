# **R2 Uploader Storage**

**A deeply optimized, private asset registry. Upload, inspect, mutate, and distribute binaries safely onto an edge-distributed Cloudflare R2 bucket.**

Security & speed optimized. Features timing-attack defense, CSP strict bindings, nonce architecture, cross-origin isolation, and CSS `aspect-ratio` fluid layouts.

## **Deployment Pathway**

### **1\. Provision Cloudflare R2 (Object Store)**

1. Navigate to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and authorize access.  
2. Under the sidebar, select **R2**.  
3. Initialize **Create bucket**, dictate an identifier (e.g., `edge-assets`), and commit.  
4. From the root R2 menu, navigate to **Manage R2 API Tokens**.  
5. Select **Create API Token**.  
6. Designate permissions strictly to **Object Read & Write**, then confirm.  
7. **Securely vault** the emitted credentials:  
   * **Access Key ID**  
   * **Secret Access Key**  
   * **Endpoint** `https://<accountid>.r2.cloudflarestorage.com`

### **2\. Node Provisioning (Railway.app logic route)**

1. Authenticate at [Railway.app](https://railway.com?referralCode=jARGAL).  
2. Provision a **New Project** → **Deploy from GitHub repo**.  
3. Supply the repository target: `https://github.com/your-username/r2-uploader`  
4. Execute **Deploy**.

### **3\. Inject Environment Keys**

1. Target the environment **Variables** panel within your project.  
2. Commit the following secure keys:  
   * `R2_ENDPOINT` \= *vaulted Endpoint*  
   * `R2_ACCESS_KEY_ID` \= *vaulted Access Key*  
   * `R2_SECRET_ACCESS_KEY` \= *vaulted Secret Access Key*  
   * `R2_BUCKET_NAME` \= *dictated bucket identifier*  
   * `ACCESS_PASSWORD` \= *strict alphanumeric authentication token for backend access*  
3. The platform will execute an automatic redeployment pipeline.

### **4\. Engage**

1. Trigger the generated **public URL** output.  
2. Authenticate the barrier sequence using `ACCESS_PASSWORD`.  
3. Distribute binaries into the dropzone.

## **Core Systems**

* **Cryptographic Barrier** – Timing-safe SHA-256 validation prevents algorithmic leakage against payload attacks.  
* **Multipart Stream Uploads** – Pipeline handles deep processing natively without locking memory allocations (up to 5 GB streams).  
* **Asynchronous Processing Bars** – CSS transition optimized tracking for sequence progression.  
* **Zero-Latency Modals** – Unlocks binary views directly inside the application structure.  
* **Dynamic Mutation & Destruction** – Full rename capabilities mapped against native bucket clones, alongside bulk array destruction logic.  
* **Theme Subsystem** – Pure CSS variable adaptation logic scaling automatically from root preferences or manual toggles.  
* **Hardware-Agnostic Viewports** – Strict scaling parameters down to 320px frame widths without CSS overflow.

## **Override Parameters**

* **Limit Bypass**: Define `MAX_FILE_SIZE_MB` inside variables. Default locks at 5000 MB.  
* **Barrier Deactivation**: Detach the `ACCESS_PASSWORD` variable completely for pure public ingress.  
* **Array Targeting**: Ensure `R2_BUCKET_NAME` is strictly accurate.

## **Sandbox (Local Execution)**

git clone \[https://github.com/your-username/r2-uploader\](https://github.com/your-username/r2-uploader)  
cd r2-uploader  
npm install  
\# Construct .env file embedding target keys.  
npm start

Access via `http://localhost:3000`.

## **📜 License**

MIT
