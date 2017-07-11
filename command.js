#!/usr/bin/env node

const bindAll = require('lodash/fp/bindAll')
const partial = require('lodash/fp/partial')
const OctoDash = require('octodash')
const WebSocket = require('ws')
const packageJSON = require('./package.json')
const Powermate = require('./lib/powermate')

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
    const { host, port } = octoDash.parseOptions()

    this.powermate = new Powermate()
    this.server = new WebSocket.Server({ host, port })
  }

  run() {
    this.powermate.on('error', this._onError)
    this.powermate.on('click', partial(this._sendMessage, ['click']))
    this.powermate.on('rotateLeft', partial(this._sendMessage, ['rotateLeft']))
    this.powermate.on('rotateRight', partial(this._sendMessage, ['rotateRight']))

    this.powermate.connect((error) => {
      if (error) return this._onError(error)
    })
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
