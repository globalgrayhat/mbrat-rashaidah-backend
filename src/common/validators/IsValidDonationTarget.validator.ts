import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsValidDonationTargetConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments) {
    const obj = args.object as Record<string, unknown>;
    const hasProjectId =
      typeof obj.projectId !== 'undefined' && obj.projectId !== null;
    const hasCampaignId =
      typeof obj.campaignId !== 'undefined' && obj.campaignId !== null;

    // Must have exactly one of them
    return (hasProjectId && !hasCampaignId) || (!hasProjectId && hasCampaignId);
  }

  defaultMessage() {
    return 'A donation must be linked to either a project or a campaign, but not both.';
  }
}

export function IsValidDonationTarget(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidDonationTargetConstraint,
    });
  };
}
