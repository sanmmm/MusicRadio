import React, {useMemo, useEffect, useState, useContext} from 'react'

import {joinPath} from '@/utils'
const RouterCotext = React.createContext({
    url: '',
    base: '',
} as {
    base: string;
    url: string;
})

interface RouterProps {
    basePath?: string;
    children?: React.ReactNode
}

export const HashRouter: React.FC<RouterProps> = props => {
    const [hashPath, setHashPath] = useState(location.hash.replace('#', '') || '/')
    const providerValue = useMemo(() => {
        return {
            base: props.basePath || '',
            url: hashPath
        }
    }, [hashPath, props.basePath])
    
    useEffect(() => {
        const handler = () => {
            setHashPath(location.hash.replace('#', ''))
        }
        window.addEventListener('hashchange', handler)
        return () => {
            window.removeEventListener('hashchange', handler)
        }
    }, [])

    return <RouterCotext.Provider value={providerValue}>
        {props.children}
    </RouterCotext.Provider>
}

export const hashRouter = {
    go () {
        history.go()
    },
    back () {
        history.back()
    },
    push (hash = '') {
        location.hash = hash
    },
    replace (hash) {
        location.replace(`${location.origin}/#${hash}`)
    }
}

type childrenFunc = (appendClassName: string) => React.ReactNode

interface RouteProps {
    path: string;
    exact?: boolean;
    children?: React.ReactElement | childrenFunc;
    startAniamtiojn?: string; // 动画classname
    endAnimation?: string; // 动画classname
    animationDuration?: number; // 动画时间 单位s
}

const normalizePath = (path: string) => {
    return path.toLowerCase().replace(/\/$/, '')
}

const HashRoute: React.FC<RouteProps> = (props) => {
    const {path = '/', exact = false, children, animationDuration = 0.5} = props
    const {base = '', url = '/'} = useContext(RouterCotext)
    const [appendClassName, setAppendClassName] = useState('')
  
    const fullPath = useMemo(() => {
        return normalizePath(joinPath(base, path))
    }, [base, path])
    const normalizedUrl = useMemo(() => {
        return normalizePath(url)
    }, [url])
    const isMatch =  exact ? fullPath === normalizedUrl : normalizedUrl.startsWith(fullPath)

    useEffect(() => {
        let className = ''
        if (isMatch && props.startAniamtiojn) {
            className = props.startAniamtiojn
        }
        if (!isMatch && props.endAnimation) {
            className = props.endAnimation
            setTimeout(() => {
                setAppendClassName('')
            }, animationDuration * 1000 * 0.7)
        }
        setAppendClassName(className)

    }, [isMatch])

    const isDelayDestroy = !!appendClassName
    const isShow = isMatch || isDelayDestroy
    return isShow ? (
        (typeof children === 'function' ? children(appendClassName) : children) as React.ReactElement
    ) : null
}

export default HashRoute
