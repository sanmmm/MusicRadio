import React, { useState } from 'react'
import bindClass from 'classnames'
import { Input, IconButton, Button } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { Search as SearchIcon, Refresh as RefreshIcon } from '@material-ui/icons'
import ScrollBar from 'react-perfect-scrollbar'

import styles from './style.less'
import styleConfig from 'config/baseStyle.conf'

const useStyle = makeStyles({
    root: {
        color: styleConfig.normalTextColor,
    },
    input: {
        fontSize: '1.2rem',
        lineHeight: '1.6em',
    },
    underline: {
        '&::before': {
            borderColor: styleConfig.normalTextColor,
        },
        '&::after': {
            borderColor: styleConfig.themeColor,
        }
    }
})
export default React.memo<{
    onSearch: (str: string) => any;
    searchLoading: boolean;
    loadMoreLoading: boolean;
    onLoadMore: () => any;
    onRefresh: () => any;
    hasMore: boolean;
    children: React.ReactNode;
}>((props) => {
    const { children, hasMore, loadMoreLoading, searchLoading } = props
    const hasData = !!React.Children.count(children)
    const [searchStr, onSearchStrChange] = useState('')
    const classObj = useStyle({})

    const onRefresh = () => {
        onSearchStrChange('')
        props.onRefresh()
    }
    return <div className={styles.listContainer}>
        <div className={styles.header}>
            <Input fullWidth={true} className={bindClass(classObj.root, classObj.input, classObj.underline)} onChange={e => onSearchStrChange(e.target.value)} value={searchStr}
                placeholder="请输入搜索内容"
                endAdornment={<React.Fragment>
                    <IconButton disabled={searchLoading} onClick={props.onSearch.bind(null, searchStr)}>
                        <SearchIcon className={classObj.root} />
                    </IconButton>
                    <IconButton disabled={loadMoreLoading} onClick={onRefresh}>
                        <RefreshIcon className={classObj.root} />
                    </IconButton>
                </React.Fragment>}
            />
        </div>
        <div className={styles.list}>
            <ScrollBar style={{height: '100%'}}>
                {
                    hasData ? <React.Fragment>
                        {children}
                        <div className={styles.bottom}>
                            {
                                hasMore ? <Button disabled={loadMoreLoading} className={classObj.root} onClick={props.onLoadMore.bind(null, null)}>加载更多</Button> : <span>没有更多了</span>}
                        </div>
                    </React.Fragment> :
                        <div className={styles.noData}>
                            暂无数据
                    </div>
                }
            </ScrollBar>
        </div>
    </div>
})
