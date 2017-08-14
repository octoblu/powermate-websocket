/* eslint-disable func-names, prefer-arrow-callback, no-unused-expressions */

const { afterEach, beforeEach, describe, it } = global
const { expect } = require('chai')
const { EventEmitter } = require('events')
const once = require('lodash/fp/once')
const url = require('url')
const WebSocket = require('ws')
const Server = require('../../lib/server')

describe('Server', function() {
  describe('when started', function() {
    beforeEach(function(done) {
      this.hid = new EventEmitter()
      const getHID = callback => callback(null, this.hid)

      this.sut = new Server({ hostname: 'localhost', port: 0, getHID })
      this.sut.start(done)
    })

    afterEach(function(done) {
      this.sut.destroy(done)
    })

    beforeEach('connect to the WebSocket server', function(done) {
      this.ws = new WebSocket(url.format({
        protocol: 'http',
        hostname: 'localhost',
        port: this.sut.port(),
      }))

      const doneOnce = once(done)
      this.ws.once('open', doneOnce)
      this.ws.once('error', doneOnce)
    })

    describe('when the powermate is rotated left', function() {
      beforeEach(function(done) {
        this.ws.on('message', (message) => {
          this.message = message
          done()
        })

        this.hid.emit('data', [0x00, 0xff])
      })

      it('should emit left', function() {
        expect(JSON.parse(this.message)).to.deep.equal({
          data: { action: 'rotateLeft' },
        })
      })
    })

    describe('when the powermate is rotated right', function() {
      beforeEach(function(done) {
        this.ws.on('message', (message) => {
          this.message = message
          done()
        })

        this.hid.emit('data', [0x00, 0x01])
      })

      it('should emit right', function() {
        expect(JSON.parse(this.message)).to.deep.equal({
          data: { action: 'rotateRight' },
        })
      })
    })
  })
})
