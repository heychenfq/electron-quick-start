
console.error = (...args: any[]) => bridge.call('logService', 'error', ...args);
console.warn = (...args: any[]) => bridge.call('logService', 'error', ...args);
console.info = (...args: any[]) => bridge.call('logService', 'info', ...args);
console.log = (...args: any[]) => bridge.call('logService', 'log', ...args);
console.debug = (...args: any[]) => bridge.call('logService', 'debug', ...args);