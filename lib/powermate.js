const { EventEmitter } = require('events')
const HID = require('node-hid')
const bindAll = require('lodash/fp/bindAll')
const first = require('lodash/fp/first')
const isEmpty = require('lodash/fp/isEmpty')
const isNil = require('lodash/fp/isNil')
const after = require('lodash/fp/after')
const size = require('lodash/fp/size')
const throttle = require('lodash/fp/throttle')
const debounce = require('lodash/fp/debounce')
const debug = require('debug')('powermate-websocket:powermate')

const ROTATION_THRESHOLD = 5

class Powermate extends EventEmitter {
  constructor() {
    super()
    bindAll(Object.getOwnPropertyNames(Powermate.prototype), this)

    this._emitRotateLeft = after(this._unthrottledEmitRotateLeft, ROTATION_THRESHOLD)
    this._emitRotateRight = after(this._unthrottledEmitRotateRight, ROTATION_THRESHOLD)
    this._emitClick = throttle(100, this._unthrottledEmitClick)
    this._debounceEmitClick = debounce(200, this._emitClick)


    //this._emitClick = throttle(1000, this._unthrottledEmitClick, {"leading": true, "trailing": false})

  }

  connect(callback) {
    if (this.device) return callback(null)

    const devices = HID.devices(1917, 1040)

    if (isEmpty(devices)) return callback(this._createError(404, 'Powermate device not found'))
    if (size(devices) > 1) return callback(this._createError(412, 'More than one Powermate device found'))

    const { path } = first(devices)

    try {
      this.device = new HID.HID(path)
      this.device.on('data', (data) => {
        clearTimeout(this.timeout)
        this._onData(data)
      })
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

    if(data[0] === 0x01 || data[1] === 0x00){
      return this._debounceEmitClick();
    }

    if(data[1] === 0xff){
      return this._emitRotateLeft()
    }

    if(data[1] === 0x01){
      return this._emitRotateRight()
    }

  }

  _unthrottledEmitClick() {
    debug ('click')
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
