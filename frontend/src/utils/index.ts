import {Modal} from 'antd'

const tipLabelObj = {
    [TipTypes.blockMusic]: '屏蔽的音乐在播放期间会自动静音, 可以点击取消屏蔽撤销',
}

const pastTipRecord = {}

export function tipWrapper (func: Function, type: TipTypes) {
    if (pastTipRecord[type]) {
        return func
    }
    return function () {
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
        func()
    }
}
