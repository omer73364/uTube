const path = require("node:path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const workspace = path.resolve(__dirname, "../..");
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  maxWorkers: 2,
  watchFolders: [workspace],
  resolver: {
    // Hoisted native libraries must use the app's React, just like App.tsx.
    // Otherwise Metro bundles the desktop's React as a second hook dispatcher.
    resolveRequest(context, moduleName, platform) {
      const target =
        moduleName === "react" || moduleName.startsWith("react/")
          ? require.resolve(moduleName, { paths: [__dirname] })
          : moduleName;
      return context.resolveRequest(context, target, platform);
    },
    nodeModulesPaths: [
      path.join(__dirname, "node_modules"),
      path.join(workspace, "node_modules"),
    ],
  },
});
