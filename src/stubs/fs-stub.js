// fs-stub.js - Empty implementation of Node.js fs module for browser
export default {
  readFileSync: () => '', // Return empty string for file contents
  existsSync: () => false, // Files don't exist in browser
  readFile: (path, options, callback) => {
    if (typeof options === 'function') {
      options(null, '');
    } else if (typeof callback === 'function') {
      callback(null, '');
    }
    return Promise.resolve('');
  },
  writeFileSync: () => {}, // No-op
  writeFile: () => Promise.resolve(),
  mkdirSync: () => {}, // No-op
  mkdir: () => Promise.resolve()
};
