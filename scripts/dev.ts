
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import preloadWebpackConfig from '../config/webpack.config.preload.dev';
import browserWebpackConfig from '../config/webpack.config.dev';

const runServer = async () => {
	const compiler = webpack(browserWebpackConfig);
	const devServerOptions = browserWebpackConfig.devServer;
	const server = new WebpackDevServer(devServerOptions, compiler);
  await server.start();
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

const dev = async () => {
	try {
		await runServer();
		await buildPreload();
	} catch(e) {
		if (typeof e === 'number') {
			console.error('process exit with code: ', e);
			return;
		}
		console.error(e);
	}
}

dev();