"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDonationDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_donation_dto_1 = require("./create-donation.dto");
class UpdateDonationDto extends (0, mapped_types_1.PartialType)(create_donation_dto_1.createDonationDto) {
}
exports.UpdateDonationDto = UpdateDonationDto;
//# sourceMappingURL=update-donation.dto.js.map