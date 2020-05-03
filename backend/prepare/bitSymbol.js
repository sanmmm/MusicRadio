const fs = require('fs')
const path = require('path')

function shuffleArr (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const swapIndex = Math.floor(Math.random() * i)
        const backUp = arr[i]
        arr[i] = arr[swapIndex]
        arr[swapIndex] = backUp
    }
    return arr
} 

function main () {
    const arr = []
    let i = 0
    while (i < 10) {
        arr.push(String.fromCharCode(0x30 + i))
        i ++
    }
    i = 0
    while (i < 26) {
        arr.push(String.fromCharCode(0x41 + i))
        i ++
    }
    i = 0
    while (i < 26) {
        arr.push(String.fromCharCode(0x61 + i))
        i ++
    }
    shuffleArr(arr)
    fs.writeFileSync(path.resolve(__dirname, 'bitSymbols.json'), JSON.stringify(arr))
    console.log(arr)
}

main()