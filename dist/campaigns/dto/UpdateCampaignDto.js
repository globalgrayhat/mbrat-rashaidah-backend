"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCampaignDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const createCampaignDto_1 = require("./createCampaignDto");
class UpdateCampaignDto extends (0, mapped_types_1.PartialType)(createCampaignDto_1.CreateCampaignDto) {
}
exports.UpdateCampaignDto = UpdateCampaignDto;
//# sourceMappingURL=UpdateCampaignDto.js.map