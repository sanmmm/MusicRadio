import React, { useMemo } from 'react'
import bindClass from 'classnames'

import styles from './index.less'

interface Props {
    pic: string;
    playing: string;
    title: string;
    heat: number;
    onClick?: () => any
}

const animationDuration = 2

const RoomItemShow: React.FC<Props> = (props) => {
    const { pic, playing, title, heat = 0 } = props
    const randomValues = useMemo(() => {
        return [1, 2, 3, 4].map(i => Math.random() * animationDuration)
    }, [])
    return <div className={styles.roomItem} onClick={props.onClick || null}>
        <div className={styles.main}>
            <img src={pic} />
            <div className={styles.heat}><span className="iconfont icon-persons"></span><span>{heat}</span></div>
            {!!playing && <div className={styles.playing}>
                <div className={styles.radioRandomSignalIcon}>
                    {randomValues.map(delay => <div
                        key={delay}
                        style={{ animationDelay: `${delay}s`, animationDuration: `${animationDuration}s` }}
                    >
                    </div>)}
                </div>
                <div className={styles.text} title={playing}>正在播放: {playing}</div>
            </div>}
            <div className={styles.playIcon}>
                <div className={bindClass('iconfont', 'icon-play-circle')}></div>
            </div>
        </div>
        <div className={styles.title} title={title}>{title}</div>
    </div>
}

export default RoomItemShow
