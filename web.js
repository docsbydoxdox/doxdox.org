const path = require('path');
const url = require('url');

const JSZip = require('jszip');

const request = require('request');
const loaders = require('doxdox/lib/loaders');

const express = require('express');
const server = express();

const MongoClient = require('mongodb').MongoClient;

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doxdox';

let repos = null;

MongoClient.connect(mongoURI, (err, db) => {

    repos = db.collection('repos');

});

server.get('/', (req, res, next) => {

    if (req.headers.referer) {

        const redirect = url.parse(req.headers.referer);

        if (redirect.host === 'github.com') {

            const repo = redirect.path.match(/^\/.+?\/[^/]+\/?/);

            if (repo) {

                res.redirect(repo);

            }

        }

    }

    next();

});

server.use(express.static(path.join(__dirname, '/static')));

server.get('/:username/:repo/:branch?', (req, res) => {

    if (!req.params.branch) {

        req.params.branch = 'master';

    }

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
                'encoding': null,
                'url': `https://github.com/${req.params.username}/${req.params.repo}/archive/${req.params.branch}.zip`
            }, (err, response, body) => {

                const config = {
                    'layout': 'templates/bootstrap.hbs',
                    'parser': 'dox'
                };

                const files = [];

                loaders.loadParser(config).then(parser =>
                    loaders.loadPlugin(config).then(plugin => {

                        JSZip.loadAsync(body).then(zip => {

                            let sequence = Promise.resolve();

                            Object.values(zip.files)
                                .filter(file => file.name.match(/\.js$/) &&
                                    !file.name.match(/(test\/|tests\/|Gruntfile|Gulpfile|\.min)/))
                                .forEach(file => {

                                    sequence = sequence
                                        .then(() => zip.file(file.name).async('string'))
                                        .then(contents => files.push({
                                            'methods': parser(contents, file.name),
                                            'name': file.name.replace(/^[^/]+\//, '')
                                        }));

                                });

                            Object.values(zip.files)
                                .filter(file => file.name.match(/package\.json$/))
                                .forEach(file => {

                                    sequence = sequence
                                        .then(() => zip.file(file.name).async('string'))
                                        .then(contents => JSON.parse(contents))
                                        .then(pkg => {

                                            config.title = pkg.name;
                                            config.description = pkg.description;
                                            config.pkg = pkg;

                                        });

                                });

                            return sequence;

                        })
                        .then(() => {

                            plugin(Object.assign({
                                'files': files.filter(file => file.methods.length)
                            }, config)).then(content => {

                                docs.content = encodeURIComponent(content);

                                repos.insert(docs, () => {

                                    res.send(content);

                                });

                            });

                        });

                    }));

            });

        }

    });

});

server.listen(process.env.PORT || 5000);
