"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_service_1 = require("../config/config.service");
const config_module_1 = require("../config/config.module");
const jwt_strategy_1 = require("../common/strategies/jwt.strategy");
const refresh_token_strategy_1 = require("../common/strategies/refresh-token.strategy");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const otp_module_1 = require("../common/otp/otp.module");
const user_module_1 = require("../user/user.module");
const otp_service_1 = require("../common/otp/otp.service");
const mail_module_1 = require("../common/mail/mail.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_module_1.AppConfigModule],
                useFactory: (configService) => ({
                    secret: configService.jwtAccessTokenSecret,
                    signOptions: {
                        expiresIn: configService.jwtAccessTokenExpiresIn,
                    },
                }),
                inject: [config_service_1.AppConfigService],
            }),
            user_module_1.UserModule,
            config_module_1.AppConfigModule,
            otp_module_1.OtpModule,
            mail_module_1.MailModule,
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy, refresh_token_strategy_1.RefreshTokenStrategy, otp_service_1.OtpService],
        exports: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy, passport_1.PassportModule],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map