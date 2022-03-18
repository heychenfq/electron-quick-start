import path from 'path';
import webpack from 'webpack';
import browserWebpackConfig from '../config/webpack.config.prod';
import preloadWebpackConfig from '../config/webpack.config.preload';
import { spawn } from 'child_process';

const buildRenderer = () => {
	return new Promise<void>((resolve, reject) => {
		webpack(browserWebpackConfig, (err: any, stats: any) => {
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

const buildPreload = () => {
	return new Promise<void>((resolve, reject) => {
		webpack(preloadWebpackConfig, (err: any, stats: any) => {
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
}

const buildMain = () => {
	return new Promise<void>((resolve, reject) => {
		const tscCompiler = spawn('swc', [
			path.resolve(__dirname, '../src'),
			'--config-file', path.resolve(__dirname, '../config/swcrc.electron.json'),
			'-d', path.resolve(__dirname, '../dist'),
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

const run = async () => {
	try {
		await buildRenderer();
		await buildPreload();
		await buildMain();
	} catch (err) {
		if (typeof err === 'number') {
			console.error('process exit with code: ', err);
			return;
		}
		console.error(err);
	}
}

run();
