import {Modal} from 'antd'

enum TipTypes {
    blockMusic, 
    unBlockMusic,
}   

const tipLabelObj = {
    [TipTypes.blockMusic]: '屏蔽的音乐在播放期间会自动静音, 可以点击取消屏蔽撤销',
}

const pastTipRecord = {}

export function tipWrapper (func: Function, type: TipTypes) {
    if (pastTipRecord[type]) {
        return func
    }
    return function (...args) {
        if (!pastTipRecord[type]) {
            Modal.info({
                title: '提示',
                content: tipLabelObj[type],
                onOk: () => {
                    func()
                }
            })
            return
        }
        func(...args)
    }
}

export const throttle = (func, time = 500, delayMode = false) => {
    if (delayMode) {
        let delayTimer = null
        return (...args) => {
            if (delayTimer) {
                clearTimeout(delayTimer)
            }
            delayTimer = setTimeout(() => {
                func()
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
