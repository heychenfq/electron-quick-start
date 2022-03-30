
console.error = (...args: any[]) => nativeHost.call('logService', 'error', ...args);
console.warn = (...args: any[]) => nativeHost.call('logService', 'error', ...args);
console.info = (...args: any[]) => nativeHost.call('logService', 'info', ...args);
console.log = (...args: any[]) => nativeHost.call('logService', 'log', ...args);
console.debug = (...args: any[]) => nativeHost.call('logService', 'debug', ...args);