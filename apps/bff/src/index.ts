import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const app = createApp({ staticDir: env.STATIC_DIR });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`DyingStar Admin BFF listening on http://localhost:${info.port}`);
});
