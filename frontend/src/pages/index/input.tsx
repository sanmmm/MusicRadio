import React, { useEffect, useState, useMemo } from 'react'
import bindClass from 'classnames'
import { Button, TextField } from '@material-ui/core'
import { useMediaQuery } from 'react-responsive'

import FocusInputWrapper from '@/components/focusMobileInput'
import HashRoute, { hashRouter, HashRouter } from '@/components/hashRouter'
import EmojiSearch from '@/components/chatList/emoji'
import PlayList from '@/components/musicList'
import ChatList from '@/components/chatList'
import MusicSearch from '@/components/musicSearchList'
import configs from '@/config'
import { MessageTypes, MessageItem } from '@/typeConfig'
import styles from './style.less'

interface ChatInputProps {
}

enum ActionTypes {
    emoji = 'emoji', // 表情选择
    vote = 'vote',
    playList = 'playList', // 播放列表 
    chatList = 'chatList', // 评论弹幕
    searchMusic = 'searchMusic', // 
    info = 'info', // 说明
}

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
        render: () => <PlayList />
    },
    {
        icon: 'comment',
        type: ActionTypes.chatList,
        label: '查看评论',
        showInPc: false,
        render: () => <ChatList />
    },
    {
        icon: 'search',
        type: ActionTypes.searchMusic,
        label: '搜索音乐',
        showInPc: true,
        render: () => <MusicSearch baseHashPath={ActionTypes.searchMusic} />
    },
    {
        icon: 'detail',
        type: ActionTypes.info,
        label: '查看说明',
        showInPc: true,
        render: () => <div>
            <p>关于点歌: 可以在输入框中输入发送 “点歌 歌名” 或者 “点歌 音乐对应id” （id为网易云音乐对应id） 来点歌，
                也可以点击【搜索音乐】来更方便地点歌
    </p>
        </div>
    },
]

const ChatInput: React.FC<ChatInputProps> = function (props) {
    const [contentStr, setContent] = useState('' as string)

    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    console.log('render input')

    const handleAction = (actionType: ActionTypes) => {
        hashRouter.push(`/${actionType}`)
        if (actionType === ActionTypes.vote) {

        } else {

        }
    }

    const drawerWrapper = (content) => (appendClassName) => <div className={styles.mask} style={{ position: isMobile ? 'fixed' : 'absolute' }}
        onClick={_ => hashRouter.push('/')}
    >
        <div className={bindClass(styles.drawer, appendClassName)} onClick={e => e.stopPropagation()}>
            {content}
        </div>
    </div>
    const renderActions = actionsConfig.filter(obj => isMobile || obj.showInPc)

    return <div className={styles.sendMessageBox}>
        <HashRouter>
            <FocusInputWrapper>
                {
                    inputRef => <div className={styles.box}>
                        <TextField multiline={true} inputRef={inputRef} placeholder="发送消息" color="secondary" onChange={e => {
                            const value = e.target.value
                            setContent(value)
                        }} />
                        <span className="iconfont icon-emoji" onClick={handleAction.bind(null, ActionTypes.emoji)}></span>
                        <Button
                            disabled={!contentStr.length}
                            onClick={_ => {
                                if (contentStr.length && contentStr.length < configs.maxInputMessage) {
                                    // 
                                } else {
                                    // TODO
                                }
                            }}>
                            发送
                    </Button>
                    </div>}
            </FocusInputWrapper>
            <div className={bindClass(styles.actionsBox, isMobile && styles.mobile)}>
                {renderActions.map(obj => <div key={obj.type} onClick={_ => handleAction(obj.type)}>
                    <span className={`iconfont icon-${obj.icon}`}
                    ></span>
                    {!isMobile && <span>{obj.label}</span>}
                </div>)}
            </div>
            <HashRoute path={`/${ActionTypes.emoji}`} exact={true} startAniamtiojn={styles.drawerStartAnimation} endAnimation={styles.drawerEndAnimation}
                animationDuration={0.5}
            >
                {
                    drawerWrapper(<EmojiSearch />)
                }
            </HashRoute>
            {
                renderActions.filter(obj => !!obj.render).map(obj => <HashRoute key={obj.type} exact={true} path={`/${obj.type}`}
                    startAniamtiojn={styles.drawerStartAnimation} endAnimation={styles.drawerEndAnimation}
                    animationDuration={0.5}
                >
                    {
                        drawerWrapper(obj.render())
                    }
                </HashRoute>)}

        </HashRouter>

    </div>
}

export default ChatInput
