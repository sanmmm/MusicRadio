import React, {useCallback} from 'react'
import { withStyles } from '@material-ui/core/styles'
import { TextField, Button, Tabs, Tab, Slider} from '@material-ui/core'
import {TextFieldProps} from '@material-ui/core/TextField'
import styleConfigs from 'config/baseStyle.conf'

const {themeColor, highLightColor, normalTextColor} = styleConfigs

const CustomTextFeildContent = withStyles({
    root: {
        color: normalTextColor,
        '& textarea, input': {
            color: normalTextColor,
        },
        '& .MuiInput-underline:before': {
            borderBottomColor: `${normalTextColor} !important`,
        },
        '& .MuiInput-underline:after': {
            borderBottomColor: themeColor,
        },
        '& .Mui-disabled': {
            textAlign: 'center',
            cursor: 'not-allowed',
        }
    },
})(TextField)


export const CustomTextFeild: React.FC<TextFieldProps> = (props) => {
    const {onKeyDown} = props
    const handleKeyDown = useCallback((e) => {
        e && e.stopPropagation()
        onKeyDown && onKeyDown(e)
    }, [onKeyDown])
    return <CustomTextFeildContent {...props} onKeyDown={handleKeyDown}/>
}

 
export const CustomBtn = withStyles({
    root: {
        fontSize: '1rem',
        '&:hover .MuiButton-label': {
            color: themeColor
        },
        '& .MuiButton-label': {
            color: normalTextColor
        }
    }
})(Button)

export const CustomTabs = withStyles({
    root: {
        borderBottom: `1px solid ${normalTextColor}`,
    },
    indicator: {
        backgroundColor: themeColor,
    },
    
})(Tabs)

export const CustomTab = withStyles({
    root: {
        fontSize: '1rem'
    },
    selected: {
        color: themeColor
    },
})(Tab)

export const VolumeSlider = withStyles({
    root: {
        color: 'rgb(155, 155, 155)',
    },
    track: {
        backgroundColor: 'white'
    },
    thumb: {
        width: '8px',
        height: '8px',
        marginLeft: '-2px',
        marginTop: '-3px',
        backgroundColor: 'white',
        '&::after': {
            display: 'none',
        }
    }
})(Slider)
