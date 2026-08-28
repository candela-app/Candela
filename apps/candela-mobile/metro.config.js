const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedAssets = path.resolve(workspaceRoot, 'packages/shared/assets');
const reactRoot = path.resolve(projectRoot, 'node_modules/react');
const promiseRoot = path.resolve(workspaceRoot, 'node_modules/promise');

const config = getDefaultConfig(projectRoot);

// Watch shared code only — not the whole monorepo. Metro crawling
// `apps/candela-app/.next` hits disappearing export dirs and crashes with ENOENT.
config.watchFolders = [
  ...new Set(
    [
      ...(config.watchFolders ?? []),
      path.resolve(workspaceRoot, 'packages/shared'),
      path.resolve(workspaceRoot, 'node_modules'),
    ].filter((folder) => path.resolve(folder) !== workspaceRoot),
  ),
];
const extraBlockList = [
  /[\\/]apps[\\/]candela-app[\\/]\.next[\\/].*/,
  /[\\/]apps[\\/]candela-backend[\\/]dist[\\/].*/,
  /[\\/]\.turbo[\\/].*/,
];

function asRegexList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(asRegexList);
  return [value];
}

const existingBlockList = asRegexList(config.resolver.blockList);
const blockFlags = existingBlockList[0]?.flags ?? '';
config.resolver.blockList = [
  ...existingBlockList,
  ...extraBlockList.map((re) => new RegExp(re.source, blockFlags)),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: reactRoot,
  promise: promiseRoot,
};

function resolveInside(dir, subpath) {
  const candidates = [
    path.join(dir, subpath),
    path.join(dir, `${subpath}.js`),
    path.join(dir, subpath, 'index.js'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return { type: 'sourceFile', filePath };
    }
  }
  return null;
}

function resolvePinned(moduleName, pkgName, pkgRoot) {
  if (moduleName !== pkgName && !moduleName.startsWith(`${pkgName}/`)) return null;
  const subpath = moduleName === pkgName ? 'index.js' : moduleName.slice(pkgName.length + 1);
  return resolveInside(pkgRoot, subpath);
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@candela/shared/assets/')) {
    return {
      filePath: path.resolve(sharedAssets, moduleName.replace('@candela/shared/assets/', '')),
      type: 'sourceFile',
    };
  }

  const pinned =
    resolvePinned(moduleName, 'react', reactRoot) ||
    resolvePinned(moduleName, 'promise', promiseRoot);
  if (pinned) return pinned;

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
