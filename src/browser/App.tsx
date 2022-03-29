
import { FC, useCallback } from 'react';

const App: FC = () => {
	const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		nativeHost.setTitle((e.target as any).title.value);
	}, []);
	return (
		<div>
			<h1>Hello Electron!</h1>
			<div>
				<div>electron version: {nativeHost.appInfo.electronVersion}</div>
				<div>node version: {nativeHost.appInfo.nodeVersion}</div>
				<div>chrome version: {nativeHost.appInfo.chromeVersion}</div>
			</div>
			<form onSubmit={handleSubmit}>
				<label>
					title
					<input name="title" />
				</label>
				<button type="submit">set title</button>
			</form>
		</div>
	)
};

export default App;