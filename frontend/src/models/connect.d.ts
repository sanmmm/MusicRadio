import { AnyAction } from 'redux';
import { RouterTypes } from 'umi';
import { PlayListModelState } from './playList';
import {ChatListModelState} from './chatList'

export { PlayListModelState, ChatListModelState};

export interface Loading {
  global: boolean;
  effects: { [key: string]: boolean | undefined };
  models: {
    global?: boolean;
    menu?: boolean;
    setting?: boolean;
    user?: boolean;
    login?: boolean;
  };
}

export interface ConnectState {
  playList: PlayListModelState;
  chatList: ChatListModelState;
  loading: Loading;
}

export interface Route {
  routes?: Route[];
}

/**
 * @type T: Params matched in dynamic routing
 */
export interface ConnectProps<T = {}> extends Partial<RouterTypes<Route, T>> {
  dispatch?<K = any>(action: AnyAction): K;
}
