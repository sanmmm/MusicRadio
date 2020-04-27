import React from 'react'
import jss, { Styles, Classes } from 'jss'
import preset from 'jss-preset-default'


jss.setup(preset())

const getRandomVariableName = (baseName?: string) => [baseName, Math.random().toString(32).slice(2, 6)].filter(o => !!o).join('_')

export const useScript = function <T>(func: (global: T) => any, deps: Partial<T> = {}) {
    const depStrVarName = getRandomVariableName('depsStr')
    const depVarName = getRandomVariableName('dep')
    const funcName = func.name || getRandomVariableName('func')

    const scriptStr = `
    const ${depStrVarName} = '${JSON.stringify(deps)}';
    const ${depVarName} = JSON.parse(${depStrVarName});
    Object.assign(${depVarName}, window);
    const ${funcName} = ${func.toString()};
    ${funcName}(${depVarName});
    `
    return <script dangerouslySetInnerHTML={{
        __html: scriptStr
    }}>
    </script>
}

const sheetDataMap = new Map<string, {
    classes: Classes;
    sheetStr: string;
}>()
export function useStyle<Name extends any>(key: string, obj: Partial<Styles<Name>>) {
    let sheetData = sheetDataMap.get(key)
    if (!sheetData) {
        const sheet = jss.createStyleSheet(obj)
        sheetData = {
            classes: sheet.classes,
            sheetStr: sheet.toString(),
        }
        sheetDataMap.set(key, sheetData)
    }
    const { classes, sheetStr } = sheetData
    return [
        <style>{sheetStr}</style>,
        classes,
    ] as [JSX.Element, Classes<Name>]
}