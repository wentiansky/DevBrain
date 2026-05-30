import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GenerationService } from '../src/generation/generation.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const generationService = app.get(GenerationService);

  const userId = process.argv[2] || 'cmprv434l00009k6om4zt24qo';
  const kbId = process.argv[3] || 'cmprv4npe000a9k6oucamic02';
  const query = process.argv[4] || '什么是自注意力机制';

  console.log('=== Mock Generation 测试 ===');
  console.log(`userId: ${userId}`);
  console.log(`kbId: ${kbId}`);
  console.log(`query: ${query}`);
  console.log('');

  try {
    const result = await generationService.generate(userId, kbId, query);
    console.log('状态:', result.status);
    if (result.status === 'rejected') {
      console.log('拒答原因:', result.reason);
    } else {
      console.log('回答:', result.answer);
    }
    console.log('');
    console.log('=== Stream Generate 测试 ===');
    let tokenCount = 0;
    for await (const chunk of generationService.streamGenerate(userId, kbId, query)) {
      if (chunk.type === 'delta') {
        tokenCount++;
        process.stdout.write(chunk.delta);
      } else if (chunk.type === 'finish') {
        console.log(`\n\n[完成] tokens: ${tokenCount}`);
      } else if (chunk.type === 'error') {
        console.log(`\n错误: ${chunk.errorCode} - ${chunk.message}`);
      }
    }
  } catch (err) {
    console.error('生成失败:', (err as Error).message);
  }

  await app.close();
}

main();