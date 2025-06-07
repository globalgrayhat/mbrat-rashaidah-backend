import { User } from '../../user/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { Banner } from '../../banners/entities/banner.entity';
import { MediaType } from '../../common/constants/media.constant';
export declare class Media {
    id: string;
    data: string;
    mimeType: string;
    size: number;
    type: MediaType;
    altText?: string;
    projects: Project[];
    banner?: Banner;
    bannerId?: string;
    displayOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: User;
    createdById?: string;
}
