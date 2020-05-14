import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { connect } from 'dva'
import { Fab, Zoom } from '@material-ui/core';
import { ArrowDownward as ArrowDown } from '@material-ui/icons'

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
import { CustomTabs, CustomTab } from '@/utils/styleInject'
import { RoomMusicPlayMode } from '@global/common/enums';
import { getLocalStorageData, setLocalStorageData } from '@/utils';
interface IndexProps extends ConnectProps {
    nowUserInfo: CenterModelState['userInfo'];
    isRoomAdmin: boolean;
    openDanmu: boolean;
    nowRoomInfo: CenterModelState['nowRoomInfo'];
}

enum TabTypes {
    playList = 'playList',
    chatList = 'chatList',
    actionList = 'actionList',
    onlineUsers = 'onlineUsers',
}

const Index: React.FC<IndexProps> = function Index(props) {
    const { dispatch, nowUserInfo, isRoomAdmin, nowRoomInfo } = props
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const [isInitial, setIsInitial] = useState(true)
    const [showArrowDownButton, setShowArrowDownButton] = useState(getLocalStorageData('showArrowDownButton', true) as boolean)
    const [showArrowDownButtonOuter, setShowArrowDownButtonOuter] = useState(getLocalStorageData('showArrowDownButton', true) as boolean)
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

    const handlePageChange = useCallback(() => {
        if (showArrowDownButton) {
            setShowArrowDownButton(false)
            setLocalStorageData('showArrowDownButton', false)
        }
    }, [])

    const toPrevPage = useCallback(() => {
        scrollRef.current.toPreviousPage()
    }, [])

    const toNextPage = useCallback(() => {
        scrollRef.current.toNextPage()
    }, [])

    const handleNotShowArrowButton = useCallback(() => {
        setShowArrowDownButtonOuter(false)
    }, [])

    return isInitial ? null : <div>

        <ScrollPage ref={scrollRef}
            onPageChange={handlePageChange}
        >
            <ScrollPageItem>
                {
                    (isShow) => <div className={styles.radioPageOuter}>
                        {
                            showArrowDownButtonOuter && <div
                                className={styles.arrowDownButton}
                                onClick={toNextPage}>
                                <Zoom in={showArrowDownButton} onExited={handleNotShowArrowButton}>
                                    <Fab>
                                        <ArrowDown />
                                    </Fab>
                                </Zoom>
                            </div>
                        }
                        <HandleSelectedMessage />
                        <div className={bindClass(styles.radioPage, isMobile ? styles.mobile : styles.normal)} >
                            <div className={bindClass(isMobile ? styles.top : styles.left)}>
                                <div className={bindClass(isMobile && styles.playerOuter)}>
                                    <MyPlayer isMobile={isMobile} simpleMode={!isShow} />
                                </div>
                                <div className={styles.danmuOuter}>
                                    {
                                        props.openDanmu &&
                                        <DanmuBox />
                                    }
                                </div>
                            </div>
                            <div className={isMobile ? styles.bottom : styles.right} ref={actionAreaEleRef}>
                                <ActionsArea nowRoomInfo={nowRoomInfo} isRoomAdmin={isRoomAdmin} isMobile={isMobile} />
                            </div>
                        </div>
                    </div>
                }
            </ScrollPageItem>
            <ScrollPageItem>
                {
                    (show) => {
                        return <RoomList isInShow={show} toPrevPage={toPrevPage} />
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
    const { isMobile, nowRoomInfo, isRoomAdmin } = props
    const [activeTab, setActiveTab] = useState(TabTypes.chatList)

    const handleTabChange = useCallback((_, type) => setActiveTab(type as TabTypes), [])
    return isMobile ? <MessageInputBox /> :
        <React.Fragment>
            <CustomTabs value={activeTab} onChange={handleTabChange} scrollButtons="auto" variant="scrollable">
                <CustomTab label="消息列表" value={TabTypes.chatList} />
                <CustomTab label="播放列表" value={TabTypes.playList} disabled={!!nowRoomInfo && nowRoomInfo.playMode === RoomMusicPlayMode.auto} />
                {
                    isRoomAdmin && [
                        <CustomTab label="操作记录" value={TabTypes.actionList} key={TabTypes.actionList} />,
                        <CustomTab label="在线用户" value={TabTypes.onlineUsers} key={TabTypes.onlineUsers} />
                    ]
                }
            </CustomTabs>
            <TabContent activeKey={activeTab}>
                <TabContent.Item key={TabTypes.chatList}>
                    <div className={styles.chatListTabContent}>
                        <ChatList className={styles.chatList} />
                        <MessageInputBox />
                    </div>
                </TabContent.Item>
                <TabContent.Item key={TabTypes.playList}>
                    <PlayList />
                </TabContent.Item>
                {
                    isRoomAdmin && [
                        <TabContent.Item key={TabTypes.actionList}>
                            <AdminActionsManage />
                        </TabContent.Item>,
                        <TabContent.Item key={TabTypes.onlineUsers}>
                            <OnlineUserManage />
                        </TabContent.Item>
                    ]
                }
            </TabContent>
        </React.Fragment>
})