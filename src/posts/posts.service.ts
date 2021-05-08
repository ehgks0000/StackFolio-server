import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FilesService } from 'src/files/files.service';
import { CreateTagDto } from 'src/tags/dto/create-tag.dto';
import { Tag } from 'src/tags/entity/tag.entity';
import { TagRepository } from 'src/tags/repository/tag.repository';
import { User } from 'src/users/entity/user.entity';
import { UserProfileRepository } from 'src/users/repository/user-profile.repository';
import { UserRepository } from 'src/users/repository/user.repository';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentPostDto } from './dto/create_comment_post';
import { PostByUserResponseDto } from './dto/post-by-user-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostComment } from './entity/post-comment.entity';
import { Post } from './entity/post.entity';
import { PostCommentRepository } from './repository/post-comment.repository';
// import { PostLikeRepository } from './repository/post-like.repository';
import { PostRepository } from './repository/post.repository';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  constructor(
    @InjectRepository(Post)
    private readonly userRepository: UserRepository,
    private readonly userProfileRepository: UserProfileRepository,
    private readonly postRepository: PostRepository,
    private readonly filesService: FilesService,
    private readonly postCommentRepository: PostCommentRepository,
  ) {}

  async createPost(userId: string, data: CreatePostDto): Promise<Post> {
    const post = await this.postRepository.createPost(userId, data);
    return post;
  }

  //전체 게시글 & is_private = false 인것만
  async getPostsAll(): Promise<Post[]> {
    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.tags', 'tags')
      .leftJoinAndSelect('post.user_like', 'user_like')
      .leftJoinAndSelect('post.metadata', 'metadata')
      .where('metadata.is_private = false')
      .orderBy('post.created_at', 'DESC')
      .getMany();
    console.log('post all');

    return posts;
  }
  async getPostsOfMy(userId: string): Promise<Post[]> {
    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.tags', 'tags')
      .leftJoinAndSelect('post.user_like', 'user_like')
      .leftJoinAndSelect('post.metadata', 'metadata')
      .leftJoinAndSelect('post.information', 'information')
      .where('post.user_id= :userId', { userId: userId })
      .orderBy('post.created_at', 'DESC')
      .getMany();
    return posts;
  }

  // 유저의 post 불러오기
  //   공개된것만
  async getPostsByUserId(userId: string): Promise<PostByUserResponseDto> {
    //   async getPostsByUserId(userId: string): Promise<Post[]> {
    const user = await this.userProfileRepository.findOne({ user_id: userId });
    const posts = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.metadata', 'metadata')
      .leftJoinAndSelect('post.tags', 'tag')
      //   .leftJoinAndSelect('post.author', 'author')
      //   .leftJoinAndSelect('author.profile', 'profile')
      .where('post.user_id= :userId', { userId: userId })
      .andWhere('metadata.is_private = false')
      .getMany();

    // console.log(post);
    return {
      author: user.username,
      posts,
    };
  }
  // postid의 post 불러오기
  //   공개된것만
  async getPostByPostId(postId: string): Promise<Post> {
    // const posts = await this.postRepository.find({ id: postId });
    const post = await this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.metadata', 'metadata')
      .leftJoinAndSelect('post.comments', 'comments')
      .where('post.id = :postId', { postId: postId })
      .andWhere('metadata.is_private = false')
      .getOne();

    // post.weekly_view_count++;
    // post.total_view_count++;

    await this.postRepository.save(post);

    return post;
  }
  /**
   * 
   * @test 게시글 조회 어떻게해야할까?
   
   */

  //   @Cron('45 * * * * *')
  //   handleCron() {
  //     this.logger.debug('45초마다 실행');
  //   }

  async updatePost(
    userId: string,
    postId: string,
    data: UpdatePostDto,
  ): Promise<Post> {
    const post = await this.postRepository.updatePost(userId, postId, data);

    return post;
  }

  async deletePost(userid: string, postId: string): Promise<Post> {
    const post = await this.postRepository.findOne({
      id: postId,
      user_id: userid,
    });

    await this.postRepository.remove(post);
    return post;
  }

  //   async getLikePosts(userId: string) {
  //     const posts = this.userRepository.findOne({ id: userId });
  //     return { posts } as any;
  //   }

  async likePost(me: User, postId: string): Promise<void> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user_like'],
    });
    post.user_like_ids.forEach((id) => {
      if (id === me.id) {
        throw new BadRequestException('이미 좋아요 했습니다.');
      }
    });
    post.user_like = [...post.user_like, me];

    // await this.userRepository.save(user);
    await this.postRepository.save(post);
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    // await this.postRepository
    //   .createQueryBuilder()
    //   .delete()
    //   .from('post_like')
    //   .where('post_like_ids = :postId AND user_like_ids = :userId', {
    //     postId: postId,
    //     userId: userId,
    //   })
    //   .execute();

    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user_like'],
    });
    post.user_like = post.user_like.filter((user) => {
      user.id !== userId;
    });

    await this.postRepository.save(post);
  }

  //test createTags
  //   async createTag(
  //     userId: string,
  //     postId: string,
  //     data: CreateTagDto,
  //   ): Promise<Tag> {
  //     const tag = await this.tagRepository.createTag(userId, postId, data);
  //     return tag;
  //   }

  //   async getTags(): Promise<Tag[] | undefined> {
  //     const tags = await this.tagRepository.find();
  //     return tags;
  //   }

  async uploadThumbnail(
    userId: string,
    postId: string,
    buffer: Buffer,
    originalname: string,
  ): Promise<string> {
    // const { buffer, originalname } = files.thumbnail;
    const post = await this.postRepository.findOne({
      where: { id: postId, user_id: userId },
      //   relations: ['information'],
    });
    if (!post) {
      throw new BadRequestException('게시글이 없습니다!');
    }

    const key = `${postId}`;
    const thumbnail = await this.filesService.uploadFile(
      key,
      buffer,
      originalname,
    );
    post.information.thumbnail = thumbnail;
    await this.postRepository.save(post);

    return thumbnail;
  }

  async uploadContentImages(
    userId: string,
    postId: string,
    buffer: Buffer,
    originalname: string,
  ): Promise<string> {
    const key = `${postId}/${originalname}`;
    return this.filesService.uploadFile(key, buffer, originalname);
  }

  async deleteThumbnail(userId: string, postId: string): Promise<void> {
    const post = await this.postRepository.findOne(
      {
        id: postId,
        user_id: userId,
      },
      { relations: ['information'] },
    );

    if (post.information.thumbnail) {
      await this.filesService.deleteFile(post.information.thumbnail);

      post.information.thumbnail = null;
      await this.postRepository.save(post);
    }
    // return post;
  }
  /**
   *
   * @todo
   * 게시글의 이미지 삭제하기
   * 파일 서비스로 옮겨야 할까?
   
   */
  async deleteContentImages(userId: string, postId: string): Promise<any> {
    return;
  }

  async getComments(post_id: string): Promise<PostComment[]> {
    const comments = await this.postCommentRepository.find({
      //   post_id,
      where: {
        post_id,
      },
      order: { group: 'ASC', sorts: 'ASC' },
    });
    return comments;
  }

  async createComment(
    userId: string,
    post_id: string,
    data: CreateCommentPostDto,
  ): Promise<void> {
    await this.postCommentRepository.createPostComment(userId, post_id, data);

    // return {} as any;
  }
}
