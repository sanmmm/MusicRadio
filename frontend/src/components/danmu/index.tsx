import React, { useEffect, useState } from 'react'
import bindClass from 'classnames'
import { connect } from 'dva'
import {useMediaQuery} from 'react-responsive'

import {MessageItem, DanmuItem, MessageTypes} from '@/typeConfig'
import { ConnectProps, ConnectState } from '@/models/connect'
import configs from '@/config'
import styles from './index.less'


interface DanmuBoxProps extends ConnectProps {
    danmuList: DanmuItem[];
    handleDamuClick: (message: MessageItem, index: number) => any;
}

const danmuContentHeight = 28

const DanmuBox: React.FC<DanmuBoxProps> = function (props) {
    const { danmuList, dispatch } = props
    const isMobile = useMediaQuery({query: configs.mobileMediaQuery})
    const maxShowCount = isMobile ? 3 : 7
    useEffect(() => {
        dispatch({
            type: 'chatList/saveData',
            payload: {
                danmuMaxShowCount: maxShowCount
            }
        })
    }, [maxShowCount])

    useEffect(() => {
        if (!danmuList.length) {
            dispatch({
                type: 'chatList/addDanmuItem',
                payload: {
                    items: [
                        {
                            content: {
                                text: '[系统消息]有那些好听的歌会让你感同身受，快来跟大家谈谈感受吧',
                            },
                            type: MessageTypes.advanced,
                            time: Date.now()
                        }
                    ]
                }
            })
            return
        }
        const preSetTotalTime = 8000
        const averageDuration = Math.floor(preSetTotalTime / danmuList.length)
        let refreshDuration = averageDuration
        if (averageDuration > configs.danmuMaxRefreshDuration) {
            refreshDuration = configs.danmuMaxRefreshDuration
        }
        if (averageDuration < configs.danmuMinRefreshDuration) {
            refreshDuration = configs.danmuMinRefreshDuration
        }
        const timer = setInterval(() => {
            dispatch({
                type: 'chatList/refreshDamuList',
                payload: {
                }
            })
        }, refreshDuration)
        return () => {
            clearInterval(timer)
        }
    }, [danmuList.length])
    

    return <div>
        <div className={styles.damuListBox} style={{ height: `${maxShowCount * 1.5 * danmuContentHeight}px` }}>
            {danmuList.map(d => <div key={d.time} className={bindClass(styles.item, d.levelValue === 1 && styles.highLight)}
                style={{
                    height: danmuContentHeight,
                    top: `${danmuContentHeight * 1.5 * d.levelValue}px`
                }}
            >
                <div className={styles.placeholder} style={{maxWidth: `${(d.offset * 100).toFixed(2)}%`}}></div>
                <div className={bindClass(styles.content, d.type === MessageTypes.advanced && styles.advanced, 
                        d.type === MessageTypes.emoji && styles.emoji, d.type === MessageTypes.notice && styles.notice)}>
                    {d.content.text || `[图片消息: ${d.content.title}]点击查看图片`}
                </div>
            </div>)}
        </div>
    </div>
}

export default connect(({ chatList }: ConnectState) => {
    const { danmuList } = chatList
    return {
        danmuList
    }
})(DanmuBox)
