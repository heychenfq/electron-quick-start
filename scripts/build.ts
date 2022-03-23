import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import webpack from 'webpack';
import prettier from 'prettier';
import browserWebpackConfig from '../config/webpack.config.prod';
import preloadWebpackConfig from '../config/webpack.config.preload';
import { spawn } from 'child_process';

const buildRenderer = () => {
	return new Promise<void>((resolve, reject) => {
		webpack([browserWebpackConfig, preloadWebpackConfig], (err: any, stats: any) => {
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
	return new Promise<void>((resolve, reject) => {
		const tscCompiler = spawn('swc', [
			path.resolve(__dirname, '../src'),
			'--config-file', path.resolve(__dirname, '../config/swcrc.electron.json'),
			'-d', path.resolve(__dirname, '../output'),
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
