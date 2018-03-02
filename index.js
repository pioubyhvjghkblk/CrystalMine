'use strict';

const net = new (require('./network'))();
const config = require('./config');
const errors = require('./errors');
const Job = require('./job');

let rpcID;
let job;

net.emitter.on('reply', (req, res) => {
	if (req.method === 'login') {
		// login succeed
		if (!res.result.job) throw errors.badResErr;

		rpcID = res.result.id;

		handleJob(res.result.job);
	}
	else if (req.method === 'submit') {
		// submit received
		if (res.result.status === 'OK') {
			console.log(`share accepted! hashrate: ${job.hashrate()}`);
		}
		else {
			console.log('share rejected');
		}
	}
	else {
		console.log('unknown reply');
		console.log(req);
		console.log(res);
	}
});
net.emitter.on('notification', res => {
	if (res.method === 'job') {
		// new job comes in
		if (!res.params) throw errors.badResErr;

		handleJob(res.params);
	}
	else {
		console.log('unknown notification');
		console.log(res);
	}
});
net.connect(
	config.host,
	config.port,
	config.user,
	config.password
);

const submitResult = result => {
	// nonce should in 4 bytes hex form
	const bf = new Buffer(4);
	bf.writeUInt32LE(result.nonce, 0);
	const nonce = bf.toString('hex');
	
	// data should be in 32 bytes hex form
	const data = result.hash.toString('hex');

	net.send('submit', {
		id: rpcID,
		job_id: result.jobID,
		nonce: nonce,
		result: data
	});
};

const handleJob = json => {
	let hrs = [];
	if (job) {
		hrs = job.hashrates;
		job.kill();
	}

	job = new Job(json.job_id, json.target, json.blob);
	job.hashrates = hrs;
	console.log(`new job. ID: ${job.id}; diff: ${job.difficulty}`);

	job.emitter.on('submit', result => {
		submitResult(result);
	});
	job.mine(); // start mining!
};

process.openStdin().addListener('data', data => {
	const str = data.toString().trim();

	if (str === 'h' || str === 'hashrate') {
		console.log('average hashrate:', job.hashrate());
	}
});
