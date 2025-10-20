import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './entities/post.entity';
import { CONNECTION } from '../../public/tenancy/tenancy.symbols';

@Injectable()
export class PostsService {
  private postRepository: Repository<Post>;

  constructor(@Inject(CONNECTION) private readonly connection: any) {
    this.postRepository = connection.getRepository(Post);
  }

  async create(createPostDto: CreatePostDto): Promise<Post> {
    const post = this.postRepository.create(createPostDto);
    return this.postRepository.save(post);
  }

  async findAll(): Promise<Post[]> {
    return this.postRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return post;
  }

  async update(id: string, updatePostDto: UpdatePostDto): Promise<Post> {
    const post = await this.findOne(id);
    Object.assign(post, updatePostDto);
    return this.postRepository.save(post);
  }

  async remove(id: string): Promise<void> {
    const post = await this.findOne(id);
    await this.postRepository.remove(post);
  }

  async findPublished(): Promise<Post[]> {
    return this.postRepository.find({
      where: { published: true },
      order: { createdAt: 'DESC' },
    });
  }
}
