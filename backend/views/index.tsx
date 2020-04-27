import React from 'react'

import DefaultLayout from './base/layout'
import { useScript, useStyle } from './base/hooks'

export default function IndexLayout(props) {

  const [styleNode, classes] = useStyle('index-css', {

  })

  const scriptNode = useScript<{
    $: JQueryStatic;
    registerUrl: string;
    checkTokenUrl: string;
  }>(({ $, registerUrl,  checkTokenUrl}) => {
    function getRegisterData() {
      const userName = $('#username').val()
      const password = $('#password').val()
      return {
        userName,
        password,
      }
    }
    $('#submit').click(function () {
      const postData = getRegisterData()
      console.log(postData)
      $.post({
        url: registerUrl + location.search,
        data: postData,
        dataType: 'json',
        xhrFields: {
          withCredentials: true,
        },
        success: function (res) {
          if (res.code === 0) {
            
          }
        }
      })
    })

    $('#checkToken').click(function () {
      const postData = getRegisterData()
      console.log(postData)
      $.post({
        url: registerUrl,
        xhrFields: {
          withCredentials: true,
        },
        success: function (...args) {
          console.log(args)
        }
      })
    })
  }, {
    checkTokenUrl: props.checkTokenUrl,
    registerUrl: props.registerUrl
  })

  const layoutProps = {
    header: <React.Fragment>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.4.1/dist/css/bootstrap.min.css"></link>
      {styleNode}
    </React.Fragment>
  }
  return <DefaultLayout {...layoutProps}>
    <div>
      <div className="form-group">
        <label htmlFor="token">注册码</label>
        <input type="token" className="form-control" id="token" placeholder="请输入超级管理员注册激活码" />
      </div>
    </div>
    <div>
      <div className="form-group">
        <label htmlFor="username">用户名</label>
        <input type="username" className="form-control" id="username" placeholder="请输入用户名"/>
      </div>
      <div className="form-group">
        <label htmlFor="password">登录密码</label>
        <input type="password" className="form-control" id="password" placeholder="请输入密码" />
      </div>
      <button type="button" className="btn btn-primary" id="submit">提交</button>
    </div>
    {scriptNode}
  </DefaultLayout>
}