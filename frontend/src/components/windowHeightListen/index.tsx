import React, {useEffect, useState, useContext} from 'react'

const HeightContext = React.createContext(0)

interface Props {
    children: React.ReactNode
}

// context provider
export const WindowHeightProvider: React.FC<Props> =  (props) => {
    const [height, setHeight] = useState(window.innerHeight)
    
    useEffect(() => {
        const handler = () => {
            setHeight(window.innerHeight)
        }   
        window.addEventListener('resize', handler)
        return () => {
            window.removeEventListener('resize', handler)
        }
    }, [])
    return <HeightContext.Provider value={height}>
        {props.children}
    </HeightContext.Provider>
}

// hooks
export default function useListenWindowHeight() {
    const windowHeight = useContext(HeightContext)
    return windowHeight
}
