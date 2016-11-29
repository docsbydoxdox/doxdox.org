const path = require('path');
const url = require('url');

const request = require('request');
const loaders = require('doxdox/lib/loaders');

const express = require('express');
const server = express();

const MongoClient = require('mongodb').MongoClient;

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doxdox';

const RAWGIT_URL = 'https://raw.githubusercontent.com/';

let repos = null;

MongoClient.connect(mongoURI, (err, db) => {

    repos = db.collection('repos');

});

server.get('/', (req, res, next) => {

    let redirect = null;
    let repo = null;

    if (req.headers.referer) {

        redirect = url.parse(req.headers.referer);

        if (redirect.host === 'github.com') {

            repo = redirect.path.match(/^\/.+?\/[^/]+\/?/);

            if (repo) {

                res.redirect(repo);

            }

        }

    }

    next();

});

server.use(express.static(path.join(__dirname, '/static')));

server.get('/:username/:repo/:branch?', (req, res) => {

    repos.findOne({'url': req.url}, (err, docs) => {

        if (docs) {

            res.send(decodeURIComponent(docs.content));

        } else {

            docs = {
                'content': '',
                'date': new Date(),
                'url': req.url
            };

            request.get({
                'json': true,
                'url': `${RAWGIT_URL}${req.params.username}/${req.params.repo}/${(req.params.branch || 'master')}/package.json`
            }, (e, r, pkg) => {

                const config = {
                    'description': pkg.description,
                    'layout': 'templates/bootstrap.hbs',
                    'parser': 'dox',
                    pkg,
                    'title': pkg.name
                };

                const file = pkg.main || 'index.js';

                request.get({
                    'url': `${RAWGIT_URL}${req.params.username}/${req.params.repo}/${(req.params.branch || 'master')}/${file}`
                }, (e, r, body) => {

                    loaders.loadParser(config).then(parser =>
                        loaders.loadPlugin(config).then(plugin => {

                            plugin(Object.assign({
                                'files': [{
                                    'methods': parser(body, file),
                                    'name': file
                                }]
                            }, config)).then(content => {

                                docs.content = encodeURIComponent(content);

                                repos.insert(docs, () => {

                                    res.send(content);

                                });

                            });

                        }));

                });

            });

        }

    });

});

server.listen(process.env.PORT || 5000);
