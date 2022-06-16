const { spawn } = require('child_process');
const fs = require('fs/promises');
const esbuild = require('esbuild');
const path = require('path');

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

	async function copyDevFile() {
		const files = await fs.readdir(path.resolve(__dirname, '../.dev'));
		return Promise.all(files.map(file => fs.copyFile(path.resolve(__dirname, '../.dev', file), path.resolve(__dirname, '../output', path.basename(file)))))
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
			external: ['electron', 'electron/*'],
			tsconfig: 'config/tsconfig.electron.json',
			sourcemap: true,
		});
	}	

	const watchMainSource = () => {
		esbuild.build({
			watch: {
				onRebuild(error, result) {
					if (error) {
						console.error('build main error: ', error);
					} else {
						relaunchElectron();
					}
				},
			},
			minify: false,
			entryPoints: ['src/main.ts'],
			platform: 'node',
			outfile: 'output/main.js',
			bundle: true,
			external: ['electron', 'electron/*'],
			tsconfig: 'config/tsconfig.electron.json',
			sourcemap: true,
		});
	};
	await copyDevFile();
	watchPreloadSource();
	watchMainSource();
	doLaunchElectron();
}
launchElectron();