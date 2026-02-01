import { __PROD__, __DEV__ } from '@/env'
/**
 * say hello
 *
 * @author CaoMeiYouRen
 * @date 2020-11-28
 * @export
 */
export function hello() {
    if (__PROD__) {
        console.log('Hello production')
    }
    if (__DEV__) {
        console.log('Hello development')
    }
    console.log('你好，世界！')
}

// 测试 ESM 中的 CommonJS 变量（需要 shims 支持）
console.log('__dirname:', typeof __dirname !== 'undefined' ? __dirname : 'not defined')
console.log('__filename:', typeof __filename !== 'undefined' ? __filename : 'not defined')

// 测试 ESM 中的 require（Node.js 平台自动注入）
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require && require('os')
    console.log('require("os"):', !!os)
} catch (e) {
    console.log('require is not available:', e)
}

// 测试 CommonJS 中的 ESM 变量（始终可用）
console.log('import.meta.url:', import.meta.url || 'not defined')
console.log('import.meta.dirname:', import.meta.dirname || 'not defined')
console.log('import.meta.filename:', import.meta.filename || 'not defined')
