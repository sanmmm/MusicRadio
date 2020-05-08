import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { connect } from 'dva'
import { withRouter,history as router } from 'umi'
import { RouteComponentProps } from 'react-router'
import { Tab, Tabs, makeStyles, Dialog, DialogTitle, DialogContent } from '@material-ui/core'

import { MessageTypes } from 'config/type.conf'
import { ConnectProps, ConnectState, CenterModelState, } from '@/models/connect'
import configs from 'config/base.conf'
import globalConfigs from '@global/common/config'
import styles from './style.less'
import MyPlayer from '@/components/player'
import ChatList from '@/components/chatList'
import PlayList from '@/components/musicList'
import DanmuBox from '@/components/danmu'
import { AdminActionsManage, OnlineUserManage } from '@/components/adminActionManage'
import TabContent from '@/components/tabContent'
import ScrollPage, { ScrollPageItem } from '@/components/scrollPage'
import usePreventScrollAndSwipe from '@/components/hooks/preventScrollAndSwipe'
import MessageInputBox from './input'
import RoomList from './roomList'
import HandleSelectedMessage from './handleSelectMessage'
import { CustomTabs, CustomTab } from '../../utils/styleInject'
import { RoomMusicPlayMode } from '@global/common/enums';
interface IndexProps extends ConnectProps {
    nowUserInfo: CenterModelState['userInfo'];
    isRoomAdmin: boolean;
    openDanmu: boolean;
    nowRoomInfo: CenterModelState['nowRoomInfo'];
}

enum TabTyps {
    playList = 'playList',
    chatList = 'chatList',
    actionList = 'actionList',
    onlineUsers = 'onlineUsers',
}

const Index: React.FC<IndexProps> = function Index (props) {
    const { dispatch, nowUserInfo, isRoomAdmin, nowRoomInfo } = props
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const [isInitial, setIsInitial] = useState(true)
    const scrollRef = useRef(null)
    const actionAreaEleRef = usePreventScrollAndSwipe()

    useEffect(() => {
        props.dispatch({
            type: 'center/saveData',
            payload: {
                nowRoomInfo: null,
                adminActionList: [],
                hasMoreActions: false,
                chatList: [],
                onlineUserList: [],
                hasMoreOnlineUsers: true,
                roomList: [],
                hasMoreRoomItems: true,
            }
        })
        props.dispatch({
            type: 'chatList/initState',
            payload: {
                exclude: ['lastReadDanmuItemTime']
            }
        })
        props.dispatch({
            type: 'playList/initState'
        })
        setIsInitial(false)
    }, [])

    useEffect(() => {
        props.dispatch({
            type: 'center/loadRoomInitData',
            payload: {
                roomId: nowUserInfo.nowRoomId
            }
        })
    }, [])

    const toPrevPage = useCallback(() => {
        scrollRef.current.toPreviousPage()
    }, [])


    return isInitial ? null : <div>

        <ScrollPage ref={scrollRef}
        >
            <ScrollPageItem>
                {
                    (isShow) => <div className={styles.radioPageOuter}>
                        <HandleSelectedMessage />
                        <div className={bindClass(styles.radioPage, isMobile ? styles.mobile : styles.normal)} >
                            <div className={bindClass(isMobile ? styles.top : styles.left)}>
                                <div className={bindClass(!isShow && styles.fixPlayerBox, isMobile && styles.playerOuter)}>
                                    <MyPlayer isMobile={isMobile} simpleMode={!isShow} />
                                </div>
                                <div className={styles.danmuOuter}>
                                    {
                                        props.openDanmu && 
                                        <DanmuBox  />
                                    }
                                </div>
                            </div>
                            <div className={isMobile ? styles.bottom : styles.right} ref={actionAreaEleRef}>
                                <ActionsArea nowRoomInfo={nowRoomInfo} isRoomAdmin={isRoomAdmin} isMobile={isMobile}/>
                            </div>
                        </div>
                    </div>}
            </ScrollPageItem>
            <ScrollPageItem>
                {
                    (show) => {
                        return <RoomList isInShow={show} toPrevPage={toPrevPage}/>
                    }
                }
            </ScrollPageItem>

        </ScrollPage>
    </div>
}

export default connect(({ center: { userInfo, isRoomAdmin, openDanmu, nowRoomInfo } }: ConnectState) => {
    return {
        nowUserInfo: userInfo,
        nowRoomInfo,
        isRoomAdmin,
        openDanmu,
    }
})(Index)


const ActionsArea = React.memo<{
    isMobile: boolean;
    isRoomAdmin: boolean;
    nowRoomInfo: CenterModelState['nowRoomInfo'];
}>(function (props) {
    const {isMobile, nowRoomInfo, isRoomAdmin} = props
    const [activeTab, setActiveTab] = useState(TabTyps.chatList)

    const handleTabChange = useCallback((_, type) => setActiveTab(type as TabTyps), [])
    return isMobile ? <MessageInputBox /> :
    <React.Fragment>
        <CustomTabs value={activeTab} onChange={handleTabChange} scrollButtons="auto" variant="scrollable">
            <CustomTab label="消息列表" value={TabTyps.chatList} />
            <CustomTab label="播放列表" value={TabTyps.playList} disabled={!!nowRoomInfo && nowRoomInfo.playMode === RoomMusicPlayMode.auto}/>
            {
                isRoomAdmin && [
                    <CustomTab label="操作记录" value={TabTyps.actionList} key={TabTyps.actionList} />,
                    <CustomTab label="在线用户" value={TabTyps.onlineUsers} key={TabTyps.onlineUsers} />
                ]
            }
        </CustomTabs>
        <TabContent activeKey={activeTab}>
            <TabContent.Item key={TabTyps.chatList}>
                <div className={styles.chatListTabContent}>
                    <ChatList className={styles.chatList}/>
                    <MessageInputBox />
                </div>
            </TabContent.Item>
            <TabContent.Item key={TabTyps.playList}>
                <PlayList />
            </TabContent.Item>
            {
                isRoomAdmin && [
                    <TabContent.Item key={TabTyps.actionList}>
                        <AdminActionsManage />
                    </TabContent.Item>,
                    <TabContent.Item key={TabTyps.onlineUsers}>
                        <OnlineUserManage />
                    </TabContent.Item>
                ]
            }
        </TabContent>
    </React.Fragment>
})