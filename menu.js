var request = require('request'),
	moment = require('moment');

var argv = require('yargs').options({
	d: {
		alias: 'days',
		default: 1
	}
}).argv;

var now = moment(),
	tomorrow = now.clone().add(argv.days, 'days').set({ hour: 0, minute: 0, second: 0, ms: 0 });

if (argv.d == 1 && (now.day() == 6 || now.day() == 0)) {
	return console.log('weekend -- bailing');
}

if (tomorrow.day() == 6) {
	tomorrow.weekday(8);
}

var tomorrowEnd = tomorrow.clone().add(1, 'days');

request({
	url: 'https://app.zerocater.com/api/v3/companies/' + process.env.ZC_KEY + '/meals',
	json: true,
	gzip: true
}, function(err, res, body) {
	if (err || res.statusCode != 200) {
		return console.error('e1', err || res.statusCode, body);
	}
	for (var i = 0; i < body.length; i++) {
		if (moment(body[i].time * 1000).isBetween(tomorrow, tomorrowEnd)) {
			getMenu(body[i].url);
		}
	}
});

function getMenu(url) {
	request({
		url: url,
		json: true,
		gzip: true
	}, function(err, res, menu) {
		if (err || res.statusCode != 200) {
			return console.error('e2', err || res.statusCode, menu);
		}

		var when = moment(menu.time * 1000);


		var attach = [{
			image_url: menu.vendor_image_url
		}];

		menu.items.forEach(function(item) {
			var labels = [];
			for (var label in item.labels) {
				if (item.labels[label].value) labels.push(label);
			}
			attach.push({
				title: item.name,
				text: item.description + (labels.length ? '\n_' + labels.join(', ') + '_' : ''),
				fallback: item.name + '\n' + item.description + '\n' + labels.join(', '),
				mrkdwn_in: ["text"]
			});
		});

		request({
			method: 'POST',
			url: process.env.SLACK_HOOK,
			json: {
				username: 'LunchBot',
				icon_emoji: ':fork_and_knife:',
				text: '*' + menu.vendor_name + '* - ' + when.format('dddd, MMM Do') + '\n' + menu.vendor_description,
				attachments: attach
			}
		}, function(err, slackRes, body) {
			if (err || slackRes.statusCode != 200) {
				console.error('e3', err || slackRes.statusCode, body);
			} else {
				console.log('ok');
			}
		});
		
	});
}
