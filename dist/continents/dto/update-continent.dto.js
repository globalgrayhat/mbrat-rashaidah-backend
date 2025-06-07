"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateContinentDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_continent_dto_1 = require("./create-continent.dto");
class UpdateContinentDto extends (0, mapped_types_1.PartialType)(create_continent_dto_1.CreateContinentDto) {
}
exports.UpdateContinentDto = UpdateContinentDto;
//# sourceMappingURL=update-continent.dto.js.map