import {
  PipeTransform,
  Injectable,
  NotFoundException,
  //   ArgumentMetadata,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

@Injectable()
export class ProjectExistsPipe
  implements PipeTransform<string, Promise<string>>
{
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async transform(value: string): Promise<string> {
    const project = await this.projectRepository.findOne({
      where: { id: value },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID "${value}" not found.`);
    }
    return value;
  }
}
