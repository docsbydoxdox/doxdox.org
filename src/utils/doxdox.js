const JSZip = require('jszip');

const loaders = require('doxdox/lib/loaders');

const renderer = body => {

    const config = {
        'layout': 'templates/bootstrap.hbs',
        'parser': 'dox'
    };

    const files = [];

    return loaders.loadParser(config).then(parser =>
        loaders.loadPlugin(config).then(plugin =>
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
            }, config)))));

};

module.exports = {
    renderer
};
