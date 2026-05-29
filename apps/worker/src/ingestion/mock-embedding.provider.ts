import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { EmbeddingProvider, EmbeddingResult } from './embedding-provider.interface';

@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'mock';
  readonly model = 'mock-embedding-v1';
  readonly dimension = 1024;

  async embedDocuments(texts: string[]): Promise<EmbeddingResult[]> {
    return texts.map((text, index) => ({
      vector: this.generateDeterministicVector(text),
      index,
    }));
  }

  private generateDeterministicVector(text: string): number[] {
    const hash = createHash('sha256').update(text, 'utf-8').digest();
    const vector: number[] = new Array(this.dimension);
    const seed = hash.readUInt32LE(0);

    for (let i = 0; i < this.dimension; i++) {
      const idx = i % hash.length;
      const val = (hash[idx] * (i + 1) + seed) % 256;
      vector[i] = (val - 128) / 128;
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }
}