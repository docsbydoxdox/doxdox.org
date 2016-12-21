const path = require('path');
const url = require('url');

const moment = require('moment');

const raspar = require('raspar');
const request = require('request');

const express = require('express');
const server = express();

const MongoClient = require('mongodb').MongoClient;

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doxdox';

const renderer = require('./src/utils/doxdox').renderer;

const CACHE_TIMEOUT_IN_MINUTES = 30;

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

server.get('/sitemap.txt', (req, res) => {

    repos.find({}, {'url': 1}, (err, docs) => {

        docs.toArray().then(repos => {

            res.type('text');

            res.send(
                repos.map(repo => `${req.protocol}://${req.headers.host}${repo.url}`)
                    .sort()
                    .join('\n')
            );

        });

    });

});

server.get('/:username/:repo/:branch?', (req, res) => {

    if (!req.params.branch) {

        req.params.branch = 'master';

    }

    repos.findOne({'url': req.path}, (err, docs) => {

        if (docs && moment(docs.createdAt).add(CACHE_TIMEOUT_IN_MINUTES, 'minutes')
            .isAfter(new Date())) {

            res.send(decodeURIComponent(docs.content));

        } else {

            request.get({
                'encoding': null,
                'url': `https://github.com/${req.params.username}/${req.params.repo}/archive/${req.params.branch}.zip`
            }, (err, response, body) => {

                if (err || response.statusCode !== 200) {

                    res.sendStatus(response.statusCode);

                } else {

                    raspar.fetch(`https://api.github.com/repos/${req.params.username}/${req.params.repo}/releases`, {
                        'requestOptions': {
                            'headers': {
                                'Authorization': `token ${process.env.GITHUB_API_KEY}`,
                                'User-Agent': 'doxdox.org'
                            }
                        }
                    }).then(data => {

                        const releases = JSON.parse(data.body)
                            .filter(release => !release.draft)
                            .map(release => ({
                                'name': (release.tag_name || release.name).replace(/^v/i, ''),
                                'version': (release.tag_name || release.name)
                            }));

                        renderer(body, {
                            releases,
                            'url': `${req.protocol}://${req.headers.host}/${req.params.username}/${req.params.repo}`
                        }).then(content => {

                            repos.save({
                                '_id': docs ? docs._id : null,
                                'content': encodeURIComponent(content),
                                'createdAt': new Date(),
                                'url': req.path
                            }, () => {

                                res.send(content);

                            });

                        });

                    });

                }

            });

        }

    });

});

server.listen(process.env.PORT || 5000);
