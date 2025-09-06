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

  // TODO: add other distances
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
    const metric = opts.metric ?? 'cosine';
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

  // TODO: add other distances
  async getNearestNeighbors(
    word: string,
    n: number,
    opts: { metric?: Metric; includeDistance?: boolean } = {},
  ): Promise<Row[]> {
    const metric = opts.metric ?? 'cosine';
    const op = ({ l2: '<->', cosine: '<=>', ip: '<#>' } as const)[metric];

    const excludeArr = [
      `'%${word}%'`,
      `'%${word.charAt(0).toUpperCase() + word.slice(1)}%'`,
    ];

    const sql = `
        WITH q AS (
            SELECT embedding AS qvec
            FROM word_embeddings
            WHERE word = $1
        )
        SELECT w.word,
               w.embedding <=> (SELECT qvec FROM q) AS cosine_distance,
               1 - (w.embedding <=> (SELECT qvec FROM q)) AS cosine_similarity
        FROM word_embeddings AS w
        WHERE w.word <> $1
          AND EXISTS (SELECT 1 FROM q)
            AND w.word NOT LIKE ALL (ARRAY[${excludeArr.join(',')}])
        ORDER BY w.embedding <=> (SELECT qvec FROM q)
        LIMIT $2;
    `;

    console.log('SQL Query:', sql);

    // $1 = text, $2 = int
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rows = await this.db.query(sql, [word, n]);
    return rows as Row[];
  }

  /**
   * Compute distances from a query word to a provided list of words.
   * Default returns cosine similarity; other metrics return their native distance.
   */
  async getDistancesToWords(
    queryWord: string,
    targetWords: string[],
    opts: { metric?: Metric; asSimilarity?: boolean; excludeSelf?: boolean } = {},
  ): Promise<Row[]> {
    if (!Array.isArray(targetWords) || targetWords.length === 0) {
      return [];
    }

    // Deduplicate inputs to minimize index lookups; preserve first-seen order
    const uniqueTargetWords = Array.from(new Set(targetWords));
    if (uniqueTargetWords.length === 0) {
      return [];
    }

    const metric = opts.metric ?? 'cosine';
    const op = ({ l2: '<->', cosine: '<=>', ip: '<#>' } as const)[metric];
    const isCosine = metric === 'cosine';
    const asSimilarity = opts.asSimilarity ?? isCosine; // default to cosine similarity

    const measureExpr = asSimilarity && isCosine
      ? `1 - (w.embedding <=> q.qvec)`
      : `w.embedding ${op} q.qvec`;

    const sql = `
        WITH q AS (
            SELECT embedding AS qvec
            FROM word_embeddings
            WHERE word = $1
        )
        SELECT t.word AS word,
               ${measureExpr} AS distance
        FROM q
        JOIN unnest($2::text[]) WITH ORDINALITY AS t(word, ord) ON true
        JOIN word_embeddings AS w
          ON w.word = t.word
        ${opts.excludeSelf ? 'WHERE t.word <> $1' : ''}
        ORDER BY t.ord;
    `;

    console.log('SQL Query:', sql);

    // $1 = text, $2 = text[]
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rows = await this.db.query(sql, [queryWord, uniqueTargetWords]);
    return rows as Row[];
  }




  
}
