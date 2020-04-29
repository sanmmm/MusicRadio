import React, { useState, useRef, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { connect } from 'dva'
import { Dialog, DialogTitle, List, ListItem, ListItemText } from '@material-ui/core'

import { ConnectProps, ConnectState, ChatListModelState } from '@/models/connect'
import styles from './style.less'

interface Props extends ConnectProps {
    userId: string;
    isRoomAdmin: boolean;
    roomId: string;
    selectedMessage: ChatListModelState['selectedMessageItem'];
}

enum ActionTypes { blockAccount, blockIp, ban, atSign }

const actionTypeMap = {
    [ActionTypes.blockAccount]: 'center/blockUser',
    [ActionTypes.blockIp]: 'center/blockIP',
    [ActionTypes.ban]: 'center/banUserComment',
}

const HandleSelectMessage: React.FC<Props> = (props) => {
    const { selectedMessage, roomId, isRoomAdmin, userId } = props
    const blockUser = (type: ActionTypes) => {
        clearSelectedMessageItem()
        props.dispatch({
            type: actionTypeMap[type],
            payload: {
                roomId,
                userId: selectedMessage.fromId, 
            }
        })
    }

    const clearSelectedMessageItem = () => {
        props.dispatch({
            type: 'chatList/clearSelectedMessageItem',
            payload: {
            }
        })
    }

    const handleAtSignAction = () => {
        clearSelectedMessageItem()
        props.dispatch({
            type: 'chatList/handleAtSignAction',
            payload: {
                atSignToUserId: selectedMessage.fromId,
                atSignToUserName: selectedMessage.from,
            }
        })
    }

    const withdrawlMessage = () => {
        clearSelectedMessageItem()
        props.dispatch({
            type: 'chatList/withdrawlMessageItem',
            payload: {
                messageId: selectedMessage.id,
                content: selectedMessage.content.text,
                fromId: selectedMessage.fromId,
                roomId,
            }
        })
    }

    return <Dialog onClose={clearSelectedMessageItem} open={!!selectedMessage}>
    <DialogTitle>对该发言用户:<b>{selectedMessage && selectedMessage.from}</b></DialogTitle>
    <List>
        {
            isRoomAdmin &&
            <React.Fragment >
                <ListItem button={true} onClick={_ => blockUser(ActionTypes.ban)}>
                <ListItemText primary="禁言" />
                </ListItem>
                <ListItem button={true} onClick={_ => blockUser(ActionTypes.blockAccount)}>
                    <ListItemText primary="封禁账号" />
                </ListItem>
                <ListItem button={true} onClick={_ => blockUser(ActionTypes.blockIp)}>
                    <ListItemText primary="封禁ip" />
                </ListItem>
            </React.Fragment>
        }
        { 
            isRoomAdmin &&
            <ListItem button={true} onClick={withdrawlMessage}>
                    <ListItemText primary="撤回消息" />
                </ListItem>
        }
        <ListItem button={true} onClick={_ => handleAtSignAction()}>
            <ListItemText primary="@ta" />
        </ListItem>
    </List>
</Dialog>
}

export default connect(({ chatList, center: {nowRoomInfo, userInfo, isRoomAdmin} }: ConnectState) => {
    return {
        userId: userInfo.id,
        isRoomAdmin,
        roomId: nowRoomInfo && nowRoomInfo.id,
        selectedMessage: chatList.selectedMessageItem
    }
})(HandleSelectMessage)
