# 🚀 APA 7 Citation Machine - Netlify Deployment Guide

Your APA citation machine has been **fully converted** to work on Netlify with serverless functions!

## ✅ What Changed

- ❌ **Removed**: `server.js` (persistent HTTP server)
- ✅ **Added**: Serverless functions in `netlify/functions/`
- ✅ **Kept**: ALL your original APA 7 formatting logic intact
- ✅ **Result**: Free, always-on hosting with no sleep mode

## 📁 File Structure

```
citation/
├── index.html              # Frontend interface
├── netlify.toml           # Netlify configuration
└── netlify/
    └── functions/
        ├── fetch-meta.js  # Scrapes websites for metadata
        └── generate.js    # Generates APA 7 citations
```

---

## 🎯 Deploy to Netlify (Step-by-Step)

### Step 1: Update Your GitHub Repo

1. **Delete** your old `server.js` file from the repo:
   ```bash
   git rm server.js
   ```

2. **Add** all the new files:
   ```bash
   git add .
   git commit -m "Converted to Netlify serverless functions"
   git push
   ```

### Step 2: Connect to Netlify

1. Go to **[https://app.netlify.com](https://app.netlify.com)**
2. Click **"Add new site"**
3. Click **"Import an existing project"**
4. Choose **GitHub** and authorize Netlify

### Step 3: Configure Build Settings

When asked for build settings:

- **Build command**: *Leave empty*
- **Publish directory**: `.` (just a period)
- Click **"Deploy"**

### Step 4: Wait for Deployment

⏳ Netlify will:
- Detect your `netlify.toml` config
- Build your serverless functions
- Deploy your site
- Give you a live URL like: `https://something-cool.netlify.app`

**Deployment time**: ~30-60 seconds

---

## ✅ What You Get

| Feature | Status |
|---------|--------|
| **Always On** | ✅ No sleeping |
| **Free** | ✅ Completely free |
| **Fast** | ✅ Global CDN |
| **Auto-Deploy** | ✅ Push to GitHub = auto-deploy |
| **HTTPS** | ✅ Free SSL certificate |
| **Website Scraping** | ✅ Still works |
| **APA 7 Logic** | ✅ 100% preserved |

---

## 🧪 Test Your Site

Once deployed, test these features:

1. **Fetch Metadata**
   - Enter a URL (e.g., `https://www.nature.com/articles/s41586-023-06221-2`)
   - Click "Fetch Metadata"
   - Should auto-fill citation fields

2. **Generate Citation**
   - Fill in citation details
   - Click "Generate Citation"
   - Should show reference + in-text citation

3. **Different Source Types**
   - Try: Website, Journal, Book, Newspaper, YouTube
   - All should format correctly per APA 7

---

## 🛠️ Troubleshooting

### "404 Not Found" after deploy

**Fix**: Make sure you pushed all files including `netlify.toml`

```bash
git add netlify.toml netlify/
git commit -m "Add Netlify config"
git push
```

### Functions not working

**Check**: 
1. In Netlify dashboard → Functions
2. You should see: `fetch-meta` and `generate`
3. If missing, check that `netlify/functions/` folder is in your repo

### "Cannot fetch metadata"

**Possible causes**:
- Target website blocks scraping (nothing you can do)
- Invalid URL format
- Website requires authentication

**This is normal** - not all websites allow scraping.

---

## 🎨 Customization

### Change Colors

Edit `index.html`, find this in the `<style>` section:

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

Replace with your preferred gradient.

### Add More Source Types

Edit `netlify/functions/generate.js` and add new `else if` blocks in the `buildCitation()` function.

---

## 📊 Limits (Netlify Free Tier)

| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB/month |
| Function runs | 125,000/month |
| Function duration | 10 seconds max |
| Build minutes | 300/month |

**For your citation machine**: These limits are MORE than enough for thousands of users.

---

## 🔒 Security Notes

- ✅ Serverless functions run in isolated containers
- ✅ No persistent server = smaller attack surface
- ✅ HTTPS by default
- ⚠️ No rate limiting built in (add if you get popular)

---

## 🚀 Next Steps

1. **Custom Domain** (optional)
   - Netlify Settings → Domain management
   - Add your own domain

2. **Analytics** (optional)
   - Netlify Analytics shows page views
   - Or add Google Analytics to `index.html`

3. **Rate Limiting** (if needed)
   - Use Netlify's built-in rate limiting
   - Or add logic in your functions

---

## 💡 Why This Is Better

| Old Setup | New Setup |
|-----------|-----------|
| ❌ Sleeps after 15 min | ✅ Always on |
| ❌ Requires server host | ✅ Serverless |
| ❌ Limited free tier | ✅ Generous free tier |
| ❌ Manual scaling | ✅ Auto-scales |
| ❌ HTTPS setup needed | ✅ HTTPS included |

---

## 📧 Support

If something's not working:

1. Check Netlify deploy logs
2. Check browser console (F12)
3. Check function logs in Netlify dashboard

---

**That's it!** Your citation machine is now production-ready on Netlify. 🎉
