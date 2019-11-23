import React, { useEffect, useState } from 'react'
import bindClass from 'classnames'
import ScorllBar from 'react-perfect-scrollbar'
import dayjs, { Dayjs } from 'dayjs'
import {connect} from 'dva'

import {ConnectState, ConnectProps} from '@/models/connect'
import { MessageTypes, MessageItem } from '@/typeConfig'
import styles from './index.less'


interface ChatListProps extends ConnectProps {
    messages: MessageItem[]
}

const ChatList: React.FC<ChatListProps> = function (props) {
    const { messages = [] } = props
    const [renderMessages, setRenderMessages] = useState([] as MessageItem[][])

    useEffect(() => {
        props.dispatch({
            type: 'reqChatList',
            payload: {
                
            }
        })
    }, [])

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
                <span>{m.content.text}</span>
            </div>
        } else {
            content = <div key={m.time} className={styles.messageItem}>
                <div className={styles.header}>
                    {
                        m.type === MessageTypes.advanced && `[${m.tag}] `}
                    {
                        m.type === MessageTypes.send && '[已发送] '
                    }
                    {
                        m.type === MessageTypes.notice && '[系统消息] '
                    }
                    {m.from}
                </div>
                <div className={bindClass(styles.content, m.type === MessageTypes.advanced && styles.advanced,
                    m.type === MessageTypes.notice && styles.notice, m.type === MessageTypes.emoji && styles.emoji)}>
                    {
                        m.type === MessageTypes.emoji ? <img src={m.content.img} title={m.content.title} /> : <span>{m.content.text}</span>}
                </div>
            </div>
        }
        return content
    }
    const nowDate = dayjs().date(), nowMonth = dayjs().month(), nowYear = dayjs().year()
    return <div className={styles.chatListBox}>
        <ScorllBar style={{ height: '100%' }}>
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
        </ScorllBar>
    </div>
}

export default connect(({chatList}: ConnectState) => {
    return {
        messages: chatList.chatList
    }
})(ChatList)

