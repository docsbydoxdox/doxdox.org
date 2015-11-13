var url = require('url');

var request = require('request');
var doxdox = require('doxdox');

var express = require('express');
var server = express();

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var mongoURI = process.env.MONGOHQ_URL || 'mongodb://localhost:27017/doxdox';

var repos;

MongoClient.connect(mongoURI, function(err, db) {

    repos = db.collection('repos');

});

var rawgit_url = 'https://raw.githubusercontent.com/';

server.get('/', function (req, res, next) {

    var redirect,
        repo;

    if (req.headers.referer) {

        redirect = url.parse(req.headers.referer);

        if (redirect.host === 'github.com') {

            repo = redirect.path.match(/^\/.+?\/[^\/]+\/?/);

            if (repo) {

                res.redirect(repo);

            }

        }

    }

    next();

});

server.use(express.static(__dirname + '/static'));

server.get('/:username/:repo/:branch?', function (req, res) {

    repos.findOne({ url: req.url }, function (err, docs) {

        if (!docs) {

            docs = {
                url: req.url,
                content: '',
                date: new Date()
            };

            request.get({
                url: rawgit_url + req.params.username + '/' + req.params.repo + '/' + (req.params.branch || 'master') + '/package.json',
                json: true
            }, function (e, r, pkg) {

                var config = {
                    title: pkg.name,
                    description: pkg.description,
                    layout: 'templates/bootstrap.hbs'
                };

                var file = pkg.main || 'index.js';

                request.get({
                    url: rawgit_url + req.params.username + '/' + req.params.repo + '/' + (req.params.branch || 'master') + '/' + file
                }, function (e, r, body) {

                    doxdox.parseScripts([{
                        name: file,
                        contents: body
                    }], config, pkg).then(function (content) {

                        docs.content = encodeURIComponent(content);

                        repos.insert(docs, function () {

                            res.send(content);

                        });

                    }).catch(function (err) {

                        console.log(err);

                    });

                });

            });

        } else {

            res.send(decodeURIComponent(docs.content));

        }

    });

});

server.listen(process.env.PORT || 5000);
