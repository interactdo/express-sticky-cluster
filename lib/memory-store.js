'use strict';

module.exports = function (options) {
    options.ttl = options.ttl || 3600000;
    options.repeat = options.repeat || 60000;
    options.debug = options.debug || false;
    options.logger = options.logger || {
            log: function (level, message, stack) {
                if (!stack)
                    return console[level](message);
                return console[level](stack);
            }
        };

    var stickers = {},
        current_proxy = 0;

    setTimeout(function () {
        var maxAge = new Date().getTime() + options.ttl;
        Object.keys(stickers).forEach(function (key) {
            if (stickers[key].maxAge <= maxAge) {
                if (options.debug)
                    options.logger.log('debug', 'Sticker deleted. Hash: ' + key);
                delete stickers[key];
            }
        });
    }, options.repeat);

    function nextProxy(config, proxies) {
        var proxy = proxies[current_proxy];
        current_proxy = (current_proxy + 1) % config.workers;
        return proxy;
    }

    return function (config, proxies, req, res) {
        var hash = config.session.hashFn(req, res),
            proxy = undefined,
            maxAge = undefined;

        if (hash !== undefined) {
            if (stickers[hash] !== undefined) {
                proxy = stickers[hash].proxy;
                maxAge = new Date().getTime() + config.session.ttl;

                stickers[hash] = {
                    proxy: proxy,
                    maxAge: maxAge
                };

                if (config.debug)
                    config.logger.log('debug', 'Restored proxy. Hash: ' + hash + ' [target: ' + proxy.options.target.href + ', maxAge: ' + maxAge + ']');
            } else {
                proxy = nextProxy(config, proxies);
                maxAge = new Date().getTime() + config.session.ttl;

                stickers[hash] = {
                    proxy: proxy,
                    maxAge: maxAge
                };

                if (config.debug)
                    config.logger.log('debug', 'Assigned proxy. Hash: ' + hash + ' [target: ' + proxy.options.target + ', maxAge: ' + maxAge + ']');
            }
        } else {
            proxy = nextProxy(config, proxies);

            if (config.debug)
                config.logger.log('debug', 'Random proxy. Hash: ' + hash + ' [target: ' + proxy.options.target + ', maxAge: 0]');
        }

        return proxy;
    };
};
