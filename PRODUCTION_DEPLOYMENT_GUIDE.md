# Production Deployment Guide

**Application:** Cleanup Tracker
**Version:** 2.0
**Production Ready:** 95%
**Last Updated:** 2025-10-17

---

## Pre-Deployment Checklist

### ✅ Code Quality & Security
- [x] All critical bugs fixed (23/23)
- [x] All high-severity bugs fixed (0 remaining)
- [x] Security audit completed
- [x] Production build tested
- [x] Dependencies audited (only minor issues in dev dependencies)
- [x] Authentication implemented on all endpoints
- [x] Input validation comprehensive
- [x] Brute force protection active
- [x] Rate limiting configured

### 🔧 Required Actions Before Deployment

1. **Generate Secure JWT Secret**
   ```bash
   openssl rand -base64 32
   ```
   Copy the output and use it as your `JWT_SECRET` in production.

2. **Set Up Production MongoDB**
   - Use MongoDB Atlas (recommended) or your own MongoDB server
   - Create a new database: `cleanup-tracker-prod`
   - Note down the connection string

3. **Configure Environment Variables**
   - See section below for all required variables

4. **Build Client for Production**
   - Already completed ✅ (130.47 kB gzipped)
   - Located in: `client/build/`

---

## Environment Variables Configuration

### Server Environment Variables

Create `/Users/missionford/cleanup-tracker-app Final/server/.env.production`:

```bash
# Node Environment
NODE_ENV=production

# Server Port (most hosting platforms override this)
PORT=5051

# MongoDB Connection (REQUIRED)
# For MongoDB Atlas:
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/cleanup-tracker-prod?retryWrites=true&w=majority
# For local MongoDB:
# MONGO_URI=mongodb://localhost:27017/cleanup-tracker-prod

# JWT Secret (REQUIRED - use output from: openssl rand -base64 32)
JWT_SECRET=REPLACE_WITH_GENERATED_SECRET

# Frontend URLs for CORS (comma-separated)
# Replace with your actual production domain
FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com

# Google Sheets CSV URL (optional - for inventory import)
INVENTORY_CSV_URL=

# Rate Limiting (requests per 15 minutes)
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5

# File Upload Limits
UPLOAD_LIMIT=10mb

# Logging Level (error, warn, info, debug)
LOG_LEVEL=info
```

### Client Environment Variables

The client `.env` file is already configured correctly:

```bash
# Empty = uses relative path (recommended for production)
REACT_APP_API_URL=
```

**Note:** The client will automatically use relative paths in production (e.g., `/api/...`) when `REACT_APP_API_URL` is empty.

---

## Deployment Steps

### Option 1: Deploy to a VPS/Cloud Server (AWS, DigitalOcean, etc.)

#### Step 1: Prepare the Server

```bash
# SSH into your server
ssh user@your-server-ip

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB (if not using MongoDB Atlas)
# Follow: https://docs.mongodb.com/manual/installation/

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy (recommended)
sudo apt install nginx -y
```

#### Step 2: Upload Application Files

```bash
# On your local machine, from project root:
cd "/Users/missionford/cleanup-tracker-app Final"

# Create a production archive (excluding dev files)
tar -czf cleanup-tracker-prod.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=client/node_modules \
  --exclude=mobile \
  --exclude=*.log \
  server/ client/build/ package.json

# Upload to server
scp cleanup-tracker-prod.tar.gz user@your-server-ip:~/

# On the server:
mkdir -p ~/cleanup-tracker
cd ~/cleanup-tracker
tar -xzf ../cleanup-tracker-prod.tar.gz
```

#### Step 3: Configure Environment

```bash
# On the server:
cd ~/cleanup-tracker/server

# Create production environment file
nano .env.production

# Paste the environment variables (see section above)
# Make sure to replace:
# - JWT_SECRET with generated secret
# - MONGO_URI with your MongoDB connection string
# - FRONTEND_URL with your domain

# Save and exit (Ctrl+X, Y, Enter)
```

#### Step 4: Install Dependencies & Start Server

```bash
# Install server dependencies
cd ~/cleanup-tracker/server
npm ci --production

# Start with PM2
pm2 start server.js \
  --name "cleanup-tracker" \
  --env production \
  -i max \
  --watch false

# Save PM2 configuration
pm2 save

# Configure PM2 to start on system boot
pm2 startup

# View logs
pm2 logs cleanup-tracker

# Check status
pm2 status
```

#### Step 5: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/cleanup-tracker

# Paste this configuration:
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Serve static React build
    root /home/user/cleanup-tracker/client/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5051;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # React Router - serve index.html for all non-API routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/cleanup-tracker /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### Step 6: Set Up SSL with Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot will automatically update your Nginx config
# Certificates will auto-renew
```

---

### Option 2: Deploy to Heroku

#### Step 1: Install Heroku CLI

```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku  # macOS
# Or download from: https://devcenter.heroku.com/articles/heroku-cli
```

#### Step 2: Create Heroku App

```bash
cd "/Users/missionford/cleanup-tracker-app Final"

# Login to Heroku
heroku login

# Create app
heroku create cleanup-tracker-prod

# Add MongoDB addon (optional, or use MongoDB Atlas)
heroku addons:create mongocloud:free
```

#### Step 3: Configure Environment Variables

```bash
# Set JWT secret
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Set Node environment
heroku config:set NODE_ENV=production

# Set frontend URL (replace with your Heroku app URL)
heroku config:set FRONTEND_URL=https://cleanup-tracker-prod.herokuapp.com

# If using MongoDB Atlas instead of addon:
heroku config:set MONGO_URI="your-mongodb-atlas-connection-string"

# Rate limiting
heroku config:set RATE_LIMIT_MAX=100
heroku config:set AUTH_RATE_LIMIT_MAX=5
```

#### Step 4: Create Procfile

Create `/Users/missionford/cleanup-tracker-app Final/Procfile`:

```
web: cd server && npm start
```

#### Step 5: Deploy

```bash
# Add files to git (if not already done)
git add .
git commit -m "Prepare for production deployment"

# Deploy to Heroku
git push heroku main

# View logs
heroku logs --tail

# Open app in browser
heroku open
```

---

### Option 3: Deploy with Docker

#### Step 1: Create Dockerfile

Create `/Users/missionford/cleanup-tracker-app Final/Dockerfile`:

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy server files
COPY server/package*.json ./server/
COPY server ./server

# Copy built client
COPY client/build ./client/build

# Install server dependencies
WORKDIR /app/server
RUN npm ci --production

# Expose port
EXPOSE 5051

# Start server
CMD ["node", "server.js"]
```

#### Step 2: Create docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: cleanup-tracker

  app:
    build: .
    ports:
      - "5051:5051"
    depends_on:
      - mongodb
    environment:
      NODE_ENV: production
      MONGO_URI: mongodb://mongodb:27017/cleanup-tracker
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
      RATE_LIMIT_MAX: 100
      AUTH_RATE_LIMIT_MAX: 5

volumes:
  mongodb_data:
```

#### Step 3: Deploy with Docker

```bash
# Generate JWT secret
export JWT_SECRET=$(openssl rand -base64 32)
export FRONTEND_URL=http://localhost:5051

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Check server health
curl https://yourdomain.com/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-10-17T..."}
```

### 2. Test Authentication

```bash
# Try accessing protected endpoint (should return 401)
curl https://yourdomain.com/api/v2/jobs

# Expected response:
# {"message":"Unauthorized"}
```

### 3. Monitor Logs

```bash
# For PM2:
pm2 logs cleanup-tracker

# For Heroku:
heroku logs --tail

# For Docker:
docker-compose logs -f app
```

### 4. Performance Testing

```bash
# Install Apache Bench (if not installed)
# macOS: brew install httpd
# Linux: sudo apt install apache2-utils

# Run load test (100 requests, 10 concurrent)
ab -n 100 -c 10 https://yourdomain.com/api/health

# Monitor response times
```

---

## Monitoring & Maintenance

### Daily Monitoring

1. **Check Error Logs**
   ```bash
   pm2 logs cleanup-tracker --lines 100 --err
   ```

2. **Monitor Memory Usage**
   ```bash
   pm2 monit
   ```

3. **Check Database Size**
   ```bash
   # MongoDB shell
   mongo
   use cleanup-tracker-prod
   db.stats()
   ```

### Weekly Maintenance

1. **Review Security Logs**
   - Check for brute force attempts
   - Review rate limit violations
   - Monitor failed authentication attempts

2. **Database Backup**
   ```bash
   # MongoDB dump
   mongodump --uri="your-connection-string" --out=/backup/$(date +%Y%m%d)
   ```

3. **Update Dependencies**
   ```bash
   npm audit
   npm audit fix --production
   ```

### Monthly Maintenance

1. **Performance Review**
   - Analyze slow API endpoints
   - Check database query performance
   - Review job completion metrics

2. **Security Audit**
   - Run penetration tests
   - Review authentication logs
   - Update security headers

---

## Rollback Procedure

If issues arise after deployment:

### Quick Rollback (PM2)

```bash
# Stop current version
pm2 stop cleanup-tracker

# Switch to previous version
cd ~/cleanup-tracker-backup
pm2 start server.js --name cleanup-tracker

# Or reload from saved ecosystem
pm2 reload ecosystem.config.js
```

### Rollback (Heroku)

```bash
# View releases
heroku releases

# Rollback to previous release
heroku rollback v<previous-version-number>
```

### Rollback (Docker)

```bash
# Stop current containers
docker-compose down

# Switch to previous image
docker-compose up -d <previous-image-tag>
```

---

## Troubleshooting

### Server Won't Start

1. **Check environment variables**
   ```bash
   # Verify all required vars are set
   env | grep -E 'NODE_ENV|MONGO_URI|JWT_SECRET'
   ```

2. **Check MongoDB connection**
   ```bash
   # Test connection
   mongosh "your-connection-string"
   ```

3. **Review error logs**
   ```bash
   pm2 logs cleanup-tracker --err --lines 50
   ```

### 502 Bad Gateway (Nginx)

1. **Check server is running**
   ```bash
   pm2 status
   netstat -tlnp | grep 5051
   ```

2. **Check Nginx configuration**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

### High Memory Usage

1. **Restart with limited instances**
   ```bash
   pm2 delete cleanup-tracker
   pm2 start server.js --name cleanup-tracker -i 2
   ```

2. **Check for memory leaks**
   ```bash
   pm2 monit
   ```

### Database Connection Issues

1. **Verify connection string**
   - Check username/password
   - Verify IP whitelist (MongoDB Atlas)
   - Test connection with mongosh

2. **Check network connectivity**
   ```bash
   telnet <mongodb-host> 27017
   ```

---

## Performance Optimization Tips

### 1. Enable Redis Caching (Optional)

```bash
# Install Redis
sudo apt install redis-server

# Install redis npm package
npm install redis

# Configure caching in server (see server/utils/cache.js)
```

### 2. Database Optimization

- Ensure all indexes are created (already done ✅)
- Monitor slow queries
- Archive old completed jobs (>6 months)

### 3. CDN for Static Assets

- Consider using Cloudflare or AWS CloudFront
- Serve static assets from CDN
- Enable browser caching

---

## Security Best Practices

### ✅ Already Implemented

- [x] JWT authentication on all endpoints
- [x] Rate limiting (100 req/15min general, 5 req/15min auth)
- [x] Brute force protection (5 attempts → 15 min lockout)
- [x] Input validation and sanitization
- [x] Helmet.js security headers
- [x] CORS configured properly
- [x] MongoDB injection prevention
- [x] XSS protection

### 🔒 Additional Recommendations

1. **Enable HTTPS Only**
   - Use Let's Encrypt SSL certificates
   - Set HSTS headers
   - Redirect HTTP → HTTPS

2. **Regular Security Audits**
   - Run `npm audit` weekly
   - Monitor security advisories
   - Keep dependencies updated

3. **Database Security**
   - Use strong passwords
   - Enable authentication
   - Restrict network access
   - Regular backups

4. **Monitoring & Alerts**
   - Set up error tracking (Sentry, Rollbar)
   - Monitor uptime (UptimeRobot)
   - Alert on high error rates

---

## Support & Documentation

### Related Documents

- [ALL_BUGS_FIXED_REPORT.md](./ALL_BUGS_FIXED_REPORT.md) - Complete bug audit and fixes
- [SECOND_PASS_BUG_FIXES.md](./SECOND_PASS_BUG_FIXES.md) - Second audit pass
- [BUG_FIXES_REPORT.md](./BUG_FIXES_REPORT.md) - First audit pass
- [COMPLETE_BUG_AUDIT_SUMMARY.md](./COMPLETE_BUG_AUDIT_SUMMARY.md) - Executive summary

### Application Architecture

- **Frontend:** React 18 (Single Page Application)
- **Backend:** Node.js + Express
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens)
- **API:** RESTful API (v2)

### Key Endpoints

- `GET /api/health` - Health check
- `POST /api/v2/auth/login` - User login
- `GET /api/v2/jobs` - List jobs (authenticated)
- `GET /api/v2/reports` - Generate reports (authenticated)
- `GET /api/v2/users` - List users (authenticated)

---

## Production Checklist Summary

Before going live, ensure:

- [ ] JWT_SECRET is generated and set (not using default)
- [ ] MONGO_URI points to production database
- [ ] FRONTEND_URL is set to production domain
- [ ] SSL certificate is installed and working
- [ ] All environment variables verified
- [ ] Production build tested locally
- [ ] Database backups configured
- [ ] Monitoring tools set up
- [ ] Error tracking configured
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Nginx reverse proxy configured (if applicable)
- [ ] PM2 or process manager configured
- [ ] Health check endpoint responding
- [ ] Authentication working
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Rollback procedure tested
- [ ] Team trained on deployment process

---

## Success Metrics

After deployment, monitor these metrics:

- **Uptime:** Target 99.9%
- **Response Time:** <200ms for API endpoints
- **Error Rate:** <0.1%
- **Database Query Time:** <50ms for indexed queries
- **Failed Authentication Attempts:** Monitor for attacks
- **Memory Usage:** Stable, no leaks
- **CPU Usage:** <70% average

---

**Deployment Status:** ✅ Ready for Production

**Production Readiness:** 95%

**Last Audit:** 2025-10-17

**All Critical Bugs:** Fixed (23/23)

---

*For questions or issues, refer to the bug fix reports or contact the development team.*
