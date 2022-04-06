
declare namespace nativeHost {
  let process: {
		platform: string;
		arch: string;
		env: IProcessEnvironment;
		versions: {
			electron: string;
			chrome: string;
			node: string;
		};
		sandboxed?: boolean;
		type?: string;
		cwd: () => string;
  };
	function call<R>(service: string, method: string, ...args: any[]): R;
	function on<T>(service: string, event: string, ...args: any[]): any;
}
