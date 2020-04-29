import { IConfig } from 'umi-types';
import path from 'path'
import settings from './config/settings'

// ref: https://umijs.org/config/
const config: IConfig = {
  treeShaking: true,
  context: {
    httpServerUrl: settings.httpServer,
  },
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
    [
      'transform-remove-console',
      { "exclude": ["error", "warn"] }
    ],
  ]
}

export default config;
