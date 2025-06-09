import { UsersService } from '../../user/user.service';
import { MailService } from '../../common/mail/mail.service';
import { AppConfigService } from '../../config/config.service';
export declare class OtpService {
    private readonly userService;
    private readonly mailService;
    private readonly cfg;
    constructor(userService: UsersService, mailService: MailService, cfg: AppConfigService);
    createAndSend(email: string): Promise<void>;
    verify(email: string, otp: string): Promise<void>;
}
