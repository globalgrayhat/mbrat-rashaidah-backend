export declare class CreateProjectDto {
    title: string;
    slug: string;
    description: string;
    location: string;
    startDate: Date;
    endDate?: Date;
    targetAmount: number;
    categoryId: string;
    countryId: string;
    continentId: string;
    status?: string;
    isActive?: boolean;
    isDonationActive?: boolean;
    isProgressActive?: boolean;
    isTargetAmountActive?: boolean;
    donationGoal?: number;
    mediaIds?: string[];
}
