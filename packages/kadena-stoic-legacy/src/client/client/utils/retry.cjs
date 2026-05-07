"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = void 0;
const utils_1 = require("./utils");
const rejectAfter = (timeout) => {
    let stopTimer = () => { };
    const promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('TIME_OUT_REJECT')), timeout);
        stopTimer = () => clearTimeout(timer);
    });
    return { stopTimer: stopTimer, promise };
};
const retry = (task, signal) => async function runTask(options, count = 0) {
    const startTime = Date.now();
    const { timeout = 1000 * 60 * 3, interval = 5000 } = options !== null && options !== void 0 ? options : {};
    const rejectTimer = rejectAfter(timeout);
    try {
        const result = await Promise.race([
            new Promise((resolve, reject) => {
                if ((signal === null || signal === void 0 ? void 0 : signal.aborted) === true) {
                    reject(new Error('ABORTED'));
                }
                signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', () => reject(new Error('ABORTED')));
            }),
            rejectTimer.promise,
            // sleep for 1ms to let the timeout promise reject first.
            (0, utils_1.sleep)(1)
                .then(task)
                .finally(() => {
                // stop the timer if the task already fulfilled
                rejectTimer.stopTimer();
            }),
        ]);
        return result;
    }
    catch (error) {
        if (error !== undefined &&
            (error.message === 'TIME_OUT_REJECT' || error.message === 'ABORTED')) {
            throw error;
        }
        await (0, utils_1.sleep)(interval);
        const durationTime = Date.now() - startTime;
        return runTask({ timeout: timeout - durationTime, interval }, count + 1);
    }
};
exports.retry = retry;
//# sourceMappingURL=retry.js.map