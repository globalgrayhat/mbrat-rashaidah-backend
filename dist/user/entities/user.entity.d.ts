import { Role } from '../../common/constants/roles.constant';
export declare class User {
    id: string;
    email: string;
    password: string;
    otp?: string;
    otpExpires?: Date;
    isVerified: boolean;
    refreshToken?: string;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
}
