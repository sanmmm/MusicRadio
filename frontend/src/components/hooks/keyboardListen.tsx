import React, { useEffect, useState, useMemo, useRef } from 'react'

interface Options {
    onShow?: () => any;
    onHide?: () => any;
}
// 移动端下监听键盘弹起/隐藏
export default function useKeyBoardListener(options?: Options) {
    const {onShow = () => {}, onHide = () => {}} = (options || {})
    const [isShow, setIsShow] = useState(false)
    const inputBoxRef = useRef<HTMLInputElement>(null)
    const {isAndroid, isiOS} = useMemo(() => {
        const u = navigator.userAgent
        return {
            isAndroid: u.indexOf('Android') > -1 || u.indexOf('Adr') > -1,
            isiOS: !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/)
        }
    }, [navigator.userAgent])


    useEffect(() => {
        if (!isAndroid && !isiOS) {
            return
        }
        if (!inputBoxRef.current) {
            return
        }
        const handleShow = () => {
            onShow()
            setIsShow(true)
        }
        const handlerHide = () => {
            onHide()
            setIsShow(false)
        }
        const focusHandler = () => {
            handleShow()
        }
        inputBoxRef.current.addEventListener('focus', focusHandler)
        if (isAndroid) {
            const originHeight = document.documentElement.clientHeight || document.body.clientHeight;
            const resizeHandler = () => {
                const nowHeight = document.documentElement.clientHeight || document.body.clientHeight;
                nowHeight < originHeight ? handleShow() : handlerHide()
            }
            window.addEventListener('resize', resizeHandler)
        } else {
            const blurHandler = () => {
                handlerHide()
            }
            inputBoxRef.current.addEventListener('blur', blurHandler)
        }
       
    }, [isAndroid, isiOS, options])
    return [inputBoxRef, isShow] as [React.MutableRefObject<any>, boolean]
}
