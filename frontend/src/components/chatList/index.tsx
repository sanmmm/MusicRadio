import React, { useEffect, useState } from 'react'
import bindClass from 'classnames'
import { Slider } from '@material-ui/core'
import { PlayArrow, Pause, VolumeUp, VolumeOff } from '@material-ui/icons'
import dayjs, { Dayjs } from 'dayjs'

import InputBox from './input'
import styles from './index.less'

enum MessageTypes {
    notice, // 系统通知
    advanced, // 高级弹幕， 房管，或超级管理员所发
    normal, // 普通消息
    send, // 发送的消息(仅发送者本地可见)
    response, // 系统响应
}

interface MessageItem {
    from: string;
    tag?: string; // 发送者的头衔
    content: string;
    time: string;
    type: MessageTypes;
}

interface ChatListProps {
    messages: MessageItem[]
}

const ChatList: React.FC<ChatListProps> = function (props) {
    const { messages = [] } = props
    const [renderMessages, setRenderMessages] = useState([] as MessageItem[][])
    useEffect(() => {
        const renderArr = []
        const nowDay = new Date().getDate()
        let subArr = [], lastTime: Dayjs
        messages.forEach((m, index) => {
            const messageDate = dayjs(m.time)
            if (!lastTime) {
                lastTime = messageDate
            }
            let flag = false
            if (messageDate.date() === nowDay && lastTime.date() !== nowDay) {
                flag = true
            } else if (messageDate.isAfter(lastTime.add(3, 'hour'))) {
                flag = true
            }

            if (flag) {
                renderArr.push(subArr)
                subArr = []
            }
            subArr.push(m)
            lastTime = messageDate
            if (index === messages.length - 1) {
                renderArr.push(subArr)
            }
        })
        setRenderMessages(renderArr)
    }, [messages])

    const renderItem = (m: MessageItem) => {
        let content = null
        if (m.type === MessageTypes.response) {
            content = <div key={m.time} className={bindClass(styles.messageItem, styles.response)}>
                <span>{m.content}</span>
            </div>
        } else {
            content = <div key={m.time} className={styles.messageItem}>
                <div className={styles.header}>
                    {
                        m.type === MessageTypes.advanced && `[${m.tag}] `}
                    {
                        m.type === MessageTypes.send && '[已发送] '
                    }
                    {m.from}
                </div>
                <div className={bindClass(styles.content, m.type === MessageTypes.advanced && styles.advanced,
                    m.type === MessageTypes.notice && styles.notice)}>{m.content}</div>
            </div>
        }
        return content
    }
    const nowDate = dayjs().date(), nowMonth = dayjs().month(), nowYear = dayjs().year()
    return <div className={styles.chatListBox}>
        {
            renderMessages.map((msgs, i) => {
                const msgDate = dayjs(msgs[0].time)
                // TODO 日期更精细化格式化
                let formatStr = 'YYYY-MM-DD HH:mm'
                if (msgDate.year() === nowYear) {
                    formatStr = 'MM-DD HH:mm'
                    if (msgDate.month() === nowMonth && msgDate.date() === nowDate) {
                        formatStr = 'HH:mm'
                    }
                }

                const startDateStr = dayjs(msgs[0].time).format(formatStr)
                return <div key={i} className={styles.messageItemSubArr}>
                    <div className={bindClass(styles.messageItem, styles.time)}><span>{startDateStr}</span></div>
                    {
                        msgs.map(renderItem)
                    }
                </div>
            })
        }
    </div>
}

export default ChatList

export const InputMessageBox = InputBox
