import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import 'dotenv/config';

@Module({
  imports: [
    EmbeddingsModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: '127.0.0.1',
      port: 5433, // the local tunnel port
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: 'postgres',
      ssl: false, // or an SSL config if your DB requires it
      autoLoadEntities: true,
      synchronize: false,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
