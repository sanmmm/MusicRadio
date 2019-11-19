import { IConfig } from 'umi-types';
import path from 'path'

// ref: https://umijs.org/config/
const config: IConfig =  {
  treeShaking: true,
  routes: [
    {
      path: '/',
      component: '../layouts/index',
      routes: [
        { path: '/', component: '../pages/index' }
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
  chainWebpack: (config,webpack) => {
    config.resolve.alias.set('@', path.join(__dirname, './src'))
  },
  theme: {
    "primary-color": 'white',
    "text-color": 'rgba(225,225,225,.8)',
  }
}

export default config;
