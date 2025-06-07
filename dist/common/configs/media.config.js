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
exports.MediaConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let MediaConfigService = class MediaConfigService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    get uploadDir() {
        return this.configService.get('UPLOAD_DIR', 'uploads');
    }
    get maxFileSize() {
        return this.configService.get('MAX_FILE_SIZE', 5 * 1024 * 1024);
    }
    get allowedMimeTypes() {
        const defaultTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
        ];
        const configTypes = this.configService.get('ALLOWED_MIME_TYPES');
        return configTypes ? configTypes.split(',') : defaultTypes;
    }
    get maxFilenameLength() {
        return this.configService.get('MAX_FILENAME_LENGTH', 255);
    }
    get useCloudStorage() {
        return this.configService.get('USE_CLOUD_STORAGE', false);
    }
    get cloudinaryConfig() {
        return {
            cloudName: this.configService.get('CLOUDINARY_CLOUD_NAME'),
            apiKey: this.configService.get('CLOUDINARY_API_KEY'),
            apiSecret: this.configService.get('CLOUDINARY_API_SECRET'),
        };
    }
};
exports.MediaConfigService = MediaConfigService;
exports.MediaConfigService = MediaConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MediaConfigService);
//# sourceMappingURL=media.config.js.map