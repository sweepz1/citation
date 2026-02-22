# ⚡ QUICK DEPLOY CHECKLIST

## Before You Start
- [ ] Delete `server.js` from your repo (if it exists)
- [ ] Download all files from Claude
- [ ] Have GitHub account ready

---

## 5-Minute Deployment

### 1️⃣ Update Your Repo (2 minutes)

```bash
# In your citation repo folder:
git rm server.js  # Delete old server file
git add .
git commit -m "Converted to Netlify functions"
git push
```

### 2️⃣ Deploy to Netlify (3 minutes)

1. Go to **https://app.netlify.com**
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** → Select **sweepz1/citation** repo
4. Build settings:
   - Build command: *Leave empty*
   - Publish directory: `.`
5. Click **"Deploy"**

### 3️⃣ Done! ✅

Wait ~30 seconds. You'll get a URL like:
`https://your-site-name.netlify.app`

---

## ✅ Test Checklist

- [ ] Visit your Netlify URL
- [ ] Enter a URL and click "Fetch Metadata"
- [ ] Fill in citation details
- [ ] Click "Generate Citation"
- [ ] Copy citation to clipboard

---

## 🔥 What's Working Now

✅ **No more "Cannot GET /"**
✅ **No sleep mode**
✅ **Always online**
✅ **Free forever**
✅ **Auto-deploys from GitHub**

---

## 📁 Files You Need

Make sure your repo has:
```
citation/
├── index.html
├── netlify.toml
└── netlify/
    └── functions/
        ├── fetch-meta.js
        └── generate.js
```

❌ **DELETE**: server.js

---

## 🆘 Having Issues?

1. **Deploy failed?**
   - Check you pushed `netlify.toml`
   - Check `netlify/functions/` folder exists

2. **404 error?**
   - Wait 1-2 minutes after deploy
   - Try hard refresh (Ctrl+Shift+R)

3. **Functions not working?**
   - Check Netlify dashboard → Functions tab
   - Should see 2 functions listed

---

**Total time**: ~5 minutes
**Cost**: $0
**Uptime**: 99.99%+

🎉 **Your citation machine is now production-ready!**
