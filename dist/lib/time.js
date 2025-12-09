"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOT_DELETED_DATE = exports.NOT_DELETED_MS = void 0;
exports.newCreateTimes = newCreateTimes;
exports.NOT_DELETED_MS = -62135596800000; // matches your sentinel
exports.NOT_DELETED_DATE = new Date(exports.NOT_DELETED_MS);
function newCreateTimes() {
    const now = new Date();
    return {
        create_time: now,
        update_time: now,
        delete_time: exports.NOT_DELETED_DATE
    };
}
