import { AnyAction } from 'redux';
import { PlayListModelState } from './playList';
import {ChatListModelState} from './chatList'
import {CenterModelState} from './center'

export { PlayListModelState, ChatListModelState, CenterModelState};

export interface Loading {
  global: boolean;
  effects: { [key: string]: boolean | undefined };
  models: {
    chatList?: boolean;
    playList?: boolean;
    center?: boolean;
  };
}

export interface ConnectState {
  playList: PlayListModelState;
  chatList: ChatListModelState;
  center: CenterModelState;
  loading: Loading;
}

/**
 * @type T: Params matched in dynamic routing
 */
export interface ConnectProps<T = {}> {
  dispatch?<K = any>(action: AnyAction): K;
}
