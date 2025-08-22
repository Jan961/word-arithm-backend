// similar-words.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

type Metric = 'l2' | 'cosine' | 'ip';
type Row = { word: string; distance?: number };

@Injectable()
export class AppService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Return the top-n words closest to the SUM of the given words' embeddings.
   * Uses pgvector nearest-neighbor ORDER BY (no query builder).
   *
   * @param addWords
   * @param subWords
   * @param n     number of neighbors to return
   * @param opts
   *   - metric: must match your index opclass ('l2' | 'cosine' | 'ip')
   *   - includeDistance: include distance column in the output
   */
  async getVectorAdditionResults(
    addWords: string[],
    subWords: string[],
    n: number,
    opts: {
      metric?: Metric;
      excludeInputs?: boolean;
      includeDistance?: boolean;
    } = {},
  ): Promise<Row[]> {
    const metric = opts.metric ?? 'l2';
    const op = ({ l2: '<->', cosine: '<=>', ip: '<#>' } as const)[metric];

    const selectDistance = opts.includeDistance
      ? `, w.embedding ${op} (SELECT qvec FROM q) AS distance`
      : '';

    const excludeArray = addWords.concat(subWords).reduce((acc, curr) => {
      return [
        ...acc,
        `'%${curr}%'`,
        `'%${curr.charAt(0).toUpperCase() + curr.slice(1)}%'`,
      ];
    }, []);

    // IMPORTANT: nearest-neighbor "notation" is the ORDER BY with pgvector operator.
    // The query vector is a scalar subquery from the CTE, so no cross join is used.
    const sql = `
        WITH
          sums AS (
          SELECT
              SUM(e.embedding) FILTER (WHERE e.word = ANY($1)) AS add_sum,
              SUM(e.embedding) FILTER (WHERE e.word = ANY($2)) AS sub_sum
          FROM word_embeddings e
          WHERE e.word = ANY($1) OR e.word = ANY($2)
        ),
         q AS (
         SELECT COALESCE(add_sum, sub_sum - sub_sum) - COALESCE(sub_sum, add_sum - add_sum) AS qvec
            FROM sums
        )
        
        SELECT w.word${selectDistance}
        FROM word_embeddings AS w
        WHERE w.word NOT LIKE ALL (ARRAY[${excludeArray.join(',')}])
      ORDER BY w.embedding <=> (SELECT qvec FROM q)
      LIMIT $3
    `;

    console.log('SQL Query:', sql);

    // $1 = text[], $2 = int
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rows = await this.db.query(sql, [addWords, subWords, n]);
    return rows as Row[];
  }
}
