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
exports.CreateCountryDto = void 0;
const class_validator_1 = require("class-validator");
class CreateCountryDto {
    name;
    code;
    flagUrl;
    phoneCode;
    currencyCode;
    currencySymbol;
    isActive;
    continentId;
    projects;
}
exports.CreateCountryDto = CreateCountryDto;
__decorate([
    (0, class_validator_1.IsString)({ message: 'Name must be a string.' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Name should not be empty.' }),
    __metadata("design:type", String)
], CreateCountryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'Code must be a string.' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Code should not be empty.' }),
    (0, class_validator_1.Length)(2, 2, { message: 'Code must be exactly 2 characters.' }),
    __metadata("design:type", String)
], CreateCountryDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({}, { message: 'flagUrl must be a valid URL.' }),
    __metadata("design:type", String)
], CreateCountryDto.prototype, "flagUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'phoneCode must be a string.' }),
    __metadata("design:type", String)
], CreateCountryDto.prototype, "phoneCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'currencyCode must be a string.' }),
    __metadata("design:type", String)
], CreateCountryDto.prototype, "currencyCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ message: 'currencySymbol must be a string.' }),
    __metadata("design:type", String)
], CreateCountryDto.prototype, "currencySymbol", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'isActive must be a boolean.' }),
    __metadata("design:type", Boolean)
], CreateCountryDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'continentId must be a valid UUID.' }),
    __metadata("design:type", String)
], CreateCountryDto.prototype, "continentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)({ message: 'projects must be an array.' }),
    (0, class_validator_1.ArrayNotEmpty)({ message: 'projects array should not be empty.' }),
    (0, class_validator_1.ArrayUnique)({ message: 'projects array values must be unique.' }),
    (0, class_validator_1.IsUUID)('4', { each: true, message: 'Each projectId must be a valid UUID.' }),
    __metadata("design:type", Array)
], CreateCountryDto.prototype, "projects", void 0);
//# sourceMappingURL=create-country.dto.js.map