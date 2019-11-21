import React, { useEffect, useState, useMemo, useRef } from 'react'

interface Options {
    onShow?: () => any;
    onHide?: () => any;
}

export default function useKeyBoardListener(options: Options) {
    const {onShow = () => {}, onHide = () => {}} = options
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
        const focusHandler = () => {
            onShow()
        }
        inputBoxRef.current.addEventListener('focus', focusHandler)
        if (isAndroid) {
            const originHeight = document.documentElement.clientHeight || document.body.clientHeight;
            const resizeHandler = () => {
                const nowHeight = document.documentElement.clientHeight || document.body.clientHeight;
                nowHeight < originHeight ? onShow() : onHide()
            }
            window.addEventListener('resize', resizeHandler)
        } else {
            const blurHandler = () => {
                onHide()
            }
            inputBoxRef.current.addEventListener('blur', blurHandler)
        }
       
    }, [isAndroid, isiOS])
    return inputBoxRef
}
