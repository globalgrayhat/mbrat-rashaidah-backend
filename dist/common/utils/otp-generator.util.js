"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOTP = generateOTP;
function generateOTP(length) {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}
//# sourceMappingURL=otp-generator.util.js.map