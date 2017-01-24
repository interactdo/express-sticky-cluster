# express-sticky-cluster
Sticky session balancer based on a <code>[cluster](https://nodejs.org/api/cluster.html)</code> and <code>[node-http-proxy](https://github.com/nodejitsu/node-http-proxy)</code> modules, with <code>[express](http://expressjs.com/)</code> and <code>[socket.io](http://socket.io/)</code> support.

Designed for using like <code>[express-cluster](https://github.com/Flipboard/express-cluster)</code>.

**No memory leaks** from version 1.0.0!

[![NPM](https://nodei.co/npm/express-sticky-cluster.png?downloads=true&stars=true)](https://nodei.co/npm/express-sticky-cluster/)

## How it works
Launches multiple worker processes through [cluster](https://nodejs.org/api/cluster.html), using bunch of ports.
One worker process becomes also 'http-proxy', serving as sticky session balancer.

Establishes sticky round-robin balancer for any kind of http(s) frameworks. Not only, but including [socket.io](http://socket.io/) and [express](http://expressjs.com/). 
Client will always connect to same worker process sticked with customizable hash function.
For example, [socket.io](http://socket.io/) multi-stage authorization will work as expected. 

**Unused sessions stickers will be deleted after some time, so module does not have memory leaks.**

## Installation
```bash
npm install express-sticky-cluster [--save]
```

## Usage example
[Express 4](http://expressjs.com/) example with [socket.io](http://socket.io/) and [passport.js](http://passportjs.org/) usage.

**./bin/www**:
```javascript
var app = require('../worker'),
    debug = require('debug')('example-app:server'),
    https = require('https'),
    fs = require('fs'),
    ipfilter = require('express-ipfilter').IpFilter;
var express_sticky_cluster = require('express-sticky-cluster');

var optionsHTTPs = {
        key: fs.readFileSync('./cert/def-secured.key'),
        cert: fs.readFileSync('./cert/def-secured.crt')
    };
    
var server = https.createServer(optionsHTTPs, app);
require('../socket.io')(require('socket.io')(server));

express_sticky_cluster(
    {
	    workers: 0,
	    respawn: true,
	    socket: true,
	    proxy_port: 443,
        worker_port: 8000,
        delay: 1000,        	    
        debug: true,
        ssl: {
	        secure: true,
	        certs: optionsHTTPs
        },	  
        ipfilter: ipfilter(['127.0.0.1', ['192.168.0.1', '192.168.0.200']], {mode: allow, log: false}),
	    session: {
            hash: 'connect.sid',
            ttl: 360000
	    },
	    logger: undefined,
	    workerListener: function (message) {}
	}, function (worker, port) {
	    console.info('Worker ID#' + worker.id + ' process started PID#' + worker.process.pid);
	    app.set('port', port);
	    return server.listen(port);
	}
);

server.on('error', onError);
server.on('listening', onListening);

function onError(error) {
    if (error.syscall !== 'listen')
        throw error;
    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}
function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    console.info('Listening on ' + bind + ' PID#' + process.pid);
}
```
**./worker.js**:
```javascript
var express = require('express'),
    session = require('express-session'),
    passport = require('passport'),
	uuid = require('node-uuid');
	
var app = express();

var sessionFileStore = require('session-file-store')(session);
global.sessionStore = new sessionFileStore({
    path : path.join(__dirname, '/sessions')
});    
...
require('./passport')(passport);
app.use(passport.initialize());
app.use(passport.session());
...
app.use(session({
    secret: 'keyboard-cat',
    name: 'connect.sid',
    resave: true,
    rolling: true,
    saveUninitialized: true,
    cookie: {
        path: '/',
        httpOnly: false,
        secure: true,
        maxAge: 360000
    },
    store: global.sessionStore,
    genid: function (req) {
        return uuid.v4();
    }
}));
...
module.exports = app;
```

**./socket.io.js**:
```javascript
var passportIo = require('passport.socketio'),
    cookieParser = require('cookie-parser');

module.exports = function (io) {
    io.use(passportIo.authorize({
        cookieParser: cookieParser,
        key: 'connect.sid',
        secret: 'keyboard-cat',
        store: global.sessionStore,
        success: function (data, accept) {
            accept();
        },
        fail: function (data, message, err, accept) {
            if(err)
                accept(new Error(message));
        }
    }));
    io.on('connection', function (socket) {
        socket.on('join', function (data) {
            console.log('join', data);
        });
        socket.on('disconnect', function () {
            socket.leave();
        });
    });
};
```
**./passport.js**:
```javascript
var LocalStrategy = require('passport-local').Strategy;

module.exports = function (passport, licensing) {
    passport.serializeUser(function (user, done) {
        done(null, user);
    });
    passport.deserializeUser(function (user, done) {
        done(null, user);
    });
    passport.use(
        'local-signin',
        new LocalStrategy({
                usernameField: 'username',
                passwordField: 'password',
                passReqToCallback: true
            },
            function (req, username, password, done) {
                var objUser = {};
                return done(null, objUser, {message: 'Successfull login'});
            }
        )
    );
};
```

#### Options
* **workers** - Number of workers to spawn (default: CPU core count)
* **respawn** - Respawn process on exit (default: true)
* **socket** - Allow WebSocket proxy (default: true)
* **proxy_port** - Proxy listener port (default: if **secure** then 443 else 80)
* **worker_port** - Workers first port, increased for each worker (for 4 workers it will be use [worker_port, worker_port+1, worker_port+2, worker_port+3]) (default: 8000)
* **delay** - Proxy instance creating delay (default: 1000ms) 
* **debug** - Log Proxy debug info to **logger** (default: false)
* **ssl**:
	1. **secure** - Create HTTP or HTTPS proxy (default: false means HTTP)
	2. **certs** - TLS certificates data object (default: undefined, if **secure**=true must contain you TLS certificates data)
* **ipfilter** - IP-filter function, for details see [express-ipfilter](https://www.npmjs.com/package/express-ipfilter) (default: undefined)
* **session**:
	1. **hash** - Function (req, res) or Session cookie name. If function - can use cookie-based session ids and etc. (default: if undefined uses cookie-based session id from cookie 'connect.sid')
	2. **ttl** - Sessions TTL, uses for **store** configuration (default: 3600000ms)
* **logger** - Logger instance, for example new winston.Logger(...) instance (default: undefined)
* **workerListener** - Attach the given function to each spawned worker. The function will be bound to the worker that sent the message so you can setup a two way message bus if you want (default: undefined)

#### Callback function
* **worker** - current worker instance
* **port** - current worker assigned port
	
### LICENSE
MIT License

Copyright (c) 2016 Valeriy V. Pushkar and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
