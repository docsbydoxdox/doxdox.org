var request = require('request');
var doxdox = require('doxdox');

var express = require('express');
var server = express();

server.get('/:username/:repo', function (req, res) {

    request.get({
        url: 'https://raw.githubusercontent.com/' + req.params.username + '/' + req.params.repo + '/master/package.json',
        json: true
    }, function (e, r, body) {

        var config = {
            title: body.name,
            description: body.description,
            layout: 'bootstrap'
        };

        request.get({
            url: 'https://raw.githubusercontent.com/' + req.params.username + '/' + req.params.repo + '/master/' + body.main,
            json: true
        }, function (e, r, body) {

            res.send(doxdox.parseScript(body, null, config));

        });

    });

});

server.listen(process.env.PORT || 5000);
