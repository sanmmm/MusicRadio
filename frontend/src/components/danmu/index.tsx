import React, { useEffect, useState } from 'react'
import bindClass from 'classnames'
import { connect } from 'dva'
import {useMediaQuery} from 'react-responsive'

import {MessageItem, DanmuItem} from '@/typeConfig'
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

    // useEffect(() => {
    //     if (!danmuList.length) {
    //         dispatch({
    //             type: 'chatList/addDanmuItem',
    //             payload: {
    //                 items: [
    //                     {
    //                         content: '[系统消息]初听不知曲中意 再听已是曲中人，快来跟大家谈谈感受吧',
    //                         time: Date.now()
    //                     }
    //                 ]
    //             }
    //         })
    //         return
    //     }
    //     const preSetTotalTime = 8000
    //     const averageDuration = Math.floor(preSetTotalTime / danmuList.length)
    //     let refreshDuration = averageDuration
    //     if (averageDuration > configs.danmuMaxRefreshDuration) {
    //         refreshDuration = configs.danmuMaxRefreshDuration
    //     }
    //     if (averageDuration < configs.danmuMinRefreshDuration) {
    //         refreshDuration = configs.danmuMinRefreshDuration
    //     }
    //     const timer = setInterval(() => {
    //         dispatch({
    //             type: 'chatList/refreshDamuList',
    //             payload: {
    //             }
    //         })
    //     }, refreshDuration)
    //     return () => {
    //         clearInterval(timer)
    //     }
    // }, [danmuList.length])


    useEffect(() => {
        dispatch({
            type: 'chatList/addDanmuItem',
            payload: {
                items: [
                    {
                        from: '伯钧大魔王',
                        content: '18年好啊',
                        time: '2018-02-03',
                    },
                    {
                        from: '用户2',
                        content: '19年号',
                        time: '2019-01-01',
                    },
                    {
                        from: '用户3',
                        content: '19年号',
                        time: '2019-01-01 01:22:23',
                    },
                    {
                        from: '管理员',
                        tag: '管理员',
                        content: '友好讨论',
                        time: '2019-01-033434',
                    },
                    {
                        from: '伯钧大魔王',
                        content: '18年好啊',
                        time: '2018-02-03dgf',
                    },
                    {
                        from: '用户2',
                        content: '19年号',
                        time: '2019-01-01dfdf',
                    },
                    {
                        from: '用户3',
                        content: '19年号22',
                        time: '2019-01-01 01:22:23dfdf',
                    },
                    {
                        from: '管理员',
                        tag: '管理员',
                        content: '友好讨论33',
                        time: '2019-01-03sdssdsd',
                    },
                    {
                        from: '伯钧大魔王',
                        content: '18年好33啊',
                        time: '2018-02-03sdsd',
                    },
                    {
                        from: '用户2',
                        content: '19年号33',
                        time: '2019-01-01dfdfd',
                    },
                    {
                        from: '用户3',
                        content: '19年号3333',
                        time: '2019-01-0101:22:23dfdf',
                    },
                    {
                        from: '管理员',
                        tag: '管理员',
                        content: '友好讨333论',
                        time: '2019-01-03dfdfdf',
                    },
                ]
            }
        })
    }, [])

    return <div>
        <div className={styles.damuListBox} style={{ height: `${maxShowCount * 1.5 * danmuContentHeight}px` }}>
            {danmuList.map(d => <div key={d.time} className={bindClass(styles.item, d.levelValue === 1 && styles.highLight)}
                style={{
                    height: danmuContentHeight,
                    top: `${danmuContentHeight * 1.5 * d.levelValue}px`
                }}
            >
                <div className={styles.placeholder} style={{maxWidth: `${(d.offset * 100).toFixed(2)}%`}}></div>
                <div className={styles.content}>{d.content}</div>
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
