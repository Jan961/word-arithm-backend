import { Controller, Get, Param } from '@nestjs/common';

@Controller('words')
export class WordsController {
  // get word vector
  @Get(':word')
  findWordVector(@Param('word') word: string) {
    return { word, vector: [0.1, 0.2, 0.3] }; // Mocked response
  }
}
