import { Module } from '@nestjs/common';
import { EmbeddingsRepo } from './embeddings.repo';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [EmbeddingsRepo],
  exports: [EmbeddingsRepo],
})
export class EmbeddingsModule {}
