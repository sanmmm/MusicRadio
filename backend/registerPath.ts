// const tsConfig = require("./tsconfig.json")
import tsConfig from './tsconfig.json'
const tsConfigPaths = require("tsconfig-paths")

const baseUrl = __dirname // Either absolute or relative path. If relative it's resolved to current working directory.

export default function () {
  const cleanup = tsConfigPaths.register({
    baseUrl,
    paths: tsConfig.compilerOptions.paths
  });
  return cleanup
}
 
// When path registration is no longer needed
// cleanup();