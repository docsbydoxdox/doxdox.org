var request = require('request');
var doxdox = require('doxdox');

var express = require('express');
var server = express();

var redis = require('redis');
var url = require('url');
var redisURL = url.parse(process.env.REDISCLOUD_URL);
var client = redis.createClient(redisURL.port, redisURL.hostname, { no_ready_check: true });
client.auth(redisURL.auth.split(':')[1]);

var rawgit_url = 'https://raw.githubusercontent.com/';

server.use(express.static(__dirname + '/static'));

server.get('/:username/:repo', function (req, res) {

    client.get(req.url, function (err, reply) {

        if (reply) {

            res.send(reply);

        } else {

            request.get({
                url: rawgit_url + req.params.username + '/' + req.params.repo + '/master/package.json',
                json: true
            }, function (e, r, body) {

                var config = {
                    title: body.name,
                    description: body.description,
                    layout: 'bootstrap'
                };

                request.get({
                    url: rawgit_url + req.params.username + '/' + req.params.repo + '/master/' + body.main
                }, function (e, r, body) {

                    body = doxdox.parseScript(body, null, config);

                    client.set(req.url, body);

                    res.send(body);

                });

            });

        }

    });

});

server.listen(process.env.PORT || 5000);
