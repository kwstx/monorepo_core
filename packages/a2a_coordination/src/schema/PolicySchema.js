"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViolationSeverity = void 0;
/**
 * Severity level for policy violations.
 */
var ViolationSeverity;
(function (ViolationSeverity) {
    ViolationSeverity["REJECT"] = "REJECT";
    ViolationSeverity["MODIFY"] = "MODIFY";
    ViolationSeverity["ADVISE"] = "ADVISE"; // Message is accepted but with a warning/advice
})(ViolationSeverity || (exports.ViolationSeverity = ViolationSeverity = {}));
