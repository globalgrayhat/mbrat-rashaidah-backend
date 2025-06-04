import { SetMetadata } from '@nestjs/common';
import { AuthRolesEnum } from '../enums';

export const Role = (...roles: AuthRolesEnum[]) => SetMetadata('roles', roles);
