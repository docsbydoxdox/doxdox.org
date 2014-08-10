var request = require('request');
var doxdox = require('doxdox');

var express = require('express');
var server = express();

var rawgit_url = 'https://raw.githubusercontent.com/';

server.get('/:username/:repo', function (req, res) {

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

            res.send(doxdox.parseScript(body, null, config));

        });

    });

});

server.listen(process.env.PORT || 5000);
