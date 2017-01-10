const url = require('url');

const moment = require('moment');

const raspar = require('raspar');
const request = require('request');

const ua = require('universal-analytics')(process.env.GA_TOKEN);

const {MongoClient} = require('mongodb');

const {renderer} = require('../utils/doxdox');

const CACHE_TIMEOUT_IN_MINUTES = 30;

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doxdox';

let repos = null;

MongoClient.connect(MONGO_URI, (err, db) => {

    repos = db.collection('repos');

});

module.exports = router => {

    router.get('/', (req, res, next) => {

        if (req.headers.referer) {

            const redirect = url.parse(req.headers.referer);

            if (redirect.host === 'github.com') {

                const urlPart = redirect.path.match(/^\/([^/]+)\/([^/]+)(?:\/tree\/(.+))?/);

                if (urlPart) {

                    return res.redirect(`${urlPart[1]}/${urlPart[2]}/${urlPart[3] || ''}`);

                }

            }

        }

        return next();

    });

    router.get('/', (req, res) => {

        raspar.fetch('https://api.npms.io/v2/search?from=0&q=doxdox%20plugin&size=10')
            .then(res => JSON.parse(res.body))
            .then(data => {

                ua.pageview(req.path, req.sessionID).send();

                res.render('index', {
                    'plugins': data.results
                });

            });

    });

    router.get('/sitemap.txt', (req, res) => {

        repos.distinct('url', (err, docs) => {

            res.type('text');

            res.send(docs.sort().join('\n'));

        });

    });

    router.get(['/:username/:repo', '/:username/:repo/*?'], (req, res) => {

        if (!req.params.branch) {

            req.params.branch = req.params[0] || 'master';

        }

        const {
            branch,
            repo,
            username
        } = req.params;

        const url = `${req.protocol}://${req.headers.host}/${username}/${repo}`;

        ua.pageview(req.path, req.sessionID).send();

        repos.findOne({
            branch,
            repo,
            username
        }, (err, docs) => {

            if (docs && moment(docs.createdAt).add(CACHE_TIMEOUT_IN_MINUTES, 'minutes')
                .isAfter(new Date())) {

                res.send(decodeURIComponent(docs.content));

            } else {

                request.get({
                    'encoding': null,
                    'url': `https://github.com/${username}/${repo}/archive/${branch}.zip`
                }, (err, response, body) => {

                    if (err || response.statusCode !== 200) {

                        res.sendStatus(response.statusCode);

                    } else {

                        raspar.fetch(`https://api.github.com/repos/${username}/${repo}/releases`, {
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
                                    'version': release.tag_name || release.name
                                }));

                            renderer(body, {
                                releases,
                                url
                            }).then(content => {

                                repos.save({
                                    '_id': docs ? docs._id : null,
                                    branch,
                                    'content': encodeURIComponent(content),
                                    'createdAt': new Date(),
                                    repo,
                                    url,
                                    username
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

};
