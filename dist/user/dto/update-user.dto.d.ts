import { Role } from '../../common/constants/roles.constant';
export declare class UpdateUserDto {
    role?: Role;
    refreshToken?: string;
    otp?: string;
    otpExpires?: Date;
    isVerified?: boolean;
}
