
declare namespace nativeHost {
  let setTitle: (title: string) => void;
  let appInfo: {
    nodeVersion: string;
    chromeVersion: string;
    electronVersion: string;
  };
	let call = <R>(service: string, method: string, ...args: any[]) => R;
}