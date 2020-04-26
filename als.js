const asyncHooks = require('async_hooks')
const nano = require('nano-seconds')
const util = require('util')
const fs = require('fs')
const assert = require('assert')

const enabledDebug = process.env.DEBUG === 'als'
const toRemove = new Map()
const relationMap = new Map()
const dataMap = new Map()

const BLACKLIST_TYPE = [
  'GETADDRINFOREQWRAP',
  'GETNAMEINFOREQWRAP',
  'TCPCONNECTWRAP',
  'WRITEWRAP',
  'TTYWRAP',
  'SIGNALWRAP'
]

let timer
let defaultLinkedTop = false
let enabledCreatedAt = false
let removeDelay = 60000

assert(asyncHooks.executionAsyncId)

const debug = (...args) => {
  if (!enabledDebug) {
    return
  }
  // use a function like this one when debugging inside an AsyncHooks callback
  fs.writeSync(1, `${util.format(...args)}\n`)
}

const getTopData = id => {
  const data = dataMap.get(id)
  if (data && data.isTop) {
    return data
  }
  const parentId = relationMap.get(id)
  if (!parentId) {
    return data
  }
  return getTopData(parentId)
}

const getData = (id, key) => {
  const data = dataMap.get(id) || {}
  const value = data[key]
  if (value !== undefined) {
    return value
  }
  if (!data.isTop) {
    const parentId = relationMap.get(id)
    if (parentId) {
      return getData(parentId, key)
    }
  }
  return undefined
}


const delayRemove = (id, delay = removeDelay) => {
  if (!relationMap.has(id)) {
    return
  }
  debug('delayRemove %d;%d', id, delay)
  toRemove.set(id, { id, removeAt: Date.now() + delay })
}

// https://nodejs.org/dist/latest-v12.x/docs/api/async_hooks.html#async_hooks_init_asyncid_type_triggerasyncid_resource
const hooks = asyncHooks.createHook({
  init: function init (id, type, triggerId) {
    debug('%d(%s) init by %d', id, type, triggerId)
    if (BLACKLIST_TYPE.includes(type)) {
      return
    }
    relationMap.set(id, triggerId)
    if (enabledCreatedAt) {
      dataMap.set(id, { created: nano.now() })
    }
  },
  promiseResolve: delayRemove,
  after: delayRemove,
  destroy: id => delayRemove(id, 5000)
})

/**
 * Get the current id
 * @returns {int} currentId
 */
const getCurrentId = () => asyncHooks.executionAsyncId()

exports.currentId = getCurrentId

/**
 * Enable the async hook
 * @returns {AsyncHook} A reference to asyncHook.
 */
exports.enable = () => {
  timer = setInterval(() => {
    debug('toRemoveSize %d;', toRemove.size)
    const now = Date.now()
    toRemove.forEach(item => {
      const { id, removeAt } = item
      if (removeAt < now) {
        toRemove.delete(id)
        relationMap.delete(id)
        dataMap.delete(id)
        debug('remove %d;', id)
      }
    })
    debug('toRemoveSize %d;', toRemove.size)
  }, 20000)
  return hooks.enable()
}

/**
 * Disable the async hook
 * @returns {AsyncHook} A reference to asyncHook.
 */
exports.disable = () => {
  relationMap.clear()
  dataMap.clear()
  toRemove.clear()
  clearInterval(timer)
  return hooks.disable()
}

/**
 * Get the size of map
 * @returns {int} size
 */
exports.size = () => dataMap.size

/**
 * Enable linked top
 * @returns {void}
 */
exports.enableLinkedTop = () => {
  defaultLinkedTop = true
}

/**
 * Disable linked top
 * @returns {void}
 */
exports.disableLinkedTop = () => {
  defaultLinkedTop = false
}

/**
 * Set the key/value for this score
 * @param {string} key The key of value
 * @param {any} value The value
 * @param {boolean} [linkedTop] The value linked to top
 * @returns {boolean} if success, will return true, otherwise false
 */
exports.set = function setValue (key, value, linkedTop = defaultLinkedTop) {
  /* istanbul ignore if */
  if (key === 'created') {
    throw new Error("can't set created")
  }
  const id = getCurrentId()
  debug('set %s:%j to %d', key, value, id)
  if (linkedTop) {
    const data = getTopData(id)
    if (data) {
      data[key] = value
    }
  }
  const currentData = dataMap.get(id)
  if (!currentData) {
    dataMap.set(id, { [key]: value })
  } else {
    currentData[key] = value
  }
}

/**
 * Get the value by key
 * @param {string} key The key of value
 * @returns {any} value
 */
exports.get = key => getData(getCurrentId(), key)

/**
 * 获取当前current data
 * @returns {object} current data
 */
exports.getCurrentData = () => dataMap.get(getCurrentId())

/**
 * Get the value by key from parent
 * @param {string} key The key of value
 * @returns {any} value
 */
exports.getFromParent = key => getData(
  relationMap.get(getCurrentId()),
  key
)

/**
 * Remove the data of the current id
 * @returns {void}
 */
exports.remove = function removeValue () {
  const id = getCurrentId()
  if (id) {
    dataMap.delete(id)
    relationMap.delete(id)
    toRemove.delete(id)
  }
}

/**
 * Get the use the of id
 * @param {number} id The trigger id, is optional, default is `als.currentId()`
 * @returns {number} The use time(ns) of the current id
 */
exports.use = function getUse (id) {
  const data = dataMap.get(id || getCurrentId())
  /* istanbul ignore if */
  if (!data || !enabledCreatedAt) {
    return -1
  }
  return nano.difference(data.created)
}

/**
 * Get the top value
 * @returns {object} topData
 */
exports.top = function top () {
  return getTopData(getCurrentId())
}

/**
 * Set the scope (it will change the top)
 * @returns {void}
 */
exports.scope = function scope () {
  const id = getCurrentId()
  const currentData = dataMap.get(id)
  if (currentData) {
    currentData.isTop = true
  } else {
    dataMap.set(id, { isTop: true })
  }
}

/**
 * Get all data of async locatl storage, please don't modify the data
 * @returns {map} allData
 */
exports.getAllData = function getAllData () {
  return dataMap
}

/**
 * Enable the create time of data
 * @returns {void}
 */
exports.enableCreateTime = function enableCreateTime () {
  enabledCreatedAt = true
}

/**
 * Disable the create time of data
 * @returns {void}
 */
exports.disableCreateTime = function disableCreateTime () {
  enabledCreatedAt = false
}

exports.setRemoveDelay = delay => {
  removeDelay = delay
}

exports.parentId = () => relationMap.get(getCurrentId())

exports.sizes = () => ({
  toRemove: toRemove.size,
  relationMap: relationMap.size,
  dataMap: dataMap.size
})
