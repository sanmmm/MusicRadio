import React, {useEffect} from 'react'
import Nprogress from 'nprogress'

import styles from './style.less'

export default function PageLoading () {
    useEffect(() => {
        Nprogress.start()
        Nprogress.set(0.3)
        return () => {
            Nprogress.done()
            Nprogress.remove()
        }
    })
    return <div className={styles.loading}>
        加载中....
    </div>
}
