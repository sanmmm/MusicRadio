import {getConfig} from 'root/lib/tools'
import {Settings, EmojiData, BlockMusicList, BlockWordList, BitSymbols, ClientSettings} from 'root/default/configs.type'

const basePath = __dirname

const configDirs = ['.', './default', './config']
if (injectedConfigs.appendConfigFileDir) {
    configDirs.push(injectedConfigs.appendConfigFileDir)
}

const settings = getConfig<Settings>({
    filename: 'settings.js',
    basePath,
    dir: configDirs,
    silent: true,
})

export default settings


export const emojiData = getConfig<EmojiData>({
    filename: 'emojiData.json',
    basePath,
    dir: configDirs,
    silent: true,
})

export const blockMusic = getConfig<BlockMusicList>({
    filename: 'blockMusic.json',
    basePath,
    dir: configDirs,
    silent: true,
})

export const blockWords = getConfig<BlockWordList>({
    filename: 'blockWords.json',
    basePath,
    dir: configDirs,
    silent: true,
})

export const bitSymbols = getConfig<BitSymbols>({
    filename: 'bitSymbols.json',
    basePath,
    dir: configDirs,
    silent: true,
})

export const clientSettings = getConfig<ClientSettings>({
    filename: 'clientSettings.js',
    silent: true,
    basePath,
    dir: configDirs,
})
