const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const protocol = process.env.REACT_APP_BACKEND_PROTOCOL || 'http';
  const port = process.env.REACT_APP_BACKEND_PORT || '3000';
  const target = `${protocol}://localhost:${port}`;

  const sharedOptions = {
    target,
    changeOrigin: true,
    secure: false,
    ws: true,
  };

  app.use('/api', createProxyMiddleware(sharedOptions));
  app.use('/socket.io', createProxyMiddleware(sharedOptions));
};
