
// Main Process
import { winService as winMainService } from "@modern-js/electron-runtime";

winMainService.callBrowserWindow('main', 'hello', 'ModernJS');

// Renderer Process
import { winService } from "@modern-js/electron-runtime/render";

winService.registerServices({
	hello: (name: string) => {
		return `hello ${name}`;
	},
});