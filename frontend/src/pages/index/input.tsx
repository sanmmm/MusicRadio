import React, { useCallback, useState } from 'react'
import bindClass from 'classnames'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'
import { Button } from '@material-ui/core';

import FocusInputWrapper from '@/components/focusMobileInput'
import HashRoute, { hashRouter } from '@/components/hashRouter'
import EmojiSearch from '@/components/chatList/emoji'
import PlayList from '@/components/musicList'
import ChatList from '@/components/chatList'
import MusicSearch from '@/components/musicSearchList'
import configs from 'config/base.conf'
import styles from './style.less'
import { CustomAlert, copyToClipBoard } from '@/utils';
import { CustomTextFeild, CustomBtn } from '@/utils/styleInject'
import { ConnectProps, ConnectState, CenterModelState } from '@/models/connect'
import useSyncState from '@/components/hooks/syncAccessState';
import CustomIcon from '@/components/CustomIcon';
import TabContent from '@/components/tabContent'
import { AdminActionsManage, OnlineUserManage } from '@/components/adminActionManage'
import { RoomMusicPlayMode } from '@global/common/enums';
import { CustomTabs, CustomTab } from '@/utils/styleInject'

interface ChatInputProps extends ConnectProps {
    nowRoomId: string;
    nowRoomPassword: string;
    nowRoomInfo: CenterModelState['nowRoomInfo'];
    isRoomAdmin: boolean;
    allowComment: boolean;
    sendMessagePending: boolean;
}

enum ActionTypes {
    emoji = 'emoji', // 表情选择
    vote = 'vote', // 投票
    playList = 'playList', // 播放列表 
    chatList = 'chatList', // 评论弹幕
    searchMusic = 'searchMusic', // 搜索音乐
    info = 'info', // 说明
    manage = 'manage', // 管理
}

const ChatInput: React.FC<ChatInputProps> = React.memo(function (props) {
    const { dispatch, nowRoomId, nowRoomPassword, isRoomAdmin, nowRoomInfo } = props

    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const [getIsInChatList, setIsInChatList] = useSyncState(false)

    const actionsConfig = [
        {
            icon: 'vote',
            type: ActionTypes.vote,
            label: '投票切歌',
            showInPc: true
        },
        {
            icon: 'playlist',
            type: ActionTypes.playList,
            label: '播放列表',
            showInPc: false,
            render: () => <PlayList />,
            disabled: nowRoomInfo && nowRoomInfo.playMode === RoomMusicPlayMode.auto,
        },
        {
            icon: 'comment',
            type: ActionTypes.chatList,
            label: '查看评论',
            showInPc: false,
            render: () => <div className={styles.chatListWrapper}>
                <ChatList />
                <InputBox.Render handleShowEmoji={cbInChatList} />
            </div>
        },
        {
            icon: 'search',
            type: ActionTypes.searchMusic,
            label: '搜索音乐',
            showInPc: true,
            render: () => <MusicSearch baseHashPath={ActionTypes.searchMusic} />,
            disabled: nowRoomInfo && nowRoomInfo.playMode === RoomMusicPlayMode.auto,
        },
        {
            icon: 'detail',
            type: ActionTypes.info,
            label: '查看说明',
            showInPc: true,
            render: () => <ul className={styles.infoListBox}>
                {
                    isRoomAdmin && nowRoomPassword && <li>
                        <span>房间密码为：{nowRoomPassword}</span>
                        <Button style={{ marginLeft: '1rem' }} variant="contained" color="primary" onClick={copyToClipBoard.bind(null, nowRoomPassword, null, true)}>复制到剪贴板</Button>
                    </li>
                }
                <li>
                    关于点歌: 可以在输入框中输入发送  “点歌 音乐对应id” （id为网易云音乐对应id） 来点歌，
                    也可以点击【搜索音乐】来更方便地点歌
                </li>
                <li>
                    投票切歌: 可以在输入框输入发生“切歌”，也可以点击下方【投票切歌】来更方便切歌<br />
                    注：管理员只能创建投票，不能参与投票
                </li>
            </ul>
        },
    ]

    if (isRoomAdmin) {
        actionsConfig.push({
            icon: 'manage',
            type: ActionTypes.manage,
            label: '管理',
            showInPc: false,
            render: () => <MobileModeManageArea/>
        })
    }


    const handleAction = (actionType: ActionTypes) => {
        if (actionType === ActionTypes.vote) {
            dispatch({
                type: 'chatList/voteToCutMusic',
                payload: {
                    roomId: nowRoomId,
                    agree: true,
                }
            })
            return
        }
        hashRouter.push(`/${actionType}`)
    }

    const drawerWrapper = (content) => (appendClassName) => <div className={styles.mask} style={{ position: isMobile ? 'fixed' : 'absolute' }}
        onClick={_ => hashRouter.push('/')}
    >
        <div className={bindClass(styles.drawer, appendClassName)} onClick={e => e.stopPropagation()}>
            <div className={styles.back} onClick={_ => hashRouter.back()}><CustomIcon>back-circle</CustomIcon><span className={styles.text}>返回</span></div>
            <div className={styles.content} >
                {content}
            </div>
        </div>
    </div>
    const renderActions = actionsConfig.filter(obj => isMobile || obj.showInPc)

    const handleShowEmoji = (isInChatList = false) => {
        handleAction(ActionTypes.emoji)
        setIsInChatList(isInChatList)
    }
    const cbInChatList = useCallback(handleShowEmoji.bind(null, true), [])
    const cbNotInChatList = useCallback(handleShowEmoji.bind(null, false), [])

    const handleCloseShowEmoji = useCallback(() => {
        if (isMobile && getIsInChatList()) {
            hashRouter.push(`/${ActionTypes.chatList}`)
        } else {
            hashRouter.push('/')
        }
    }, [])
    return <div className={bindClass(styles.sendMessageBox, isMobile && styles.mobile)}>
        <InputBox.Render handleShowEmoji={cbNotInChatList} />
        <div className={bindClass(styles.actionsBox, isMobile && styles.mobile)}>
            {renderActions.map(obj => <div key={obj.type} onClick={_ => handleAction(obj.type)} className={bindClass(obj.disabled && styles.disabled)}>
                <CustomIcon>{obj.icon}</CustomIcon>
                {!isMobile && <span>{obj.label}</span>}
            </div>)}
        </div>
        <HashRoute path={`/${ActionTypes.emoji}`} exact={true} startAniamtiojn={styles.drawerStartAnimation} endAnimation={styles.drawerEndAnimation}
            animationDuration={0.4}
        >
            {
                drawerWrapper(<EmojiSearch onClose={handleCloseShowEmoji} />)}
        </HashRoute>
        {
            renderActions.filter(obj => !!obj.render).map(obj => <HashRoute key={obj.type} path={`/${obj.type}`}
                startAniamtiojn={styles.drawerStartAnimation} endAnimation={styles.drawerEndAnimation}
                animationDuration={0.4}
            >
                {
                    drawerWrapper(obj.render())
                }
            </HashRoute>)}

    </div>
})

export default connect(({ center: { userInfo, isRoomAdmin, nowRoomInfo }, loading }: ConnectState) => {
    return {
        allowComment: userInfo && userInfo.allowComment,
        nowRoomId: userInfo ? userInfo.nowRoomId : '',
        nowRoomPassword: userInfo && userInfo.nowRoomPassword,
        isRoomAdmin,
        nowRoomInfo,
        sendMessagePending: loading.effects['chatList/sendMessage'],
    }
})(ChatInput)


interface InputBoxRenderProps extends ConnectProps {
    inputMessageObj: ConnectState['chatList']['inputMessageObj'];
    nowRoomId: string;
    allowComment: boolean;
    sendMessagePending: boolean;
    handleShowEmoji: (...args: any) => any;
}

namespace InputBox {
    const InputBox = React.memo<InputBoxRenderProps>((props) => {
        const { inputMessageObj, allowComment, nowRoomId, dispatch, sendMessagePending, handleShowEmoji } = props
        const { atSign = [], text: value = '' } = inputMessageObj
        const onTextFieldChange = useCallback((e) => {
            const value = e.target.value
            dispatch({
                type: 'chatList/saveData',
                payload: {
                    inputMessageObj: {
                        ...inputMessageObj,
                        text: value
                    }
                }
            })
        }, [])

        const handleSendMessage = () => {
            let isValid = true
            if (value.startsWith('点歌')) {
                const [_, musicIdStr] = value.trim().split(/\s+/)
                const musicId = Number(musicIdStr)
                dispatch({
                    type: 'playList/addMusicToPlayList',
                    payload: {
                        roomId: nowRoomId,
                        ids: [musicId],
                    }
                })
            } else if (value === '切歌') {
                dispatch({
                    type: 'chatList/voteToCutMusic',
                    payload: {
                        roomId: nowRoomId,
                        agree: true,
                    }
                })
            } else {
                if (value.length && value.length < configs.maxInputMessage) {
                    dispatch({
                        type: 'chatList/sendMessage',
                        payload: {
                            roomId: nowRoomId,
                            text: value,
                            atSign,
                        }
                    })
                } else {
                    isValid = false
                    CustomAlert('消息不能为空或者过长!')
                }
            }
            if (isValid) {
                dispatch({
                    type: 'chatList/saveData',
                    payload: {
                        inputMessageObj: {}
                    }
                })
            }
        }
        return <FocusInputWrapper>
            {
                (inputRef, isFocus) => <div className={bindClass(styles.box, isFocus && styles.focus)}>
                    <CustomTextFeild multiline={true} fullWidth={true} value={value} inputRef={inputRef}
                        placeholder={allowComment ? '发送消息' : '您已被禁言'}
                        onChange={onTextFieldChange}
                        disabled={!allowComment}
                    />
                    <CustomIcon onClick={handleShowEmoji} className={styles.iconfont}>emoji</CustomIcon>
                    <CustomBtn
                        disabled={sendMessagePending || !allowComment}
                        onClick={handleSendMessage}>
                        发送
            </CustomBtn>
                </div>}
        </FocusInputWrapper>
    })

    export const Render = connect(({ center: { userInfo }, loading, chatList: { inputMessageObj } }: ConnectState) => {
        return {
            inputMessageObj: inputMessageObj || {},
            allowComment: userInfo && userInfo.allowComment,
            nowRoomId: userInfo ? userInfo.nowRoomId : '',
            sendMessagePending: loading.effects['chatList/sendMessage'],
        }
    })(InputBox)
}

enum ManageAreaTabTypes {
    actionList = 'actionList',
    onlineUsers = 'onlineUsers',
}

const MobileModeManageArea = React.memo<{}>(props => {
    const [activeType, setActiveType] = useState(ManageAreaTabTypes.actionList)
    const handleTabValueChenge = useCallback((_, type) => {
        setActiveType(type)
    }, [])
    return <div className={styles.sendMessageBoxMobileManageArea}>
        <CustomTabs value={activeType} onChange={handleTabValueChenge} centered variant="fullWidth">
            <CustomTab label="操作记录" value={ManageAreaTabTypes.actionList} key={ManageAreaTabTypes.actionList} />,
            <CustomTab label="在线用户" value={ManageAreaTabTypes.onlineUsers} key={ManageAreaTabTypes.onlineUsers} />
        </CustomTabs>
        <TabContent activeKey={activeType}>
            <TabContent.Item key={ManageAreaTabTypes.actionList}>
                <AdminActionsManage />
            </TabContent.Item>
                    <TabContent.Item key={ManageAreaTabTypes.onlineUsers}>
                <OnlineUserManage />
            </TabContent.Item>
        </TabContent>
    </div>
})

