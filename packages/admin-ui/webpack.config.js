const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/index.js',
    
    output: {
      path: path.resolve(__dirname, '..', 'web'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
    },
    
    devServer: {
      static: {
        directory: path.join(__dirname, '.'),
      },
      compress: true,
      port: 9000,
      open: true,
      hot: true,
      // 禁用缓存，确保每次修改都能立即生效
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
        logging: 'info',
      },
      // 添加额外的开发服务器选项
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      // 监听文件变化的配置
      watchFiles: {
        paths: ['src/**/*', 'css/**/*'],
        options: {
          usePolling: false,
        },
      },
    },
    
    // 禁用 webpack 缓存
    cache: false,
    
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader'
          ],
        },
        {
          test: /\.js$/,
          enforce: 'pre',
          use: ['source-map-loader'],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
        }
      ]
    },
    
    plugins: [
      new HtmlWebpackPlugin({
        template: './admin.html',
        filename: 'index.html'
      }),
      
       new CopyWebpackPlugin({
         patterns: [
           { from: 'css/codemirror.css', to: 'css/' },
           { from: 'css/codemirror-theme_xq-light.css', to: 'css/' },
           { from: 'css/terminal-fix.css', to: 'css/' },
           { from: 'css/main.css', to: 'css/' },
         ],
       }),
      
      new MiniCssExtractPlugin({
        filename: 'css/[name].[contenthash].css',
      }),

      // 定义环境变量，供前端代码使用
      new webpack.DefinePlugin({
        'process.env.HTTP_PORT': JSON.stringify(process.env.HTTP_PORT || '5621'),
        'window.HTTP_PORT': JSON.stringify(process.env.HTTP_PORT || '5621'),
      }),
    ],
    
    optimization: {
      minimize: isProduction
    }
  };
};