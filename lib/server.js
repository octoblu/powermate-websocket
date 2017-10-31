const async = require('async')
const { EventEmitter } = require('events')
const http = require('http')
const bindAll = require('lodash/fp/bindAll')
const delay = require('lodash/fp/delay')
const isNil = require('lodash/fp/isNil')
const partial = require('lodash/fp/partial')
const debug = require('debug')('powermate-websocket:server')
const enableDestroy = require('server-destroy')
const WebSocket = require('ws')
const Powermate = require('./powermate')

class Server extends EventEmitter {
  constructor({ hostname = 'localhost', port = 0, getHID } = {}) {
    super()
    bindAll(Object.getOwnPropertyNames(Server.prototype), this)

    this.getHID = getHID

    this.options = { hostname, port }
    this.server = http.createServer()
    this.wss = new WebSocket.Server({ server: this.server })
  }

  destroy(callback) {
    this.wss.close()
    enableDestroy(this.server)
    this.server.destroy(callback)
  }

  port() {
    return this.server.address().port
  }

  start(callback) {
    this._restartPowermate()

    this._startWss(callback)
  }

  stop(callback) {
    async.parallel([this._stopWss, this._stopPowermate], callback)
  }

  _delayedRestartPowermate() {
    debug('_delayedRestartPowermate')
    delay(5000, this._restartPowermate)
  }

  _restartPowermate() {
    debug('_restartPowermate')
    this._stopPowermate((error) => {
      debug('_stopPowermate', error)

      this._startPowermate((startError) => {
        debug('_startPowermate', startError)
        if (startError) {
          this._delayedRestartPowermate()
        }
      })
    })
  }

  _sendMessage(action) {
    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return
      client.send(JSON.stringify({ data: { data: { action } } }))
    })
  }

  _startPowermate(callback) {
    this.powermate = new Powermate({ getHID: this.getHID })
    this.powermate.once('error', this._delayedRestartPowermate)
    this.powermate.on('longClick', partial(this._sendMessage, ['longClick']))
    this.powermate.on('click', partial(this._sendMessage, ['click']))
    this.powermate.on('rotateLeft', partial(this._sendMessage, ['rotateLeft']))
    this.powermate.on('rotateRight', partial(this._sendMessage, ['rotateRight']))
    this.powermate.connect(callback)
  }

  _startWss(callback) {
    const { port, hostname } = this.options
    this.server.listen(port, hostname, callback)
  }

  _stopPowermate(callback) {
    if (isNil(this.powermate)) return callback()

    this.powermate.close(callback)
  }

  _stopWss(callback) {
    if (isNil(this.wss)) return callback()

    this.wss.close(callback)
  }
}

module.exports = Server
