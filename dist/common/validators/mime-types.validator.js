"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MimeTypesValidator = void 0;
const common_1 = require("@nestjs/common");
class MimeTypesValidator extends common_1.FileValidator {
    isValid(file) {
        const clean = file.mimetype.split(';')[0].toLowerCase();
        return this.validationOptions.types
            .map((t) => t.toLowerCase())
            .includes(clean);
    }
    buildErrorMessage() {
        return 'Invalid file type. Only JPEG, PNG, GIF images and PDF documents are allowed.';
    }
}
exports.MimeTypesValidator = MimeTypesValidator;
//# sourceMappingURL=mime-types.validator.js.map