import React, { useEffect, useState, useRef } from 'react'
import bindClass from 'classnames'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'

import { MessageItem, DanmuItem, MessageTypes } from 'config/type.conf'
import { ConnectProps, ConnectState, ChatListModelState } from '@/models/connect'
import configs from 'config/base.conf'
import styles from './index.less'
interface DanmuBoxProps extends ConnectProps {
    danmuList: DanmuItem[];
    handleDamuClick?: (message: MessageItem, index: number) => any;
    isPaused: boolean;
}

const danmuContentHeight = 28

const caclRefreshDuration = (dataLength: number) => {
    if (!dataLength) {
        return 1100
    }
    const durations = [1100, 1000, 900, 800, 700, 600]
    const duration = durations[Math.ceil(dataLength / 10) - 1] || 600
    return duration
}

const DanmuBox: React.FC<DanmuBoxProps> = function (props) {
    const { danmuList, dispatch, isPaused } = props
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const maxShowCount = isMobile ? 3 : 7
    const [refreshCounter, setRefreshCounter] = useState(0)
    const refreshTimerRef = useRef(null)
    const refreshDurationRef = useRef(0)
    const refreshCounterRef = useRef(refreshCounter)
    refreshCounterRef.current = refreshCounter
    const danmuQueueRef = useRef([] as DanmuItem[])
    const danmuListRef = useRef([] as ChatListModelState['danmuList'])
    danmuListRef.current = danmuList


    useEffect(() => {
        if (!isPaused && (!!danmuList.length || !!danmuQueueRef.current.length)) {
            startDamuRefreshTask(refreshDurationRef.current)
            return stopDamuRefreshTask
        } else {
            if (!isPaused) {
                const timer = setInterval(() => {
                    dispatch({
                        type: 'chatList/addDanmuItems',
                        payload: {
                            items: [
                                {
                                    content: {
                                        text: '[系统消息]有哪些好听的歌会让你感同身受，快来跟大家谈谈感受吧',
                                    },
                                    type: MessageTypes.advanced,
                                    time: Date.now()
                                }
                            ]
                        }
                    })
                }, maxShowCount * 1100)
                return () => {
                    clearInterval(timer)
                }
            }
        }
    }, [isPaused, !!danmuList.length || !!danmuQueueRef.current.length])

    const handleRefresh = () => {
        const danmuQueue = danmuQueueRef.current, danmuList = danmuListRef.current,
            refreshCounter = refreshCounterRef.current
        if (!danmuQueue.length && !danmuList.length) {
            stopDamuRefreshTask()
            return
        }

        let newQueue = danmuQueue,
            needDispatch = false
        if (danmuQueue.length && danmuQueue[0].levelValue <= refreshCounter - 1) {
            danmuQueue.shift()
            newQueue = danmuQueue
        }
        if (danmuList.length) {
            let lastQueneLevelValue = danmuQueue.length ? danmuQueue[danmuQueue.length - 1].levelValue : 0
            const minLevel = refreshCounter + maxShowCount
            if (lastQueneLevelValue < minLevel) {
                lastQueneLevelValue = minLevel
            }
            const supplementArr = danmuList.map((item, index) => {
                return {
                    ...item,
                    levelValue: lastQueneLevelValue + 1 + index,
                    offset: Math.random() * 0.8,
                }
            })
            needDispatch = true
            newQueue = newQueue.concat(supplementArr)
        }
        danmuQueueRef.current = newQueue
        if (needDispatch) {
            dispatch({
                type: 'chatList/saveData',
                payload: {
                    danmuList: []
                }
            })
        }
        setRefreshCounter((counter) => counter + 1)

        const newDuration = caclRefreshDuration(newQueue.length)
        if (newDuration !== refreshDurationRef.current) {
            refreshDurationRef.current = newDuration
            stopDamuRefreshTask()
            startDamuRefreshTask(newDuration)
        }
    }

    const startDamuRefreshTask = (duration) => {
        if (refreshTimerRef.current) {
            return
        }
        refreshTimerRef.current = setInterval(handleRefresh, duration)
    }

    const stopDamuRefreshTask = () => {
        const timer = refreshTimerRef.current
        if (timer) {
            clearInterval(timer)
            refreshTimerRef.current = null
        }
    }

    const handleItemClick = (item) => {
        if (!item.fromId) {
            return
        }
        dispatch({
            type: 'chatList/selectMessageItem',
            payload: {
                selectedMessageItem: {
                    ...item
                }
            }
        })
    }

    const danmuQueue = danmuQueueRef.current
    return <div className={styles.damuListBox} style={{ height: `${maxShowCount * 1.5 * danmuContentHeight}px`, maxHeight: '100%' }}>
        {danmuQueue.slice(0, maxShowCount * 2).map(d => <div key={d.levelValue} className={styles.item}
            style={{
                height: danmuContentHeight,
                top: `${danmuContentHeight * 1.5 * (d.levelValue - refreshCounter)}px`,
            }}
        >
            {!isMobile && <div className={styles.placeholder} style={{ maxWidth: `${(d.offset * 100).toFixed(2)}%` }}></div>}
            <div className={bindClass(styles.content, {
                [styles.advanced]: d.type === MessageTypes.advanced,
                [styles.emoji]: d.type === MessageTypes.emoji,
                [styles.notice]: [MessageTypes.notice].includes(d.type),
            })}
                onClick={handleItemClick.bind(null, d)}
            >
                {d.content.text || `[图片消息: ${d.content.title}]点击查看图片`}
            </div>
        </div>)}
    </div>
}

export default connect(({ chatList, }: ConnectState) => {
    const { danmuList, selectedMessageItem } = chatList
    return {
        danmuList,
        isPaused: !!selectedMessageItem,
    }
})(DanmuBox)
