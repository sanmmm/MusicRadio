import React, { useState, useRef, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { connect } from 'dva'
import { Dialog, DialogTitle, List, ListItem, ListItemText } from '@material-ui/core'

import FocusInputWrapper from '@/components/focusMobileInput'
import { ConnectProps, ConnectState, ChatListModelState } from '@/models/connect'
import styles from './style.less'

interface Props extends ConnectProps {
    selectedMessage: ChatListModelState['selectedMessageItem']
}

enum ActionTypes { blockAccount, blockIp, ban }

const HandleSelectMessage: React.FC<Props> = (props) => {
    const { selectedMessage } = props
    const blockUser = (type: ActionTypes) => {
        clearSelectedMessageItem()
        props.dispatch({
            type: 'center/blockUser',
            payload: {

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
    // TODO 操作权限

    return <div>
        <Dialog onClose={clearSelectedMessageItem} open={!!selectedMessage}>
            <DialogTitle>对该发言用户:<b>{selectedMessage && selectedMessage.from}</b></DialogTitle>
            <List>
                <ListItem button={true} onClick={_ => blockUser(ActionTypes.ban)}>
                    <ListItemText primary="禁言" />
                </ListItem>
                <ListItem button={true} onClick={_ => blockUser(ActionTypes.blockAccount)}>
                    <ListItemText primary="封禁账号" />
                </ListItem>
                <ListItem button={true} onClick={_ => blockUser(ActionTypes.blockIp)}>
                    <ListItemText primary="封禁ip" />
                </ListItem>
            </List>
        </Dialog>
    </div>
}

export default connect(({ chatList }: ConnectState) => {
    return {
        selectedMessage: chatList.selectedMessageItem
    }
})(HandleSelectMessage)
