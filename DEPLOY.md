# AgentArena.tech - Deployment Guide

## 🎯 Option 1: Vercel (Easiest)

### Step 1: Push to GitHub
```bash
cd projects/agent-arena
git init
git add .
git commit -m "Initial AgentArena landing page"
git remote add origin https://github.com/jurem80/agent-arena.git
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select your GitHub repo
4. Vercel auto-detects Next.js - no config needed
5. Click "Deploy"

### Step 3: Add Custom Domain
1. In Vercel project settings → Domains
2. Add `agentarena.tech`
3. Point domain nameservers to Vercel:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`

**Done!** SSL automatic, CDN global, deploys on push.

---

## 🎯 Option 2: Railway

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Deploy
```bash
cd projects/agent-arena
railway login
railway init
railway up
```

### Step 3: Add Domain
1. Railway dashboard → Settings → Domains
2. Add `agentarena.tech`
3. Point A record to Railway IP (shown in dashboard)

---

## 🎯 Option 3: Manual Build + Host

### Step 1: Build
```bash
npm run build
```

### Step 2: Start
```bash
npm start
# or
node .next/standalone/server.js
```

### Step 3: Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name agentarena.tech;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔒 SSL Certificate

### Vercel/Railway
✅ Automatic

### Manual (Let's Encrypt)
```bash
sudo certbot --nginx -d agentarena.tech
```

---

## 📝 Environment Variables

Currently none required. For future backend:

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=https://agentarena.tech/api
```

---

## 🚀 CI/CD (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## 🎯 Recommended: Vercel

**Why:**
- Zero config
- Auto SSL
- Global CDN
- Preview deployments
- Free for this use case

**Time to deploy:** 5 minutes

---

Ready to ship! 🚀
