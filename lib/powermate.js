const { EventEmitter } = require('events')
const _ = require('lodash')
const bindAll = require('lodash/fp/bindAll')
const first = require('lodash/fp/first')
const isEmpty = require('lodash/fp/isEmpty')
const isNil = require('lodash/fp/isNil')
const after = require('lodash/fp/after')
const size = require('lodash/fp/size')
const debug = require('debug')('powermate-websocket:powermate')

const ROTATION_THRESHOLD = 0

class Powermate extends EventEmitter {
  constructor(options = {}) {
    super()
    bindAll(Object.getOwnPropertyNames(Powermate.prototype), this)

    if (options.getHID) {
      this.getHID = options.getHID
    }
    this._emitRotateLeft = _.throttle(this._unthrottledEmitRotateLeft, 10, { leading: true, trailing: false })
    this._emitRotateRight = _.throttle(this._unthrottledEmitRotateRight, 10, { leading: true, trailing: false })
    this._emitClick = _.throttle(this._unthrottledEmitClick, 200, { leading: true, trailing: false })
  }

  connect(callback) {
    if (this.device) return callback(null)

    this.getHID((getDeviceError, device) => {
      if (getDeviceError) return callback(getDeviceError)

      this.device = device
      this.device.on('data', (data) => {
        clearTimeout(this.timeout)
        this._onData(data)
      })
      this.device.once('error', this._emitError)

      debug('connected to device')
      callback();
    })
  }

  close(callback) {
    if (!this.isConnected()) return callback()

    this.device.close()
    this.device.removeAllListeners()
    this.device = null

    callback()
  }

  getHID(callback) {
    const HID = require('node-hid') // eslint-disable-line global-require
    const devices = HID.devices(1917, 1040)

    if (isEmpty(devices)) return callback(this._createError(404, 'Powermate device not found'))
    if (size(devices) > 1) return callback(this._createError(412, 'More than one Powermate device found'))

    const { path } = first(devices)

    try {
      callback(null, new HID.HID(path))
    } catch (error) {
      return callback(error)
    }
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

    if (data[0] === 0x01 || data[1] === 0x00) {
      return this._emitClick();
    }

    if (data[1] === 0xff) {
      return this._emitRotateLeft()
    }

    if (data[1] === 0x01) {
      return this._emitRotateRight()
    }
  }

  _unthrottledEmitClick() {
    debug('click')
    this.emit('click')
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
