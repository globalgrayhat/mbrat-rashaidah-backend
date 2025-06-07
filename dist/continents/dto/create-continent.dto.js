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
exports.CreateContinentDto = void 0;
const class_validator_1 = require("class-validator");
class CreateContinentDto {
    name;
    code;
    isActive;
}
exports.CreateContinentDto = CreateContinentDto;
__decorate([
    (0, class_validator_1.IsString)({ message: 'Name must be a string.' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Name should not be empty.' }),
    __metadata("design:type", String)
], CreateContinentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'Code must be a string.' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Code should not be empty.' }),
    (0, class_validator_1.Length)(2, 2, { message: 'Code must be exactly 2 characters.' }),
    __metadata("design:type", String)
], CreateContinentDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'isActive must be a boolean.' }),
    __metadata("design:type", Boolean)
], CreateContinentDto.prototype, "isActive", void 0);
//# sourceMappingURL=create-continent.dto.js.map