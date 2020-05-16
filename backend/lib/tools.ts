import path from 'path';
import fs from 'fs';

interface GetConfigOptions {
    basePath?: string; //绝对路径
    filename: string; // 配置文件名
    dir: string[] | string; // 搜索目录
    silent?: boolean; // 是否打印错误
}
export function getConfig<T = any> (options: GetConfigOptions) {
    const {filename, dir, basePath = process.cwd(), silent = false} = options
    const fileInfo = path.parse(filename)
    const fileExt = fileInfo.ext
    const fileNameToMatched = [filename, `${fileInfo.name}.default${fileExt}`] // [a.js, a.default.js]
    let defaultConfig: Partial<T> = null, config: Partial<T> = null

    if (!['.js', '.json'].includes(fileExt)) {
        throw new Error(`invalid ext:${fileExt}`)
    }
    const readFile = (dirPath: string, filename: string) => {
        try {
            let exported: T = null, isDefault = filename.endsWith(`default${fileExt}`)
            if (fileExt === '.js') {
                const fromDir = __dirname
                const toDir = path.isAbsolute(dirPath) ? dirPath : path.resolve(basePath, dirPath)
                const readFilePath = path.join(path.relative(fromDir, toDir), filename)
                exported = require(readFilePath)
            } else if (fileExt === '.json') {
                const readFilePath = path.isAbsolute(dirPath) ? path.join(dirPath, filename) : path.resolve(basePath, dirPath, filename)
                const jsonStr = fs.readFileSync(readFilePath, {
                    encoding: 'utf-8'
                })
                exported = JSON.parse(jsonStr)
            } else {
                throw new Error(`invalid ext:${fileExt}`)
            }
            if (isDefault) {
                (!defaultConfig || Array.isArray(exported)) ? (defaultConfig = exported) : Object.assign(defaultConfig, exported)
            } else {
                (!config || Array.isArray(exported)) ? (config = exported) : Object.assign(config, exported)
            }
        } catch (e) {
            if (!silent) {
                console.error(e)
            }
        }
       
    }

    const readFileFromDir = (dirname) => {
        fileNameToMatched.forEach(readFile.bind(null, dirname))
    }

    const dirArr = Array.isArray(dir) ? dir : [dir]
    dirArr.forEach(readFileFromDir)
    return Array.isArray(defaultConfig || config) ? (config || defaultConfig) : {
        ...defaultConfig,
        ...config,
    }
}

export function fillVaraibleToFile (options: {
    filePath: string;
    exportTo: string;
    vars: {
        [variableName: string]: string;
    }
}) {
    const {filePath, exportTo, vars} = options
    const fileStr = fs.readFileSync(filePath, {
        encoding: 'utf-8'
    })
    let isMatched = false
    const filledFileStr = fileStr.replace(/{{!(\w+)}}/g, (matched, varName) => {
        isMatched = true
        return vars[varName]
    })
    
    const exportToFileStr = fs.existsSync(exportTo) ? fs.readFileSync(exportTo, {
        encoding: 'utf-8'
    }) :  ''
    if (isMatched && filledFileStr !== exportToFileStr) {
        fs.writeFileSync(exportTo, filledFileStr)
    }
}

