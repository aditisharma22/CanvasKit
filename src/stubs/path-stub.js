// path-stub.js - Empty implementation of Node.js path module for browser
export default {
  join: (...args) => args.join('/'),
  resolve: (...args) => args.join('/'),
  dirname: (path) => path.split('/').slice(0, -1).join('/'),
  basename: (path) => path.split('/').pop(),
  extname: (path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }
};
