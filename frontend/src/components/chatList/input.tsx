import React, { useEffect, useState, useMemo } from 'react'
import bindClass from 'classnames'
import { Button, TextField } from '@material-ui/core'
import { PlayArrow, Pause, VolumeUp, VolumeOff } from '@material-ui/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useMediaQuery } from 'react-responsive'

import FocusInputWrapper from '@/components/focusMobileInput'
import HashRoute, { hashRouter, HashRouter } from '@/components/hashRouter'
import configs from '@/config'
import { MessageTypes, MessageItem } from '@/typeConfig'
import styles from './index.less'

interface ChatInputProps {
    handleSendMessage: (content: string, type: MessageTypes) => any
}

enum ActionTypes {
    emoji = 'emoji', // 表情选择
    vote = 'vote',
    palyList = 'palyList', // 播放列表 
    comments = 'comments', // 评论弹幕
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
        type: ActionTypes.palyList,
        label: '播放列表',
        showInPc: false 
    },
    {
        icon: 'comment',
        type: ActionTypes.comments,
        label: '查看评论',
        showInPc: false
    },
    {
        icon: 'search',
        type: ActionTypes.searchMusic,
        label: '搜索音乐',
        showInPc: true
    },
    {
        icon: 'detail',
        type: ActionTypes.info,
        label: '查看说明',
        showInPc: true
    },
]

const ChatInput: React.FC<ChatInputProps> = function (props) {
    const { handleSendMessage } = props
    const [contentStr, setContent] = useState('' as string)

    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    console.log('render input')
  
    const handleAction = (actionType: ActionTypes) => {
        hashRouter.push(`/${actionType}`)
        if (actionType === ActionTypes.vote) {
            
        } else {
            
        }
    }
    
    return <div className={styles.sendMessageBox}>
        <HashRoute path="/">
            <div>
                <FocusInputWrapper>
                    {
                        inputRef => <TextField multiline={true} inputRef={inputRef} placeholder="发送消息" onChange={e => {
                            const value = e.target.value
                            // TODO 表情包支持
                            setContent(value)
                        }} />}
                </FocusInputWrapper>

                <span className="iconfont icon-emoji"></span>
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
            </div>
            <div>
                {actionsConfig.filter(obj => isMobile || obj.showInPc).
                map(obj => <span key={obj.type} className={`iconfont icon-${obj.icon}`} 
                    onClick={_ => handleAction(obj.type)}
                >
                    {obj.label}
                </span>)}
            </div>
            <div>
                <p>关于点歌: 可以在输入框中输入发送 “点歌 歌名” 或者 “点歌 音乐对应id” （id为网易云音乐对应id） 来点歌，
                    也可以点击【搜索音乐】来更方便地点歌
            </p>
            </div>
        </HashRoute>

    </div>
}

export default ChatInput
