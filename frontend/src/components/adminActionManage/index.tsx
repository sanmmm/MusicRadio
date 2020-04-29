import React, { useEffect, useRef, useCallback, useState } from 'react'
import bindClass from 'classnames'
import dayjs from 'dayjs'
import { connect } from 'dva'
import { ListItem, List, ListItemSecondaryAction, ListItemText, ListItemIcon, ListItemAvatar, Divider, Avatar, Badge, Dialog, DialogContent, DialogTitle } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles'
import {Delete as DeleteIcon, Block as BlockIcon, SpeakerNotesOff as SpeakerNotesOffIcon, GroupAdd as GroupAddIcon, PersonAddDisabled as PersonAddDisabledIcon} from '@material-ui/icons'

import { AdminActionTypes, AdminAction, UserRoomRecordTypes } from 'config/type.conf'
import { ConnectProps, ConnectState, CenterModelState } from '@/models/connect'
import useSyncState from '@/components/hooks/syncAccessState'
import styleConf from 'config/baseStyle.conf'
import ListContainer from './listContainer'
import { isMatchedFeildSearchValue } from '@/utils'

const detailFormat = (strings: TemplateStringsArray, ...args) => {
    const child = []
    child.push(<span key={-1}>{strings[0]}</span>)
    args.forEach((item, index) => {
        child.push(<span key={index}>
            {renderMatchedSearchValue(item)}
            <span>{strings[index + 1]}</span>
        </span>)
    })
    return <div>
        {child}
    </div>
}

const renderAdminActionDetail = (detail: AdminAction['detail']) =>
    detailFormat`操作详情\n 用户名: ${detail.userName}\n 用户id: ${detail.userId}\n 用户ip：${detail.ip}\n 其他: ${detail.message}`

const renderMatchedSearchValue = (item) => {
    return isMatchedFeildSearchValue(item) ?
        <span>{item.value.slice(0, item.startMatched)}<em>{item.value.slice(item.startMatched, item.endMatched)}</em>{item.value.slice(item.endMatched)}</span> :
        <span>{item || '暂无'}</span>
}

const getSearchObjFeildValue = (item) => {
    return isMatchedFeildSearchValue(item) ? item.value : item
}

const useStyles = makeStyles(thme => ({
    root: {
    },
    line: {
        backgroundColor: styleConf.normalTextColor
    },
    badge: {
        whiteSpace: 'nowrap',
    }
}))

interface Props extends ConnectProps {
    adminActionList: ActionItem[];
    nowRoomId: string;
    pending: boolean;
    hasMoreActions: boolean;
}

const UserRoomRecordTypeLabel = {
    [UserRoomRecordTypes.creator]: '房主',
    [UserRoomRecordTypes.superAdmin]: '超管',
    [UserRoomRecordTypes.normalAdmin]: '管理员',
    [UserRoomRecordTypes.others]: '',
}

enum UserManageTypes {
    blockUser,
    banComment,
    setAdmin,
    removeAdmin,
}

interface OnlineUserManageProps extends ConnectProps {
    list: CenterModelState['onlineUserList'];
    hasMore: boolean;
    searchLoading: boolean;
    loadMoreLoading: boolean;
    nowRoomId: string;
    userRoomType: UserRoomRecordTypes;
    nowUserId: string;
}

export const OnlineUserManage = connect(({ center: { hasMoreOnlineUsers, onlineUserList, nowRoomInfo, userInfo }, loading }: ConnectState) => {
    return {
        list: onlineUserList || [],
        hasMore: hasMoreOnlineUsers,
        searchLoading: loading.effects['center/getOnlineUserList'],
        loadMoreLoading: loading.effects['center/getOnlineUserList'],
        nowRoomId: nowRoomInfo && nowRoomInfo.id,
        userRoomType: userInfo && userInfo.userRoomRecordType,
        nowUserId: userInfo && userInfo.id,
    }
})(React.memo<OnlineUserManageProps>((props) => {
    const { dispatch, list, hasMore, searchLoading, loadMoreLoading, nowRoomId, userRoomType: mineUserRoomType, nowUserId } = props
    const [focusUserItem, setFocusUserItem] = useState(null as OnlineUserManageProps['list'][0])
    const classObj = useStyles({})
    const [getLastId, setLastId] = useSyncState()
    const [getNowRoomId, setNowRoomId] = useSyncState()
    setLastId(!!list.length && list[list.length - 1].userId)
    setNowRoomId(nowRoomId)
    const onSearch = useCallback((searchStr) => {
        dispatch({
            type: 'center/getOnlineUserList',
            payload: {
                roomId: getNowRoomId(),
                searchStr,
            }
        })
    }, [])
    const onLoadMore = useCallback((isRefresh = false) => {
        const lastId = isRefresh ? null : getLastId()
        dispatch({
            type: 'center/getOnlineUserList',
            payload: {
                roomId: getNowRoomId(),
                lastId,
            }
        })
    }, [])
    const onRefresh = useCallback(() => {
        onLoadMore(true)
    }, [])

    useEffect(() => {
        if (nowRoomId && !list.length && hasMore) {
            onLoadMore(true)
        }
    }, [nowRoomId, list.length, hasMore])

    const renderListItem = (item: CenterModelState['onlineUserList'][0]) => {
        const isAdmin = item.type > UserRoomRecordTypes.others
        const renderAvator = (child) => isAdmin ? <Badge badgeContent={UserRoomRecordTypeLabel[item.type]} color="primary" className={classObj.badge}>
            {child}
        </Badge> : child
        return <ListItem key={item.userId}>
            <ListItemAvatar>
                {
                    renderAvator(
                        <Avatar>{(getSearchObjFeildValue(item.userName) || '匿').slice(0, 1).toUpperCase()}</Avatar>
                    )
                }
            </ListItemAvatar>
            <ListItemText>
                {renderMatchedSearchValue(item.userName || '匿名')}
                {
                    item.isOffline && <span>(已离线)</span>
                }
            </ListItemText>
            {
                item.type < mineUserRoomType && item.type < UserRoomRecordTypes.creator && !item.isOffline &&
                <ListItemSecondaryAction onClick={_ => setFocusUserItem(item)}>
                    管理
                </ListItemSecondaryAction>
            }
        </ListItem>
    }

    const renderDialogContent = () => {
        let listItems = [], handleClick = null
        if (focusUserItem) {
            handleClick = (e) => {
                const target: HTMLElement = e.currentTarget
                const type: UserManageTypes = Number(target.dataset.type)
                const roomId = getNowRoomId(), userId = focusUserItem.userId
                let actionType = '', payload = null
                if (type === UserManageTypes.banComment) {
                    actionType = 'center/banUserComment',
                        payload = {
                            roomId,
                            userId,
                        }
                } else if (type === UserManageTypes.blockUser) {
                    actionType = 'center/blockUser'
                    payload = {
                        roomId,
                        userId,
                    }
                } else if (type === UserManageTypes.setAdmin) {
                    actionType = 'center/manageRoomAdmin'
                    payload = {
                        isAward: true,
                        roomId,
                        userId,
                    }
                } else if (type === UserManageTypes.removeAdmin) {
                    actionType = 'center/manageRoomAdmin'
                    payload = {
                        isAward: false,
                        roomId,
                        userId,
                    }
                }
                if (actionType && payload) {
                    dispatch({
                        type: actionType,
                        payload
                    })
                }
                setFocusUserItem(null)
            }
            const isAdmin = focusUserItem.type > UserRoomRecordTypes.others
            listItems = [{
                type: UserManageTypes.blockUser,
                icon: <BlockIcon/>,
                text: '屏蔽用户',
            }]
            if (focusUserItem.allowComment) {
                listItems.unshift({
                    type: UserManageTypes.banComment,
                    text: '禁言',
                    icon: <SpeakerNotesOffIcon/>
                })
            }
            if (mineUserRoomType > UserRoomRecordTypes.normalAdmin) {
                if (isAdmin) {
                    if (focusUserItem.type === UserRoomRecordTypes.normalAdmin) {
                        listItems.unshift({
                            type: UserManageTypes.removeAdmin,
                            text: '撤销管理员',
                            icon: <PersonAddDisabledIcon/>
                        })
                    }
                } else {
                    listItems.unshift({
                        type: UserManageTypes.setAdmin,
                        text: '设为管理员',
                        icon: <GroupAddIcon/>
                    })
                }
            }
        }
        return   <List>
                {listItems.map(item => <ListItem button={true} key={item.type} data-type={item.type} onClick={handleClick}>
                    <ListItemIcon>
                        {item.icon}
                    </ListItemIcon>
                    <ListItemText>
                        {item.text}
                    </ListItemText>
                </ListItem>)}
            </List>
    }
    return <ListContainer
        onSearch={onSearch}
        onLoadMore={onLoadMore}
        onRefresh={onRefresh}
        hasMore={hasMore}
        searchLoading={searchLoading}
        loadMoreLoading={loadMoreLoading}
    >
        <Dialog open={!!focusUserItem} onClose={_ => setFocusUserItem(null)}>
            {renderDialogContent()}
        </Dialog>
        <List>
            {list.map(renderListItem)}
        </List>
    </ListContainer>
}))


type ActionItem = CenterModelState['adminActionList'][0]

const ActionTypeToLabel = {
    [AdminActionTypes.banUserComment]: '禁言用户',
    [AdminActionTypes.blockIp]: '封禁ip',
    [AdminActionTypes.blockUser]: '封禁用户',
    [AdminActionTypes.withdrwalMessage]: '撤回消息',
    [AdminActionTypes.awardAdmin]: '设置管理员',
    [AdminActionTypes.removeAdmin]: '撤销管理员',
}

interface AdminActionsManageProps extends ConnectProps {
    list: CenterModelState['adminActionList'];
    hasMore: boolean;
    searchLoading: boolean;
    loadMoreLoading: boolean;
    nowRoomId: string;
    isRoomAdmin: boolean;
}

const isRevokeAbleAction = (action: AdminAction) => ![AdminActionTypes.withdrwalMessage, AdminActionTypes.awardAdmin, AdminActionTypes.removeAdmin].includes(action.type)

export const AdminActionsManage = connect(({ center: { hasMoreActions, adminActionList, userInfo, isRoomAdmin }, loading }: ConnectState) => {
    return {
        nowRoomId: userInfo && userInfo.nowRoomId,
        list: adminActionList || [],
        hasMore: hasMoreActions,
        searchLoading: loading.effects['center/getAdminActionList'],
        loadMoreLoading: loading.effects['center/getAdminActionList'],
        isRoomAdmin,
    }
})(React.memo<AdminActionsManageProps>((props) => {
    const { dispatch, list, hasMore, searchLoading, loadMoreLoading, nowRoomId, isRoomAdmin } = props
    const [getLastId, setLastId] = useSyncState()
    const [getNowRoomId, setNowRoomId] = useSyncState()
    setLastId(!!list.length && list[list.length - 1].id)
    setNowRoomId(nowRoomId)

    useEffect(() => {
        if (isRoomAdmin) {
            onLoadMore(true)
        }
    }, [isRoomAdmin])

    const onSearch = useCallback((searchStr) => {
        dispatch({
            type: 'center/getAdminActionList',
            payload: {
                roomId: getNowRoomId(),
                searchStr,
            }
        })
    }, [])
    const onLoadMore = useCallback((isRefresh = false) => {
        const lastId = isRefresh ? null : getLastId()
        dispatch({
            type: 'center/getAdminActionList',
            payload: {
                roomId: getNowRoomId(),
                lastId,
            }
        })
    }, [])
    const onRefresh = useCallback(() => {
        onLoadMore(true)
    }, [])

    const handleDelete = (item: ActionItem) => {
        dispatch({
            type: 'center/revokeAction',
            payload: {
                roomId: nowRoomId,
                revokeActionId: item.id
            }
        })
    }

    const renderListItem = (item: CenterModelState['adminActionList'][0]) => {
        return <React.Fragment key={item.id}>
            <ListItem key={item.id}>
                <ListItemText primary={<div>
                    [{dayjs(item.time).format('YYYY-MM-DD HH:mm')}]
                        <div>{ActionTypeToLabel[item.type]}: {(item.detail && renderAdminActionDetail(item.detail)) || '未知'}</div>
                </div>}
                    secondary={<span>
                        操作者: {renderMatchedSearchValue(item.operatorName)}
                                ({UserRoomRecordTypeLabel[item.operatorUserRoomType]})
                            </span>}
                    secondaryTypographyProps={{ color: 'inherit' }}
                />
                {
                    isRevokeAbleAction(item) &&
                    <ListItemSecondaryAction onClick={handleDelete.bind(null, item)}>
                        <DeleteIcon/>
                    </ListItemSecondaryAction>
                }
            </ListItem>
        </React.Fragment>
    }
    return <ListContainer
        onSearch={onSearch}
        onLoadMore={onLoadMore}
        onRefresh={onRefresh}
        hasMore={hasMore}
        searchLoading={searchLoading}
        loadMoreLoading={loadMoreLoading}
    >
        <List>
            {list.map(renderListItem)}
        </List>
    </ListContainer>
}))
