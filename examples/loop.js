const als = require('..');
const fs = require('fs');
const assert = require('assert')
const got = require('got');
const debug = require('debug')('als')
const util = require('util');
const dns = require('dns');

const lookup = util.promisify(dns.lookup);
const lookupService = util.promisify(dns.lookupService);

als.enable();
als.setRemoveDelay(5000)

const scope = async () => {
  als.scope();
  als.set('id', Math.random())
  await sleep(300)
}

const sleep = timeout => new Promise(resolve => setTimeout(() => {
  debug('sleep', als.currentId())
  als.set('id', Math.random())
  resolve();
}, timeout))

const request = url => {
  als.set('id', Math.random())
  return got(url, {})
}

let count = 0

const loop = () => {
  setTimeout(async () => {
    while (true) {
      await scope()
      const id = Math.random()
      als.set('id', id)
      debug('while', als.currentId())
      count += 1
      await sleep(400)
      debug('whileDone', als.currentId())
      debug('http>>>>', als.currentId())
      await got('https://www.baidu.com/').then(() => {
        setTimeout(() => {
          debug('http', als.currentId())
        })
      })
      debug('http<<<<', als.currentId())
      await sleep(400)
      debug('lookup>>>>', als.currentId())
      await lookup('www.baidu.com').then(() => {
        setTimeout(() => {
          debug('lookup', als.currentId())
        })
      })
      debug('lookup<<<<', als.currentId())
      await sleep(500)
      debug('lookupService>>>>', als.currentId())
      await lookupService('127.0.0.1', 80).then(() => {
        setTimeout(() => {
          debug('lookupService', als.currentId())
        })
      })
      debug('lookupService<<<<', als.currentId())
      await sleep(500)
      debug('log', als.currentId())
    }
  })
}

setImmediate(() => {
  loop()
  loop()
  loop()
  loop()
})

setInterval(() => {
  debug('===========', count, als.getAllData().keys(), als.size())
  const { toRemove, relationMap, dataMap }= als.sizes()
  console.log('===========', count, als.sizes())
  assert(relationMap - toRemove < 50)
  assert(dataMap < 500)
}, 2000)

/*
setTimeout(() => {
  als.disable()
}, 6000)
*/
