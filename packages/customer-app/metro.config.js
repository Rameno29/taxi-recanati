const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Block duplicate native packages from root node_modules
const rootModules = path.resolve(monorepoRoot, "node_modules");
const escape = (str) => str.replace(/[/\\]/g, "[/\\\\]").replace(/\./g, "\\.");
config.resolver.blockList = [
  new RegExp(`${escape(rootModules)}[/\\\\]react-native-safe-area-context[/\\\\].*`),
  new RegExp(`${escape(rootModules)}[/\\\\]react-native-screens[/\\\\].*`),
  // Block other workspace apps from being watched
  new RegExp(`${escape(path.resolve(monorepoRoot, "packages", "driver-app"))}[/\\\\].*`),
  new RegExp(`${escape(path.resolve(monorepoRoot, "packages", "admin-dashboard"))}[/\\\\].*`),
  new RegExp(`${escape(path.resolve(monorepoRoot, "packages", "server"))}[/\\\\].*`),
];

module.exports = config;
