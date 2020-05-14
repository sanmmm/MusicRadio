import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import bindclass from 'classnames'
import { useSwipeable, Swipeable } from 'react-swipeable'
import { useMediaQuery } from 'react-responsive';

import { throttle } from '@/utils'
import styles from './style.less'
import configs from 'config/base.conf';

interface Props {
    children: React.ReactElement<ItemProps, typeof ScrollPageItem>[];
    onPageChange?: (page: number) => any;
    refObj: React.Ref<RefAttributes>;
}

interface RefAttributes {
    toPreviousPage: Function,
    toNextPage: Function,
}

const ScrollWrapper: React.FC<Props> = function ScrollWrapper (props) {
    const {refObj} = props
    const [focusPageIndex, setFocusPageIndex] = useState(0)
    const [pageHeight, setPageHeight] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const boxRef = useRef<HTMLDivElement>(null)
    const isMobile = useMediaQuery({query: configs.mobileMediaQuery})

    const isInitial = !boxRef.current
    useEffect(() => {
        getPageHeight()
        window.addEventListener('resize', throttle(getPageHeight, 300, true))
    }, [])

    useEffect(() => {
        document.body.addEventListener('touchmove', function (e) {
            e.preventDefault(); //阻止默认的处理方式(阻止微信浏览器下拉滑动的效果)
        }, { passive: false });
    }, [])

    useEffect(() => {
        if (!isInitial) {
            props.onPageChange && props.onPageChange(focusPageIndex)
        }
    }, [focusPageIndex])

    const getPageHeight = () => {
        requestAnimationFrame(() => {
            if (boxRef.current) {
                const client = boxRef.current.getBoundingClientRect()
                setPageHeight(client.height)
            }
        })
    }

    const toPreviousPage = useCallback(throttle(() => {
        setFocusPageIndex((prevValue) => {
            if (prevValue === 0) {
                return prevValue
            }
            return prevValue - 1
        })
    }, 900), [])
    const toNextPage = useCallback(throttle(() => {
        setFocusPageIndex((prevValue) => {
            const childCount = React.Children.count(props.children)
            if (prevValue === childCount - 1) {
                return prevValue
            }
            return prevValue + 1
        })
    }, 900), [])
    const handlers = useSwipeable({ onSwipedUp: toNextPage, onSwipedDown: toPreviousPage })
    useImperativeHandle(refObj, () => {
        return {
            toPreviousPage,
            toNextPage,
        }
    })
    return <div {...handlers}>
        <div ref={boxRef} className={styles.scrollOuterBox} 
            onWheel={e => {
                const { deltaY } = e
                if (deltaY < 0) {
                    toPreviousPage()
                } else {
                    toNextPage()
                }
            }}>
            <div ref={containerRef} className={styles.scrollContainer}
                style={{ top: `${-1 * pageHeight * focusPageIndex}px` }}
            >
                {
                    React.Children.map(props.children, (child, index) => {
                        return <div key={index} 
                            className={bindclass(styles.scrollPageContainer, focusPageIndex === index && styles.focus, isMobile && styles.mobile)}
                            >
                            {
                                React.cloneElement(child, {
                                    isShow: focusPageIndex === index
                                })
                            }
                        </div>
                    })
                }
            </div>
        </div>
    </div>
}

export default forwardRef<RefAttributes, Pick<Props, Exclude<keyof Props, 'refObj'>>>(function (props, ref) {
    return <ScrollWrapper refObj={ref} {...props} />
})

interface ItemProps {
    isShow?: boolean;
    children: React.ReactNode | ((isShow: boolean) => React.ReactNode)
}

export const ScrollPageItem: React.FC<ItemProps> = ({ children, isShow }) => {
    return typeof children === 'function' ? (children as Function)(isShow) : children
}