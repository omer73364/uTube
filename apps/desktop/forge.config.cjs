const path = require("node:path");
const MakerAppImage = require("./build/maker-appimage.cjs");
module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "utube-desktop",
    appBundleId: "io.github.omer73364.utube",
    icon: path.join(
      __dirname,
      process.platform === "win32"
        ? "assets/icon.ico"
        : process.platform === "darwin"
          ? "assets/icon.icns"
          : "assets/icon.png",
    ),
    extraResource: [path.join(__dirname, "assets/icon.png")],
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["linux", "darwin", "win32"],
    },
    new MakerAppImage(),
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "uTubeDesktop",
        setupExe: "uTube-Desktop-Setup.exe",
        setupIcon: path.join(__dirname, "assets/icon.ico"),
      },
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: "uTube-Desktop",
        icon: path.join(__dirname, "assets/icon.icns"),
      },
    },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: {
        options: {
          name: "utube-desktop",
          bin: "utube-desktop",
          maintainer: "OMAR ANWAR",
          homepage: "https://github.com/omer73364/uTube",
          icon: path.join(__dirname, "assets/icon.png"),
          categories: ["AudioVideo"],
          description: "Download YouTube videos, playlists, and MP3s",
          depends: ["ffmpeg"],
        },
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: "src/main/main.ts",
            config: "vite.main.config.mjs",
            target: "main",
          },
          {
            entry: "src/main/worker.ts",
            config: "vite.main.config.mjs",
            target: "main",
          },
          {
            entry: "src/main/preload.ts",
            config: "vite.preload.config.mjs",
            target: "preload",
          },
        ],
        renderer: [{ name: "main_window", config: "vite.renderer.config.mjs" }],
      },
    },
  ],
};
