'use strict';

module.exports = function (options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    var cookie = require('cookie'),
        cluster = require('cluster');
    var stickyCluster = require('./lib/sticky-cluster');

    var config = {
        workers: undefined,
        respawn: undefined,
        socket: undefined,
        proxy_port: undefined,
        worker_port: undefined,
        delay: undefined,
        verbose: undefined,
        debug: undefined,
        ssl: {
            secure: undefined,
            certs: {
                key: undefined,
                cert: undefined
            }
        },
        session: {
            hash: undefined,
            hashFn: undefined,
            ttl: undefined
        },
        store: undefined,
        logger: undefined,
        workerListener: undefined
    };

    config.workers = options.workers || require('os').cpus().length;
    config.respawn = options.respawn || true;
    config.socket = options.socket || true;
    config.proxy_port = options.proxy_port || (config.ssl.secure ? 443 : 80);
    config.worker_port = options.worker_port || 8000;
    config.delay = options.delay || 1000;

    config.verbose = options.verbose || true;
    config.debug = options.debug || false;

    if (options.ssl !== undefined) {
        config.ssl.secure = options.ssl.secure || false;
        config.ssl.certs.key = options.ssl.certs.key || new Buffer('');
        config.ssl.certs.cert = options.ssl.certs.cert || new Buffer('');
    } else {
        config.ssl.secure = false;
        config.ssl.certs.key = new Buffer('');
        config.ssl.certs.cert = new Buffer('');
    }

    var hashFn = function (req, res) {
        if (!req.headers.cookie)
            return config.session.hash;
        var cookie_value = cookie.parse(req.headers.cookie)[config.session.hash];
        return cookie_value ? cookie_value : config.session.hash;
    };
    if (options.session !== undefined) {
        if (options.session.hash !== undefined)
            config.session.hash = typeof options.session.hash === 'function' ? '' : options.session.hash;
        else
            config.session.hash = 'connect.sid';
        config.session.hashFn = typeof options.session.hash === 'function' ? options.session.hash : hashFn;
        config.session.ttl = options.session.ttl || 3600000;
    } else {
        config.session.hash = 'connect.sid';
        config.session.hashFn = hashFn;
        config.session.ttl = 3600000;
    }

    config.logger = options.logger || {
            log: function (level, message, stack) {
                if (!stack)
                    return console[level](message);
                return console[level](stack);
            }
        };

    config.store = (options.store !== undefined && typeof options.store === 'function') ? options.store :
        require('./stores/memory-store')({
            ttl: config.session.ttl,
            repeat: (config.session.ttl / 10) >= 60000 ? (config.session.ttl / 10) : 60000,
            debug: config.debug,
            logger: config.logger
        });

    config.workerListener = options.workerListener || undefined;

    if (cluster.isMaster)
        return stickyCluster.master(config);
    else
        return stickyCluster.worker(cluster.worker, callback);
};
