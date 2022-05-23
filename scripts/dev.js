const path = require('path');
const { spawn } = require('child_process');
const esbuild = require('esbuild');

const launchElectron = async () => {
	let electronProcess;
	const doLaunchElectron = () => {
		const electronExecPath = require('electron');
		electronProcess = spawn(electronExecPath, [
			'output/main.js'
		], {
			stdio: 'inherit',
			cwd: process.cwd(),
		});
	}
	const relaunchElectron = () => {
		console.log('relaunch electron...');
		if (electronProcess) {
			electronProcess.kill(1);
		}
		doLaunchElectron();
	}
	const watchPreloadSource = () => {
		esbuild.build({
			watch: {
				onRebuild(error, result) {
					if (error) {
						console.error('build preload error: ', error);
					} else {
						relaunchElectron();
					}
				},
			},
			minify: false,
			entryPoints: ['src/preload.ts'],
			platform: 'node',
			outfile: 'output/preload.js',
			bundle: true,
			external: ['electron', 'electron-log'],
			tsconfig: 'config/tsconfig.electron.json',
		});
	}	
	const watchMainSource = () => {
		const tscBin = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
		const tscCompiler = spawn(tscBin, [
			'--project', path.resolve(__dirname, '../config/tsconfig.electron.json'),
			'--watch',
		], {
			stdio: 'pipe',
			cwd: process.cwd(),
		});
		tscCompiler.stdout.on('data', (buffer) => {
			const message = buffer.toString();
			if (message.includes('Found 0 errors. Watching for file changes')) {
				relaunchElectron();
			} else {
				console.log(message);
			}
		});
		tscCompiler.on('error', (err) => {
			process.exit(err.code);
		});
	};
	watchPreloadSource();
	watchMainSource();
}
launchElectron();