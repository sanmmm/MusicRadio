import React from 'react'
import * as polished from 'polished'
import bindClass from 'classnames'

import DefaultLayout from './base/layout'
import { useScript, useStyle } from './base/hooks'
import { UserModel, UserStatus } from 'root/type';

export default function IndexLayout(props) {
  const [styleNode, classes] = useStyle('admin-register-css', {
    container: {
      ...polished.size('100%'),
      display: 'flex',
      justifyContent: 'center',
      flexDirection: 'column',
    },
    panel: {
      display: 'none',
      ...polished.size(null, '25vw'),
      ...polished.margin(0, 'auto', 0, 'auto'),
      ...polished.padding(14),
      ...polished.border(1, 'solid', polished.rgba(155, 155, 155, 0.5)),
      ...polished.borderRadius('left', 5),
      ...polished.borderRadius('right', 5),
      '@global': {
        button: {
          display: 'block',
          ...polished.size(null, '60%'),
          ...polished.margin(0, 'auto'),
        },
      }
    },
    error: {
      color: '#ff3333',
      fontSize: '0.8rem',
      ...polished.margin('.4rem', 0),
    },
    panelTitle: {
      textAlign: 'center',
      fontSize: '1.3rem',
    },
    panelFooter: {
      fontSize: '0.8rem',
      lineHeight: '2em',
      cursor: 'pointer',
      color: 'green',
    },
    success: {
      display: 'none',
      textAlign: 'center',
      '& *': {
        marginLeft: '1rem',
      }
    },
    loading : {
      position: "fixed",
      width: '100vw',
      height: '100vh',
      backgroundColor: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '2rem',
    },
    '@media (max-width: 500px)': {
      panel: {
        width: '90vw',
      }
    }
  })

  const scriptNode = useScript<{
    $: JQueryStatic;
    httpServerUrl: string;
    classes: typeof classes;
    basePath: string;
    UserStatus: typeof UserStatus;
  }>(({ $, classes, UserStatus, basePath = '', httpServerUrl = '' }) => {

    enum PagePaths {
      success = '/main',
      login = '/login',
      register = '/register',
    }

    const pageTitles = {
      [PagePaths.success]: '管理员',
      [PagePaths.login]: '登录',
      [PagePaths.register]: '注册',
    }

    const vars = {
      registerToken: '',
      pagePath: null as PagePaths,
      user: null as UserModel,
      isSuperAdmin: null as boolean,
    }
    
    $(window).on('load', function () {
      $('#loading').hide()
      if (!vars.user) {
        getUserInfo()
      } else {
        handlePageOnLoad()
      }
    })

    function handlePageOnLoad () {
      if (vars.isSuperAdmin) {
        redirectTo(PagePaths.success)
      } else if (getPurePath() === PagePaths.success) {
        redirectTo(PagePaths.login)
      } else{
        handlePathChange()
      }
    }

    function getUserInfo () {
      $('#loading').show()
      $.ajax(getApiUrl('/userinfo'), {
        method: 'GET',
        xhrFields: {
          withCredentials: true,
        },
        success: function (res) {
          if (res.code === 0) {
            vars.user = res.user
            vars.isSuperAdmin = vars.user.status > UserStatus.normal
            $('#loading').fadeOut(300)
            handlePageOnLoad()
          }
        }
      })
    }

    function getPurePath (pathname: string = location.pathname) {
      return pathname.replace(basePath, '')
    }

    function handlePathChange (path?: string) {
      if (!path) {
        path = getPurePath()
      }
      vars.pagePath = path as PagePaths
      if (path === PagePaths.login) {
        renderActions.showLogin()
      } else if (path === PagePaths.register) {
        renderActions.showRegister()
      } else if (path === PagePaths.success) {
        renderActions.showSuccess()
      }
    }


    function debounce(func: Function, timeout = 500) {
      let timer = null
      return function (...args) {
        if (timer) {
          clearTimeout(timer)
        }
        const that = this
        timer = setTimeout(function () {
          func.call(that, args)
        }, timeout)
      }
    }

    function redirectTo(path: PagePaths) {
      const url = new URL(location.href)
      url.pathname = basePath + path
      const pageTitle = pageTitles[path]
      history.pushState({
        pathTo: path,
      }, pageTitle, url.toString())
      handlePathChange(path)
    }

    function getLoginOrRegisterData() {
      const userName = $('#username').val()
      const password = $('#password').val()
      return {
        token: vars.registerToken,
        userName,
        password,
      }
    }

    function goToIndexPage () {
      const url = new URL(location.href)
      url.pathname = '/'
      location.href = url.toString()
    }

    function clearLoginOrRegisterData() {
      $('#username').val('')
      $('#password').val('')
    }

    function showError(ele: HTMLElement, text: string) {
      $(`<div class="${classes.error}">
        ${text}
      </div>`).insertAfter(ele)
    }

    const renderActions = {
      showSuccess () {
        $(`#registerOrLoginPanel`).hide()
        $('#success').show()
      },
      showRegister () {
        $(`#registerOrLoginPanel`).hide()
        $('#success').hide()
        $('#inputBaseInfo').hide()
        $('#validateToken').show()
        $(`.${classes.panelTitle}`).text('管理员注册')
        $(`.${classes.panelFooter}`).text('登录>>')
        $(`#registerOrLoginPanel`).fadeIn()
      },
      showLogin () {
        $(`#registerOrLoginPanel`).hide()
        $('#success').hide()
        $('#inputBaseInfo').show()
        $('#validateToken').hide()
        $(`.${classes.panelTitle}`).text('管理员登录')
        $(`.${classes.panelFooter}`).text('注册>>')
        $(`#registerOrLoginPanel`).fadeIn()
      }
    }
    
    function getApiUrl (path: string, query: {[key: string]: string} = {}) {
      const url = new URL(httpServerUrl + '/api/admin' + path)
      url.search = location.search
      Object.keys(query).forEach(key => url.searchParams.set(key, query[key]))
      return url.toString()
    }

    $('input').on('keyup', function () {
      $(`.${classes.error}`).remove()
    })

    $('#submit').click(function () {
      const postData = getLoginOrRegisterData()
      const isRegister = vars.pagePath === PagePaths.register
      if (isRegister) {
        Object.assign(postData, {
          token: vars.registerToken,
        })
      }
      const apiUrl = getApiUrl(isRegister ? '/register' : '/login')
      const that = this
      $.post({
        url: apiUrl,
        data: postData,
        dataType: 'json',
        xhrFields: {
          withCredentials: true,
        },
        success: function (res) {
          if (res.code === 0) {
            clearLoginOrRegisterData()
            if (isRegister) {
              redirectTo(PagePaths.login)
            } else {
              redirectTo(PagePaths.success)
            }
          } else {
            showError(that, `${res.msg || '未知错误'}`)
          }
        }
      })
    })


    const handleTokenInput = debounce(function () {
      const registerToken = $(this).val() as string
      if (!registerToken) {
        return
      }
      const url = new URL(location.href)
      url.searchParams.set('token', registerToken)
      const that = this
      const apiUrl = getApiUrl('/checktoken', {
        token: registerToken,
      })
      $.get({
        url: apiUrl,
        xhrFields: {
          withCredentials: true,
        },
        success: function (res) {
          if (res.code !== 0) {
            showError(that, `邀请码错误:${res.msg || '未知错误'}`)
          } else {
            vars.registerToken = registerToken
            $('#validateToken').hide()
            $('#inputBaseInfo').fadeIn()
          }
        }
      })
    }, 800)
    $<HTMLInputElement>('#token').
      on('keyup', handleTokenInput).
      on('keyup', function () {
        $(`.${classes.error}`).remove()
      })


    $('#logout').click(function () {
      $.post({
        url: getApiUrl('/logout'),
        xhrFields: {
          withCredentials: true,
        },
        success: function (res) {
          if (res.code === 0) {
            goToIndexPage()
          }
        }
      })
    })

    $('#panelFooter').click(function () {
      const nowPagePath = vars.pagePath
      redirectTo(nowPagePath === PagePaths.register ? PagePaths.login : PagePaths.register)
    })
    $('#backToIndex').click(goToIndexPage)
  }, {
    basePath: props.basePath,
    httpServerUrl: props.httpServerUrl,
    classes,
    UserStatus: UserStatus,
  })
  const layoutProps = {
    header: <React.Fragment>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.4.1/dist/css/bootstrap.min.css"></link>
      {styleNode}
    </React.Fragment>
  }
  return <DefaultLayout {...layoutProps}>
    <div className={classes.loading} id="loading">
      加载中...
    </div>
    <div className={classes.container}>
      <div className={classes.panel} id="registerOrLoginPanel">
        <h3 className={classes.panelTitle}></h3>
        <form id="validateToken">
          <div className="form-group">
            <label htmlFor="token">注册码</label>
            <input type="input" className="form-control" id="token" placeholder="请输入超级管理员注册激活码" />
          </div>
        </form>
        <form id="inputBaseInfo">
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input type="username" className="form-control" id="username" placeholder="请输入用户名" />
          </div>
          <div className="form-group">
            <label htmlFor="password">登录密码</label>
            <input type="password" className="form-control" id="password" placeholder="请输入密码" />
          </div>
          <button type="button" className="btn btn-primary" id="submit">提交</button>
        </form>
        <div className={classes.panelFooter} id="panelFooter"></div>
      </div>
      <div className={bindClass(classes.success)} id="success">
        <div>
          您已登录成功!
          <button type="button" className="btn btn-primary" id="backToIndex">返回首页</button>
          <button type="button" className="btn btn-secondary" id="logout">注销</button>
        </div>
      </div>
    </div>

    {scriptNode}
  </DefaultLayout>
}