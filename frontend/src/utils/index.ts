import { MatchedSearchValue, SearchTreeType } from 'config/type.conf'

enum TipTypes {
    blockMusic,
    unBlockMusic,
}

const tipLabelObj = {
    [TipTypes.blockMusic]: '屏蔽的音乐在播放期间会自动静音, 可以点击取消屏蔽撤销',
}

const pastTipRecord = {}

export function tipWrapper(func: Function, type: TipTypes) {
    if (pastTipRecord[type]) {
        return func
    }
    return function (...args) {
        if (!pastTipRecord[type]) {
            // Modal.info({
            //     title: '提示',
            //     content: tipLabelObj[type],
            //     onOk: () => {
            //         func()
            //     }
            // })
            return
        }
        func(...args)
    }
}

export const throttle = (func, time = 500, delayMode = false) => {
    if (delayMode) {  // 防抖
        let delayTimer = null
        return (...args) => {
            if (delayTimer) {
                clearTimeout(delayTimer)
            }
            delayTimer = setTimeout(() => {
                func(...args)
            }, time)
        }
    }
    let isThrottle = false
    const func2 = function (...args) {
        if (isThrottle) {
            return
        }
        func(...args)
        isThrottle = true
        setTimeout(() => {
            isThrottle = false
        }, time)
    }
    return func2
}


export const isPathEqual = (path1: string, path2: string) => path1.toLocaleLowerCase().replace(/\/$/, '') === path2.toLocaleLowerCase().replace('/\/$/', '')

export const joinPath = (path1, path2) => '/' + path1.split('/').concat(path2.split('/')).filter(s => !!s).join('/')

export const getAuthToken = () => (new URL(location.href)).searchParams.get('token') || ''


export function getLocalStorageData<T = any>(key: string) {
    const dataStr = localStorage.getItem(key)
    return JSON.parse(dataStr) as T
}

export function setLocalStorageData(key: string, data: any) {
    localStorage.setItem(key, JSON.stringify(data))
}

export function CustomAlert(content: string) {
    window.g_app._store.dispatch({
        type: 'center/addNotification',
        payload: {
            content
        }
    })
}

export function checkReqRes (res, actionName = '请求') {
    if (res && res.success) {
        CustomAlert(`${actionName}成功`)
    } else {
        CustomAlert(`${actionName}失败`)
    }
}


const getFlatSearchTree = (searchTree) => {
    const fieldNames = Object.keys(searchTree)
    const arr = []
    fieldNames.forEach(fieldName => {
        const value = searchTree[fieldName]
        const valueType = typeof value
        if (valueType === 'object') {
            const flatTree = getFlatSearchTree(value)
            flatTree.forEach(fieldNameArr => arr.push([fieldName, ...fieldNameArr]))
        } else if (value === true) {
            arr.push([fieldName])
        }
    })
    return arr
}

export function searchValueFromObjByTree<T>(objs: T[], searchTree: SearchTreeType<T>, searchStr) {
    if (typeof searchTree !== 'object') {
        throw new Error('invalid searchtree')
    }
    const flatSearchTree = getFlatSearchTree(searchTree)
    objs.forEach(obj => {
        flatSearchTree.forEach(keyArr => {
            const searchValue = keyArr.reduce((obj, key) => {
                return obj && obj[key]
            }, obj)
            let findIndex = -1
            if (!!searchValue && !!searchValue.indexOf) {
                findIndex = searchValue.indexOf(searchStr)
            }
            if (findIndex > -1) {
                const leafNodeParent = keyArr.length === 1 ? obj :
                    keyArr.slice(0, -1).reduce((nodeObj, feildName) => {
                        return nodeObj[feildName]
                    }, obj)
                const lastKey = keyArr[keyArr.length -1]
                leafNodeParent[lastKey] = new MatchedSearchValue({
                    value: searchValue,
                    startMatched: findIndex,
                    endMatched: findIndex + searchStr.length
                })
            }
        })
    })
}

export function isMatchedFeildSearchValue (value) {
    return value instanceof MatchedSearchValue
}

export function deduplicateObjArr (arr: Object[], getId: (item) => string) {
    const set = new Set()
    const newArr = []
    arr.forEach(item => {
        const key = getId(item)
        if (set.has(key)) {
            return
        }
        set.add(key)
        newArr.push(item)
    })
    return newArr
}

export function copyToClipBoard (text = '', container: React.MutableRefObject<HTMLElement> = null, alert = false) {
    const input = document.createElement('input')
    input.setAttribute('readonly', 'readonly')
    input.setAttribute('value', text)
    const box = container ? container.current : document.body
    box.appendChild(input)
    input.select()
    let flag = false
    if (document.execCommand) {
        document.execCommand('copy')
        flag = true
    }
    box.removeChild(input)
    if (alert) {
        CustomAlert(flag ? '已复制到剪切板' : '复制失败')
    }
    return flag
}


export function getArrRandomItem (arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)]
}
