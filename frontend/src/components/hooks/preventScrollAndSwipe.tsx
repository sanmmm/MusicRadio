import React, {useEffect, useRef} from 'react'

export default function () {
    const eleRef = useRef<any>(null)
    useEffect(() => {
        if (eleRef.current) {
            const handler = (e) => {
                e.preventDefault()
                e.stopPropagation()
            }
            eleRef.current.addEventListener('wheel', handler)
            eleRef.current.addEventListener('touchstart', handler)
            return () => {
                eleRef.current.removeEventListener('wheel', handler)
                eleRef.current.removeEventListener('touchstart', handler)
            }
        }
    }, [])
    return eleRef
}
