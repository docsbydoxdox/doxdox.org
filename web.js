const path = require('path');
const url = require('url');

const request = require('request');

const express = require('express');
const server = express();

const MongoClient = require('mongodb').MongoClient;

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doxdox';

const renderer = require('./src/utils/doxdox').renderer;

let repos = null;

MongoClient.connect(mongoURI, (err, db) => {

    repos = db.collection('repos');

    repos.ensureIndex({
        'url': 1
    }, {
        'expireAfterSeconds': 1800
    }, err => {

        if (err) {

            throw new Error(err);

        }

    });

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

                if (err || response.statusCode !== 200) {

                    res.sendStatus(response.statusCode);

                } else {

                    renderer(body).then(content => {

                        docs.content = encodeURIComponent(content);

                        repos.insert(docs, () => {

                            res.send(content);

                        });

                    });

                }

            });

        }

    });

});

server.listen(process.env.PORT || 5000);
