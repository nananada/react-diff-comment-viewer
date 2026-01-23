const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Css = require('mini-css-extract-plugin');
const FavIconsWebpackPlugin = require('favicons-webpack-plugin');

module.exports = {
  entry: {
    main: './examples/src/index.tsx',
  },
  mode: process.env.NODE_ENV === 'production' ?
    'production' : 'development',
  // 禁用 webpack 缓存
  cache: false,
  // 添加 source maps 支持调试
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
  resolve: {
    extensions: ['.jsx', '.tsx', '.ts', '.scss', '.css', '.js'],
  },
  output: {
    path: path.resolve(__dirname, 'examples/dist'),
    filename: '[name].js',
  },
  devServer: {
    contentBase: path.resolve(__dirname, 'examples/dist'),
    port: 9000,
    hot: true,
    open: true,
    compress: true,
    historyApiFallback: true,
    publicPath: '/',
  },
  module: {
    rules: [{
        test: /\.tsx?$/,
        use: [{
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.examples.json',
            transpileOnly: true, // 启用类型检查
            experimentalWatchApi: true, // 使用实验性 watch API
          },
        }],
        exclude: /node_modules/,
      },
      {
        test: /\.s?css$/,
        use: [
          Css.loader,
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
            },
          },
        ],
      },
      {
        test: /\.xml|.rjs|.java/,
        use: 'raw-loader',
      },
      {
        test: /\.svg|.png/,
        use: 'file-loader',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './examples/src/index.ejs',
    }),
    new FavIconsWebpackPlugin('./logo-standalone.png'),
    new Css({
      filename: 'main.css',
    }),
  ],
};
