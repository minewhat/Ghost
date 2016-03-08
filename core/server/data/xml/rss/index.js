var _        = require('lodash'),
    Promise  = require('bluebird'),
    crypto   = require('crypto'),
    RSS      = require('rss'),
    url      = require('url'),
    config   = require('../../../config'),
    api      = require('../../../api'),
    filters  = require('../../../filters'),

    generate,
    generateFeed,
    getFeedXml,
    feedCache = {};

function isTag(req) {
    return req.originalUrl.indexOf('/' + config.routeKeywords.tag + '/') !== -1;
}

function isAuthor(req) {
    return req.originalUrl.indexOf('/' + config.routeKeywords.author + '/') !== -1;
}

function handleError(next) {
    return function handleError(err) {
        return next(err);
    };
}

function getOptions(req, pageParam, slugParam) {
    var options = {};

    if (pageParam) { options.page = pageParam; }
    if (isTag(req)) { options.tag = slugParam; }
    if (isAuthor(req)) { options.author = slugParam; }

    options.include = 'author,tags,fields';

    return options;
}

function getData(options) {
    var api_options = {
        context: {
            internal: true
        },
        limit: 'all'
    };
    var ops = {
        title: api.settings.read('title'),
        description: api.settings.read('description'),
        permalinks: api.settings.read('permalinks'),
        results: api.tags.browse(api_options)
    };

    return Promise.props(ops).then(function (result) {
        var titleStart = '';
        if (options.tag) { titleStart = options.tag + " | "}
        if (options.author) { titleStart = options.author + " | "}

        return {
            title: titleStart + result.title.settings[0].value,
            description: result.description.settings[0].value,
            permalinks: result.permalinks.settings[0],
            results: result.results
        };
    });
}

function getBaseUrl(req, slugParam) {
    var baseUrl = config.paths.subdir;

    if (isTag(req)) {
        baseUrl += '/' + config.routeKeywords.tag + '/' + slugParam + '/rss/';
    } else if (isAuthor(req)) {
        baseUrl += '/' + config.routeKeywords.author + '/' + slugParam + '/rss/';
    } else {
        baseUrl += '/rss/';
    }

    return baseUrl;
}


getFeedXml = function getFeedXml(path, data) {
    var dataHash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    if (!feedCache[path] || feedCache[path].hash !== dataHash) {
        // We need to regenerate
        feedCache[path] = {
            hash: dataHash,
            xml: generateFeed(data)
        };
    }

    return feedCache[path].xml;
};

generateFeed = function generateFeed(data) {
    var feed = new RSS({
        title: data.title,
        description: data.description,
        generator: 'Ghost ' + data.version,
        feed_url: data.feedUrl,
        site_url: data.siteUrl,
        ttl: '60',
        custom_namespaces: {
            content: 'http://purl.org/rss/1.0/modules/content/',
            media: 'http://search.yahoo.com/mrss/'
        }
    });

    data.results.tags.forEach(function forEach(tag) {
        var baseURL = config.getBaseUrl(data.secure);
        var itemUrl =  baseURL + "/collection/" + tag.slug,
        item = {
                title: tag.name,
                description: tag.description,
                guid: tag.uuid,
                url: itemUrl,
                date: tag.updated_at,
                author: tag.author ? tag.author.name : null,
                custom_elements: []
         }, imageUrl;

        // Add a featured tag
        item.custom_elements.push({
            'featured': post.featured
        });


        if (tag.image) {
            imageUrl = config.urlFor('image', {image: tag.image, secure: data.secure}, true);

            // Add a media content tag
            item.custom_elements.push({
                'media:content': {
                    _attr: {
                        url: imageUrl,
                        medium: 'image'
                    }
                }
            });
        }

        filters.doFilter('rss.item', item, tag).then(function then(item) {
            feed.item(item);
        });
    });

    return filters.doFilter('rss.feed', feed).then(function then(feed) {
        return feed.xml();
    });
};

generate = function generate(req, res, next) {
    // Initialize RSS
    var pageParam = req.params.page !== undefined ? parseInt(req.params.page, 10) : 1,
        slugParam = req.params.slug,
        baseUrl   = getBaseUrl(req, slugParam),
        options   = getOptions(req, pageParam, slugParam);

    // No negative pages, or page 1
    if (isNaN(pageParam) || pageParam < 1 || (req.params.page !== undefined && pageParam === 1)) {
        return res.redirect(baseUrl);
    }

    return getData(options).then(function then(data) {
        var maxPage = data.results.meta.pagination.pages;

        // If page is greater than number of pages we have, redirect to last page
        if (pageParam > maxPage) {
            return res.redirect(baseUrl + maxPage + '/');
        }

        data.version = res.locals.safeVersion;
        data.siteUrl = config.urlFor('home', {secure: req.secure}, true);
        data.feedUrl = config.urlFor({relativeUrl: baseUrl, secure: req.secure}, true);
        data.secure = req.secure;

        return getFeedXml(req.originalUrl, data).then(function then(feedXml) {
            res.set('Content-Type', 'text/xml; charset=UTF-8');
            res.send(feedXml);
        });
    }).catch(handleError(next));
};

module.exports = generate;
