import { createApp } from './app.js';
import { env } from './env.js';

createApp().listen(env.port, () => {
  console.log(`API de Clima Laboral escuchando en http://localhost:${env.port}`);
});
