import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { cpSync, createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const IMAGE_DIR = fileURLToPath(new URL('./assets/dishes', import.meta.url));

// Dish photos stay in assets/dishes (managed by scripts/fetch-images.ts). Serve
// them at /images/ in dev, and copy them into the client build so the Worker
// serves them as static assets in production.
function dishImages(): Plugin {
  return {
    name: 'dish-images',
    configureServer(server) {
      server.middlewares.use('/images', (req, res, next) => {
        const name = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '');
        const file = join(IMAGE_DIR, name);
        if (!/^[\w-]+\.jpg$/.test(name) || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'image/jpeg');
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      if (this.environment.name !== 'client' || !options.dir) return;
      cpSync(IMAGE_DIR, join(options.dir, 'images'), {
        recursive: true,
        filter: (src) => src === IMAGE_DIR || src.endsWith('.jpg'),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    dishImages(),
    cloudflare(),
  ],
});
