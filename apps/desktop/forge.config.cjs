const path = require('node:path');
module.exports = {
  packagerConfig: { asar: true, executableName: 'utube-desktop', icon: path.join(__dirname, 'assets/icon.png'), extraResource: [path.join(__dirname, 'assets/icon.png')] },
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['linux', 'darwin', 'win32'] },
    { name: '@electron-forge/maker-deb', config: { options: {
      name: 'utube-desktop', bin: 'utube-desktop', maintainer: 'OMER ANWAR', homepage: 'https://github.com/omer73364/uTube',
      icon: path.join(__dirname, 'assets/icon.png'), categories: ['AudioVideo'], description: 'Download YouTube videos, playlists, and MP3s',
    } } },
  ],
  plugins: [{ name: '@electron-forge/plugin-vite', config: {
    build: [
      { entry: 'src/main/main.ts', config: 'vite.main.config.mjs', target: 'main' },
      { entry: 'src/main/worker.ts', config: 'vite.main.config.mjs', target: 'main' },
      { entry: 'src/main/preload.ts', config: 'vite.preload.config.mjs', target: 'preload' },
    ],
    renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
  } }],
};
