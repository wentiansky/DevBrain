import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup() {
  const root = path.resolve(__dirname, '../../..');

  execSync('pnpm --filter @devbrain/db build', {
    cwd: root,
    stdio: 'inherit',
  });

  execSync('pnpm --filter @devbrain/db exec prisma migrate deploy', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://devbrain:devbrain@localhost:5432/devbrain',
    },
  });
}

export default globalSetup;