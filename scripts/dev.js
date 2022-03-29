
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
// const preloadWebpackConfig = require('../config/webpack.config.preload.dev');
const browserWebpackConfig = require('../config/webpack.config.dev');

const runServer = async () => {
	// const compiler = webpack([browserWebpackConfig, preloadWebpackConfig]);
	const compiler = webpack(browserWebpackConfig);
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