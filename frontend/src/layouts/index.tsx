import React from 'react';
import styles from './index.less';
import 'react-perfect-scrollbar/dist/css/styles.css';
import 'antd/dist/antd.less';
import zhCN from 'antd/es/locale/zh_CN';
import { connect } from 'dva'

import configs from '@/config'
import { ConnectProps, ConnectState, PlayListModelState } from '@/models/connect'

interface LayoutProps extends ConnectProps {
  nowPlaying: PlayListModelState['nowPlaying']
}

const BasicLayout: React.FC<LayoutProps> = props => {
  const { nowPlaying } = props
  return (
    <div className={styles.normal}>
      <div className={styles.header}>
        {<img src={configs.logoUrl} className={styles.logo}/>}
      </div>
      {props.children}
      <div className={styles.mask}>
      </div>
      {
        !!nowPlaying && <div className={styles.playerBackground} style={{
          backgroundImage: `url("${nowPlaying.pic}")`
        }}>
        </div>}
    </div>
  );
};

export default connect(({ playList }: ConnectState) => {
  const { nowPlaying } = playList
  return {
    nowPlaying
  }
})(BasicLayout);
