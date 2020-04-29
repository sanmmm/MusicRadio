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
        const handleHide = () => {
            setIsShow(false)
        }

        const focusHandler = (e) => {
            e.stopPropagation()
            handleShow()
        }
        const unRegister: [string, EventListenerOrEventListenerObject][] = []
        inputBoxRef.current.addEventListener('focus', focusHandler)
        unRegister.push(['focus', focusHandler])
        if (isAndroid) {
            const originHeight = document.documentElement.clientHeight || document.body.clientHeight;
            const resizeHandler = (e) => {
                e.stopPropagation()
                const nowHeight = document.documentElement.clientHeight || document.body.clientHeight;
                if (nowHeight === originHeight) {
                    handleHide()
                }
            }
            
            window.addEventListener('resize', resizeHandler)
            unRegister.push(['resize', resizeHandler])
        } else {
            const blurHandler = (e) => {
                e.stopPropagation()                    
                handleHide()
            }
            inputBoxRef.current.addEventListener('blur', blurHandler)
            unRegister.push(['blur', blurHandler])
        }

        return () => {
            if (!inputBoxRef.current) {
                return
            }
            unRegister.forEach(([eventName, handler]) => {
                inputBoxRef.current.removeEventListener(eventName, handler)
            })
        }
       
    }, [isAndroid, isiOS])
    return [inputBoxRef, isShow] as [React.MutableRefObject<any>, boolean]
}
