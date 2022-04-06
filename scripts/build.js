const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const webpack = require('webpack');
const prettier = require('prettier');
const browserWebpackConfig = require('../config/webpack.config.prod');
// const preloadWebpackConfig = require('../config/webpack.config.preload');
const { spawn } = require('child_process');

const buildRenderer = () => {
	return new Promise((resolve, reject) => {
		webpack([
			browserWebpackConfig, 
			// preloadWebpackConfig,
		], (err, stats) => {
			if (err) {
				reject(err);
				return;
			}
			console.log(stats.toString({
				chunks: false,  // Makes the build much quieter
				colors: true    // Shows colors in the console
			}));
			resolve();
		});
	});
};

const buildMain = () => {
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
		await buildRenderer();
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
