import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Adjust to your pgvector text format -> Float32Array
export function parsePgvector(text: string): Float32Array {
  // text like: "[0.1, 0.2, 0.3]" (ensure you SELECT embedding::text)
  const nums = text
    .replace(/^\s*\[|\]\s*$/g, '')
    .split(',')
    .map((x) => Number(x.trim()));
  return Float32Array.from(nums);
}

@Injectable()
export class EmbeddingsRepo {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async findEmbeddingByWord(word: string): Promise<Float32Array> {
    interface Row {
      embedding: string;
    }
    const rows = await this.ds.query<Row[]>(
      `SELECT embedding::text AS embedding
       FROM word_embeddings
       WHERE word = $1
       LIMIT 1`,
      [word],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Word "${word}" not found`);
    }
    return parsePgvector(rows[0].embedding);
  }

  // Add other reusable queries here (by id, nearest neighbours, etc.)
}
