import { withStyles } from '@material-ui/core/styles'
import { TextField, Button, Tabs, Tab } from '@material-ui/core'
import styleConfigs from '@/baseStyle.conf'

const {themeColor, highLightColor, normalTextColor} = styleConfigs

export const CustomTextFeild = withStyles({
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
    }
})(TextField)
 
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
    }
})(Tab)
