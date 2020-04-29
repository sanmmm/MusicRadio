import React from 'react';
import bindClass from 'classnames'

import useKeyBoardListen from '@/components/hooks/keyboardListen'
import styles from './index.less'


type Children = (ref: React.MutableRefObject<any>, isFocus?: boolean) => React.ReactElement

interface Props {
    children: Children;
}

/**
 * 移动端下input聚焦后，将input绝对定位避免被弹出的虚拟键盘遮挡
 */
const FocusMobileInput: React.FC<Props> = (props) => {
    const [inputRef, isFocus] = useKeyBoardListen()

    return <div className={bindClass(isFocus && styles.focusMobileInputBox)}>
        {
            props.children(inputRef, isFocus)
        }
    </div>
}

export default FocusMobileInput
