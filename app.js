// fs
const fs            = require('fs');
const config        = JSON.parse(fs.readFileSync('config.json') +'');

// crypto
const crypto        = require('crypto');
const qrcode        = require('qrcode');
const authenticator = require('otplib/authenticator');
      authenticator.options = { crypto };

// webserver
const express       = require('express');
const app           = express();
const compression   = require('compression')
const helmet        = require('helmet');
const rateLimit     = require("express-rate-limit");
const apiLimiter    = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200 // limit each IP to 200 requests per windowMs (euqals to a bit more than 1 every 5 seconds)
});

// emailing
const nodemailer    = require('nodemailer');

// snippet database
var sqlite3         = require('sqlite3');
var mysql           = require('mysql');

// system
var args            = process.argv.slice(2);

function leftPad(k, pattern, str) {
    if (typeof str != 'string') {
        str = str +'';
    }

    while (str.length <  k) {
        str = pattern + str;
    }

    return str;
}

function rightPad(k, pattern, str) {
    if (typeof str != 'string') {
        str = str +'';
    }

    while (str.length <  k) {
        str += pattern;
    }

    return str;
}

function reportLog(msg) {
    var od = new Date();
    var d  = od.getUTCFullYear() +'-'+ leftPad(2, '0', od.getUTCMonth() +1) +'-'+ leftPad(2, '0', od.getUTCDate());
    var dt = od.getUTCFullYear() +'-'+ leftPad(2, '0', od.getUTCMonth() +1) +'-'+ leftPad(2, '0', od.getUTCDate()) +' '+ leftPad(2, '0', od.getUTCHours()) +':'+ leftPad(2, '0', od.getUTCMinutes()) +':'+ leftPad(2, '0', od.getUTCSeconds()) +'.'+ leftPad(3, '0', od.getUTCMilliseconds());

    fs.appendFile('log_'+ d +'.txt', dt +'   LOG: '+ msg +'\n', (err) => {
        if (err) {
            reportError(err);
        }
    });
    console.log(dt +' '+ msg);
}

function reportError(msg) {
    var od = new Date();
    var d  = od.getUTCFullYear() +'-'+ leftPad(2, '0', od.getUTCMonth() +1) +'-'+ leftPad(2, '0', od.getUTCDate());
    var dt = od.getUTCFullYear() +'-'+ leftPad(2, '0', od.getUTCMonth() +1) +'-'+ leftPad(2, '0', od.getUTCDate()) +' '+ leftPad(2, '0', od.getUTCHours()) +':'+ leftPad(2, '0', od.getUTCMinutes()) +':'+ leftPad(2, '0', od.getUTCSeconds()) +'.'+ leftPad(3, '0', od.getUTCMilliseconds());

    fs.appendFile('error_'+ d +'.txt', dt +' ERROR: '+ msg +'\n', (err) => {
        if (err) {
            console.error('LOG-ERROR: '+ err);
        }
    });
    console.error(dt +' '+ msg);
}

function generateUUID() {
    var d = new Date().getTime();

    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }).toLowerCase();
}

function generateSecureString() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

function comparePassword(plainPassword, encodedPassword) {
    var obj      = typeof encodedPassword == 'object' ? encodedPassword : JSON.parse(encodedPassword +'');
    var password = crypto.createHash('sha512').update(obj.salt + plainPassword).digest('base64');

    return password === obj.key;
}

function encodePassword(plainPassword) {
    var salt     = generateUUID();
    var password = crypto.createHash('sha512').update(salt + plainPassword).digest('base64');

    return JSON.stringify({salt: salt, key: password});
}

function authenticateUser(username, password, token) {
    if (typeof config.users[username] != 'object') {
        return false;
    }

    var passwordHash = config.users[username].password;
    var secret   = config.users[username].secret;

    return comparePassword(password, passwordHash) && authenticator.check(token, secret);
}

function authenticateRequest(req, res) {
    try {
        /* basic auth with enhanced scheme for 2FA:
        * username:token:password
        */
        const base64Credentials =  req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii').split(':');

        let username = credentials[0];
        let token    = credentials[1];
        let password = credentials.slice(2).join(':');

        if (!authenticateUser(username, password, token)) {
            throw 'Unauthorized user';
        }
    } catch (err) {
        res.status(401);
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify({
            result: 'error',
            error: 'Unauthorized attempt to access restricted resource!'
        }, null, config.debug ? '\t' : ''));

        return  false;
    }

    return true;
}

// if only a password is to be generated
if (args.indexOf('--generateUser') >= 0) {
    var username = args[args.indexOf('--generateUser') +1];
    var password = generateSecureString();

    if (typeof config.users[username] == 'object') {
        reportError('ERROR: User already exists!');
        return;
    }

    // alter config
    config.users[username] = {
        "password": JSON.parse(encodePassword(password)),
        "secret": authenticator.generateSecret()
    }
    // write config to file
    fs.writeFileSync('config.json', JSON.stringify(config, null, '\t'));

    reportLog('Password: '+ password);
    return;
}

// if only a password is to be generated
else if (args.indexOf('--generatePassword') >= 0) {
    var username = args[args.indexOf('--generatePassword') +1];
    var password = generateSecureString();

    if (typeof config.users[username] != 'object') {
        reportError('ERROR: User doesn\'t exist!');
        return;
    }

    // alter user password
    config.users[username].password = JSON.parse(encodePassword(password));

    // write config to file
    fs.writeFileSync('config.json', JSON.stringify(config, null, '\t'));

    reportLog('Password: '+ password);
    return;
}

// if only a password is to be generated
else if (args.indexOf('--generateSecret') >= 0) {
    var username = args[args.indexOf('--generateSecret') +1];
    var password = generateSecureString();

    if (typeof config.users[username] != 'object') {
        reportError('ERROR: User doesn\'t exist!');
        return;
    }

    // alter user password
    config.users[username].secret = authenticator.generateSecret();

    // write config to file
    fs.writeFileSync('config.json', JSON.stringify(config, null, '\t'));

    reportLog('Password: '+ password);
    return;
}

// if only a password is to be generated
else if (args.indexOf('--encodePassword') >= 0) {
    reportLog(encodePassword(args[args.indexOf('--encodePassword') +1]));
    return;
}

// if only a password is to be generated
else if (args.indexOf('--QRCode') >= 0) {
    try {  
        var username = args[args.indexOf('--QRCode') +1];
        var secret   = config.users[username].secret;

        var keyuri = authenticator.keyuri(username, 'SnippetsNow', secret);
        qrcode.toString(keyuri, {type: 'terminal'}, function(error, str) {
            reportLog(str);
        });
    } catch (err) {
        reportError('ERROR: User unknown  / '+ err);
    }
    return;
}

// if only a token is to be generated
else if (args.indexOf('--token') >= 0) {
    try {  
        var username = args[args.indexOf('--token') +1];
        var secret   = config.users[username].secret;

        // immediately print currently valid token
        reportLog(authenticator.generate(secret));

        // wait to the next 30 sec to regularly print tokens  every 30 seconds
        setTimeout(function() {
            reportLog(authenticator.generate(secret));

            setInterval(function() {
                reportLog(authenticator.generate(secret));
            }, 30000);
        }, 30000 - new Date().getTime() % 30000 + 100)
    } catch (err) {
        reportError('ERROR: User unknown');
    }
    return;
}

// server is to be started
else {  
    /* Database Setup */
    var db           = null;
    var dbConnection = config.db.connection[config.db.type]
    var dbTypes      = config.db.typeMapping[config.db.type];

    if (config.db.type == 'sqlite') {
        if (config.debug) sqlite3.verbose()
        db = new sqlite3.Database(dbConnection.file);

    } else if (config.db.type == 'mysql') {
        db = mysql.createPool({
            connectionLimit    : dbConnection.connectionLimit || 100,
            host               : dbConnection.host || 'localhost',
            user               : dbConnection.user,
            password           : dbConnection.password,
            database           : dbConnection.database,
            multipleStatements : true
        });
    }

    function sqlRun(statement, callback) {
        if (config.debug) reportLog('--\n'+ statement +'\n--');

        if (config.db.type == 'sqlite') {
            db.all(statement, callback);
        } else {
            db.query(statement, callback)
        }
    }

    function sqlExec(statement, callback) {
        if (config.debug) reportLog('--\n'+ statement +'\n--');

        if (config.db.type == 'sqlite') {
            db.exec(statement, callback);
        } else {
            db.query(statement, callback)
        }
    }

    function wrapTransaction(statement) {
        if (config.db.type == 'sqlite') {
            return 'BEGIN TRANSACTION;\n'+ statement +'\nCOMMIT TRANSACTION;';
        } else {
            return 'START TRANSACTION;\n'+ statement +'\nCOMMIT;';
        }
    }

    function sqlRunResponse(statement, res) {
        sqlRun(statement, function(err, rows) {
            if (config.debug) reportLog(JSON.stringify(rows, null, '\t'));
            res.set('Content-Type', 'application/json');

            result = {
                result: err ? 'error' : 'success',
                object: rows
            }
            if (err) {
                result.error = err +'';
            }

            res.send(JSON.stringify(result, null, config.debug ? '\t' : ''));
        });
    }

    function sqlEscape(value) {
        if (config.db.type == 'sqlite') {
            if (typeof value == 'string') {
                value = '\''+ value.replace(/'/ig, '\'\'') +'\'';
            }
    
            return value;
        } else {
            return db.escape(value);
        }
    }

    function sqlEscapeObject(obj) {
        var eObj = JSON.parse(JSON.stringify(obj));

        for (k in eObj) {
            if (typeof eObj[k] == 'string') {
                // escape string that are not numbers
                if (eObj[k] == '' || isNaN(eObj[k])){
                    eObj[k] = sqlEscape(eObj[k]);

                // convert strings to numbers if they actually are numbers
                } else {
                    eObj[k] = +eObj[k];
                }
            }

            if (typeof eObj[k] == 'object') {
                if (eObj[k] instanceof Array) {
                    for (var i = 0; i < eObj[k].length; i++) {
                        eObj[k][i] = eObj[k][i].trim();
                    }
                    eObj[k] = sqlEscape(eObj[k].join(','));
                } else {
                    eObj[k] = sqlEscapeObject(eObj[k]);
                }
            }
        }

        return eObj;
    }

    // first create the snippets table (if not already existing)
    sqlRun('CREATE TABLE IF NOT EXISTS snippet (id '+ dbTypes['key'] +' PRIMARY KEY, title '+ dbTypes['string'] +', author '+ dbTypes['string'] +', contact_name '+ dbTypes['string'] +', contact_email '+ dbTypes['string'] +', contact_ip '+ dbTypes['string'] +', categories '+ dbTypes['string'] +', code '+ dbTypes['string'] +', language '+ dbTypes['string'] +', remarks '+ dbTypes['string'] +', tags '+ dbTypes['string'] +', download '+ dbTypes['url'] +', external_link '+ dbTypes['url'] +', published_by '+ dbTypes['string'] +', submitted_at '+ dbTypes['datetime'] +', published_at '+ dbTypes['datetime'] +', retired_at '+ dbTypes['datetime'] +', state '+ dbTypes['string'] +');', function(err, rows) {
        if (err) {
            reportError(err);
        }
    });

    /* E-Mailing setup */
    var mailTransporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: false,
        auth: {
            user: config.email.auth.user,
            pass: config.email.auth.pass
        },
        requireTLS: true,
        tls: {
            ciphers: 'SSLv3'
        }
    });

    function sendMail(subject, text, to) {
        var mailOptions = {
            from:    config.email.from,
            to:      to || config.email.to,
            subject: subject,
            text:    text
        };

        mailTransporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                reportError('ERROR: '+ error);
            } else {
                reportLog('Email sent: ' + info.response);
            }
        });
    }

    /* Application REST API setup */
    app.use(express.json({
        type: '*/*'
    }));
    app.use(helmet());
    app.use(compression({
        filter: shouldCompress,
        level: 9
    }));
    app.use('/', express.static('public'));

    function shouldCompress (req, res) {
        if (req.headers['x-no-compression']) {
            // don't compress responses with this request header
            return false
        }

        // fallback to standard filter function
        return compression.filter(req, res);
    }

    /* Provide /SnippetsAppConfig.js as the "app" branch in the config file  */
    app.all('/SnippetsAppConfig.js', function(req, res) {
        res.set('Content-Type', 'application/javascript');
        res.send('window.SnippetsAppConfig = '+ JSON.stringify(config.app, null, '\t') +';');
    });

    
    /* Endpoint /snippets
     *
     * used for multiple snippets:
     *   - get a snippets of a specific state or list of states
     *     (either using query part [list of states] or path [a specific state])
     *   - changing multiple snippets at once
     *     (e.g. publishing or declining)
     * */
    app.get('/snippets', function(req, res) {
        if (req.query.states == 'published' || (req.query.states != 'published' && authenticateRequest(req, res))) {
            var state = '';

            if (typeof req.query.states != 'undefined' && req.query.states != '' && req.query.states != null) {
                state = 'WHERE ';
                var states = (req.query.states +'').split(',');

                // state "undisclosed" is a shortcut for new and declined snippets
                if  (states.length == 1 && states[0] == 'undisclosed') {
                    states = ['new', 'declined'];
                }

                for (var i = 0; i < states.length; i++) {
                    if (i > 0) {
                        state += 'OR '
                    }
                    state += 'state = '+ sqlEscape(states[i].trim());
                }
            }

            sql = 'SELECT * FROM snippet '+ state +' -- '+ req.method +' '+ req.path;

            sqlRunResponse(sql, res);
        }
    });
    app.post('/snippets', function(req, res) {
        if (authenticateRequest(req, res)) {
            var snippets = [].concat(req.body);
            var sql = '';

            if (snippets.length > 0) {
                for (var k = 0; k < snippets.length; k++) {
                    var snippet = snippets[k];

                    if (snippet.state == 'deleted') {
                        sql += 'DELETE FROM snippet WHERE id = '+ sqlEscape(snippet.id) +';\n';
                    } else {
                        if (snippet.state == 'published') {
                            snippet.published_at = new Date().getTime();
                        }
                        if (snippet.state == 'retired') {
                            snippet.retired_at = new Date().getTime();
                        }

                        snippet = sqlEscapeObject(snippet);

                        var keys = Object.keys(snippet);
                        keys.splice(keys.indexOf('id'), 1);

                        sql += 'UPDATE snippet SET ';
                        for(var i = 0; i < keys.length; i++) {
                            if (i > 0) {
                                sql += ', ';
                            }
                            sql += keys[i] +' = '+ snippet[keys[i]];
                        }
                        sql += ' WHERE id = '+ snippet.id +';\n';
                    }
                }

                sql = wrapTransaction(sql);
            }

            sqlExec(sql, function(err) {
                if (err) {
                    reportError(err);
                }

                sql = 'SELECT * FROM snippet -- '+ req.method +' '+ req.path;

                sqlRunResponse(sql, res);
            })
            
        }
    });
    app.get('/snippets/:state', function(req, res) {
        let state = req.params.state;

        if (state == 'published' || (state != 'published' && authenticateRequest(req, res))) {
            var fields = '*';

            if (state == 'published') {
                fields = 'id, title, author, categories, code, language, remarks, tags, download, external_link, published_by, submitted_at, published_at, retired_at, state';
            }

            // state "undisclosed" is a shortcut for new and declined snippets
            if  (state == 'undisclosed')  {
                state = 'state = '+ sqlEscape('new') +' OR state = '+ sqlEscape('declined');
            } else {
                state = 'state = '+ sqlEscape(state);
            }

            sql = 'SELECT '+ fields +' FROM snippet WHERE '+ state +' -- '+ req.method +' '+ req.path;

            sqlRunResponse(sql, res);
        }
    });
    app.use("/snippets", apiLimiter);

    /* Endpoint /snippet
     *
     * used for single snippets:
     *   - posting a snippet
     *   - retrieving a single snippet
     *   - changing a specific snippet
     * */
    app.post('/snippet', function(req, res) {
        var snippet = req.body;
        var invalidInsert = false;
        var invalidReason = [];

        // form validations
        if (snippet.author.trim() == '') {
            invalidInsert = true;
            invalidReason.push('Author must not be empty');
        }
        if (snippet.contact_name.trim() == '') {
            invalidInsert = true;
            invalidReason.push('Name must not be empty');
        }
        if (snippet.contact_email.trim() == '') {
            invalidInsert = true;
            invalidReason.push('E-Mail must not be empty');
        }
        if (snippet.title.trim() == '') {
            invalidInsert = true;
            invalidReason.push('Title must not be empty');
        }
        if (snippet.title.trim().length <= 5) {
            invalidInsert = true;
            invalidReason.push('Title must have more than 5 characters');
        }
        if (snippet.categories.length == 0) {
            invalidInsert = true;
            invalidReason.push('You need to choose at least one category');
        }
        if (snippet.code.trim() == '') {
            invalidInsert = true;
            invalidReason.push('Code must not be empty');
        }
        if (snippet.code.trim().length <= 10) {
            invalidInsert = true;
            invalidReason.push('Code must have more than 10 characters');
        }

        // report error on invalid form inputs
        if (invalidInsert) {
            res.set('Content-Type', 'application/json');

            result = {
                result: 'error',
                error: invalidReason.join('\n')
            }

            res.send(JSON.stringify(result, null, config.debug ? '\t' : ''));

        // otherwise insert record
        } else {
            snippet.id           = generateUUID();
            snippet.submitted_at = new Date().getTime();
            snippet.state        = 'new';
            snippet.contact_ip   = req.get('!~Passenger-Client-Address') || req.ip;

            // notify admin of new snippet
            var mailSubject = config.app.title +' Contribution "'+ snippet.title +'"';
            var mailBody    = 'A new Snippet has been contributed by '+ snippet.contact_name +' ('+ snippet.contact_email +') as '+ snippet.author +'!\n';
                mailBody   += '\n';
                mailBody   += 'Title: '+ snippet.title +'\n';
                mailBody   += 'Categories: '+ snippet.categories.join(', ') +'\n';
                mailBody   += '\n';
                mailBody   += 'Code ('+ snippet.language +'):\n'
                mailBody   += snippet.code +'\n';
                mailBody   += '\n';
                mailBody   += 'Remarks: '+ snippet.remarks +'\n';
                mailBody   += 'Link for Reference: '+ snippet.external_link +'\n';
                mailBody   += 'Tags: '+ snippet.tags.join(', ') +'\n';
                mailBody   += '\n';
                mailBody   += 'Admin-Link: '+ config.app.baseUrl +'?admin=true#snippet:'+ snippet.id;
                mailBody   += '\n';
            sendMail(mailSubject, mailBody);

            // confirm receiving of the snippet
            mailBody  = 'Many thanks for your contribution to '+ config.app.title +'!\n';
            mailBody += 'Your code snippet will be reviewed and published as soon as possible.';
            sendMail(mailSubject, mailBody, snippet.contact_name +' <'+ snippet.contact_email +'>');

            snippet = sqlEscapeObject(snippet);
            var keys = Object.keys(snippet);

            sql  = 'INSERT INTO snippet ('+ keys.join(',') +') VALUES (';
            for(var i = 0; i < keys.length; i++) {
                if (i > 0) {
                    sql += ',';
                }
                sql += snippet[keys[i]];
            }
            sql += ') -- '+ req.method +' '+ req.path;

            sqlRunResponse(sql, res);
        }
    });
    app.get('/snippet/:id', function(req, res) {
        if (authenticateRequest(req, res)) {
            let id = req.params.id;

            sql = 'SELECT * FROM snippet WHERE id = '+ sqlEscape(id) +' -- '+ req.method +' '+ req.path;

            sqlRunResponse(sql, res);
        }
    });
    app.post('/snippet/:id', function(req, res) {
        if (authenticateRequest(req, res)) {
            let id = req.params.id;
            var snippet = req.body;

            if (snippet.state == 'published') {
                snippet.published_at = new Date().getTime();
            }
            if (snippet.state == 'retired') {
                snippet.retired_at = new Date().getTime();
            }
            snippet = sqlEscapeObject(snippet);

            var keys = Object.keys(snippet);
            keys.splice(keys.indexOf('id'), 1);

            sql = 'UPDATE snippet SET ';
            for(var i = 0; i < keys.length; i++) {
                if (i > 0) {
                    sql += ', ';
                }
                sql += keys[i] +' = '+ snippet[keys[i]];
            }
            sql += ' WHERE id = '+ sqlEscape(id);

            sqlExec(sql, function(err) {
                if (err) {
                    reportError(err);
                }

                sql = 'SELECT * FROM snippet WHERE id = '+ sqlEscape(id) +' -- '+ req.method +' '+ req.path;

                sqlRunResponse(sql, res);
            });
        }
    });
    app.use("/snippet", apiLimiter);

    app.get('/lastPublishTimestamp', function(req, res) {
        var sql = 'SELECT published_at FROM snippet ORDER  BY published_at DESC LIMIT 1';
        sqlRunResponse(sql, res);
    });
    app.use("/lastPublishTimestamp", apiLimiter);

    // add fault-tolerance by wrapping each request in a try-catch-block
    app.use(function(req, res, next) {
        try {
            next();
        } catch(err) {
            reportError('ERROR: '+ err);
            res.status(500).json(JSON.stringify(error) == '{}' ? error +'' : error);
        }
    });

    // start express server
    if (config.runType == 'standalone') {
        reportLog('process.env.PORT = '+ process.env.PORT);
        let port = process.env.PORT || args[0] || config.port;
        app.listen(+(port), function () {
            reportLog('SnippetsApp listening on port '+ port +'!');
        })
    }
}

module.exports = app;