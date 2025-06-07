"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
const config_service_1 = require("../../config/config.service");
let MailService = class MailService {
    configService;
    transporter;
    constructor(configService) {
        this.configService = configService;
        this.transporter = nodemailer.createTransport({
            host: this.configService.mailHost,
            port: this.configService.mailPort,
            secure: this.configService.mailSecure,
            auth: {
                user: this.configService.mailUser,
                pass: this.configService.mailPass,
            },
        });
    }
    async sendMail(to, subject, text) {
        const mailOptions = {
            from: `"${this.configService.mailFromName}" <${this.configService.mailFrom}>`,
            to,
            subject,
            text,
        };
        try {
            await this.transporter.sendMail(mailOptions);
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Mail send error:', error.message);
            }
            else {
                console.error('Unknown error during mail sending', error);
            }
            throw new common_1.InternalServerErrorException('Failed to send email');
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map