
declare namespace nativeHost {
  let setTitle: (title: string) => void;
  let appInfo: {
    nodeVersion: string;
    chromeVersion: string;
    electronVersion: string;
  };
	function call<R>(service: string, method: string, ...args: any[]): R;
	function on<T>(service: string, event: string, ...args: any[]): any;
}
