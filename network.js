'use strict';

const net = require('net');
const events = require('events');
const errors = require('./errors');

class Net {
	constructor() {
		this.emitter = new events.EventEmitter();
		this.socket = new net.Socket();
		this.socket.setKeepAlive(true, 60 * 1000);
		this.socket.setNoDelay(true);

		this.msgID = 1;
		this.requests = {};

		this.socket.on('close', () => {
			console.log('socket closed');
		});
		this.socket.on('error', err => {
			throw err;
		});
		this.socket.on('data', data => {
			const str = data.toString('utf8');

			// several jsons might arrive at once, so we have to split them
			const jsons = str.split('\n').filter(json => json.length > 0);
			
			jsons.forEach(json => {
				const res = JSON.parse(json);
				const req = this.getRequest(res.id);

				if (res.error) throw new Error(res.error.message);
				

				if (req) {
					this.emitter.emit('reply', req, res);
				}
				else {
					this.emitter.emit('notification', res);
				}
			});
		});
	}

	send(method, params) {
		const msg = this.formatMsg(method, params);
		const succeed = this.socket.write(msg);
		if (!succeed) throw errors.sendFailErr;
	}

	formatMsg(method, params) {
		const msg = {id: this.msgID, method: method, params: params, jsonrpc: '2.0'};
		this.requests[this.msgID] = msg;
		this.msgID += 1;
		return JSON.stringify(msg) + '\n'; // NOTE: every reqest has to end with `\n` (WTF)
	}

	getRequest(id) {
		return this.requests[String(id)];
	}

	connect(host, port, user, pass) {
		this.socket.connect(port, host, () => {
			console.log('socket connected');
			this.send('login', {login: user, pass: pass});
		});
	}
}

module.exports = Net;
