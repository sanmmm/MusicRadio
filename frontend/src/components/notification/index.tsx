import React, { useEffect, useState, useCallback } from 'react'
import bindClass from 'classnames'
import { useMediaQuery } from 'react-responsive'
import { connect } from 'dva'
import Alert from '@material-ui/lab/Alert'
import { Snackbar, Fade, Slide } from '@material-ui/core'

import styles from './style.less'
import configs from 'config/base.conf'
import { CenterModelState, ConnectState, ConnectProps } from '@/models/connect'

interface NotificationProps extends ConnectProps {
    list: CenterModelState['notifications'];
}

const duration = 3000

const Notification: React.FC<NotificationProps> = React.memo(function (props) {
    const { list = [], dispatch } = props
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })

    const handleClose = useCallback((timestamp) => {
        dispatch({
            type: 'center/removeNotification',
            payload: {
                timestamp
            }
        })
    }, [dispatch])
    
    if (isMobile) {
        const lastItem = list.length ? list[0] : null
        return lastItem ? <Snackbar open={true} autoHideDuration={duration} onClose={handleClose.bind(null, lastItem.timestamp)}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'center',
            }}
            TransitionComponent={SlideDown}
        >
            <Alert variant="filled" severity="info" onClose={handleClose.bind(null, lastItem.timestamp)}>
                {lastItem.content}
            </Alert>
        </Snackbar> : null
    } else {
        return <div className={styles.notifications}>
        {
            list.map(item => <NotificationItem key={item.timestamp} onClose={handleClose} item={item} autoCloseDuration={duration}/>)}
    </div>
    }

})

export default connect(({ center }: ConnectState) => {
    return {
        list: center.notifications,
    }
})(Notification)


interface ItemProps {
    onClose: (timestamp: number) => void;
    item: CenterModelState['notifications'][0];
    autoCloseDuration?: number;
}

const NotificationItem = React.memo<ItemProps>((props) => {
    const [isShow, setIsShow] = useState(true)

    useEffect(() => {
        if (!props.autoCloseDuration) {
            return
        }
        const timer = setTimeout(() => {
            handleClickClose()
        }, props.autoCloseDuration)
        return () => {
            clearTimeout(timer)
        }
    }, [])
    
    const handleClickClose = () => {
        setIsShow(false)
    }

    const handleFadeExisted = () => {
        props.onClose(props.item.timestamp)
    }

    return  <Fade in={isShow} onExited={handleFadeExisted}>
    <Alert variant="filled" severity="info" onClose={handleClickClose}>
        {props.item.content}
    </Alert>
</Fade>
})

const SlideDown = (props) => <Slide direction="down" {...props}/>
