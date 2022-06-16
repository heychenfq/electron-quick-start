
import { FC } from 'react';
import Update from './components/update/update';

const App: FC = () => {
	return (
		<div>
			<h1>Hello Electron!</h1>
			<div>
				<div>electron version: {bridge.process.versions.electron}</div>
				<div>node version: {bridge.process.versions.node}</div>
				<div>chrome version: {bridge.process.versions.chrome}</div>
			</div>
			<Update />
		</div>
	)
};

export default App;