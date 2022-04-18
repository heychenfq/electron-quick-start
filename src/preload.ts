import { browserWindowPreloadApis, exposeInMainWorld } from "@modern-js/electron-runtime/render";

export type Bridge = typeof browserWindowPreloadApis;

console.log(browserWindowPreloadApis);


exposeInMainWorld({
	...browserWindowPreloadApis,
});