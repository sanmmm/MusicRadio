import React from 'react';
import styles from './index.css';
import 'react-perfect-scrollbar/dist/css/styles.css';
import 'antd/dist/antd.css';
import zhCN from 'antd/es/locale/zh_CN';

const BasicLayout: React.FC = props => {
  return (
    <div className={styles.normal}>
      {/* <h1 className={styles.title}>Yay! Welcome to umi!</h1> */}
      {props.children}
    </div>
  );
};

export default BasicLayout;
