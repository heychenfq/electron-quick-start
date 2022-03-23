
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import preloadWebpackConfig from '../config/webpack.config.preload.dev';
import browserWebpackConfig from '../config/webpack.config.dev';

const runServer = async () => {
	const compiler = webpack([browserWebpackConfig, preloadWebpackConfig]);
	const devServerOptions = { 
		devMiddleware: {
			writeToDisk: true,
		},
	};
	const server = new WebpackDevServer(devServerOptions, compiler);
  await server.start();
};

const dev = async () => {
	try {
		await runServer();
	} catch(e) {
		if (typeof e === 'number') {
			console.error('process exit with code: ', e);
			return;
		}
		console.error(e);
	}
}

dev();