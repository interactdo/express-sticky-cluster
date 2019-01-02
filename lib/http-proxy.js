'use strict';

exports.init = function (config) {
    var httpProxy = require('http-proxy');
    var proxies = {},
        server = {};

    for (var iCounter = 0; iCounter < config.workers; iCounter++) {
        var proxyOptions = {};
        if (config.ssl.secure) {
            proxyOptions.target = 'http://127.0.0.1:' + (config.worker_port + iCounter);
            proxyOptions.secure = false;
            proxyOptions.ssl = config.ssl.certs;
        } else
            proxyOptions.target = 'http://127.0.0.1:' + (config.worker_port + iCounter);
        proxies[iCounter] = new httpProxy.createProxyServer(proxyOptions);

        proxies[iCounter].on('error', function (err, req, res) {
            config.logger.log('error', 'Proxy error: ' + err.message, err);

            if (!res.headersSent)
                res.writeHead(500, {'content-type': 'application/json'});
            res.end(JSON.stringify({error: 'proxy_error', reason: err.message}));
        });
    }

    if (config.ssl.secure)
        server = require('https').createServer(config.ssl.certs, function (req, res) {
            config.ipfilter(req, res, function (err) {
                if (!err)
                    return config.store(config, proxies, req, res).web(req, res);

                ipfilterError(req, undefined, err);
            });
        });
    else
        server = require('http').createServer(function (req, res) {
            config.ipfilter(req, res, function (err) {
                if (!err)
                    return config.store(config, proxies, req, res).web(req, res);

                ipfilterError(req, undefined, err);
            });
        });

    if (config.socket)
        server.on('upgrade', function (req, socket, head) {
            config.ipfilter(req, null, function (err) {
                if (!err)
                    return config.store(config, proxies, req).ws(req, socket, head);

                ipfilterError(req, socket, err);
            });
        });

    config.logger.log('info', 'Proxy start listen on port: ' + config.proxy_port);

    server.listen(config.proxy_port);

    function ipfilterError(req, socket, err) {
        config.logger.log('error', 'Proxy IPFilter error: ' + err.message, err);
        if (socket){
            socket.write(err);
            socket.end();
        } else {
            if (!res.headersSent)
                res.writeHead(500, {'content-type': 'application/json'});
            res.end(JSON.stringify({error: 'proxy_ipfilter_error', reason: err.message}));
        }
    }
};
