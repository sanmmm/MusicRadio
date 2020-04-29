import React, {useEffect, useRef} from 'react'

export default function () {
    const eleRef = useRef<HTMLElement>(null)
    const addEvent = () => {
        if (eleRef.current) {
            const handler = (e) => {
                e.stopPropagation()
            }
            eleRef.current.addEventListener('wheel', handler)
            eleRef.current.addEventListener('touchstart', handler)
            return () => {
                eleRef.current.removeEventListener('wheel', handler)
                eleRef.current.removeEventListener('touchstart', handler)
            }
        }
    }
    return (node) => {
        eleRef.current = node
        addEvent()
    }
}
