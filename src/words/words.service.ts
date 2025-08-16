import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type WordRow = { word: string };

function isWordRowArray(x: unknown): x is WordRow[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return Array.isArray(x) && x.every((r) => r && typeof r.word === 'string');
}

@Injectable()
export class WordsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getFirstWord(): Promise<string | null> {
    const res: unknown = await this.ds.query(
      `SELECT word_embeddings
       FROM word_embeddings
       ORDER BY word
       LIMIT 1`,
    );

    if (!isWordRowArray(res)) {
      throw new Error('Unexpected result shape from SQL');
    }
    return res[0]?.word ?? null;
  }
}
