import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRepository } from './repository/user.repository';
import { UserProfileRepository } from './repository/user-profile.repository';
import { UserFavoriteRepository } from './repository/user-favorite.repository';
import { ImageuploadModule } from 'src/imageupload/imageupload.module';
import { FilesService } from 'src/files/files.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserRepository,
      UserProfileRepository,
      UserFavoriteRepository,
    ]),
    ImageuploadModule,
  ],
  providers: [UsersService, FilesService],
  controllers: [UsersController],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
