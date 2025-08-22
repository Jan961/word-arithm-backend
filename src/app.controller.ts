import {
  Controller,
  Get,
  Param,
  ParseArrayPipe,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
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
