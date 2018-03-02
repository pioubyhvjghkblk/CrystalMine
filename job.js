'use strict';

const bn = require('bignum');
const cn = require('node-cryptonight').asyncHash;
const events = require('events');

class Job {
	constructor(id, target, blob) {
		this.emitter = new events.EventEmitter();
		this.invalid = false;
		this.lastTime = null;
		this.hashrates = [];

		this.id = id;
		this.raw_blob = blob;
		this.raw_target = target;
		this.nonce = 0;

		this.blob = Buffer.from(blob, 'hex');

		const targetBF = Buffer.from(target, 'hex');
		const targetBN = bn.fromBuffer(targetBF, {endian: 'little', size: 4});

		// magic numbers from https://github.com/xmrig/xmrig
		this.difficulty = bn(0xFFFFFFFF).div(targetBN).toNumber();
		this.target = bn(0xFFFFFFFFFFFFFFFF).div(this.difficulty);
	}

	mine() {
		if (this.invalid) return;

		this.nonce ++;

		// write nonce to the 4 bytes starting from 39 in blob
		this.blob.writeUInt32LE(this.nonce, 39); 

		if (!this.lastTime) this.lastTime = Date.now();
		else {
			const time = Date.now() - this.lastTime;

			const hashrate = 1000 / time;
			this.hashrates.push(hashrate);
			if (this.hashrates.length > 10) this.hashrates = this.hashrates.slice(1);

			this.lastTime = Date.now();
		}

		cn(this.blob, hash => {
			// get the last 8 bytes of the hash and turn it into a uint64_t
			const hashNum = bn.fromBuffer(hash.slice(24), {endian: 'little', size: 8});
			
			// submit when the last 8 bytes of hash is smaller than target
			if (hashNum.lt(this.target)) {
				this.emitter.emit('submit', {jobID: this.id, nonce: this.nonce, hash: hash});
			}

			// continue mining
			this.mine();
		});
	}

	kill() {
		this.invalid = true;
	}
	
	hashrate() {
		return this.hashrates.reduce((a, b) => a + b, 0) / this.hashrates.length;
	}
}

module.exports = Job;
