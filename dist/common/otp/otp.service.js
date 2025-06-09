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
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("../../user/user.service");
const otp_generator_util_1 = require("../../common/utils/otp-generator.util");
const mail_service_1 = require("../../common/mail/mail.service");
const config_service_1 = require("../../config/config.service");
let OtpService = class OtpService {
    userService;
    mailService;
    cfg;
    constructor(userService, mailService, cfg) {
        this.userService = userService;
        this.mailService = mailService;
        this.cfg = cfg;
    }
    async createAndSend(email) {
        if (!this.cfg.otpEnabled)
            return;
        const EXP_MINUTES = this.cfg.otpExpiresIn;
        const otpLength = this.cfg.otpLength || 6;
        const otp = (0, otp_generator_util_1.generateOTP)(otpLength);
        const otpExpires = new Date(Date.now() + EXP_MINUTES * 60_000);
        await this.userService.updateByEmail(email, { otp, otpExpires });
        await this.mailService.sendMail(email, `رمز التحقق المؤقت - ${this.cfg.appName}`, `السلام عليكم،
       رمز التحقق المؤقت (OTP) الخاص بك في ${this.cfg.appName} هو:
       ${otp}
       مدة صلاحية الرمز: ${EXP_MINUTES} دقيقة.
       إذا لم تكن أنت من طلب هذا الرمز، يرجى تجاهل هذه الرسالة.
       شكراً لاستخدامك خدماتنا.`);
    }
    async verify(email, otp) {
        const user = await this.userService.findByEmail(email);
        const invalid = !user ||
            user.otp !== otp ||
            !user.otpExpires ||
            user.otpExpires < new Date();
        if (invalid)
            throw new common_1.UnauthorizedException('Invalid or expired OTP. Please try again.');
        await this.userService.update(user.id, {
            otp: undefined,
            otpExpires: undefined,
            isVerified: true,
        });
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UsersService,
        mail_service_1.MailService,
        config_service_1.AppConfigService])
], OtpService);
//# sourceMappingURL=otp.service.js.map