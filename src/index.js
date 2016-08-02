import $ from 'jquery';


/*
 * Namespace for tools.
 */

const evil = {};

/*
 * Shortcut for `window`.
 */

evil.win = $(window);

/*
 * Shortcut for `document`.
 */

evil.doc = $(document);

/*
 * Shortcut for `body`.
 */

evil.body = null;

evil.doc.ready(function initBodyShortcut() {
  evil.body = $('body');
});

/*
 * Alternate syntax for `setTimeout`.
 *
 *   after(1000, () => addSecond());
 */

window.after = function after(ms, callback) {
  return setTimeout(callback, ms);
};

/*
 * Alternate syntax for `setInterval`.
 *
 *   every(1000, () => addSecond());
 */

window.every = function every(ms, callback) {
  return setInterval(callback, ms);
};

/*
 * Tools namespace inside jQuery.
 */

(function injectEvilToJQuery() {
  evil.jquery = function (global, namespace) {
    global.$ = function (nodes) {
      this.nodes = nodes;
    };

    global.$.extend = function (name, value) {
      if ($.isPlainObject(name)) {
        for (key in name) {
          global.$.extend(key, name[key]);
        }

        return;
      }

      if ($.isFunction(value)) {
        var callback = value;
        value = function () {
          return callback.apply(this.nodes, arguments);
        };
      }

      this.prototype[name] = value;
    };

    var originaljQuery = $.fn.init;

    $.fn.init = function () {
      nodes = originaljQuery.apply(this, arguments);
      nodes[namespace] = new global.$(nodes);

      return nodes;
    };

    $.fn.init.prototype = originaljQuery.prototype;
  };

  evil.jquery(evil, 'evil');
}());

/*
 * Add `evil.patch`, `evil.del`, `evil.put`, `evil.post` to send AJAX request
 * with RESTful HTTP verb by Rails X-HTTP-Method-Override header
 * and with CSRF token.
 */

(function ($) {
  var props = { patch: 'PATCH', put: 'PUT', del: 'DELETE', post: 'POST' };

  $.each(props, function (prop, method) {
    evil[prop] = function (url, data, callback, type) {
      if ($.isFunction(data)) {
        type = type || callback;
        callback = data;
        data = { };
      }

      return $.ajax({
        headers: {
          'X-HTTP-Method-Override': method,
          'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
        },
        type:    'POST',
        url:     url,
        data:    data,
        success: callback,
        dataType: type,
      });
    };
  });
})($);

/*
 * Change selected form to be sent by AJAX.
 * It returns jQuery node of form for chains.
 *
 *   $('form').evil.ajax
 *     success:      -> message('success')
 *     error: (text) -> message('error' + text)
 *
 * While AJAX is loading, form will has `is-submitting` class.
 * Don’t forget to show loader.
 */

evil.$.extend('ajax', function (opts) {
  if (!opts) {
    opts = { };
  }

  return this.submit(function (event) {
    if (event.isPropagationStopped()) {
      return false;
    }

    var form = $(this);

    if (form.hasClass('is-submitting')) {
      return false;
    }
    form.addClass('is-submitting');

    var check = true;

    if (opts.submitting) {
      check = opts.submitting(form);
    }

    if (!check) {
      return false;
    }

    $.ajax({
      url:  form.attr('action'),
      type: form.attr('method').toUpperCase(),
      data: form.serialize(),

      success (data) {
        if ( opts.success ) {
          opts.success(data, form);
        }
      },

      error (e) {
        if (e.status == 500) {
          if (opts.serverError) {
            opts.serverError(form);
          }
        } else if (opts.error) {
          opts.error(e.responseText, form);
        }
      },

      complete () {
        form.removeClass('is-submitting');
      },
    });

    return false;
  });
});

/*
 * Detect support 3D transform and add `transform3d` or `transform2s` class
 * to body.
 */

(function () {
  var cache  = undefined;
  var inited = false;

  evil.transform3d = {
    check () {
      if ( typeof(cache) != 'undefined' ) {
        return cache;
      }

      var cache = typeof(evil.body.css('perspective')) != 'undefined';
      var style = document.body;

      if (cache && typeof(style.webkitPerspective) != 'undefined') {
        cache = matchMedia("(transform-3d), (-webkit-transform-3d)");
        cache = cache.matches;
      }

      return cache;
    },

    init () {
      if (inited) {
        return;
      }

      inited = true;

      evil.doc.ready(function () {
        var type  = evil.transform3d.check() ? '3d' : '2d';
        evil.body.addClass('transform-' + type);
      });
    },
  };
})();

evil.transform3d.init();

/*
 * Prevent default in AJAX link with only `#` in `href`.
 */

evil.doc.ready(function () {
  evil.body.on('click', 'a', function (e) {
    if (this.getAttribute('href') == '#') {
      e.preventDefault();
    }
  });
})

(function () {
  evil.$.extend('outside', function (callback) {
    var parent = this;

    var event = function (e) {
      var el = $(e.target);
      if (!el.closest(parent).length) {
        callback();
        off();
      }
    };

    if (document.body.addEventListener) {
      var set = function () {
          document.body.addEventListener('click', event, true);
          document.body.addEventListener('focus', event, true);
      };
      var off = function () {
          document.body.removeEventListener('click', event, true);
          document.body.removeEventListener('focus', event, true);
      };
    } else {
      var name = '.evil-outside-' + (new Date()).valueOf();

      var set = function () {
        evil.body.on('click' + name + ' focus' + name, event);
      };
      var off = function () {
        evil.body.off(name);
      };
    }

    setTimeout(set, 10);

    return off;
  });
})();

/*
 * Add events to add special class on touch events. It will much faster, than
 * `:hover` selector. It returns jQuery node of element for chains.
 *
 * By default it add listener to all links and inputs on body.
 * But you can add it to any elements:
 *
 *   $('.pseudolink').evil.tappable();
 *
 * Or you can set listeners as “live” delegate:
 *
 *   $('.ajax-updated').evil.tappable('.pseudolink');
 *
 * Don’t forget about `no-hover` and `styled-taps` Sass mixins.
 */

(function () {
  var start = function () {
    this.classList.add('is-tapped');
  };

  var end = function () {
  var link = $(this);

  setTimeout(function () {
    link.removeClass('is-tapped').
         addClass('was-tapped').
         one('mouseenter', function () {
           link.removeClass('was-tapped');
         });
    }, 100);
  };

  evil.$.extend({
    tappable: function (selector) {
      if (selector) {
        this.on('touchstart', selector, start);
        this.on('touchend touchmove', selector, end);
      } else {
        this.on('touchstart', start);
        this.on('touchend touchmove', end);
      }
      return this;
    }
  });

  evil.doc.ready(function ($) {
    evil.body.evil.tappable('a, input, label');
  });
})();

/*
 * Call `callback` only after previous callback of `name` queue
 * will be finished. It is useful to animation.
 *
 *   b.link.click(() => {
 *     evil.queue('link', done => {
 *       $.get($(this).url, html => {
 *         animation(html, () => done());
 *       });
 *     });
 *   });
 */

(function () {
  evil.queue = function(name, callback) {
    if (typeof(name) == 'function') {
      callback = name;
      name     = 'default';
    }

    if (typeof(waiters[name]) == 'undefined') {
      waiting[name] = false;
      waiters[name] = [];
    }

    if (waiting[name]) {
      waiters[name].push(callback);
    } else {
      call(name, callback);
    }
  };

  var waiting = { };
  var waiters = { };

  var call = function (name, callback) {
    waiting[name] = true;

    callback(function () {
      waiting[name] = false;

      var waiter = waiters[name].pop();

      if (waiter) {
        call(name, waiter);
      }
    });
  };
})();

(function ($, window) {
  var $window = $(window);

  var clone = function (origin) {
    var cloned = { };

    for (var name in origin) {
      cloned[name] = origin[name];
    }

    return cloned;
  };

  var endsWith = function (string, substring) {
    return string.substr(-substring.length) === substring;
  };

  /*
   * Add `@data-role` alias to jQuery.
   *
   * Copy from jquery.role by Sasha Koss https://github.com/kossnocorp/role
   */

  var rewriteSelector = function (context, name, pos) {
    var original = context[name];

    if (!original) {
      return;
    }

    context[name] = function () {
      arguments[pos] = arguments[pos].replace(
        /@@([\w\u00c0-\uFFFF\-]+)/g, '[data-block~="$1"]');
      arguments[pos] = arguments[pos].replace(
        /@([\w\u00c0-\uFFFF\-]+)/g,  '[data-role~="$1"]');

      return original.apply(context, arguments);
    };

    $.extend(context[name], original);
  };

  rewriteSelector($, 'find', 0);
  rewriteSelector($, 'multiFilter', 0);
  rewriteSelector($.find, 'matchesSelector', 1);
  rewriteSelector($.find, 'matches', 0);

  /*
   * Find selector inside base DOM node and cretae class for it.
   */
  var find = function (base, id, selector, klass) {
    var blocks = $().add(base.filter(selector)).
                     add(base.find(selector));

    if (blocks.length == 0) {
      return;
    }

    var objects = [];

    blocks.each(function (_, node) {
      var block = $(node);

      var obj = clone(klass);
      obj.block = block;

      for (var i = 0; i < evil.block.filters.length; i++) {
        var stop = evil.block.filters[i](obj, id);

        if (stop === false) {
          return;
        }
      }

      objects.push(obj)
    });

    return function () {
      for (var i = 0; i < objects.length; i++) {
        if (objects[i].init) {
          objects[i].init();
        }
      }
    };
  };

  var ready = false;

  var loaded = false;

  $window.load(function (event) {
    loaded = event;
  });

  var lastBlock = 0;

  /**
   * Create object for every `selector` finded in page and call their
   * `init` method.
   *
   *   evil.block '.user-page .buttons',
   *     init: ->
   *       @gallery.fotorama()
   *     delete: ->
   *       @deleteForm.submit ->
   *         $('user-status').trigger('deleted')
   *     'click on @deleleLink': (e) ->
   *       e.el.addClass('is-loading')
   *       delete()
   *     'on update': ->
   *       location.reload()
   *
   * Every `data-role="aName"` in HTML will create in object `aName` property
   * with jQuery node.
   *
   * To bind delegate listener just create `EVENT on SELECTOR` method.
   * In first argument it will receive jQuery node of `e.currentTarget`,
   * second will be event object and others will be parameters.
   *
   * To communicate between blocks, just trigget custom events. To receive
   * events from another blocks, create `on EVENT` method. Event object will
   * be on first argument here.
   *
   * Block node will be in `@block` property and you can search only inside
   * block by `@(selector)` method.
   *
   * If your block contrain only `init` method, you can use shortcut:
   *
   *   evil.block '.block', ->
   *     # init method
   */
  evil.block = function (selector, klass) {
    lastBlock += 1;

    var id = lastBlock;

    if (typeof(klass) == 'function') {
      klass = { init: klass };
    }

    evil.block.defined.push([id, selector, klass]);

    if (ready) {
      var init = find($(document), id, selector, klass);

      if (init) {
        init();
      }
    }
  };

  /**
   * Vitalize all current blocks inside base. You must call it on every
   * new content from AJAX.
   *
   *   'on click on @load': ->
   *     $.get '/comments', (comments) =>
   *       evil.block.vitalize $(comments).applyTo(@comments)
   */
  evil.block.vitalize = function (base) {
    if (base) {
      base = $(base);
    } else {
      base = $(document);
    }

    var inits = [];

    for (var i = 0; i < evil.block.defined.length; i++) {
      var define = evil.block.defined[i];

      inits.push(find(base, define[0], define[1], define[2]));
    }

    for (var i = 0; i < inits.length; i++) {
      if (inits[i]) {
        inits[i]();
      }
    }
  };

  /**
   * Evil blocks list.
   */
  evil.block.defined = [];

  /**
   * Filters to process block object and add some extra functions
   * to Evil Blocks. For example, allow to write listeners.
   *
   * Filter will receive block object and unique class ID.
   * If filter return `false`, block will not be created.
   */
  evil.block.filters = [];

  var filters = evil.block.filters;

  /**
   * Don’t vitalize already vitalized block.
   *
   * For better perfomance, it should be last filter.
   */
  filters.push(function (obj, id) {
    var ids = obj.block.data('evil-blocks');

    if (!ids) {
      ids = [];
    } else if (ids.indexOf(id) != -1) {
      return false;
    }

    ids.push(id);
    obj.block.data('evil-blocks', ids);
  });

  /**
   * Create `this.$()` as alias for `this.block.find()`
   */
  filters.push(function (obj) {
    obj.$ = function (subselector) {
      return obj.block.find(subselector);
    };
  });

  /**
   * Create properties for each element with `data-role`.
   */
  filters.push(function (obj) {
    obj.block.find('[data-role]').each(function (_, el) {
      var roles = el.attributes['data-role'].value.split(' ');

      for (var i = 0; i < roles.length; i++) {
        var role = roles[i];

        if (!obj[role]) {
          obj[role] = $();
        }

        if (obj[role].jquery) {
          obj[role].push(el);
        }
      }
    });
  });

  /**
   * Syntax sugar to listen block events.
   */
  filters.push(function (obj) {
    for (var name in obj) {
      if (name.substr(0, 3) != 'on ') {
        continue;
      }

      var events   = name.substr(3);
      var callback = obj[name];
      delete obj[name];

      (function (events, callback) {
        obj.block.on(events, function (e) {
          if (e.currentTarget == e.target) {
            callback.apply(obj, arguments);
          }
        });
      })(events, callback);
    }
  });

  /**
   * Smart `load on window` listener, which fire immediately
   * if page was already loaded.
   */
  filters.push(function (obj) {
    var name     = 'load on window';
    var callback = obj[name];

    if (!callback) {
      return;
    }

    delete obj[name];

    if (loaded) {
      setTimeout(function () {
        callback.call(obj, loaded);
      }, 1);
    } else {
      $window.load(function (event) {
        callback.call(obj, event);
      });
    }
  });

  /**
   * Syntax sugar to listen window and body events.
   */
  filters.push(function (obj) {
    for (var name in obj) {
      var elem = false;

      if (endsWith(name, 'on body')) {
        elem = $('body');
      } else if (endsWith(name, 'on window')) {
        elem = $window;
      }

      if (!elem) {
        continue;
      }

      var event    = name.split(' on ')[0];
      var callback = obj[name];
      delete obj[name];

      (function (elem, event, callback) {
        elem.on(event, function () {
          callback.apply(obj, arguments);
        });
      })(elem, event, callback);
    }
  });

  /**
   * Syntax sugar to listen element events.
   */
  filters.push(function (obj) {
    for (var name in obj) {
      var parts = name.split(' on ');

      if (!parts[1]) {
        continue;
      }

      var callback = obj[name];
      delete obj[name];

      (function (parts, callback) {
        obj.block.on(parts[0], parts[1], function (e) {
          e.el = $(this);
          callback.apply(obj, arguments);
        });
      })(parts, callback);
    }
  });

  /*
   * Run all blocks on load.
   */
  $(document).ready(function () {
    ready = true;
    evil.block.vitalize();
  });
})(jQuery, window);

if (process.env.NODE_ENV !== 'production') {
  (function () {
    var log = function () {
      if (!console || !console.log) {
        return;
      }
      console.log.apply(console, arguments);
    };

    if (!window.evil || !window.evil.block) {
      log("You should include evil-blocks-debug.js after evil-blocks.js");

      return;
    }

    var logger = function (obj) {
      for (var name in obj) {
        if (name.indexOf('on ') == -1) {
          continue;
        }

        var parts = name.split('on ');
        var event = parts[0] ? parts[0] : parts[1];

        var callback = obj[name];

        (function(event, callback){
          obj[name] = function (e) {
            var source   = e.el ? e.el[0] : this.block[0];
            var messages = ['Event "' + event + '" on', source];

            var params = Array.prototype.slice.call(arguments, 1);

            if (params.length > 0) {
              messages.push('with params');
              messages = messages.concat(params);
            }

            log.apply(this, messages);
            callback.apply(this, arguments);
          };
        })(event, callback);
      }
    };

    evil.block.filters.splice(2, 0, logger);
  })();
}
