const path = require('node:path');
const { MakerBase } = require('@electron-forge/maker-base');

// The published Forge adapter still uses Forge 5's function API.
// Wrap the maintained builder with the Maker API used by Forge 8 instead.
module.exports = class MakerAppImage extends MakerBase {
  name = 'appimage';
  defaultPlatforms = ['linux'];
  isSupportedOnCurrentPlatform() { return process.platform === 'linux'; }
  async make({ dir, makeDir, targetArch }) {
    const { build, Arch, Platform } = require('app-builder-lib');
    return build({
      prepackaged: dir,
      targets: Platform.LINUX.createTarget('AppImage', Arch[targetArch]),
      config: {
        electronVersion: require('electron/package.json').version,
        appId: 'io.github.omer73364.utube',
        productName: 'uTube Desktop',
        directories: { output: path.join(makeDir, 'appimage', targetArch) },
        linux: {
          executableName: 'utube-desktop',
          category: 'AudioVideo',
          icon: path.join(__dirname, '../assets/icon.png'),
          artifactName: 'uTube-Desktop-${version}-linux-${arch}.${ext}',
        },
        appImage: { license: path.join(__dirname, '../../../LICENSE') },
      },
    });
  }
};
