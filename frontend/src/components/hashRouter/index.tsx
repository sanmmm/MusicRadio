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
        const prevTitle = document.title
        location.hash = hash
        document.title = prevTitle
    },
    replace (hash) {
        location.replace(`${location.origin}/#${hash}`)
    }
}

export const useHashRouteStatus = function () {
    const {base = '', url = '/'} = useContext(RouterCotext)
    return joinPath(base, url)
}

type childrenFunc = (appendClassName?: string, pathname?: string) => React.ReactNode

interface RouteProps {
    path: string;
    exact?: boolean;
    children?: React.ReactElement | childrenFunc;
    startAniamtiojn?: string; // 动画classname
    endAnimation?: string; // 动画classname
    animationDuration?: number; // 动画时间 单位s
}

const normalizePath = (path: string) => {
    return path.toLowerCase().replace(/.+\/$/, '')
}

enum RouteStatus {notMatch, matched, delayDestory}

const HashRoute: React.FC<RouteProps> = (props) => {
    const {path = '/', exact = false, children, animationDuration = 0.5} = props
    const {base = '', url = '/'} = useContext(RouterCotext)
    const [nowStatus, setStatus] = useState(RouteStatus.notMatch)
  
    const fullPath = useMemo(() => {
        return normalizePath(joinPath(base, path))
    }, [base, path])
    const normalizedUrl = useMemo(() => {
        return normalizePath(url)
    }, [url])
    const isMatch =  exact ? fullPath === normalizedUrl : normalizedUrl.startsWith(fullPath)

    useEffect(() => {
        let status = nowStatus, timer = null
        if (isMatch) {
            status = RouteStatus.matched
        }
        if (!isMatch && nowStatus !== RouteStatus.notMatch) {
            status = RouteStatus.notMatch
            if (!!props.endAnimation) {
                status = RouteStatus.delayDestory
                timer = setTimeout(() => {
                    setStatus(RouteStatus.notMatch)
                }, animationDuration * 1000)
            }
        }
        setStatus(status)
        return () => {
            if (timer) {
                clearTimeout(timer)
            }
        }
    }, [isMatch])

    const isShow = nowStatus > RouteStatus.notMatch
    const appendClassName = isShow && (nowStatus === RouteStatus.matched ? props.startAniamtiojn : props.endAnimation)
    return  isShow ? (
        (typeof children === 'function' ? children(appendClassName, normalizedUrl) : children) as React.ReactElement
    ) : null
}

export default HashRoute
