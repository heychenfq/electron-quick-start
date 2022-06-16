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
		external: ['electron', 'electron/*'],
		tsconfig: 'config/tsconfig.electron.json',
		sourcemap: true,
	});
}

const buildMain = async () => {
	await esbuild.build({
		entryPoints: ['src/main.ts'],
		platform: 'node',
		outfile: 'output/main.js',
		bundle: true,
		minify: true,
		format: 'iife',
		external: ['electron', 'electron/*'],
		tsconfig: 'config/tsconfig.electron.json',
		sourcemap: true,
	});
}

const generatePkg = () => {
	const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json')).toString());
	pkg.main = './main.js';
	delete pkg.devDependencies;
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
