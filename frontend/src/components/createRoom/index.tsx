import React, { useState, useRef, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { connect } from 'dva'
import { history as router } from 'umi'
import { FormControl, Switch, TextField, FormControlLabel, Button, Dialog, DialogTitle, DialogContent } from '@material-ui/core';

import FocusInputWrapper from '@/components/focusMobileInput'
import { ConnectProps, ConnectState } from '@/models/connect'
import { copyToClipBoard } from '@/utils';

enum DialogTypes {
    createRoom,
    createSuccess,
}

interface Props extends ConnectProps {
    open: boolean;
    onClose: () => any;
    isMobile: boolean;
}

const CreateRoom: React.FC<Props> = (props) => {
    const [formData, setFormData] = useState({
        isPrivate: false,
        maxMemberCount: 2
    } as Partial<{
        name: string;
        isPrivate: boolean;
        maxMemberCount: number;
    }>)
    const [dialogType, setDialogType] = useState(null as DialogTypes)
    const [roomPassword, setRoomPassword] = useState('')
    const divRef = useRef(null)

    useEffect(() => {
        if (props.open) {
            setDialogType(DialogTypes.createRoom)
            setFormData({
                isPrivate: false,
                maxMemberCount: 2
            })
        } else {
            setDialogType(null)
        }
    }, [props.open])

    const handleCreate = () => {
        props.dispatch({
            type: 'center/createRoom',
            payload: {
                ...formData
            }
        }).then(res => {
            if (res && res.success) {
                router.push({
                    pathname: '/' + res.roomToken,
                    search: location.search,
                })
                if (res.password) {
                    setDialogType(DialogTypes.createSuccess)
                    setRoomPassword(res.password)
                } else {
                    props.onClose()
                }
            }
        })
    }

    return <React.Fragment>
        <Dialog open={dialogType === DialogTypes.createRoom} onClose={props.onClose} fullWidth={!!props.isMobile} maxWidth="md">
            <DialogTitle>创建房间</DialogTitle>
            <DialogContent>
                <FormControl>
                    <FocusInputWrapper>
                        {
                            (ref) => <TextField inputRef={ref} label="房间名" placeholder="长度在4~20个字符之间" value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />}
                    </FocusInputWrapper>
                    <FormControl margin="normal">
                        <FormControlLabel
                            control={<Switch value={formData.isPrivate} onChange={e => setFormData({ ...formData, isPrivate: e.target.checked,})} />}
                            label="不开放"
                        />
                    </FormControl>
                    <FormControl margin="normal">
                        <FormControlLabel
                            control={<Switch checked={formData.maxMemberCount > -1} onChange={(e, checked) => {
                                setFormData({ ...formData, maxMemberCount: checked ? 2 : -1 })
                            }} />}
                            label="人数限制"
                        />
                    </FormControl>
                    {
                        formData.maxMemberCount > -1 && <TextField label="最大人数" type="number" placeholder="人数不能低于2人" value={formData.maxMemberCount}
                            onChange={e => {
                                const value = e.target.value
                                setFormData({ ...formData, maxMemberCount:  value ? Number(value) : null })
                            }}
                        />}
                    <FormControl margin="normal">
                        <Button variant="contained" color="primary" onClick={handleCreate}>提交</Button>
                    </FormControl>
                </FormControl>
            </DialogContent>
        </Dialog>
        <Dialog open={dialogType === DialogTypes.createSuccess} onClose={props.onClose}>
            <DialogTitle>创建成功</DialogTitle>
            <DialogContent>
                <div ref={divRef}>
                    房间密码为: {roomPassword}
                    <Button onClick={copyToClipBoard.bind(null, roomPassword, divRef, true)} color="primary">复制到剪切板</Button>
                </div>
                <div>
                    也可以到右下角查看说明部分查看房间密码
                </div>
            </DialogContent>
        </Dialog>
    </React.Fragment>
}

export default connect(({center: {isMobile} }: ConnectState) => {
    return {
        isMobile
    }
})(CreateRoom)
