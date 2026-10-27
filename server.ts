import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { authRouter } from './server/authRoutes.ts';
import { dataRouter } from './server/dataRoutes.ts';
import { getActiveSmsProvider } from './server/smsService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Suppress benign internal Firestore idle stream timeout warnings
const filterBenignFirestoreLogs = (method: 'warn' | 'error') => {
  const original = console[method];
  console[method] = (...args: any[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (
      msg.includes('Disconnecting idle stream') ||
      msg.includes('Timed out waiting for new targets') ||
      msg.includes('GrpcConnection RPC') ||
      (msg.includes('@firebase/firestore') && msg.includes('CANCELLED'))
    ) {
      return;
    }
    original.apply(console, args);
  };
};
filterBenignFirestoreLogs('warn');
filterBenignFirestoreLogs('error');

const filterStreamWrite = (stream: any) => {
  if (stream && typeof stream.write === 'function') {
    const originalWrite = stream.write.bind(stream);
    stream.write = ((chunk: any, encoding?: any, callback?: any) => {
      const str = typeof chunk === 'string' ? chunk : chunk?.toString?.('utf8') || '';
      if (
        str.includes('Disconnecting idle stream') ||
        str.includes('Timed out waiting for new targets') ||
        str.includes('GrpcConnection RPC') ||
        (str.includes('@firebase/firestore') && str.includes('CANCELLED'))
      ) {
        if (typeof callback === 'function') callback();
        return true;
      }
      return originalWrite(chunk, encoding, callback);
    }) as any;
  }
};
filterStreamWrite(process.stderr);
filterStreamWrite(process.stdout);

async function startServer() {
  const app = express();

  // Forwarded client IP handling behind reverse proxies (Nginx / Cloud Run)
  app.set('trust proxy', 1);

  // Security Headers compatible with AI Studio preview iframe embedding
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Note: Do NOT block iframes (X-Frame-Options or frame-ancestors 'self')
    // because AI Studio preview renders inside an iframe.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors *;"
    );
    next();
  });

  // AI Studio Cloud Run containers run Nginx on port 8080 which proxies to the internal app on port 3000.
  const PORT = (!process.env.PORT || process.env.PORT === '8080') ? 3000 : Number(process.env.PORT);

  // Body parser with 1MB payload limit to prevent DoS attacks
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  const distPath = fs.existsSync(path.resolve(__dirname, 'dist'))
    ? path.resolve(__dirname, 'dist')
    : path.join(process.cwd(), 'dist');

  // Mount production authentication & security layer
  app.use('/api/auth', authRouter);

  // Mount isolated school data and register transaction layer
  app.use('/api/data', dataRouter);

  // Google Play Store Digital Asset Links for Trusted Web Activity (TWA) verification
  app.get('/.well-known/assetlinks.json', (req, res) => {
    const assetlinksPath = path.resolve(process.cwd(), 'public/.well-known/assetlinks.json');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (fs.existsSync(assetlinksPath)) {
      return res.sendFile(assetlinksPath);
    }
    const pkgName = process.env.ANDROID_PACKAGE_NAME || 'com.mdm.dailyautoregister';
    const fingerprints = (process.env.PLAY_STORE_SHA256_FINGERPRINTS || '14:6D:E9:7F:0F:CF:68:D6:70:E2:61:94:FB:F0:4B:82:F0:DF:AC:3B:58:3B:7F:A1:08:4C:E6:86:16:FE:57:90')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pkgName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ]);
  });

  // Play Store TWA deployment verification status (Validates real release criteria, not just file existence)
  app.get('/api/play-store/info', (req, res) => {
    const twaManifestPath = path.resolve(process.cwd(), 'twa-manifest.json');
    const assetlinksPath = path.resolve(process.cwd(), 'public/.well-known/assetlinks.json');
    let targetSdkVersion = 36;
    let compileSdkVersion = 36;
    let host = '';

    try {
      if (fs.existsSync(twaManifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(twaManifestPath, 'utf8'));
        targetSdkVersion = manifest.targetSdkVersion || 36;
        compileSdkVersion = manifest.compileSdkVersion || 36;
        host = manifest.host || '';
      }
    } catch {}

    const sms = getActiveSmsProvider();
    const hasTwaManifest = fs.existsSync(twaManifestPath);
    const hasAssetLinks = fs.existsSync(assetlinksPath);
    const hasIcons = fs.existsSync(path.resolve(process.cwd(), 'public/pwa-512x512.png'));
    const isSdkCompliant = targetSdkVersion >= 36;

    // Check for placeholder fingerprint
    let isRealFingerprint = false;
    try {
      if (fs.existsSync(assetlinksPath)) {
        const al = JSON.parse(fs.readFileSync(assetlinksPath, 'utf8'));
        const fps = al[0]?.target?.sha256_cert_fingerprints || [];
        isRealFingerprint = fps.length > 0 && !fps[0].includes('14:6D:E9:7F:0F:CF');
      }
    } catch {}

    const pendingBlockers: string[] = [];
    if (!sms.configured) pendingBlockers.push('SMS gateway credentials required for live OTPs');
    if (!isRealFingerprint) pendingBlockers.push('Google Play App Signing SHA-256 fingerprint required');
    if (host.includes('ais-dev-')) pendingBlockers.push('Permanent production domain required in twa-manifest.json');

    const status = pendingBlockers.length === 0 ? 'READY_FOR_RELEASE' : 'CONFIGURATION_REQUIRED';

    res.json({
      status,
      packageId: 'com.mdm.dailyautoregister',
      appType: 'Trusted Web Activity (TWA) / Progressive Web App',
      androidTarget: 'Android 16 (API 36) and above',
      targetSdkVersion,
      compileSdkVersion,
      host,
      hasTwaManifest,
      hasAssetLinks,
      hasIcons,
      isSdkCompliant,
      smsProviderConfigured: sms.configured,
      isRealFingerprintConfigured: isRealFingerprint,
      pendingBlockers,
    });
  });

  // Sanitized source code download route for verified developer distribution
  app.get(
    [
      '/api/download-source-zip',
      '/download-source-zip',
      '/mdm-source-code.zip',
      '/midday-meal-app.zip',
      '/mdm-daily-auto-register-source-code.zip',
    ],
    (req, res) => {
      const candidatePaths = [
        path.resolve(process.cwd(), 'public/mdm-source-code.zip'),
        path.resolve(process.cwd(), 'public/midday-meal-app.zip'),
        path.resolve(process.cwd(), 'public/mdm-daily-auto-register-source-code.zip'),
        path.resolve(process.cwd(), 'dist/mdm-source-code.zip'),
        path.resolve(__dirname, 'public/mdm-source-code.zip'),
        path.resolve(__dirname, 'public/midday-meal-app.zip'),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', 'attachment; filename="mdm-daily-auto-register-source-code.zip"');
          return res.sendFile(p);
        }
      }

      // Automatically generate sanitized source zip on-the-fly if missing
      try {
        execSync('python3 scripts/generate_clean_source_zip.py', { cwd: process.cwd(), stdio: 'inherit' });
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="mdm-daily-auto-register-source-code.zip"');
            return res.sendFile(p);
          }
        }
      } catch (genErr) {
        console.error('Error auto-generating source zip:', genErr);
      }

      res.status(404).json({ error: 'Source code zip not generated yet.' });
    }
  );

  // Health check endpoint - responds 200 OK immediately for Cloud Run container health checks
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Explicit 404 handler for unknown API routes to prevent falling through to SPA middleware
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isDev = process.env.npm_lifecycle_event === 'dev' || 
                (process.env.NODE_ENV === 'development' && !process.env.npm_lifecycle_event);
  const isProduction = process.env.NODE_ENV === 'production' || (!isDev && hasDist);

  // Fail closed in production if production build is missing. Never start Vite dev middleware in production.
  if (process.env.NODE_ENV === 'production') {
    if (!hasDist) {
      console.error('FATAL: Production build is missing at dist/. Startup failed closed.');
      process.exit(1);
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in ${isProduction ? 'production' : 'development'} mode on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is currently in use. Exiting process so supervisor can restart cleanly.`);
      process.exit(1);
    } else {
      console.error('Unhandled server socket error:', err);
      process.exit(1);
    }
  });

  // Graceful shutdown on Cloud Run container termination signals
  const shutdown = () => {
    console.log('Received shutdown signal, terminating server gracefully...');
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
