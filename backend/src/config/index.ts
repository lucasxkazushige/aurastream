import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '7700', 10),
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || '',
    readToken: process.env.TMDB_READ_TOKEN || '',
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || 'strem',
    endpoint: process.env.R2_ENDPOINT || '',
    publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''),
  },
  tempDir: process.env.TEMP_DIR || '/root/streaming-app/temp',
};
