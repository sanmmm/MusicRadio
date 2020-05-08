import React, { useEffect, useState } from 'react';
import styles from './index.less';
import 'react-perfect-scrollbar/dist/css/styles.css';
import { connect } from 'dva'
import {history as router} from 'umi'
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'

import Notification from '@/components/notification'
import {HashRouter} from '@/components/hashRouter'
import { WindowHeightProvider } from '@/components/windowHeightListen/index'
import configs from 'config/base.conf'
import settings from 'config/settings'
import { ConnectProps, ConnectState, PlayListModelState, CenterModelState } from '@/models/connect'
import { ScoketStatus } from '@global/common/enums'
import Header from './header'

interface LayoutProps extends ConnectProps {
  nowPlaying: PlayListModelState['nowPlaying'];
  userInfo: CenterModelState['userInfo'];
  nowRoomInfo: CenterModelState['nowRoomInfo'];
  socketStatus: CenterModelState['nowSocketStatus'];
}


const BasicLayout: React.FC<LayoutProps> = React.memo(props => {
  const { nowPlaying, dispatch } = props
  const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
  useEffect(() => {
    dispatch({
      type: 'center/saveData',
      payload: {
        isMobile
      }
    })
    if (isMobile) {
      document.documentElement.style.fontSize = "14px"
    }
  }, [])

  return (
    <WindowHeightProvider>
      <Notification />
      <div className={styles.normal}>
        <Header />
        <HashRouter>
          {props.children}
        </HashRouter>
        <div className={styles.mask}>
        </div>
        <div className={styles.playerBackground} style={{
          backgroundImage: `url("${(nowPlaying && nowPlaying.pic) || settings.defaultMaskImg}")`
        }}>
        </div>
      </div>
      <div>
      </div>
    </WindowHeightProvider>
  );
});

export default connect(({ playList: { nowPlaying }, center: { nowSocketStatus, userInfo, nowRoomInfo } }: ConnectState) => {
  return {
    nowPlaying,
    nowRoomInfo,
    socketStatus: nowSocketStatus,
    userInfo,
  }
})(BasicLayout);
