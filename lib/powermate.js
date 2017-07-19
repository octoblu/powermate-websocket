const { EventEmitter } = require('events')
const HID = require('node-hid')
const bindAll = require('lodash/fp/bindAll')
const first = require('lodash/fp/first')
const isEmpty = require('lodash/fp/isEmpty')
const isNil = require('lodash/fp/isNil')
const after = require('lodash/fp/after')
const size = require('lodash/fp/size')
const throttle = require('lodash/fp/throttle')
const debug = require('debug')('powermate-websocket:powermate')

const ROTATION_THRESHOLD = 2
const LONG_PRESS_THRESHOLD = 1000

class Powermate extends EventEmitter {
  constructor() {
    super()
    bindAll(Object.getOwnPropertyNames(Powermate.prototype), this)

    this._emitRotateLeft = after(this._unthrottledEmitRotateLeft, ROTATION_THRESHOLD)
    this._emitRotateRight = after(this._unthrottledEmitRotateRight, ROTATION_THRESHOLD)
    this._emitClick = throttle(250, this._unthrottledEmitClick)
  }

  connect(callback) {
    if (this.device) return callback(null)

    const devices = HID.devices(1917, 1040)

    if (isEmpty(devices)) return callback(this._createError(404, 'Powermate device not found'))
    if (size(devices) > 1) return callback(this._createError(412, 'More than one Powermate device found'))

    const { path } = first(devices)

    try {
      this.device = new HID.HID(path)
      this.device.on('data', this._onData)
      this.device.once('error', this._emitError)
    } catch (error) {
      return callback(error)
    }

    debug('connected to device', { path })
    callback();
  }

  close(callback) {
    if (!this.isConnected()) return callback()

    this.device.close()
    this.device.removeAllListeners()
    this.device = null

    callback()
  }

  isConnected() {
    return !isNil(this.device)
  }

  _createError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
  }

  _emitError(error) {
    if (!this.isConnected()) return
    if (isNil(error)) return

    debug('emit error', error)
    this.emit('error', error)
    return this.close(closeError => debug('_emitError -> close', closeError))
  }

  _onData(data) {
    debug('_onData', data)

    if (data[0] === 0x01 && data[1] === 0x00) {
      this.sendShortClick = true
      this.timeout = setTimeout(() => {
        this.sendShortClick = false
        this._emitLongClick()
      }, LONG_PRESS_THRESHOLD)
    }
    if (data[0] === 0x00 && data[1] === 0x00) {
      if (this.sendShortClick) {
        clearTimeout(this.timeout)
        this._emitClick()
      }
    }
    if (data[1] === 0xff) {
      this._emitRotateLeft()
    }
    if (data[1] === 0x01) {
      this._emitRotateRight()
    }
  }

  _emitLongClick() {
    debug('longClick');
    return this.emit('longClick');
  }

  _unthrottledEmitClick() {
    debug('click');
    return this.emit('click');
  }

  _unthrottledEmitRotateLeft() {
    this._emitRotateLeft = after(this._unthrottledEmitRotateLeft, ROTATION_THRESHOLD);
    debug('rotateLeft');
    return this.emit('rotateLeft');
  }

  _unthrottledEmitRotateRight() {
    this._emitRotateRight = after(this._unthrottledEmitRotateRight, ROTATION_THRESHOLD);
    debug('rotateRight');
    return this.emit('rotateRight');
  }
}

module.exports = Powermate;