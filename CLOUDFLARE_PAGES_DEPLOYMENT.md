# Cloudflare Pages Deployment Guide

This guide walks you through deploying the HeroByte client to Cloudflare Pages.

## Prerequisites

- GitHub repository with the HeroByte code
- Cloudflare account (free tier works)
- Server already deployed on Render (or another platform)

## Step 1: Create a Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Create application** → **Pages**
3. Click **Connect to Git**
4. Select your repository (`loshunter/HeroByte`)
5. Click **Begin setup**

## Step 2: Configure Build Settings

### Basic Settings
- **Project name**: `herobyte` (or your preferred name)
- **Production branch**: `main`

### Build Configuration

Click **Show advanced** and configure:

- **Root directory (advanced)**: `apps/client`
  - This tells Cloudflare to build from the monorepo's client directory

- **Build command**:
  ```bash
  pnpm install --frozen-lockfile && pnpm build
  ```
  - This installs dependencies and builds the client (which also builds the shared package)

- **Build output directory**: `dist`
  - Vite outputs the built files to the `dist` directory

### Environment Variables

Add the following environment variable:

| Variable Name | Value |
|--------------|-------|
| `VITE_WS_URL` | `wss://herobyte-server.onrender.com` |

**Important**: Use `wss://` (WebSocket Secure) not `ws://` for production.

## Step 3: Deploy

1. Click **Save and Deploy**
2. Cloudflare Pages will:
   - Clone your repository
   - Install dependencies with pnpm
   - Build the client application
   - Deploy to a global CDN

The initial deployment takes 2-5 minutes.

## Step 4: Test Your Deployment

1. Once deployed, Cloudflare will provide a URL like: `https://herobyte.pages.dev`
2. Open the URL in your browser
3. The client should connect to your Render server via WebSocket
4. Test basic functionality:
   - Add tokens to the map
   - Move tokens around
   - Draw on the canvas
   - Roll dice

## Troubleshooting

### Build Fails

If the build fails, check:
- The build logs in Cloudflare Pages dashboard
- Ensure `Root directory` is set to `apps/client`
- Verify the build command is correct

### WebSocket Connection Fails

If the app loads but doesn't connect:
- Check browser console for errors (F12)
- Verify `VITE_WS_URL` is set correctly in Cloudflare Pages settings
- Ensure your Render server is running
- Confirm you're using `wss://` not `ws://`

### Blank Page

If you see a blank page:
- Check browser console (F12) for JavaScript errors
- Verify the build output directory is `dist`
- Check that the build succeeded in Cloudflare Pages logs

## Custom Domain (Optional)

To use your own domain:

1. In Cloudflare Pages → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain name
4. Follow the DNS configuration instructions
5. Cloudflare automatically provisions SSL certificates

## Continuous Deployment

Every time you push to the `main` branch, Cloudflare Pages will automatically:
1. Detect the push
2. Run the build
3. Deploy the new version

You can also create preview deployments for other branches in the Pages settings.

## Performance

Cloudflare Pages provides:
- **Global CDN**: Your app is served from 275+ edge locations worldwide
- **Automatic SSL**: HTTPS is enabled by default
- **Unlimited bandwidth**: No bandwidth charges on the free tier
- **Fast builds**: Typical build times are 1-3 minutes
- **Instant rollbacks**: Revert to any previous deployment with one click

## Next Steps

- Set up a custom domain
- Configure branch preview deployments for testing
- Monitor deployment logs in the Cloudflare dashboard
- Consider enabling Cloudflare Web Analytics
