var hbs = require('express-hbs');
var _ = require('underscore');
//hbs custom function to check if the content of the item is empty 
 
registerHelper = function (){

  var isFunction = function(value) {
    return typeof value === 'function';
  };

  var isArray = Array.isArray || function(value) {
    return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
  };
  function getTags(obj) {
    var tags = obj.tags;
    var arr = [];
    _.each(tags, function(item) {
      return arr.push(item.slug);
    });
    return JSON.stringify(arr);
  }
  function toSkip(skip, obj) {
    var tags = obj.tags;
    var hasHeading = _.find(tags, function(item) {
      return item.slug.indexOf('heading-') != -1;
    })?true:false;
    switch (skip) {
      case "onlytag":
        return !hasHeading;
        break;
      case "notag":
        return hasHeading;
        break;
    }
  }
  var createFrame = function(object) {
    var obj = {};
    _.extend(obj, object);
    return obj;
  };

  hbs.registerHelper('iter', function (context, options) {
      var fn = options.fn, inverse = options.inverse;
      var i = 0, ret = "", data, index = 0;
      var param = options.hash;
      if (isFunction(context)) {
        context = context.call(this);
      }
      if (options.data) {
        data = createFrame(options.data);
      }
      if (context && typeof context === 'object') {
        if (isArray(context)) {
          for (var j = context.length; i < j; i++) {
            var post = context[i];
            if(toSkip(param.skip, post)) {
              continue;
            }
            if (data) {
              data.tagsList = getTags(post);
              data.index = index + 1;
              data.first = (index === 0);
              data.last = (index === (context.length - 1));
            }
            ret = ret + fn(post, { data: data });
            index++;
          }
        }
        else {
          for (var key in context) {
            if (context.hasOwnProperty(key)) {
              var post = context[key];
              if(toSkip(param.skip, post)) {
                continue;
              }
              if (data) {
                data.tagsList = getTags(post);
                data.key = key;
                data.index = index + 1;
                data.first = (index === 0);
              }
              ret = ret + fn(post, {data: data});
              index++;
            }
          }
        }
      }
      if (i === 0) {
        ret = inverse(this);
      }
      return ret;
    });



};
 
module.exports = registerHelper;
