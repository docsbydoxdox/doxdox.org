const url = require('url');

const moment = require('moment');

const raspar = require('raspar');
const request = require('request');

const ua = require('universal-analytics')(process.env.GA_TOKEN);

const { Client } = require('pg');

const { renderer } = require('../utils/doxdox');

const plugins = require('../../data/plugins.json').results;

const CACHE_TIMEOUT_IN_MINUTES = 30;

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect();

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
        client.query(
            'SELECT "url", "username", "repo" FROM "repo" ORDER BY "createdAt" DESC LIMIT 5',
            (_, data) => {
                ua.pageview(req.path, req.sessionID).send();

                res.render('index', {
                    docs: data && data.rowCount > 0 ? data.rows : [],
                    plugins
                });
            }
        );
    });

    router.get('/sitemap.txt', (req, res) => {
        client.query('SELECT DISTINCT "url" FROM "repo"', (err, data) => {
            res.type('text');

            if (data && data.rowCount > 0) {
                res.send(
                    data.rows
                        .reduce((acc, { url }) => [...acc, url], [])
                        .sort()
                        .join('\n')
                );
            } else {
                res.send('');
            }
        });
    });

    router.get(['/:username/:repo', '/:username/:repo/*?'], (req, res) => {
        if (!req.params.branch) {
            req.params.branch = req.params[0] || 'master';
        }

        const { branch, repo, username } = req.params;

        const url = `${req.protocol}://${req.headers.host}/${username}/${repo}`;

        ua.pageview(req.path, req.sessionID).send();

        client.query(
            'SELECT * FROM "repo" WHERE "username" = $1 AND "repo" = $2 AND "branch" = $3',
            [username, repo, branch],
            (err, data) => {
                if (
                    data &&
                    data.rowCount != 0 &&
                    moment(data.rows[0].createdAt)
                        .add(CACHE_TIMEOUT_IN_MINUTES, 'minutes')
                        .isAfter(new Date()) &&
                    req.query.nocache === undefined
                ) {
                    res.send(decodeURIComponent(data.rows[0].content));
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
                                        const releases = JSON.parse(data)
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
                                                client.query(
                                                    'INSERT INTO "repo" ("createdAt", "username", "repo", "branch", "url", "title", "description", "content") VALUES(NOW(), $1, $2, $3, $4, $5, $6, $7)',
                                                    [
                                                        username,
                                                        repo,
                                                        branch,
                                                        url,
                                                        output.config.title,
                                                        output.config
                                                            .description,
                                                        encodeURIComponent(
                                                            output.content
                                                        )
                                                    ],
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
