import { builtinModules, createRequire } from 'node:module'
import typescript from '@rollup/plugin-typescript'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const builtinModuleNames = new Set([
  ...builtinModules,
  ...builtinModules.map(name => `node:${ name }`)
])
const externalPackages = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {})
]

function isExternal(id) {
  return builtinModuleNames.has(id) ||
    externalPackages.some(packageName => id === packageName || id.startsWith(`${ packageName }/`))
}

export default {
  input: {
    index: 'src/index.ts',
    'mini-claude': 'src/mini-claude.ts',
    'tools/mcp_server': 'src/tools/mcp_server.ts'
  },
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
    entryFileNames: '[name].js'
  },
  external: isExternal,
  plugins: [
    typescript({
      tsconfig: './tsconfig.build.json'
    })
  ]
}
