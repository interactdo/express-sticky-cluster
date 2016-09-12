'use strict';

module.exports = function (config, callback) {
    if (typeof config === 'function')
    {
        callback = config;
        config = {};
    }

    var cluster = require('cluster'),
        stickyCluster = require('./lib/sticky-cluster');

    var sessionHash = function (req, res) {
        var ip = (req.connection.remoteAddress || '').split(/\./g);
        var hash = ip.reduce(function (r, num) {
            r += parseInt(num, 10);
            r %= 2147483648;
            r += (r << 10);
            r %= 2147483648;
            r ^= r >> 6;
            return r;
        }, config.session_hash_seed);
        hash += hash << 3;
        hash %= 2147483648;
        hash ^= hash >> 11;
        hash += hash << 15;
        hash %= 2147483648;
        return hash >>> 0;
    };

    var logger = {
        log: function (level, message) {
            console[level](message);
        }
    };

    config.workers = config.workers || process.env.WORKERS || require('os').cpus().length;
    config.respawn = config.respawn || true;
    config.secured = config.secured || false;
    config.socket = config.socket || true;
    config.session_hash = config.session_hash || sessionHash;
    config.session_hash_seed = config.session_hash_seed || ~~(0.5 * 1e9);
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
