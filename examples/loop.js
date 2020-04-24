const als = require('..');
const got = require('got');
const debug = require('debug')('als')
als.enable();
als.setRemoveDelay(10000)

const sleep = timeout => new Promise(resolve => setTimeout(() => {
  debug('sleep', als.currentId())
  resolve();
}, timeout))

const request = url => got(url, {})

let count = 0

const loop = () => {
  setTimeout(async () => {
    while (true) {
      debug('while', als.currentId())
      count += 1
      await sleep(1000)
      debug('whileDone', als.currentId())
      await got('https://www.baidu.com/')
      await sleep(1000)
    }
  })
}

loop()
loop()
loop()
loop()

setInterval(() => {
  debug('===========', count, als.getAllData().keys(), als.size())
  console.log('===========', count, als.size())
}, 2000)
