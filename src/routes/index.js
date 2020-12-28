const url = require('url');

const moment = require('moment');

const raspar = require('raspar');
const request = require('request');

const ua = require('universal-analytics')(process.env.GA_TOKEN);

const { MongoClient } = require('mongodb');

const { renderer } = require('../utils/doxdox');

const plugins = require('../../data/plugins.json').results;

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
                const urlPart = redirect.path.match(
                    /^\/([^/]+)\/([^/]+)(?:\/tree\/(.+))?/
                );

                if (urlPart) {
                    return res.redirect(
                        `${urlPart[1]}/${urlPart[2]}/${urlPart[3] || ''}`
                    );
                }
            }
        }

        return next();
    });

    router.get('/', (req, res) => {
        repos.find(
            {
                branch: 'master'
            },
            {
                limit: 5,
                sort: {
                    createdAt: -1
                }
            },
            (err, docs) => {
                docs.toArray((err, docs) => {
                    ua.pageview(req.path, req.sessionID).send();

                    res.render('index', {
                        docs,
                        plugins
                    });
                });
            }
        );
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

        const { branch, repo, username } = req.params;

        const url = `${req.protocol}://${req.headers.host}/${username}/${repo}`;

        ua.pageview(req.path, req.sessionID).send();

        repos.findOne(
            {
                branch,
                repo,
                username
            },
            (err, docs) => {
                if (
                    docs &&
                    moment(docs.createdAt)
                        .add(CACHE_TIMEOUT_IN_MINUTES, 'minutes')
                        .isAfter(new Date()) &&
                    req.query.nocache === undefined
                ) {
                    res.send(decodeURIComponent(docs.content));
                } else {
                    request.get(
                        {
                            encoding: null,
                            url: `https://github.com/${username}/${repo}/archive/${branch}.zip`
                        },
                        (err, response, body) => {
                            if (err || response.statusCode !== 200) {
                                res.sendStatus(response.statusCode);
                            } else {
                                raspar
                                    .fetch(
                                        `https://api.github.com/repos/${username}/${repo}/releases`,
                                        {
                                            requestOptions: {
                                                headers: {
                                                    Authorization: `token ${process.env.GITHUB_API_KEY}`,
                                                    'User-Agent': 'doxdox.org'
                                                }
                                            }
                                        }
                                    )
                                    .then(data => {
                                        const releases = JSON.parse(data.body)
                                            .filter(release => !release.draft)
                                            .map(release => ({
                                                name: (
                                                    release.tag_name ||
                                                    release.name
                                                ).replace(/^v/i, ''),
                                                version:
                                                    release.tag_name ||
                                                    release.name
                                            }));

                                        renderer(body, {
                                            branch,
                                            releases,
                                            url
                                        })
                                            .then(output => {
                                                repos.save(
                                                    {
                                                        _id: docs
                                                            ? docs._id
                                                            : null,
                                                        branch,
                                                        content: encodeURIComponent(
                                                            output.content
                                                        ),
                                                        createdAt: new Date(),
                                                        description:
                                                            output.config
                                                                .description,
                                                        repo,
                                                        title:
                                                            output.config.title,
                                                        url,
                                                        username
                                                    },
                                                    () => {
                                                        res.send(
                                                            output.content
                                                        );
                                                    }
                                                );
                                            })
                                            .catch(err => {
                                                res.status(500);
                                                res.render('error', { err });
                                            });
                                    })
                                    .catch(err => {
                                        res.status(500);
                                        res.render('error', { err });
                                    });
                            }
                        }
                    );
                }
            }
        );
    });
};
