#!/usr/bin/env node

const async = require('async')
const bindAll = require('lodash/fp/bindAll')
const delay = require('lodash/fp/delay')
const isNil = require('lodash/fp/isNil')
const pick = require('lodash/fp/pick')
const OctoDash = require('octodash')
const WebSocket = require('ws')
const debug = require('debug')('powermate-websocket:command')
const packageJSON = require('./package.json')
const Server = require('./lib/server')

const CLI_OPTIONS = [
  {
    names: ['host'],
    type: 'string',
    required: true,
    env: 'POWERMATE_WEBSOCKET_HOST',
    help: 'The host where to bind the server (Use 0.0.0.0 to listen to all incoming connections)',
    helpArg: 'PATH',
    default: 'localhost',
  },
  {
    names: ['port'],
    type: 'integer',
    required: true,
    env: 'POWERMATE_WEBSOCKET_PORT',
    help: 'Port to listen to incoming websockets on',
    helpArg: 'PORT',
    default: 52052,
  },
]

class Command {
  constructor({ argv, cliOptions = CLI_OPTIONS } = {}) {
    bindAll(Object.getOwnPropertyNames(Command.prototype), this)

    const octoDash = new OctoDash({ argv, cliOptions, name: packageJSON.name, version: packageJSON.version })
    this.serverOptions = pick(['host', 'port'], octoDash.parseOptions())
  }

  restart() {
    debug('restart')
    async.series([this.stop, delay(5000), this.start], (error) => {
      debug('restarted', error)
      if (error) return this.restart()
    })
  }

  run() {
    debug('run')
    this.start((error) => {
      debug('run -> start', error)

      if (error) return this.restart()
    })
  }

  start(callback) {
    debug('start')
    this.server = new Server(this.serverOptions)
    this.server.once('error', this.restart)
    this.server.start(callback)
  }

  stop(callback) {
    debug('stop')
    if (isNil(this.server)) return callback()

    this.server.stop(callback)
  }

  _onError(error) {
    throw error
  }

  _sendMessage(action) {
    this.server.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return
      client.send(JSON.stringify({ data: { action } }))
    })
  }
}

const command = new Command({ argv: process.argv })
command.run()
