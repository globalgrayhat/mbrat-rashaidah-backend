import { AppConfigService } from '../../config/config.service';
export declare class MailService {
    private configService;
    private transporter;
    constructor(configService: AppConfigService);
    sendMail(to: string, subject: string, text: string): Promise<void>;
}
