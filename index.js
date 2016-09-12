'use strict';

module.exports = function (config, callback) {
    if (typeof config === 'function')
    {
        callback = config;
        config = {};
    }

    var cookie = require('cookie'),
        cluster = require('cluster'),
        stickyCluster = require('./lib/sticky-cluster');

    var sessionHash = function (req, res) {
        return cookie.parse(req.headers.cookie)[config.session_cookie_name];
    };

    var logger = {
        log: function (level, message, stack) {
            if(!stack)
                return console[level](message);
            return console[level](stack);
        }
    };

    config.workers = config.workers || process.env.WORKERS || require('os').cpus().length;
    config.respawn = config.respawn || true;
    config.secure = config.secure || false;
    config.socket = config.socket || true;
    config.session_hash = config.session_hash || sessionHash;
    config.session_cookie_name = config.session_cookie_name || 'connect.sid';
    config.delay = config.delay || 1000;
    config.proxy_port = config.proxy_port || process.env.PROXY_PORT || (config.secured ? 443 : 80);
    config.worker_port = config.worker_port || process.env.WORKER_PORT || 8000;
    config.verbose = config.verbose || true;
    config.logger = config.logger || logger;
    config.workerListener = config.workerListener || undefined;

    if (cluster.isMaster)
        return stickyCluster.master(config);
    else
        return stickyCluster.worker(cluster.worker, callback);
};
