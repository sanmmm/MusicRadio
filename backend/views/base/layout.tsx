import React from 'react'
import {normalize} from 'polished'

import { useScript, useStyle } from './hooks'

const normalizeStyle = normalize().reduce((obj, style) => {
  return {
    ...obj,
    ...style,
  }
}, {})
export default function DefaultLayout(props) {
  const [styleNode, classes] = useStyle('base', {
    footer: {
      width: '100%',
      lineHeight: '40px',
      textAlign: 'center',
    },
    main: {
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
    },
    content: {
      flexGrow: 1,
    },
    '@global': {
      ...normalizeStyle,
    }
  })
  return (
    <html>
      <head>
        <title>{props.title}</title>
        <script src="https://cdn.jsdelivr.net/npm/jquery@3.2.1/dist/jquery.min.js"></script>
        {styleNode}
        {props.header}
      </head>
      <body className={classes.main}>
        <div className={classes.content}>
          {props.children}
        </div>
        <div className={classes.footer}>@copyright {new Date().getFullYear()}</div>
      </body>
    </html>
  );
}