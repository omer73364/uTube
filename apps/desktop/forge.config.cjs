module.exports = {
  packagerConfig: { asar: true, executableName: 'utube-desktop' },
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['linux', 'darwin', 'win32'] }],
  plugins: [{ name: '@electron-forge/plugin-vite', config: {
    build: [
      { entry: 'src/main/main.ts', config: 'vite.main.config.mjs', target: 'main' },
      { entry: 'src/main/preload.ts', config: 'vite.preload.config.mjs', target: 'preload' },
    ],
    renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
  } }],
};
