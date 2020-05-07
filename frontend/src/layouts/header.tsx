import React, { useEffect, useState, useCallback } from 'react';
import { connect } from 'dva'
import { Select, Dialog, DialogContent, Button, ListItem, ListItemText, ListItemIcon, IconButton, MenuItem } from '@material-ui/core';
import { useMediaQuery } from 'react-responsive'
import {
    Person as PersonIcon, ViewHeadline as HeadLineIcon, Delete as DeleteIcon, PlaylistAdd as CreateIcon, Cancel as CancelIcon,
    PlaceOutlined as PlaceIcon
} from '@material-ui/icons'
import { makeStyles, withStyles } from '@material-ui/core/styles';
import bindClass from 'classnames';

import styles from './index.less';
import { UserStatus, UserRoomRecordTypes } from 'config/type.conf';
import CreateRoom from '@/components/createRoom'
import RoomHotDataVisualization from '@/components/roomVisualization'
import configs from 'config/base.conf'
import { ConnectProps, ConnectState, PlayListModelState, CenterModelState } from '@/models/connect'
import globalConfig from '@global/common/config';
import styleConfigs from 'config/baseStyle.conf';
import settings from 'config/settings';

const useStyle = makeStyles({
    button: {
        color: styleConfigs.themeColor,
    },
    select: {
        color: styleConfigs.themeColor,
        '&::before': {
            borderBottomColor: styleConfigs.normalTextColor,
        },
        '&::after': {
            borderBottomColor: styleConfigs.normalTextColor,
        },
        '& svg': {
            color: `${styleConfigs.themeColor} !important`,
        }
    },
})

interface HeaderProps extends ConnectProps {
    nowRoomInfo: CenterModelState['nowRoomInfo'];
    userInfo: CenterModelState['userInfo'];
    isRoomAdmin: boolean;
}

enum ActionTypes {
    createRoom,
    cutUserStatus,
    destoryRoom,
    quitRoom,
    showVisualization,
}

export default connect(({ center: { nowRoomInfo, userInfo, isRoomAdmin } }: ConnectState) => {
    return {
        nowRoomInfo,
        userInfo,
        isRoomAdmin,
    }
})(React.memo<HeaderProps>(function Header(props) {
    const { nowRoomInfo, userInfo, dispatch } = props
    const [showCreateRoom, setShowCreateRoom] = useState(false)
    const [showActionDialog, setShowActionDialog] = useState(false)
    const [showVisualization, setShowVisualization] = useState(false)
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const classes = useStyle()

    const closeCreateRoomDialog = useCallback(() => {
        setShowCreateRoom(false)
    }, [])

    const closeVisualizationDialog = useCallback(() => {
        setShowVisualization(false)
    }, [])

    const actionItems = []
    if (userInfo) {
        if (userInfo.status > UserStatus.normal) {
            actionItems.push({
                type: ActionTypes.cutUserStatus,
                icon: <PersonIcon />,
                label: userInfo.status === UserStatus.superOfNormal ? '切换为超管' : '切换为普通用户',
                render: (props) => <Select {...props} value={userInfo.status} className={classes.select}>
                    <MenuItem value={UserStatus.superAdmin}>超管</MenuItem>
                    <MenuItem value={UserStatus.superOfNormal}>普通用户</MenuItem>
                </Select>
            })
        }
        if (userInfo.nowRoomId) {
            if (!isMobile) {
                actionItems.push({
                    type: ActionTypes.showVisualization,
                    label: '大家在听',
                    icon: <PlaceIcon />
                })
            }
            if (!settings.notAllowCreateRoom && (userInfo.status === UserStatus.superAdmin || !userInfo.isRoomCreator)) {
                actionItems.push({
                    type: ActionTypes.createRoom,
                    icon: <CreateIcon />,
                    label: '创建房间',
                })
            }

            const isSuperAdmin = userInfo.status === UserStatus.superAdmin
            const isCreator = userInfo.isRoomCreator
            const isInHallRoom = userInfo.nowRoomId === globalConfig.hallRoomId
            if (!isInHallRoom && (isCreator || isSuperAdmin)) {
                actionItems.push({
                    type: ActionTypes.destoryRoom,
                    icon: <DeleteIcon />,
                    label: '销毁房间',
                })
            }

            if (!isInHallRoom && !isCreator) {
                actionItems.push({
                    type: ActionTypes.quitRoom,
                    icon: <CancelIcon />,
                    label: '退出房间',
                })
            }

        }
    }

    const handleActionClick = (e) => {
        const type: ActionTypes = Number(e.currentTarget.dataset.type)
        setShowActionDialog(false)
        if (type === ActionTypes.createRoom) {
            setShowCreateRoom(true)
        } else if (type === ActionTypes.cutUserStatus) {
            e.stopPropagation()
            e.preventDefault()
            let newStatus = null
            if (e.currentTarget.dataset.islistitem) {
                newStatus = userInfo.status === UserStatus.superAdmin ? UserStatus.superOfNormal : UserStatus.superAdmin
            } else {
                newStatus = e.target.value && Number(e.target.value)
            }
            if (newStatus) {
                dispatch({
                    type: 'center/cutUserStatus',
                    payload: {
                        status: newStatus
                    }
                }).then(res => {
                    if (res && res.success) {
                        location.reload()
                    }
                })
            }
        } else if (type === ActionTypes.destoryRoom) {
            dispatch({
                type: 'center/destroyRoom',
                payload: {
                    roomId: userInfo.nowRoomId
                }
            })
        } else if (type === ActionTypes.quitRoom) {
            dispatch({
                type: 'center/joinRoom',
                payload: {
                    token: globalConfig.hallRoomToken
                }
            })
        } else if (type === ActionTypes.showVisualization) {
            setShowVisualization(true)
        }
    }

    const actionItemsContent = actionItems.map(item => {
        const props = {
            key: item.type,
            'data-type': item.type,
            onClick: handleActionClick
        }
        return isMobile ? (
            actionItems.length === 0 ? <IconButton {...props}>{React.cloneElement(item.icon, {
                style: {
                    color: styleConfigs.themeColor,
                }
            })}</IconButton> :
                <ListItem {...props} data-islistitem={true}>
                    <ListItemIcon>
                        {item.icon}
                    </ListItemIcon>
                    <ListItemText>
                        {item.label}
                    </ListItemText>
                </ListItem>
        ) :
            item.render ? item.render(props) : <Button {...props} className={classes.button}>{item.label}</Button>
    })

    return <React.Fragment>
        <CreateRoom open={showCreateRoom} onClose={closeCreateRoomDialog} />
        <Dialog open={showVisualization} onClose={closeVisualizationDialog} fullWidth={isMobile} maxWidth="md">
            <DialogContent style={{ backgroundColor: 'rgba(0, 0, 0, 0.9' }}>
                {showVisualization && <RoomHotDataVisualization />}
            </DialogContent>
        </Dialog>
        <div className={bindClass(styles.header, isMobile && styles.mobile)}>
            <div className={styles.content}>
                {
                    !isMobile &&
                    <div className={styles.logo}>
                        {settings.logoText || settings.websiteName}
                    </div>
                }
                <div className={styles.center}>
                    <div id={configs.roomNameSelectorName}></div>
                    <div id={configs.playerHeaderIdSelectorName} className={styles.player}></div>
                </div>
                {
                    !!userInfo && <div className={styles.right}>
                        {
                            isMobile && <React.Fragment>
                                <IconButton onClick={_ => setShowActionDialog(true)}><HeadLineIcon style={{ color: styleConfigs.themeColor }} /></IconButton>
                                <Dialog open={showActionDialog} onClose={_ => setShowActionDialog(false)}>
                                    {actionItemsContent}
                                </Dialog>
                            </React.Fragment>
                        }
                        {
                            !isMobile && <React.Fragment>
                                <div title={`在线人数${nowRoomInfo ? nowRoomInfo.heat : 0}`} className={styles.onlinePerson}>
                                    <PersonIcon style={{ color: 'white', marginRight: '.5rem' }} /><span>{nowRoomInfo ? nowRoomInfo.heat : 0}</span>
                                </div>
                                {actionItemsContent}
                            </React.Fragment>
                        }
                    </div>}
            </div>
        </div>
    </React.Fragment>
}))
