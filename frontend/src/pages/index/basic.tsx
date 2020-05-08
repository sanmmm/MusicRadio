import React, { useState, useEffect } from 'react';
import { connect } from 'dva'
import { withRouter, history as router } from 'umi'
import { RouteComponentProps } from 'react-router'
import { Button, Dialog, DialogContent, DialogTitle, Input, Grow, InputLabel, FormControl } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import bindClass from 'classnames'
import { useMediaQuery } from 'react-responsive'

import { ConnectProps, ConnectState, CenterModelState, } from '@/models/connect'
import { ScoketStatus } from '@global/common/enums'
import globalConfigs from '@global/common/config'
import styleConfig from 'config/baseStyle.conf'
import configs from 'config/base.conf'
import RoomRender from './index'
import stlyes from './style.less'
import CustomIcon from '@/components/CustomIcon';

interface IndexProps extends ConnectProps, RouteComponentProps<{ roomToken: string }> {
    userInfo: CenterModelState['userInfo'];
    nowRoomInfo: CenterModelState['nowRoomInfo'];
    nowSocketStatus: CenterModelState['nowSocketStatus'];
    pathRoomToken: string;
}

const socketStatusLabel = {
    [ScoketStatus.invalid]: '加入房间失败, 房间可能已被销毁或者无法加入',
    [ScoketStatus.roomDestroy]: '房间已被销毁',
    [ScoketStatus.roomBlocked]: '您已被该房间屏蔽',
}

enum DialogTypes {
    inputRoomPassword,
}

const useInputPasswordStyle = makeStyles({
    label: {
        marginBottom: '1rem',
    },
    button: {
        marginLeft: '.5rem',
    }
})

const RoomPageWrapper: React.FC<IndexProps> = (props) => {
    const { userInfo, nowSocketStatus, dispatch, pathRoomToken = globalConfigs.hallRoomToken } = props
    const [dialogType, setDialogType] = useState(null as DialogTypes)
    const [roomPassword, setRoomPassword] = useState('')
    const classes = useInputPasswordStyle()

    const needSetName = !!userInfo && (!userInfo.name || userInfo.name.startsWith(globalConfigs.initNickNamePerfix))
    const isConnected = nowSocketStatus === ScoketStatus.connected && !!userInfo
    useEffect(() => {
        if (isConnected && !needSetName) {
            const { nowRoomToken } = userInfo
            if (!!nowRoomToken) {
                return
            }
            joinRoom(pathRoomToken)
        }
    }, [isConnected, needSetName])

    useEffect(() => {
        if (userInfo && userInfo.nowRoomId && userInfo.nowRoomToken) {
            const roomToken = userInfo.nowRoomToken
            if (pathRoomToken === roomToken) {
                return
            }
            router.push({
                pathname: roomToken === globalConfigs.hallRoomToken ? '/' : `/${roomToken}`,
                search: location.search,
            })
        }
    }, [!!userInfo && userInfo.nowRoomId])

    const goBackGlobalRoom = () => {
        dispatch({
            type: 'center/joinRoom',
            payload: {
                token: globalConfigs.hallRoomToken
            }
        })
    }

    const connectSocket = () => {
        dispatch({
            type: 'center/connectSocket'
        })
    }

    const setName = (nickName) => {
        dispatch({
            type: 'center/setNickName',
            payload: {
                nickName
            }
        })
    }

    const joinRoom = (roomToken, password = '') => {
        dispatch({
            type: 'center/joinRoom',
            payload: {
                token: roomToken,
                password,
            }
        }).then(res => {
            if (!res) {
                return
            }
            if (res.success) {
                if (dialogType === DialogTypes.inputRoomPassword) {
                    setDialogType(null)
                }
                return
            }
            if (res.needPassword) {
                setDialogType(DialogTypes.inputRoomPassword)
                setRoomPassword('')
            }  
            dispatch({
                type: 'center/saveData',
                payload: {
                    nowSocketStatus: ScoketStatus.invalid
                }
            })
        })
    }

    const showContent = userInfo && userInfo.nowRoomToken === pathRoomToken && nowSocketStatus >= ScoketStatus.connected
    return <div className={stlyes.basic}>
        <Dialog open={dialogType === DialogTypes.inputRoomPassword} onClose={_ => setDialogType(null)}>
                    <DialogTitle>输入房间密码</DialogTitle>
                    <DialogContent>
                        <InputLabel className={classes.label}>该房间为未公开房间，请输入房间密码:</InputLabel>
                        <Input value={roomPassword} onChange={e => setRoomPassword(e.target.value)} margin="dense" />
                        <Button variant="contained" color="primary" onClick={joinRoom.bind(null, pathRoomToken, roomPassword)} className={classes.button}>提交</Button>
                    </DialogContent>
        </Dialog>
        <Dialog open={nowSocketStatus === ScoketStatus.reconnecting}>
            <DialogTitle>连接中断</DialogTitle>
            <DialogContent>连接中断，正在重新连接中...<CustomIcon className={stlyes.loadingIcon}>load</CustomIcon></DialogContent>
        </Dialog>
        {
            nowSocketStatus >= ScoketStatus.connected ? <React.Fragment>
                {
                    needSetName ? <SetName postName={setName} /> :  (
                        showContent ? <RoomRender /> : null
                    )}
            </React.Fragment> : <React.Fragment>
                    {
                        nowSocketStatus === ScoketStatus.closed && <div className={stlyes.socketStatusPage}>
                            <CustomIcon className={stlyes.closedIcon} title="连接" onClick={connectSocket}>play-circle</CustomIcon>
                        </div>}
                    {
                        nowSocketStatus === ScoketStatus.waitting && <div className={stlyes.socketStatusPage}>
                            <CustomIcon className={stlyes.loadingIcon}>load</CustomIcon>
                        </div>}
                    {
                        [ScoketStatus.roomBlocked, ScoketStatus.invalid, ScoketStatus.roomDestroy].includes(nowSocketStatus) && <div className={stlyes.socketStatusPage}>
                            <div>{socketStatusLabel[nowSocketStatus]}</div>
                            <Button onClick={goBackGlobalRoom}>返回大厅</Button>
                        </div>}
                    {
                        nowSocketStatus === ScoketStatus.globalBlocked && <div className={stlyes.socketStatusPage}>
                            <div>你已被管理员屏蔽访问</div>
                        </div>}
                </React.Fragment>
        }
    </div>
}

const BasicPage = connect(({ center: { nowRoomInfo, userInfo, nowSocketStatus } }: ConnectState) => {
    return {
        userInfo,
        nowRoomInfo,
        nowSocketStatus,
    }
})(RoomPageWrapper)

export default withRouter((props) => {
    const {match} = props
    const pathRoomToken = match.params.roomToken || globalConfigs.hallRoomToken
    return <BasicPage {...props} pathRoomToken={pathRoomToken} key={pathRoomToken}/>
})

const useStyle = makeStyles({
    root: (props: any) => ({
        '& input': {
            fontSize: props.isMobile ? '1.8rem' : '3rem',
            color: 'white',
            textAlign: 'center',
            lineHeight: '1.4em',
        },
    }),
    underline: {
        '&::before': {
            borderBottomColor: styleConfig.normalTextColor,
        },
        '&::after': {
            borderBottomColor: styleConfig.themeColor,
        },
    },
})

const SetName = React.memo<{
    postName: (name: string) => any;
}>((props) => {
    const [nickName, setNickName] = useState('')
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const classes = useStyle({ isMobile })
    const isShowNextIcon = !!nickName.length
    const handleInput = (e) => {
        setNickName(e.target.value)
    }
    return <div className={stlyes.setNameBox}>
        <div>
            <Input placeholder="请设置您的昵称" onChange={handleInput} value={nickName} className={bindClass(classes.root, classes.underline)} />
        </div>
        <Grow in={isShowNextIcon} timeout={{
            enter: 600,
            exit: 600
        }}>
            <div>
                <CustomIcon className={stlyes.nextIcon} onClick={props.postName.bind(null, nickName)}>next-circle</CustomIcon>
            </div>
        </Grow>
    </div>
})
