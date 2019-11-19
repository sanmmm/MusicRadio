import React, {useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef} from 'react'
import bindclass from 'classnames'
import { useSwipeable, Swipeable } from 'react-swipeable'

import {throttle} from '@/utils'
import styles from './style.less'

interface ProviderProps {
    children: React.ReactNode,
}

interface Props {
    children: React.ReactNode;
}
const ScrollWrapper: React.FC<Props> = function (props, ref) {
    const [focusPageIndex, setFocusPageIndex] = useState(0)
    const [pageHeight, setPageHeight] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const boxRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const client = boxRef.current.getBoundingClientRect()
        setPageHeight(client.height)
    }, [])

    useEffect(() => {
        document.body.addEventListener('touchmove', function (e) {
            e.preventDefault(); //阻止默认的处理方式(阻止下拉滑动的效果)
          }, {passive: false});
    })
    
    const toPreviousPage = useMemo(() => {
        return throttle((e) => {
            e && e.stopPropagation()
            setFocusPageIndex((prevValue) => {
                console.log(prevValue)
                if (prevValue === 0) {
                    return prevValue
                }
                return prevValue - 1
            })
        }, 500)
    }, [])
    const toNextPage = useMemo(() => {
        return throttle((e) => {
            e && e.stopPropagation()
            setFocusPageIndex((prevValue) => {
                console.log(prevValue)
                const childCount = React.Children.count(props.children)
                if (prevValue === childCount - 1) {
                    return prevValue
                }
                return prevValue + 1
            })
        }, 500)
    }, [])
    const handlers = useSwipeable({ onSwipedUp: toNextPage, onSwipedDown: toPreviousPage })
    useImperativeHandle(ref, () => {
        return {
            toPreviousPage,
            toNextPage,
        }    
    })
    return <div {...handlers}>
        <div ref={boxRef} className={styles.scrollOuterBox} onWheel={e => {
        const {deltaY} = e
        if (deltaY < 0) {
            toPreviousPage()
        } else {
            toNextPage()
        }
    }}>
        <div ref={containerRef}  className={styles.scrollContainer}
                style={{transform: `translateY(${-1 * pageHeight * focusPageIndex}px)`}}
             >
            {
                React.Children.map(props.children, (child, index) => {
                    return <div key={index} className={bindclass(styles.scrollPageContainer, focusPageIndex === index && styles.focus)}>
                        {child}
                    </div>
                })
            }
        </div>
    </div>
    </div>
}

export default forwardRef(ScrollWrapper)
