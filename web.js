const path = require('path');

const express = require('express');
const app = express();

const session = require('express-session');

const enrouten = require('express-enrouten');

const hbs = require('express-hbs');

app.disable('x-powered-by');

app.use(session({
    'resave': true,
    'saveUninitialized': true,
    'secret': process.env.SECRET || 'secret'
}));

app.use(express.static(path.join(__dirname, '/static')));

app.use(enrouten({'directory': 'src/routes'}));

app.engine('hbs', hbs.express4());

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '/src/views'));

app.listen(process.env.PORT || 5000);
