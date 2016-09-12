'use strict';

var httpProxy = require('http-proxy'),
    merge = require('merge');

var proxies = {},
    stickers = {},
    current_proxy = 0;

function next_proxy(config) {
    var proxy = proxies[current_proxy];
    current_proxy = (current_proxy + 1) % config.workers;
    return proxy;
}

function get_proxy(config, req, res) {
    var hash = config.session_hash(req, res),
        proxy = undefined;

    if (config.verbose)
        config.logger.log('info', 'hash: ' + hash);

    if (hash !== undefined) {
        if (stickers[hash] !== undefined) {
            if (config.verbose)
                config.logger.log('info', 'Restored proxy');
            proxy = stickers[hash].proxy;
        } else {
            if (config.verbose)
                config.logger.log('info', 'Assigned proxy');
            proxy = next_proxy(config);
            stickers[hash] = {proxy: proxy}
        }
    } else {
        if (config.verbose)
            config.logger.log('info', 'Random proxy');
        proxy = next_proxy(config);
    }

    return proxy;
}

exports.init = function (config) {
    for (var iCounter = 0; iCounter < config.workers; iCounter++) {
        var proxyOptions = {
            target: {
                host: '127.0.0.1',
                port: config.worker_port + iCounter
            }
        };

        if (config.secure)
            proxyOptions = merge(true, true, [proxyOptions, {secure: config.secure}, {ssl: config.ssl}]);
        proxies[iCounter] = new httpProxy.createProxyServer(proxyOptions);

        proxies[iCounter].on('error', function (err, req, res) {
            config.logger.log('info', 'proxy error: ' + err);
            if (null != res)
                try {
                    if (!res.headersSent)
                        res.writeHead(500, {'content-type': 'application/json'});
                    res.end(JSON.stringify({error: 'proxy_error', reason: err.message}))
                } catch (err) {
                }
        });
    }

    var server = {};
    if (config.secure)
        server = require('https').createServer(config.ssl, function (req, res) {
            get_proxy(config, req, res).web(req, res);
        });
    else
        server = require('http').createServer(function (req, res) {
            get_proxy(config, req, res).web(req, res);
        });

    if (config.socket)
        server.on('upgrade', function(req, socket, head) {
            get_proxy(config, req).ws(req, socket, head);
        });

    if (config.verbose)
        config.logger.log('info', 'main proxy listen on port: ' + config.proxy_port);

    server.listen(config.proxy_port);
};
