import React, {useRef, useEffect, useState, useCallback} from 'react'
import { connect } from 'dva';
import ReactEcharts from 'echarts-for-react/lib/core'
import echarts, {ECharts} from 'echarts/lib/echarts'
import 'echarts/map/js/china'
import {Button} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles';
import bindClass from 'classnames';

import style from './style.less'
import ScrollShow from '@/components/scrollShow'
import { ConnectState, ConnectProps } from '@/models/connect';
import {getArrRandomItem} from '@/utils'
import CustomIcon from '@/components/CustomIcon';

enum TipPositions {
    left,
    right,
    top,
    bottom,
}

type TranslateParamType = number | string | (number | string)[]

const Utils = {
    tipShowDuration: 1200,
    tipTransitionDuration: 1200,
    tipOffsetSpace: {
        vertical: 3,
        horizontal: 6,
    },
    effectScatterSize: 14,
    positionTypeToShowDirection: {
        [TipPositions.bottom]: 'both',
        [TipPositions.top]: 'both',
        [TipPositions.left]: 'left',
        [TipPositions.right]: 'right',
    },
    getTipPositon: (pixel: number[], canvasSize: {width: number, height: number}) => {
        const [x, y] = pixel, {width, height} = canvasSize
        const [centerX, centerY] = [width / 2, height / 2]
        const all = [TipPositions.bottom, TipPositions.top, TipPositions.left, TipPositions.right]
        const notSelected = []
        notSelected.push(x < centerX ? TipPositions.left : TipPositions.right)
        notSelected.push(y < centerY ? TipPositions.top : TipPositions.bottom)
        const toSelected = all.filter(i => !notSelected.includes(i))
        return toSelected[Math.floor(toSelected.length * Math.random())]
    },
    getTranslateValue: (x: TranslateParamType, y: TranslateParamType) => {
        const toValueStr = (v) => typeof v === 'string' ? v : `${v}px`
        return x instanceof Array ? (
            x.map((v, i) => {
                const xValue = toValueStr(v)
                const yValue = toValueStr(y[i])
                return `translate(${xValue}, ${yValue})`
            }).join(' ')
        ) : `translate(${toValueStr(x || 0)}, ${toValueStr(y || 0)})`
    }
}

const useStyle =  makeStyles({
    tip: {
        transform: ({tipPosition}: {tipPosition: TipPositions}) => {
            const {tipOffsetSpace, effectScatterSize} = Utils
            let x, y
            if (tipPosition === TipPositions.left) {
                x = ['-100%', -tipOffsetSpace.horizontal - effectScatterSize]
                y = [0, 0]
            } else if (tipPosition === TipPositions.right) {
                x = effectScatterSize + tipOffsetSpace.horizontal
                y = 0
            } else if (tipPosition === TipPositions.bottom) {
                y = effectScatterSize + tipOffsetSpace.vertical
                x = '-50%'
            } else if (tipPosition === TipPositions.top){
                y = [- (effectScatterSize + tipOffsetSpace.vertical), '-100%']
                x = ['-50%', 0]
            }
            return Utils.getTranslateValue(x, y)
        }
    }
})

interface Props extends ConnectProps {
    isDataLoading: boolean;
    dataList: [];
}

const CoordDataVisualization = React.memo<Props>((props) => {
    const {isDataLoading, dataList, dispatch} = props
    const instanceRef = useRef<ECharts>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [canvasWidth, setCanvasWidth] = useState(0)
    const [focusInfo, setFocusInfo] = useState(null as {
        index: number;
        pixelPosition: number[];
        positionType: TipPositions;
        detail: {
            content?: string;
            id?: string;
            name?: string;
        } | string
    })
    const [showTip, setShowTip] = useState(false)
    const focusDataIndexRef = useRef(null as number)
    focusDataIndexRef.current = focusInfo ? focusInfo.index : -1
    const loopTimerRef = useRef(null)
    const scatterDataRef = useRef([] as any[][])
    const canvasSizeRef = useRef({width: 0, height: 0})
    const classes = useStyle({
        tipPosition: focusInfo && focusInfo.positionType,
    })

    const option = {
        title: {
        },
        visualMap: [
            {
                type: 'piecewise',
                splitNumber: 3,
                min: 0,
                max: 6,
                dimension: 2,
                seriesIndex: 0, 
                showLabel: false,   
                show: false, 
                inRange: {          
                    color: ['#67D5B5', '#EE7785', '#C89EC4'], 
                    symbolSize: [4, 10]               
                },
                outOfRange: {  
                    color: '#84B1ED',     
                    symbolSize: [12, 16]
                }
            },
            {
                type: 'piecewise',
                min: 0,
                splitNumber: 3,
                max: 6,
                dimension: 2,
                seriesIndex: 1, 
                showLabel: false,   
                show: false, 
                inRange: {          
                    color: ['#67D5B5', '#EE7785', '#C89EC4'], 
                },
                outOfRange: {  
                    color: '#84B1ED',     
                }
            },
        ],
        geo: {
            map: 'china',
            label: {
                emphasis: {
                    show: false
                }
            },
            itemStyle: {
                normal: {
                    areaColor: '#323c48',
                    borderColor: '#111'
                },
                emphasis: {
                    areaColor: '#2a333d'
                }
            } 
        },
        series: [ {
            name: 'heat',
            type: 'scatter',
            coordinateSystem: 'geo',
            label: {
                normal: {
                    show: false
                },
                emphasis: {
                    show: false
                }
            },
            itemStyle: {
                emphasis: {
                    borderColor: '#fff',
                    borderWidth: 1
                }
            },
            data: scatterDataRef.current || [],
         
        },  {
            name: `effect`,
            type: 'effectScatter',
            coordinateSystem: 'geo',
            data: scatterDataRef.current,
            symbolSize: function (val, params) {
                const {dataIndex} = params
                return focusDataIndexRef.current === dataIndex ? Utils.effectScatterSize : 0
            },
            showEffectOn: 'render',
            rippleEffect: {
                brushType: 'stroke'
            },
            hoverAnimation: true,
            itemStyle: {
                color: '#84B1ED',
                shadowBlur: 5,
            },
            zlevel: 1
        }]
    }

    useEffect(() => {
        dispatch({
            type: 'center/getRoomGlobalCoordHotData',
            payload: {},
        })
        
    }, [])

    useEffect(() => {
        requestAnimationFrame(() => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                setCanvasWidth(rect.width)
            }
        })
    }, [])

    useEffect(() => {
        if (dataList.length) {
            scatterDataRef.current = dataList
            handleShowTip(0)
        }
        return () => {
            console.log('clear')
            const timer = loopTimerRef.current
            if (timer) {
                clearInterval(timer)
            }
        }
    }, [dataList])

    const {tipShowDuration, tipTransitionDuration} = Utils
    const handleShowTip = (index?: number) => {
        const focusDataIndex = focusDataIndexRef.current
        const data = scatterDataRef.current
        const newIndex = index !== undefined ? index : (
            focusDataIndex < data.length -1 ? focusDataIndex + 1 : 0
        )
        const position = instanceRef.current.convertToPixel({
            seriesIndex: 0,
        }, data[newIndex].slice(0, 2)) as number[]
        setShowTip(true)
        
        const newDataItem = data[newIndex]
        const obj = getArrRandomItem(newDataItem[3])
        setFocusInfo({
            index: newIndex,
            pixelPosition: position as number[],
            positionType: Utils.getTipPositon(position, canvasSizeRef.current),
            detail: obj || `${newDataItem[2]}人在线`
        })
        loopTimerRef.current = setTimeout(() => {
            setShowTip(false)
        }, tipShowDuration + tipTransitionDuration)
    }

    const handleAfterHide = useCallback(() => {
        console.log('after hide')
        handleShowTip()
    }, [])

    const handleRef = (obj) => {
        if (obj) {
            const instance: ECharts = obj.getEchartsInstance()
            instanceRef.current = instance
            canvasSizeRef.current = {
                width: instance.getWidth(),
                height: instance.getHeight(),
            }
        }
    }

    const loadData = () => {
        console.log('inner ----')
        dispatch({
            type: 'center/getRoomGlobalCoordHotData',
            payload: {},
        })
    }

    const [left, top] = focusInfo ? focusInfo.pixelPosition : []
    const direction = Utils.positionTypeToShowDirection[focusInfo && focusInfo.positionType] || 'left'
    return <div className={style.roomVisualization} ref={containerRef}>
        <ReactEcharts option={option} echarts={echarts} ref={handleRef} showLoading={isDataLoading} opts={{width: canvasWidth}} />
        <div
            className={bindClass(style.tooltip, classes.tip)}
            style={{
                top,
                left,
            }}
        >
        <ScrollShow 
            key={focusInfo && focusInfo.index}
            show={showTip}
            transitionDuration={tipTransitionDuration / 1000}
            direction={direction as any}
            afterHide={handleAfterHide}
        >
            <span className={style.content}>
            {
                !!focusInfo &&  (
                    () => {
                        const {detail} = focusInfo
                        if (typeof detail === 'string') {
                            return detail
                        }
                        const {name, content} = detail
                        return <React.Fragment>
                            <CustomIcon style={{marginRight: '.5rem', color: 'rgb(49, 194, 12'}}>{!!name ? 'trumpet' : 'message'}</CustomIcon>
                            {
                                !!name ? `在听《${name}》` : `在说: ${content}`}
                        </React.Fragment>
                    }
                )()
            }
            </span>
        </ScrollShow>
        </div>
        <Button color="primary" variant="contained" onClick={loadData} style={{marginTop: 30}}>刷新</Button>
    </div>
})

export default connect(({center: {coordHotDataList}, loading}: ConnectState) => {
    return {
        dataList: coordHotDataList,
        isDataLoading: loading.effects['center/getRoomGlobalCoordHotData'],
    }
})(CoordDataVisualization)
