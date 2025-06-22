import { MediaType } from '../../common/constants/media.constant';
export declare class CreateMediaDto {
    name: string;
    data: string;
    mimeType: string;
    size: number;
    type: MediaType;
    altText?: string;
    displayOrder?: number;
    isActive?: boolean;
    createdById?: string;
}
