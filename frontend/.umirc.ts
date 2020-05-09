import { IConfig } from '@umijs/types';
import path from 'path'

const configInject = {
  publicPath: process.env.PUBLIC_PATH || '/',
  outPutPath: process.env.OUTPUT_PATH || './dist',
  isProductionMode: process.env.NODE_ENV === 'production',
  loadSettingsFromServer: process.env.ASYNC_SETTINGS === '1',
}

function getExternals () {
  const obj: IConfig['externals'] = {
    'nprogress': 'NProgress',
  }
  if (configInject.isProductionMode) {
    Object.assign(obj, {
      'react': 'React',
      'react-dom': 'ReactDOM',
    })
  }
  if (configInject.loadSettingsFromServer) {
    Reflect.set(obj, 'config/settings', 'clientSettings')
  }
  return obj
}

// ref: https://umijs.org/config/
const config: IConfig = {
  nodeModulesTransform: {
    type: 'none',
    exclude: [],
  },
  favicon: configInject.publicPath + 'icon.svg',
  publicPath: configInject.publicPath,
  externals: getExternals(),
  outputPath: configInject.outPutPath,
  headScripts: configInject.isProductionMode ? [
    '//cdn.jsdelivr.net/npm/react@16.12.0/umd/react.production.min.js',
    '//cdn.jsdelivr.net/npm/react-dom@16.13.1/umd/react-dom.production.min.js',
  ] : [],
  routes: [
    {
      path: '/',
      component: '../layouts/index',
      routes: [
        { path: '/', component: '../pages/index/basic.tsx', exact: true },
        { path: '/:roomToken', component: '../pages/index/basic.tsx', exact: true },
      ]
    }
  ],
  antd: false,
  dva: {
    immer: false,
    hmr: true,
  },
  dynamicImport: {
    loading: '@/components/pageLoading'
   },
  chainWebpack: (config, webpack) => {
    config.resolve.alias.set('config', path.join(__dirname, './config'))
    config.resolve.alias.set('@', path.join(__dirname, './src'))
    config.resolve.alias.set('@global', path.join(__dirname, '../'))
    config.module.rule('common').test((validatePath) => {
      return validatePath.includes(path.resolve(__dirname, '../common/'))
    }).
      exclude.add(__dirname).end().
      use('ts').loader('ts-loader').options({
      configFile: path.join(__dirname, 'tsconfig.json')
    })
  },
  theme: {
  },
  extraBabelPlugins: [
    [
      'import',
      {
        'libraryName': '@material-ui/core',
        'libraryDirectory': 'esm',
        'camel2DashComponentName': false
      },
      'core'
    ],
    [
      'import',
      {
        'libraryName': '@material-ui/lab',
        'libraryDirectory': 'esm',
        'camel2DashComponentName': false
      },
      'lab'
    ],
    [
      'import',
      {
        'libraryName': '@material-ui/icons',
        'libraryDirectory': 'esm',
        'camel2DashComponentName': false
      },
      'icon'
    ],
  ]
}

if (configInject.isProductionMode && Array.isArray(config.extraBabelPlugins)) {
  config.extraBabelPlugins.push([
    'transform-remove-console',
    { "exclude": ["error", "warn"] }
  ])
}


export default config;
