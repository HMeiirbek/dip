const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy only /api to backend; favicon and other paths are not proxied
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.HTTPS === 'true' ? `https://localhost:${process.env.REACT_APP_BACKEND_PORT || '3002'}` : `http://localhost:${process.env.REACT_APP_BACKEND_PORT || '3002'}`,
      changeOrigin: true,
      secure: false, // allow self-signed certs when backend uses HTTPS
    }),
  );
};
