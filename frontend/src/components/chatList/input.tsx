import React, { useEffect, useState } from 'react'
import bindClass from 'classnames'
import { Button, TextField } from '@material-ui/core'
import { PlayArrow, Pause, VolumeUp, VolumeOff } from '@material-ui/icons'
import dayjs, { Dayjs } from 'dayjs'

import configs from '@/config'
import styles from './index.less'


interface MessageItem {
    from: string;
    tag?: string; // 发送者的头衔
    content: string;
    time: string;
    type: MessageTypes;
}

interface ChatListProps {
    handleSendMessage: (content: string, type: MessageTypes) => any
}

const ChatList: React.FC<ChatListProps> = function (props) {
    const { handleSendMessage } = props
    const [contentStr, setContent] = useState('' as string)
    
    return <div className={styles.sendMessageBox}>
        <div>
            <TextField multiline={true} placeholder="发送消息" onChange={e => {
                const value = e.target.value
                // TODO 表情包支持
                setContent(value)
            }}/>    
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
            <div>投票切歌</div>
            <div>搜索音乐</div>
            <div>发送表情</div>
        </div>
        <div>
            <p>关于点歌: 可以在输入框中输入发送 “点歌 歌名” 或者 “点歌 音乐对应id” （id为网易云音乐对应id） 来点歌，
                也可以点击【搜索音乐】来更方便地点歌
            </p>
        </div>
    </div>
}

export default ChatList
