import React, { useEffect } from 'react';
import styles from './index.less';
import 'react-perfect-scrollbar/dist/css/styles.css';
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'

import {WindowHeightProvider} from '@/components/windowHeightListen/index'
import configs from '@/config'
import { ConnectProps, ConnectState, PlayListModelState } from '@/models/connect'

interface LayoutProps extends ConnectProps {
  nowPlaying: PlayListModelState['nowPlaying']
}

const BasicLayout: React.FC<LayoutProps> = props => {
  const { nowPlaying } = props
  const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })

  useEffect(() => {
    if (isMobile) {
      document.documentElement.style.fontSize = "14px"
    }
  }, [])
  return (
    <WindowHeightProvider>
      <div className={styles.normal}>
        <div className={styles.header}>
          {<img src={configs.logoUrl} className={styles.logo} />}
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
    </WindowHeightProvider>
  );
};

export default connect(({ playList }: ConnectState) => {
  const { nowPlaying } = playList
  return {
    nowPlaying
  }
})(BasicLayout);
