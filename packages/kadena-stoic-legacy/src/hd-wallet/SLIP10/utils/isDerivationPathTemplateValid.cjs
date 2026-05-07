"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDerivationPathTemplateValid = void 0;
function isDerivationPathTemplateValid(derivationPathTemplate) {
    return (typeof derivationPathTemplate === 'string' &&
        derivationPathTemplate.includes('<index>'));
}
exports.isDerivationPathTemplateValid = isDerivationPathTemplateValid;
//# sourceMappingURL=isDerivationPathTemplateValid.js.map