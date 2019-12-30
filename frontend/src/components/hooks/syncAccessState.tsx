import React, {useEffect, useState} from 'react'

const componentStateMap = new Map<string, any>()

const getMapData = (componentKey: string) => {
    return componentStateMap.get(componentKey)
}

const setMapDate = (componentKey: string, data) => {
    componentStateMap.set(componentKey, data)
    return data
}

const generateKey = () => Date.now() + Math.random().toString(32).slice(2)


export default function<T> (initState?: T) {
    const [componentKey, ] = useState(generateKey())
    
    if (!componentStateMap.has(componentKey)) {
        setMapDate(componentKey, initState)
    }

    const syncGetState = () => {
        return getMapData(componentKey) as T
    }
    const syncSetState = (data: T) => {
        return setMapDate(componentKey, data)
    }
    return [syncGetState, syncSetState] as [typeof syncGetState, typeof syncSetState]
}
