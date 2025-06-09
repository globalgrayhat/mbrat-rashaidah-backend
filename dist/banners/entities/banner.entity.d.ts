import { User } from '../../user/entities/user.entity';
import { Media } from '../../media/entities/media.entity';
export declare class Banner {
    id: string;
    title: string;
    description?: string;
    media?: Media;
    mediaId?: string;
    linkUrl?: string;
    isActive: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: User;
    createdById?: string;
}
