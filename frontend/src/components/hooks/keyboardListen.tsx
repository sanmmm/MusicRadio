import React, { useEffect, useState, useMemo, useRef } from 'react'

interface Options {
}
// 移动端下监听键盘弹起/隐藏
export default function useKeyBoardListener(options?: Options) {
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
            setIsShow(true)
        }
        const handlerHide = () => {
            setIsShow(false)
        }
        const focusHandler = (e) => {
            e.stopPropagation()
            handleShow()
        }
        inputBoxRef.current.addEventListener('focus', focusHandler)
        if (isAndroid) {
            const originHeight = document.documentElement.clientHeight || document.body.clientHeight;
            const resizeHandler = (e) => {
                e.stopPropagation()
                const nowHeight = document.documentElement.clientHeight || document.body.clientHeight;
                if (nowHeight > originHeight) {
                    handlerHide()
                }
            }
            
            window.addEventListener('resize', resizeHandler)
        } else {
            const blurHandler = (e) => {
                e.stopPropagation()                    
                handlerHide()
            }
            inputBoxRef.current.addEventListener('blur', blurHandler)
        }
       
    }, [isAndroid, isiOS, options])
    return [inputBoxRef, isShow] as [React.MutableRefObject<any>, boolean]
}
