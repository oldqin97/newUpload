module.exports = {
  devServer: {
    port: 3001,
    historyApiFallback: true,
    proxy: {
      '^/api': {
        target: 'http://127.0.0.1:3002',
        pathRewrite: {
          '^/api': '',
        },
        changeOrigin: true,
      },
    },
  },
};
