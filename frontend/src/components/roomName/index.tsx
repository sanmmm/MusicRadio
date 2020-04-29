import bindClass from 'classnames'
import { useMediaQuery } from 'react-responsive'
import React, { useEffect, useState, useRef } from 'react'
import { connect } from 'dva';

import styles from './style.less'
import { ConnectState, CenterModelState } from '@/models/connect';
import configs from 'config/base.conf';
import SignalIcon from '@/components/signalIcon';
import styleConf from 'config/baseStyle.conf';

interface Props {
    nowRoomInfo: CenterModelState['nowRoomInfo'];
}

enum Status {
    initial,
    overflow,
    notOverlofw,
}

const calcNameShowDuration = (contentWidth: number) => {
    return (contentWidth / 14) * 0.6 || 6
}

const RoomInfoShow = React.memo<Props>((props) => {
    const { nowRoomInfo } = props
    const roomName = nowRoomInfo ? nowRoomInfo.name : ''
    const containerRef = useRef<HTMLDivElement>(null)
    const [status, setStatus] = useState(null)
    const [units, setUnits] = useState([] as string[])
    const nameShowDurationRef = useRef(6)
    const nameShowDuration = nameShowDurationRef.current
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })

    useEffect(() => {
        setStatus(Status.initial)
    }, [roomName])

    useEffect(() => {
        if (status === Status.initial) {
            requestAnimationFrame(() => {
                const node = containerRef.current
                if (node) {
                    const scrollWidth = node.scrollWidth
                    const clientWidth = node.clientWidth
                    const status = scrollWidth > clientWidth ? Status.overflow : Status.notOverlofw
                    setStatus(status)
                    if (status === Status.overflow) {
                        const duration = calcNameShowDuration(scrollWidth)
                        nameShowDurationRef.current = duration
                    }
                }
            })
        }
        if (status === Status.overflow) {
            setUnits(['1', '2'])
        }
    }, [status])

    return <div className={styles.roomHeaderInfo}>
        <div className={styles.nameLine}>
        <SignalIcon color={styleConf.highLightColor} size={isMobile ? 16 : 20}/>
        <div ref={containerRef} className={bindClass(styles.nameBox, isMobile && styles.mobile)}>
            {
                status === Status.initial && roomName
            }
            {
                status === Status.notOverlofw && <span className={styles.unitBase}>{roomName}</span>}
            {
                status === Status.overflow && <React.Fragment>
                    {
                        units.map((key, index) => <span key={key}
                            className={styles.unit}
                            style={{
                                animationDelay: `-${(1 - index) * nameShowDuration}s`,
                                animationDuration: `${nameShowDuration * 2}s`,
                            }}
                        >{roomName}</span>)}
                </React.Fragment>
            }
        </div>
        </div>
        {
            isMobile && nowRoomInfo && <div className={styles.bottomLine}>
                <span>
                {[nowRoomInfo.heat, nowRoomInfo.max].filter(v => v >= 0).join('/')}人在线
                </span>
            </div>}
    </div>
})

export default connect(({ center: { nowRoomInfo } }: ConnectState) => {
    return {
        nowRoomInfo,
    }
})(RoomInfoShow)
