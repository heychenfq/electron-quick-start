const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const prettier = require('prettier');
const { spawn } = require('child_process');
const esbuild = require('esbuild');

const buildPreload = async () => {
	await esbuild.build({
		entryPoints: ['src/preload.ts'],
		platform: 'node',
		outfile: 'output/preload.js',
		bundle: true,
		minify: true,
		format: 'iife',
		external: ['electron', 'electron-log', 'electron-updater'],
		tsconfig: 'config/tsconfig.electron.json',
	});
}

const buildMain = async () => {
	return new Promise((resolve, reject) => {
		const tscBin = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
		const tscCompiler = spawn(tscBin, [
			'--project', path.resolve(__dirname, '../config/tsconfig.electron.json'),
		], {
			stdio: 'inherit',
			cwd: process.cwd(),
		});
		tscCompiler.on('error', (err) => {
			reject(err);
		});
		tscCompiler.on('exit', (code) => {
			if (code !== 0) {
				return reject(code);
			}
			resolve();
		})
	});
}

const generatePkg = () => {
	const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json')).toString());
	pkg.main = './main.js';
	delete pkg.devDependencies;
	delete pkg.dependencies.react;
	delete pkg.dependencies['react-dom'];
	writeFileSync(path.resolve(process.cwd(), 'output/package.json'), prettier.format(JSON.stringify(pkg), { parser: "json" }));
}

const run = async () => {
	try {
		await buildPreload();
		await buildMain();
		await generatePkg();
	} catch (err) {
		if (typeof err === 'number') {
			console.error('process exit with code: ', err);
			return;
		}
		console.error(err);
	}
}

run();
