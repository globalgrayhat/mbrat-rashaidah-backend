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
exports.FileTypeValidationPipe = void 0;
const common_1 = require("@nestjs/common");
let FileTypeValidationPipe = class FileTypeValidationPipe {
    allowedMimeTypes;
    constructor(allowedMimeTypes) {
        this.allowedMimeTypes = allowedMimeTypes;
    }
    transform(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        if (!this.allowedMimeTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException(`File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
        }
        return file;
    }
};
exports.FileTypeValidationPipe = FileTypeValidationPipe;
exports.FileTypeValidationPipe = FileTypeValidationPipe = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Array])
], FileTypeValidationPipe);
//# sourceMappingURL=file-type.pipe.js.map