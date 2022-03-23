
import { FC, useCallback } from 'react';

const App: FC = () => {
	const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		electronAPI.setTitle((e.target as any).title.value);
	}, []);
	return (
		<div>
			<h1>Hello Electron!</h1>
			<div>
				<div>electron version: {electronAPI.appInfo.electronVersion}</div>
				<div>node version: {electronAPI.appInfo.nodeVersion}</div>
				<div>chrome version: {electronAPI.appInfo.chromeVersion}</div>
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