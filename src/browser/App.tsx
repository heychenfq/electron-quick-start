
import { FC } from 'react';
import Update from './components/update/update';

const App: FC = () => {
	return (
		<div>
			<h1>Hello Electron!</h1>
			<div>
				<div>electron version: {nativeHost.process.versions.electron}</div>
				<div>node version: {nativeHost.process.versions.node}</div>
				<div>chrome version: {nativeHost.process.versions.chrome}</div>
			</div>
			<Update />
		</div>
	)
};

export default App;