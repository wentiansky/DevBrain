import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { User } from '@devbrain/db';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _DbTypeSmoke = User;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

void bootstrap();
