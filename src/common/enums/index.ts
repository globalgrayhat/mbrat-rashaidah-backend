export enum AuthRolesEnum {
  ADMIN = 'ADMIN',
  USER = 'USER',
  VERIFIED = 'VERIFIED',
  CAMPAIGN_OWNER = 'CAMPAIGN_OWNER',
  MODERATOR = 'MODERATOR',
}

export enum DonationStatusEnum {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SUCCESSFUL = 'SUCCESSFUL',
  CANCELLED = 'CANCELLED',
}

export enum CampaignPurposeEnum {
  CHARITY = 'charity',
  EMERGENCY = 'emergency',
  EDUCATION = 'education',
  HEALTH = 'health',
  OTHER = 'other',
}

export enum PaymentMethodEnum {
  STRIPE = 'stripe',
  MYFATOORA = 'myfatoora',
}
