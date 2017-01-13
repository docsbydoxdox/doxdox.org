const JSZip = require('jszip');

const loaders = require('doxdox/lib/loaders');

const FILE_PATTERN_MATCH = /\.js$|^package\.json$/;
const FILE_PATTERN_IGNORE = /(^test(s)?\/|(Grunt|Gulp)file\.js|\.min)/;

const renderer = (body, {releases, url}) => {

    const config = {
        'layout': 'templates/bootstrap.hbs',
        'parser': 'dox',
        releases,
        url
    };

    const files = [];

    return loaders.loadParser(config).then(parser =>
        loaders.loadPlugin(config).then(plugin =>
            JSZip.loadAsync(body).then(zip => {

                let sequence = Promise.resolve();

                Object.values(zip.files)
                    .map(file => {

                        file.originalName = file.name.replace(/^[^/]+\//, '');

                        return file;

                    })
                    .filter(file => file.originalName.match(FILE_PATTERN_MATCH) &&
                        !file.originalName.match(FILE_PATTERN_IGNORE))
                    .forEach(file => {

                        sequence = sequence
                            .then(() => zip.file(file.name).async('string'))
                            .then(contents => {

                                if (file.originalName === 'package.json') {

                                    const pkg = JSON.parse(contents);

                                    config.title = pkg.name;
                                    config.description = pkg.description;
                                    config.pkg = pkg;

                                } else {

                                    files.push({
                                        'methods': parser(contents, file.originalName),
                                        'name': file.originalName
                                    });

                                }

                            });

                    });

                sequence.then(() => {

                    console.log(files);

                    if (!files.length) {

                        throw new Error('No JavaScript files found.');

                    } else if (typeof config.pkg === 'undefined') {

                        throw new Error('package.json missing.');

                    }

                });

                return sequence;

            })
            .then(() => plugin(Object.assign({
                'files': files.filter(file => file.methods.length),
                'timestamp': new Intl.DateTimeFormat('en-US', {
                    'day': 'numeric',
                    'hour': 'numeric',
                    'minute': 'numeric',
                    'month': 'long',
                    'weekday': 'long',
                    'year': 'numeric'
                }).format(new Date())
            }, config)))))
            .then(content => ({
                config,
                content
            }));

};

module.exports = {
    renderer
};
