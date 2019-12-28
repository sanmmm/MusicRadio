import React, { useState } from 'react'
import bindClass from 'classnames'

import styleConf from '@/baseStyle.conf'
import styles from './style.less'

interface Props {
    paused?: boolean;
    color?: string;
}

const signalIconAnimationDuration = 2

const getInitDelayData = () => [1, 2, 3, 4].map(i => `${(signalIconAnimationDuration * Math.random()).toFixed(2)}s`)

const SignalIcon: React.FC<Props> = (props) => {
    const [delayData, _] = useState(getInitDelayData())
    const { paused = false, color = styleConf.themeColor } = props
    return <div className={styles.signalIcon}>
        {
            delayData.map(delay => <div key={delay}
                style={{
                    animationDelay: delay,
                    animationDuration: `${signalIconAnimationDuration}s`,
                    background: color,
                }}
                className={bindClass(paused && styles.paused)}
            ></div>)}
    </div>
}

export default SignalIcon
