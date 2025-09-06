import {
  Controller,
  Get,
  Param,
  ParseArrayPipe,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { AppService } from './app.service';
import { EmbeddingsRepo } from './embeddings/embeddings.repo';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly embeddingsRepo: EmbeddingsRepo,
  ) {}

  @Get('embedding/:word')
  async getWordEmbedding(@Param('word') word: string): Promise<number[]> {
    const embedding = await this.embeddingsRepo.findEmbeddingByWord(word);
    // Convert Float32Array to regular array for JSON serialization
    return Array.from(embedding);
  }

  @Get('neighbours/:word')
  async getNearestNeighbors(
    @Param('word') word: string,
    @Query('n', new DefaultValuePipe(10), ParseIntPipe) n: number,
  ) {
    return this.appService.getNearestNeighbors(word, n, {
      includeDistance: true,
    });
  }
  // Get the distances from the word passed as parameter to the words passed as query parameters
  @Get('distances/:word')
  getDistances(
    @Param('word') word: string,
    @Query(
      'words',
      new ParseArrayPipe({ items: String, separator: ',', optional: false }),
    )
    words: string[],
    @Query('metric', new DefaultValuePipe('cosine'))
    metric: 'cosine' | 'l2' | 'ip',
    @Query('similarity', new DefaultValuePipe(true), ParseBoolPipe)
    similarity: boolean,
    @Query('excludeSelf', new DefaultValuePipe(true), ParseBoolPipe)
    excludeSelf: boolean,
  ) {
    return this.appService.getDistancesToWords(word, words, {
      metric,
      asSimilarity: similarity,
      excludeSelf,
    });
  }




  @Get('results')
  getResult(
    // Array of strings: accepts repeated keys (?tags=a&tags=b) and comma-separated (?tags=a,b)
    @Query(
      'add',
      new ParseArrayPipe({ items: String, separator: ',', optional: true }),
    )
    addWords: string[] = [],

    @Query(
      'sub',
      new ParseArrayPipe({ items: String, separator: ',', optional: true }),
    )
    subWords: string[] = [],

    // Number with default + validation/transform
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    wordsReturnedNumber: number,
  ) {
    return this.appService.getVectorAdditionResults(
      addWords,
      subWords,
      wordsReturnedNumber,
    );
  }
}
