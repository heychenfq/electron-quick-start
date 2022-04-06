import React, { FC, useCallback } from "react";

const Lifecycle: FC = () => {

	const handleQuit = useCallback(() => {
		nativeHost.call('lifecycleService', 'quit');
	}, []);

	const handleRelaunch = useCallback(() => {
		nativeHost.call('lifecycleService', 'relaunch');
	}, []);
	
	const handleKill = useCallback(() => {
		nativeHost.call('lifecycleService', 'kill', 44);
	}, []);

	return (
		<div>
			<div>Lifecycle</div>
			<button onClick={handleQuit}>quit</button>
			<button onClick={handleRelaunch}>relaunch</button>
			<button onClick={handleKill}>kill</button>
		</div>
	)
};

Lifecycle.displayName = 'Lifecycle';

export default Lifecycle;
