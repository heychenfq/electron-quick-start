
import { FC } from 'react';
import Update from './components/update/update';
import Lifecycle from './components/lifecycle/lifecycle';

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
			<Lifecycle />
		</div>
	)
};

export default App;