import React, { useState } from 'react'
import bindClass from 'classnames'

import styleConf from 'config/baseStyle.conf'
import styles from './style.less'

interface Props {
    paused?: boolean;
    size?: number;
    color?: string;
}

const signalIconAnimationDuration = 2

const getInitDelayData = () => [1, 2, 3, 4].map(i => Math.random() )

const SignalIcon: React.FC<Props> = (props) => {
    const [delayData, _] = useState(getInitDelayData())
    const { paused = false, color = styleConf.themeColor, size } = props
    const boxStyle = {}
    if (size) {
        Object.assign(boxStyle, {
            height: size
        })
    }
    return <div className={styles.signalIcon} style={boxStyle}>
        {
            delayData.map((randomValue, index) => {
                const style = {
                    animationDelay: `-${(randomValue * signalIconAnimationDuration).toFixed(2)}s`,
                    animationDuration: `${signalIconAnimationDuration}s`,
                    backgroundColor: color,
                }
                if (size) {
                    Object.assign(style, {
                        height: size,
                        width: size / 7 * 1.2,
                    })
                }
                return <div key={index}
                style={style}
                className={bindClass(paused && styles.paused)}
            ></div>
            })}
    </div>
}

export default SignalIcon
