import { IConfig } from 'umi-types';
import path from 'path'

const configInject = {
  publicPath: process.env.PUBLICH_PATH || '/',
  isProductionMode: process.env.NODE_ENV === 'production',
  loadSettingsFromServer: process.env.ASYNC_SETTINGS === '1',
}

function getExternals () {
  const obj: IConfig['externals'] = {}
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
  treeShaking: true,
  context: {
    isProduction: configInject.isProductionMode,
  },
  publicPath: configInject.publicPath,
  externals: getExternals(),
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
  plugins: [
    // ref: https://umijs.org/plugin/umi-plugin-react.html
    ['umi-plugin-react', {
      antd: false,
      dva: true,
      dynamicImport: { webpackChunkName: true },
      title: 'frontend',
      dll: false,

      routes: {
        exclude: [
          /components\//,
        ],
      },
    }],
  ],
  chainWebpack: (config, webpack) => {
    config.resolve.alias.set('config', path.join(__dirname, './config'))
    config.resolve.alias.set('@', path.join(__dirname, './src'))
    config.resolve.alias.set('@global', path.join(__dirname, '../'))
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

if (configInject.isProductionMode) {
  config.extraBabelPlugins.push([
    'transform-remove-console',
    { "exclude": ["error", "warn"] }
  ])
}


export default config;
