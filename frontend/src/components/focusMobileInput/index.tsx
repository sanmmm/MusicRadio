import React from 'react';
import bindClass from 'classnames'

import useKeyBoardListen from '@/components/hooks/keyboardListen'
import styles from './index.less'


type Children = (ref: React.MutableRefObject<any>) => React.ReactElement

interface Props {
    children: Children;
    focusClassName?: string;
}

/**
 * 移动端下input聚焦后，将input绝对定位避免被弹出的虚拟键盘遮挡
 */
const FocusMobileInput: React.FC<Props> = (props) => {
    const [inputRef, isFocus] = useKeyBoardListen()

    const content = props.children(inputRef)
    const oldClassName = content.props.className
    return <div className={bindClass(isFocus && styles.focusMobileInputBox)}>
        {
             React.cloneElement(content, {
                className: bindClass(oldClassName, isFocus && props.focusClassName)
            })
        }
    </div>
}

export default FocusMobileInput
