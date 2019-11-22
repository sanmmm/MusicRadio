import React, {useMemo, useEffect, useState, useContext, FunctionComponent} from 'react'

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

interface RouteProps {
    path: string;
    exact?: boolean;
    children?: React.ReactNode
}

const normalizePath = (path: string) => {
    return path.toLowerCase().replace(/\/$/, '')
}

const HashRoute: React.FC<RouteProps> = (props) => {
    const {path = '/', exact = false, children} = props
    const {base = '', url = '/'} = useContext(RouterCotext)
    const fullPath = useMemo(() => {
        return normalizePath('/' + base.split('/').concat(path.split('/')).filter(s => !!s).join('/'))
    }, [base, path])
    const normalizedUrl = useMemo(() => {
        return normalizePath(url)
    }, [url])
    const isMatch =  exact ? fullPath === normalizePath(normalizedUrl) : normalizedUrl.startsWith(fullPath)
    return isMatch ? children as React.ReactElement : null
}

export default HashRoute
