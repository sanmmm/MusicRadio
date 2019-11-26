import React, { useState, useRef, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { connect } from 'dva'
import { FormControl, Switch, TextField, FormControlLabel, Button } from '@material-ui/core'

import FocusInputWrapper from '@/components/focusMobileInput'
import { ConnectProps, ConnectState } from '@/models/connect'
import styles from './style.less'

interface Props extends ConnectProps {
}

const CreateRoom: React.FC<Props> = (props) => {
    const [formData, setFormData] = useState({
        isPrivate: false,
        memberCount: 2
    } as Partial<{
        name: string;
        isPrivate: boolean;
        memberCount: number;
    }>)

    const handleCreate = () => {
        props.dispatch({
            type: 'center/createRoom',
            payload: {

            }
        })
    }

    return <div>
        <FormControl>
            <FocusInputWrapper>
                {
                    (ref) => <TextField inputRef={ref} label="房间名" placeholder="长度在4~20个字符之间" value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />}
            </FocusInputWrapper>
            <FormControl margin="normal">
                <FormControlLabel
                    control={<Switch value={formData.isPrivate} onChange={e => setFormData({ ...formData, isPrivate: e.target.checked, memberCount: 2 })} />}
                    label="不开放"
                />
            </FormControl>
            {
                formData.isPrivate && <TextField label="最大人数" type="number" placeholder="人数不能低于2人" value={formData.memberCount}
                    onChange={e => setFormData({ ...formData, memberCount: Number(e.target.value) })}
                />}
            <FormControl margin="normal">
                <Button variant="contained" color="primary" onClick={handleCreate}>提交</Button>
            </FormControl>
        </FormControl>
    </div>
}

export default connect(({ }: ConnectState) => {
    return {

    }
})(CreateRoom)
