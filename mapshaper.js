(function(){
var VERSION = '0.4.34';

var error = function() {
  var msg = Utils.toArray(arguments).join(' ');
  throw new Error(msg);
};

var utils = {
  getUniqueName: function(prefix) {
    var n = Utils.__uniqcount || 0;
    Utils.__uniqcount = n + 1;
    return (prefix || "__id_") + n;
  },

  isFunction: function(obj) {
    return typeof obj == 'function';
  },

  isObject: function(obj) {
    return obj === Object(obj); // via underscore
  },

  clamp: function(val, min, max) {
    return val < min ? min : (val > max ? max : val);
  },

  interpolate: function(val1, val2, pct) {
    return val1 * (1-pct) + val2 * pct;
  },

  isArray: function(obj) {
    return Array.isArray(obj);
  },

  // NaN -> true
  isNumber: function(obj) {
    // return toString.call(obj) == '[object Number]'; // ie8 breaks?
    return obj != null && obj.constructor == Number;
  },

  isInteger: function(obj) {
    return Utils.isNumber(obj) && ((obj | 0) === obj);
  },

  isString: function(obj) {
    return obj != null && obj.toString === String.prototype.toString;
    // TODO: replace w/ something better.
  },

  isBoolean: function(obj) {
    return obj === true || obj === false;
  },

  // Convert an array-like object to an Array, or make a copy if @obj is an Array
  toArray: function(obj) {
    var arr;
    if (!Utils.isArrayLike(obj)) error("Utils.toArray() requires an array-like object");
    try {
      arr = Array.prototype.slice.call(obj, 0); // breaks in ie8
    } catch(e) {
      // support ie8
      arr = [];
      for (var i=0, n=obj.length; i<n; i++) {
        arr[i] = obj[i];
      }
    }
    return arr;
  },

  // Array like: has length property, is numerically indexed and mutable.
  // TODO: try to detect objects with length property but no indexed data elements
  isArrayLike: function(obj) {
    if (!obj) return false;
    if (Utils.isArray(obj)) return true;
    if (Utils.isString(obj)) return false;
    if (obj.length === 0) return true;
    if (obj.length > 0) return true;
    return false;
  },

  // See https://raw.github.com/kvz/phpjs/master/functions/strings/addslashes.js
  addslashes: function(str) {
    return (str + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
  },

  // Escape a literal string to use in a regexp.
  // Ref.: http://simonwillison.net/2006/Jan/20/escape/
  regexEscape: function(str) {
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  },

  defaults: function(dest) {
    for (var i=1, n=arguments.length; i<n; i++) {
      var src = arguments[i] || {};
      for (var key in src) {
        if (key in dest === false && src.hasOwnProperty(key)) {
          dest[key] = src[key];
        }
      }
    }
    return dest;
  },

  extend: function(o) {
    var dest = o || {},
        n = arguments.length,
        key, i, src;
    for (i=1; i<n; i++) {
      src = arguments[i] || {};
      for (key in src) {
        if (src.hasOwnProperty(key)) {
          dest[key] = src[key];
        }
      }
    }
    return dest;
  },

  // Pseudoclassical inheritance
  //
  // Inherit from a Parent function:
  //    Utils.inherit(Child, Parent);
  // Call parent's constructor (inside child constructor):
  //    this.__super__([args...]);
  inherit: function(targ, src) {
    var f = function() {
      if (this.__super__ == f) {
        // add __super__ of parent to front of lookup chain
        // so parent class constructor can call its parent using this.__super__
        this.__super__ = src.prototype.__super__;
        // call parent constructor function. this.__super__ now points to parent-of-parent
        src.apply(this, arguments);
        // remove temp __super__, expose targ.prototype.__super__ again
        delete this.__super__;
      }
    };

    f.prototype = src.prototype || src; // added || src to allow inheriting from objects as well as functions
    // Extend targ prototype instead of wiping it out --
    //   in case inherit() is called after targ.prototype = {stuff}; statement
    targ.prototype = Utils.extend(new f(), targ.prototype); //
    targ.prototype.constructor = targ;
    targ.prototype.__super__ = f;
  },

  // Inherit from a parent, call the parent's constructor, optionally extend
  // prototype with optional additional arguments
  subclass: function(parent) {
    var child = function() {
      this.__super__.apply(this, Utils.toArray(arguments));
    };
    Utils.inherit(child, parent);
    for (var i=1; i<arguments.length; i++) {
      Utils.extend(child.prototype, arguments[i]);
    }
    return child;
  }

};

var Utils = utils;


var Env = (function() {
  var inNode = typeof module !== 'undefined' && !!module.exports;
  var inBrowser = typeof window !== 'undefined' && !inNode;
  var inPhantom = inBrowser && !!(window.phantom && window.phantom.exit);
  var ieVersion = inBrowser && /MSIE ([0-9]+)/.exec(navigator.appVersion) && parseInt(RegExp.$1) || NaN;

  return {
    iPhone : inBrowser && !!(navigator.userAgent.match(/iPhone/i)),
    iPad : inBrowser && !!(navigator.userAgent.match(/iPad/i)),
    canvas: inBrowser && !!document.createElement('canvas').getContext,
    inNode : inNode,
    inPhantom : inPhantom,
    inBrowser: inBrowser,
    ieVersion: ieVersion,
    ie: !isNaN(ieVersion)
  };
})();


// Support for timing using T.start() and T.stop("message")
//
var T = {
  stack: [],
  verbose: true,

  start: function(msg) {
    if (T.verbose && msg) verbose(T.prefix() + msg);
    T.stack.push(+new Date);
  },

  // Stop timing, print a message if T.verbose == true
  stop: function(note) {
    var startTime = T.stack.pop();
    var elapsed = (+new Date - startTime);
    if (T.verbose) {
      var msg =  T.prefix() + elapsed + 'ms';
      if (note) {
        msg += " " + note;
      }
      verbose(msg);
    }
    return elapsed;
  },

  prefix: function() {
    var str = "- ",
        level = this.stack.length;
    while (level--) str = "-" + str;
    return str;
  }
};


// Append elements of @src array to @dest array
utils.merge = function(dest, src) {
  if (!utils.isArray(dest) || !utils.isArray(src)) {
    error("Usage: utils.merge(destArray, srcArray);")
  }
  for (var i=0, n=src.length; i<n; i++) {
    dest.push(src[i]);
  }
  return dest;
};

// Returns elements in arr and not in other
// (similar to underscore diff)
utils.difference = function(arr, other) {
  var index = utils.arrayToIndex(other);
  return arr.filter(function(el) {
    return !Object.prototype.hasOwnProperty.call(index, el);
  });
};

// Test a string or array-like object for existence of substring or element
utils.contains = function(container, item) {
  if (utils.isString(container)) {
    return container.indexOf(item) != -1;
  }
  else if (utils.isArrayLike(container)) {
    return utils.indexOf(container, item) != -1;
  }
  error("Expected Array or String argument");
};

utils.some = function(arr, test) {
  return arr.reduce(function(val, item) {
    return val || test(item); // TODO: short-circuit?
  }, false);
};

utils.every = function(arr, test) {
  return arr.reduce(function(val, item) {
    return val && test(item);
  }, true);
};

utils.find = function(arr, test, ctx) {
  var matches = arr.filter(test, ctx);
  return matches.length === 0 ? null : matches[0];
};

utils.indexOf = function(arr, item, prop) {
  if (prop) error("utils.indexOf() No longer supports property argument");
  var nan = !(item === item);
  for (var i = 0, len = arr.length || 0; i < len; i++) {
    if (arr[i] === item) return i;
    if (nan && !(arr[i] === arr[i])) return i;
  }
  return -1;
};

utils.range = function(len, start, inc) {
  var arr = [],
      v = start === void 0 ? 0 : start,
      i = inc === void 0 ? 1 : inc;
  while(len--) {
    arr.push(v);
    v += i;
  }
  return arr;
};

utils.repeat = function(times, func) {
  var values = [],
      val;
  for (var i=0; i<times; i++) {
    val = func(i);
    if (val !== void 0) {
      values[i] = val;
    }
  }
  return values.length > 0 ? values : void 0;
};

// Calc sum, skip falsy and NaN values
// Assumes: no other non-numeric objects in array
//
utils.sum = function(arr, info) {
  if (!utils.isArrayLike(arr)) error ("utils.sum() expects an array, received:", arr);
  var tot = 0,
      nan = 0,
      val;
  for (var i=0, n=arr.length; i<n; i++) {
    val = arr[i];
    if (val) {
      tot += val;
    } else if (isNaN(val)) {
      nan++;
    }
  }
  if (info) {
    info.nan = nan;
  }
  return tot;
};

// Calculate min and max values of an array, ignoring NaN values
utils.getArrayBounds = function(arr) {
  var min = Infinity,
    max = -Infinity,
    nan = 0, val;
  for (var i=0, len=arr.length; i<len; i++) {
    val = arr[i];
    if (val !== val) nan++;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return {
    min: min,
    max: max,
    nan: nan
  };
};

utils.uniq = function(src) {
  var index = {};
  return src.reduce(function(memo, el) {
    if (el in index === false) {
      index[el] = true;
      memo.push(el);
    }
    return memo;
  }, []);
};

utils.pluck = function(arr, key) {
  return arr.map(function(obj) {
    return obj[key];
  });
};

utils.countValues = function(arr) {
  return arr.reduce(function(memo, val) {
    memo[val] = (val in memo) ? memo[val] + 1 : 1;
    return memo;
  }, {});
};

utils.indexOn = function(arr, k) {
  return arr.reduce(function(index, o) {
    index[o[k]] = o;
    return index;
  }, {});
};

utils.groupBy = function(arr, k) {
  return arr.reduce(function(index, o) {
    var keyval = o[k];
    if (keyval in index) {
      index[keyval].push(o);
    } else {
      index[keyval] = [o]
    }
    return index;
  }, {});
};

utils.arrayToIndex = function(arr, val) {
  var init = arguments.length > 1;
  return arr.reduce(function(index, key) {
    index[key] = init ? val : true;
    return index;
  }, {});
};

// Support for iterating over array-like objects, like typed arrays
utils.forEach = function(arr, func, ctx) {
  if (!utils.isArrayLike(arr)) {
    throw new Error("#forEach() takes an array-like argument. " + arr);
  }
  for (var i=0, n=arr.length; i < n; i++) {
    func.call(ctx, arr[i], i);
  }
};

utils.forEachProperty = function(o, func, ctx) {
  Object.keys(o).forEach(function(key) {
    func.call(ctx, o[key], key);
  });
};

utils.initializeArray = function(arr, init) {
  for (var i=0, len=arr.length; i<len; i++) {
    arr[i] = init;
  }
  return arr;
};

utils.replaceArray = function(arr, arr2) {
  arr.splice(0, arr.length);
  arr.push.apply(arr, arr2);
};


Utils.repeatString = function(src, n) {
  var str = "";
  for (var i=0; i<n; i++)
    str += src;
  return str;
};

Utils.pluralSuffix = function(count) {
  return count != 1 ? 's' : '';
};

Utils.endsWith = function(str, ending) {
    return str.indexOf(ending, str.length - ending.length) !== -1;
};

Utils.lpad = function(str, size, pad) {
  pad = pad || ' ';
  str = String(str);
  return Utils.repeatString(pad, size - str.length) + str;
};

Utils.rpad = function(str, size, pad) {
  pad = pad || ' ';
  str = String(str);
  return str + Utils.repeatString(pad, size - str.length);
};

Utils.trim = function(str) {
  return Utils.ltrim(Utils.rtrim(str));
};

var ltrimRxp = /^\s+/;
Utils.ltrim = function(str) {
  return str.replace(ltrimRxp, '');
};

var rtrimRxp = /\s+$/;
Utils.rtrim = function(str) {
  return str.replace(rtrimRxp, '');
};

Utils.addThousandsSep = function(str) {
  var fmt = '',
      start = str[0] == '-' ? 1 : 0,
      dec = str.indexOf('.'),
      end = str.length,
      ins = (dec == -1 ? end : dec) - 3;
  while (ins > start) {
    fmt = ',' + str.substring(ins, end) + fmt;
    end = ins;
    ins -= 3;
  }
  return str.substring(0, end) + fmt;
};

Utils.numToStr = function(num, decimals) {
  return decimals >= 0 ? num.toFixed(decimals) : String(num);
};

Utils.formatNumber = function(num, decimals, nullStr, showPos) {
  var fmt;
  if (isNaN(num)) {
    fmt = nullStr || '-';
  } else {
    fmt = Utils.numToStr(num, decimals);
    fmt = Utils.addThousandsSep(fmt);
    if (showPos && parseFloat(fmt) > 0) {
      fmt = "+" + fmt;
    }
  }
  return fmt;
};



function Transform() {
  this.mx = this.my = 1;
  this.bx = this.by = 0;
}

Transform.prototype.isNull = function() {
  return !this.mx || !this.my || isNaN(this.bx) || isNaN(this.by);
};

Transform.prototype.invert = function() {
  var inv = new Transform();
  inv.mx = 1 / this.mx;
  inv.my = 1 / this.my;
  //inv.bx = -this.bx * inv.mx;
  //inv.by = -this.by * inv.my;
  inv.bx = -this.bx / this.mx;
  inv.by = -this.by / this.my;
  return inv;
};


Transform.prototype.transform = function(x, y, xy) {
  xy = xy || [];
  xy[0] = x * this.mx + this.bx;
  xy[1] = y * this.my + this.by;
  return xy;
};

Transform.prototype.toString = function() {
  return Utils.toString(Utils.extend({}, this));
};


function Bounds() {
  if (arguments.length > 0) {
    this.setBounds.apply(this, arguments);
  }
}

Bounds.prototype.toString = function() {
  return JSON.stringify({
    xmin: this.xmin,
    xmax: this.xmax,
    ymin: this.ymin,
    ymax: this.ymax
  });
};

Bounds.prototype.toArray = function() {
  return this.hasBounds() ? [this.xmin, this.ymin, this.xmax, this.ymax] : [];
};

Bounds.prototype.hasBounds = function() {
  return this.xmin <= this.xmax && this.ymin <= this.ymax;
};

Bounds.prototype.sameBounds =
Bounds.prototype.equals = function(bb) {
  return bb && this.xmin === bb.xmin && this.xmax === bb.xmax &&
    this.ymin === bb.ymin && this.ymax === bb.ymax;
};

Bounds.prototype.width = function() {
  return (this.xmax - this.xmin) || 0;
};

Bounds.prototype.height = function() {
  return (this.ymax - this.ymin) || 0;
};

Bounds.prototype.area = function() {
  return this.width() * this.height() || 0;
};

Bounds.prototype.empty = function() {
  this.xmin = this.ymin = this.xmax = this.ymax = void 0;
  return this;
};

Bounds.prototype.setBounds = function(a, b, c, d) {
  if (arguments.length == 1) {
    // assume first arg is a Bounds or array
    if (Utils.isArrayLike(a)) {
      b = a[1];
      c = a[2];
      d = a[3];
      a = a[0];
    } else {
      b = a.ymin;
      c = a.xmax;
      d = a.ymax;
      a = a.xmin;
    }
  }

  this.xmin = a;
  this.ymin = b;
  this.xmax = c;
  this.ymax = d;
  if (a > c || b > d) this.update();
  // error("Bounds#setBounds() min/max reversed:", a, b, c, d);
  return this;
};


Bounds.prototype.centerX = function() {
  var x = (this.xmin + this.xmax) * 0.5;
  return x;
};

Bounds.prototype.centerY = function() {
  var y = (this.ymax + this.ymin) * 0.5;
  return y;
};

Bounds.prototype.containsPoint = function(x, y) {
  if (x >= this.xmin && x <= this.xmax &&
    y <= this.ymax && y >= this.ymin) {
    return true;
  }
  return false;
};

// intended to speed up slightly bubble symbol detection; could use intersects() instead
// TODO: fix false positive where circle is just outside a corner of the box
Bounds.prototype.containsBufferedPoint =
Bounds.prototype.containsCircle = function(x, y, buf) {
  if ( x + buf > this.xmin && x - buf < this.xmax ) {
    if ( y - buf < this.ymax && y + buf > this.ymin ) {
      return true;
    }
  }
  return false;
};

Bounds.prototype.intersects = function(bb) {
  if (bb.xmin <= this.xmax && bb.xmax >= this.xmin &&
    bb.ymax >= this.ymin && bb.ymin <= this.ymax) {
    return true;
  }
  return false;
};

Bounds.prototype.contains = function(bb) {
  if (bb.xmin >= this.xmin && bb.ymax <= this.ymax &&
    bb.xmax <= this.xmax && bb.ymin >= this.ymin) {
    return true;
  }
  return false;
};

Bounds.prototype.shift = function(x, y) {
  this.setBounds(this.xmin + x,
    this.ymin + y, this.xmax + x, this.ymax + y);
};

Bounds.prototype.padBounds = function(a, b, c, d) {
  this.xmin -= a;
  this.ymin -= b;
  this.xmax += c;
  this.ymax += d;
};

// Rescale the bounding box by a fraction. TODO: implement focus.
// @param {number} pct Fraction of original extents
// @param {number} pctY Optional amount to scale Y
//
Bounds.prototype.scale = function(pct, pctY) { /*, focusX, focusY*/
  var halfWidth = (this.xmax - this.xmin) * 0.5;
  var halfHeight = (this.ymax - this.ymin) * 0.5;
  var kx = pct - 1;
  var ky = pctY === undefined ? kx : pctY - 1;
  this.xmin -= halfWidth * kx;
  this.ymin -= halfHeight * ky;
  this.xmax += halfWidth * kx;
  this.ymax += halfHeight * ky;
};

// Return a bounding box with the same extent as this one.
Bounds.prototype.cloneBounds = // alias so child classes can override clone()
Bounds.prototype.clone = function() {
  return new Bounds(this.xmin, this.ymin, this.xmax, this.ymax);
};

Bounds.prototype.clearBounds = function() {
  this.setBounds(new Bounds());
};

Bounds.prototype.mergePoint = function(x, y) {
  if (this.xmin === void 0) {
    this.setBounds(x, y, x, y);
  } else {
    // this works even if x,y are NaN
    if (x < this.xmin)  this.xmin = x;
    else if (x > this.xmax)  this.xmax = x;

    if (y < this.ymin) this.ymin = y;
    else if (y > this.ymax) this.ymax = y;
  }
};

// expands either x or y dimension to match @aspect (width/height ratio)
// @focusX, @focusY (optional): expansion focus, as a fraction of width and height
Bounds.prototype.fillOut = function(aspect, focusX, focusY) {
  if (arguments.length < 3) {
    focusX = 0.5;
    focusY = 0.5;
  }
  var w = this.width(),
      h = this.height(),
      currAspect = w / h,
      pad;
  if (isNaN(aspect) || aspect <= 0) {
    // error condition; don't pad
  } else if (currAspect < aspect) { // fill out x dimension
    pad = h * aspect - w;
    this.xmin -= (1 - focusX) * pad;
    this.xmax += focusX * pad;
  } else {
    pad = w / aspect - h;
    this.ymin -= (1 - focusY) * pad;
    this.ymax += focusY * pad;
  }
  return this;
};

Bounds.prototype.update = function() {
  var tmp;
  if (this.xmin > this.xmax) {
    tmp = this.xmin;
    this.xmin = this.xmax;
    this.xmax = tmp;
  }
  if (this.ymin > this.ymax) {
    tmp = this.ymin;
    this.ymin = this.ymax;
    this.ymax = tmp;
  }
};

Bounds.prototype.transform = function(t) {
  this.xmin = this.xmin * t.mx + t.bx;
  this.xmax = this.xmax * t.mx + t.bx;
  this.ymin = this.ymin * t.my + t.by;
  this.ymax = this.ymax * t.my + t.by;
  this.update();
  return this;
};

// Returns a Transform object for mapping this onto Bounds @b2
// @flipY (optional) Flip y-axis coords, for converting to/from pixel coords
//
Bounds.prototype.getTransform = function(b2, flipY) {
  var t = new Transform();
  t.mx = b2.width() / this.width() || 1; // TODO: better handling of 0 w,h
  t.bx = b2.xmin - t.mx * this.xmin;
  if (flipY) {
    t.my = -b2.height() / this.height() || 1;
    t.by = b2.ymax - t.my * this.ymin;
  } else {
    t.my = b2.height() / this.height() || 1;
    t.by = b2.ymin - t.my * this.ymin;
  }
  return t;
};

Bounds.prototype.mergeCircle = function(x, y, r) {
  if (r < 0) r = -r;
  this.mergeBounds([x - r, y - r, x + r, y + r]);
};

Bounds.prototype.mergeBounds = function(bb) {
  var a, b, c, d;
  if (bb instanceof Bounds) {
    a = bb.xmin, b = bb.ymin, c = bb.xmax, d = bb.ymax;
  } else if (arguments.length == 4) {
    a = arguments[0];
    b = arguments[1];
    c = arguments[2];
    d = arguments[3];
  } else if (bb.length == 4) {
    // assume array: [xmin, ymin, xmax, ymax]
    a = bb[0], b = bb[1], c = bb[2], d = bb[3];
  } else {
    error("Bounds#mergeBounds() invalid argument:", bb);
  }

  if (this.xmin === void 0) {
    this.setBounds(a, b, c, d);
  } else {
    if (a < this.xmin) this.xmin = a;
    if (b < this.ymin) this.ymin = b;
    if (c > this.xmax) this.xmax = c;
    if (d > this.ymax) this.ymax = d;
  }
  return this;
};


// Sort an array of objects based on one or more properties.
// Usage: Utils.sortOn(array, key1, asc?[, key2, asc? ...])
//
Utils.sortOn = function(arr) {
  var comparators = [];
  for (var i=1; i<arguments.length; i+=2) {
    comparators.push(Utils.getKeyComparator(arguments[i], arguments[i+1]));
  }
  arr.sort(function(a, b) {
    var cmp = 0,
        i = 0,
        n = comparators.length;
    while (i < n && cmp === 0) {
      cmp = comparators[i](a, b);
      i++;
    }
    return cmp;
  });
  return arr;
};

// Sort array of values that can be compared with < > operators (strings, numbers)
// null, undefined and NaN are sorted to the end of the array
//
Utils.genericSort = function(arr, asc) {
  var compare = Utils.getGenericComparator(asc);
  Array.prototype.sort.call(arr, compare);
  return arr;
};

Utils.sortOnKey = function(arr, getter, asc) {
  var compare = Utils.getGenericComparator(asc !== false) // asc is default
  arr.sort(function(a, b) {
    return compare(getter(a), getter(b));
  });
};

// Stashes keys in a temp array (better if calculating key is expensive).
Utils.sortOnKey2 = function(arr, getKey, asc) {
  Utils.sortArrayByKeys(arr, arr.map(getKey), asc);
};

Utils.sortArrayByKeys = function(arr, keys, asc) {
  var ids = Utils.getSortedIds(keys, asc);
  Utils.reorderArray(arr, ids);
};

Utils.getSortedIds = function(arr, asc) {
  var ids = Utils.range(arr.length);
  Utils.sortArrayIndex(ids, arr, asc);
  return ids;
};

Utils.sortArrayIndex = function(ids, arr, asc) {
  var compare = Utils.getGenericComparator(asc);
  ids.sort(function(i, j) {
    // added i, j comparison to guarantee that sort is stable
    var cmp = compare(arr[i], arr[j]);
    return cmp > 0 || cmp === 0 && i < j ? 1 : -1;
  });
};

Utils.reorderArray = function(arr, idxs) {
  var len = idxs.length;
  var arr2 = [];
  for (var i=0; i<len; i++) {
    var idx = idxs[i];
    if (idx < 0 || idx >= len) error("Out-of-bounds array idx");
    arr2[i] = arr[idx];
  }
  Utils.replaceArray(arr, arr2);
};

Utils.getKeyComparator = function(key, asc) {
  var compare = Utils.getGenericComparator(asc);
  return function(a, b) {
    return compare(a[key], b[key]);
  };
};

Utils.getGenericComparator = function(asc) {
  asc = asc !== false;
  return function(a, b) {
    var retn = 0;
    if (b == null) {
      retn = a == null ? 0 : -1;
    } else if (a == null) {
      retn = 1;
    } else if (a < b) {
      retn = asc ? -1 : 1;
    } else if (a > b) {
      retn = asc ? 1 : -1;
    } else if (a !== a) {
      retn = 1;
    } else if (b !== b) {
      retn = -1;
    }
    return retn;
  };
};



// Generic in-place sort (null, NaN, undefined not handled)
Utils.quicksort = function(arr, asc) {
  Utils.quicksortPartition(arr, 0, arr.length-1);
  if (asc === false) Array.prototype.reverse.call(arr); // Works with typed arrays
  return arr;
};

// Moved out of Utils.quicksort() (saw >100% speedup in Chrome with deep recursion)
Utils.quicksortPartition = function (a, lo, hi) {
  var i = lo,
      j = hi,
      pivot, tmp;
  while (i < hi) {
    pivot = a[lo + hi >> 1]; // avoid n^2 performance on sorted arrays
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) {
        tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
        i++;
        j--;
      }
    }
    if (lo < j) Utils.quicksortPartition(a, lo, j);
    lo = i;
    j = hi;
  }
};


Utils.findRankByValue = function(arr, value) {
  if (isNaN(value)) return arr.length;
  var rank = 1;
  for (var i=0, n=arr.length; i<n; i++) {
    if (value > arr[i]) rank++;
  }
  return rank;
}

Utils.findValueByPct = function(arr, pct) {
  var rank = Math.ceil((1-pct) * (arr.length));
  return Utils.findValueByRank(arr, rank);
};

// See http://ndevilla.free.fr/median/median/src/wirth.c
// Elements of @arr are reordered
//
Utils.findValueByRank = function(arr, rank) {
  if (!arr.length || rank < 1 || rank > arr.length) error("[findValueByRank()] invalid input");

  rank = Utils.clamp(rank | 0, 1, arr.length);
  var k = rank - 1, // conv. rank to array index
      n = arr.length,
      l = 0,
      m = n - 1,
      i, j, val, tmp;

  while (l < m) {
    val = arr[k];
    i = l;
    j = m;
    do {
      while (arr[i] < val) {i++;}
      while (val < arr[j]) {j--;}
      if (i <= j) {
        tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
        i++;
        j--;
      }
    } while (i <= j);
    if (j < k) l = i;
    if (k < i) m = j;
  }
  return arr[k];
};

//
//
Utils.findMedian = function(arr) {
  var n = arr.length,
      rank = Math.floor(n / 2) + 1,
      median = Utils.findValueByRank(arr, rank);
  if ((n & 1) == 0) {
    median = (median + Utils.findValueByRank(arr, rank - 1)) / 2;
  }
  return median;
};


Utils.mean = function(arr) {
  var count = 0,
      avg = NaN,
      val;
  for (var i=0, n=arr.length; i<n; i++) {
    val = arr[i];
    if (isNaN(val)) continue;
    avg = ++count == 1 ? val : val / count + (count - 1) / count * avg;
  }
  return avg;
};


// Wrapper for DataView class for more convenient reading and writing of
//   binary data; Remembers endianness and read/write position.
// Has convenience methods for copying from buffers, etc.
//
function BinArray(buf, le) {
  if (Utils.isNumber(buf)) {
    buf = new ArrayBuffer(buf);
  } else if (typeof Buffer == 'function' && buf instanceof Buffer) {
    // Since node 0.10, DataView constructor doesn't accept Buffers,
    //   so need to copy Buffer to ArrayBuffer
    buf = BinArray.toArrayBuffer(buf);
  }
  if (buf instanceof ArrayBuffer == false) {
    error("BinArray constructor takes an integer, ArrayBuffer or Buffer argument");
  }
  this._buffer = buf;
  this._bytes = new Uint8Array(buf);
  this._view = new DataView(buf);
  this._idx = 0;
  this._le = le !== false;
}

BinArray.bufferToUintArray = function(buf, wordLen) {
  if (wordLen == 4) return new Uint32Array(buf);
  if (wordLen == 2) return new Uint16Array(buf);
  if (wordLen == 1) return new Uint8Array(buf);
  error("BinArray.bufferToUintArray() invalid word length:", wordLen)
};

BinArray.uintSize = function(i) {
  return i & 1 || i & 2 || 4;
};

BinArray.bufferCopy = function(dest, destId, src, srcId, bytes) {
  srcId = srcId || 0;
  bytes = bytes || src.byteLength - srcId;
  if (dest.byteLength - destId < bytes)
    error("Buffer overflow; tried to write:", bytes);

  // When possible, copy buffer data in multi-byte chunks... Added this for faster copying of
  // shapefile data, which is aligned to 32 bits.
  var wordSize = Math.min(BinArray.uintSize(bytes), BinArray.uintSize(srcId),
      BinArray.uintSize(dest.byteLength), BinArray.uintSize(destId),
      BinArray.uintSize(src.byteLength));

  var srcArr = BinArray.bufferToUintArray(src, wordSize),
      destArr = BinArray.bufferToUintArray(dest, wordSize),
      count = bytes / wordSize,
      i = srcId / wordSize,
      j = destId / wordSize;

  while (count--) {
    destArr[j++] = srcArr[i++];
  }
  return bytes;
};

BinArray.toArrayBuffer = function(src) {
  var n = src.length,
      dest = new ArrayBuffer(n),
      view = new Uint8Array(dest);
  for (var i=0; i<n; i++) {
      view[i] = src[i];
  }
  return dest;
};

// Return length in bytes of an ArrayBuffer or Buffer
//
BinArray.bufferSize = function(buf) {
  return (buf instanceof ArrayBuffer ?  buf.byteLength : buf.length | 0);
};

Utils.buffersAreIdentical = function(a, b) {
  var alen = BinArray.bufferSize(a);
  var blen = BinArray.bufferSize(b);
  if (alen != blen) {
    return false;
  }
  for (var i=0; i<alen; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

BinArray.prototype = {
  size: function() {
    return this._buffer.byteLength;
  },

  littleEndian: function() {
    this._le = true;
    return this;
  },

  bigEndian: function() {
    this._le = false;
    return this;
  },

  buffer: function() {
    return this._buffer;
  },

  bytesLeft: function() {
    return this._buffer.byteLength - this._idx;
  },

  skipBytes: function(bytes) {
    this._idx += (bytes + 0);
    return this;
  },

  readUint8: function() {
    return this._bytes[this._idx++];
  },

  writeUint8: function(val) {
    this._bytes[this._idx++] = val;
    return this;
  },

  readInt8: function() {
    return this._view.getInt8(this._idx++);
  },

  writeInt8: function(val) {
    this._view.setInt8(this._idx++, val);
    return this;
  },

  readUint16: function() {
    var val = this._view.getUint16(this._idx, this._le);
    this._idx += 2;
    return val;
  },

  writeUint16: function(val) {
    this._view.setUint16(this._idx, val, this._le);
    this._idx += 2;
    return this;
  },

  readUint32: function() {
    var val = this._view.getUint32(this._idx, this._le);
    this._idx += 4;
    return val;
  },

  writeUint32: function(val) {
    this._view.setUint32(this._idx, val, this._le);
    this._idx += 4;
    return this;
  },

  readInt32: function() {
    var val = this._view.getInt32(this._idx, this._le);
    this._idx += 4;
    return val;
  },

  writeInt32: function(val) {
    this._view.setInt32(this._idx, val, this._le);
    this._idx += 4;
    return this;
  },

  readFloat64: function() {
    var val = this._view.getFloat64(this._idx, this._le);
    this._idx += 8;
    return val;
  },

  writeFloat64: function(val) {
    this._view.setFloat64(this._idx, val, this._le);
    this._idx += 8;
    return this;
  },

  // Returns a Float64Array containing @len doubles
  //
  readFloat64Array: function(len) {
    var bytes = len * 8,
        i = this._idx,
        buf = this._buffer,
        arr;
    // Inconsistent: first is a view, second a copy...
    if (i % 8 === 0) {
      arr = new Float64Array(buf, i, len);
    } else if (buf.slice) {
      arr = new Float64Array(buf.slice(i, i + bytes));
    } else { // ie10, etc
      var dest = new ArrayBuffer(bytes);
      BinArray.bufferCopy(dest, 0, buf, i, bytes);
      arr = new Float64Array(dest);
    }
    this._idx += bytes;
    return arr;
  },

  readUint32Array: function(len) {
    var arr = [];
    for (var i=0; i<len; i++) {
      arr.push(this.readUint32());
    }
    return arr;
  },

  peek: function(i) {
    return this._view.getUint8(i >= 0 ? i : this._idx);
  },

  position: function(i) {
    if (i != null) {
      this._idx = i;
      return this;
    }
    return this._idx;
  },

  readCString: function(fixedLen, asciiOnly) {
    var str = "",
        count = fixedLen >= 0 ? fixedLen : this.bytesLeft();
    while (count > 0) {
      var byteVal = this.readUint8();
      count--;
      if (byteVal == 0) {
        break;
      } else if (byteVal > 127 && asciiOnly) {
        str = null;
        break;
      }
      str += String.fromCharCode(byteVal);
    }

    if (fixedLen > 0 && count > 0) {
      this.skipBytes(count);
    }
    return str;
  },

  writeString: function(str, maxLen) {
    var bytesWritten = 0,
        charsToWrite = str.length,
        cval;
    if (maxLen) {
      charsToWrite = Math.min(charsToWrite, maxLen);
    }
    for (var i=0; i<charsToWrite; i++) {
      cval = str.charCodeAt(i);
      if (cval > 127) {
        trace("#writeCString() Unicode value beyond ascii range")
        cval = '?'.charCodeAt(0);
      }
      this.writeUint8(cval);
      bytesWritten++;
    }
    return bytesWritten;
  },

  writeCString: function(str, fixedLen) {
    var maxChars = fixedLen ? fixedLen - 1 : null,
        bytesWritten = this.writeString(str, maxChars);

    this.writeUint8(0); // terminator
    bytesWritten++;

    if (fixedLen) {
      while (bytesWritten < fixedLen) {
        this.writeUint8(0);
        bytesWritten++;
      }
    }
    return this;
  },

  writeBuffer: function(buf, bytes, startIdx) {
    this._idx += BinArray.bufferCopy(this._buffer, this._idx, buf, startIdx, bytes);
    return this;
  }
};


/*
A simplified version of printf formatting
Format codes: %[flags][width][.precision]type

supported flags:
  +   add '+' before positive numbers
  0   left-pad with '0'
  '   Add thousands separator
width: 1 to many
precision: .(1 to many)
type:
  s     string
  di    integers
  f     decimal numbers
  xX    hexidecimal (unsigned)
  %     literal '%'

Examples:
  code    val    formatted
  %+d     1      '+1'
  %4i     32     '  32'
  %04i    32     '0032'
  %x      255    'ff'
  %.2f    0.125  '0.13'
  %'f     1000   '1,000'
*/

// Usage: Utils.format(formatString, [values])
// Tip: When reusing the same format many times, use Utils.formatter() for 5x - 10x better performance
//
Utils.format = function(fmt) {
  var fn = Utils.formatter(fmt);
  var str = fn.apply(null, Array.prototype.slice.call(arguments, 1));
  return str;
};

function formatValue(val, matches) {
  var flags = matches[1];
  var padding = matches[2];
  var decimals = matches[3] ? parseInt(matches[3].substr(1)) : void 0;
  var type = matches[4];
  var isString = type == 's',
      isHex = type == 'x' || type == 'X',
      isInt = type == 'd' || type == 'i',
      isFloat = type == 'f',
      isNumber = !isString;

  var sign = "",
      padDigits = 0,
      isZero = false,
      isNeg = false;

  var str;
  if (isString) {
    str = String(val);
  }
  else if (isHex) {
    str = val.toString(16);
    if (type == 'X')
      str = str.toUpperCase();
  }
  else if (isNumber) {
    str = Utils.numToStr(val, isInt ? 0 : decimals);
    if (str[0] == '-') {
      isNeg = true;
      str = str.substr(1);
    }
    isZero = parseFloat(str) == 0;
    if (flags.indexOf("'") != -1 || flags.indexOf(',') != -1) {
      str = Utils.addThousandsSep(str);
    }
    if (!isZero) { // BUG: sign is added when num rounds to 0
      if (isNeg) {
        sign = "\u2212"; // U+2212
      } else if (flags.indexOf('+') != -1) {
        sign = '+';
      }
    }
  }

  if (padding) {
    var strLen = str.length + sign.length;
    var minWidth = parseInt(padding, 10);
    if (strLen < minWidth) {
      padDigits = minWidth - strLen;
      var padChar = flags.indexOf('0') == -1 ? ' ' : '0';
      var padStr = Utils.repeatString(padChar, padDigits);
    }
  }

  if (padDigits == 0) {
    str = sign + str;
  } else if (padChar == '0') {
    str = sign + padStr + str;
  } else {
    str = padStr + sign + str;
  }
  return str;
}

// Get a function for interpolating formatted values into a string.
Utils.formatter = function(fmt) {
  var codeRxp = /%([\',+0]*)([1-9]?)((?:\.[1-9])?)([sdifxX%])/g;
  var literals = [],
      formatCodes = [],
      startIdx = 0,
      prefix = "",
      literal,
      matches;

  while (matches=codeRxp.exec(fmt)) {
    literal = fmt.substring(startIdx, codeRxp.lastIndex - matches[0].length);
    if (matches[0] == '%%') {
      prefix += literal + '%';
    } else {
      literals.push(prefix + literal);
      prefix = '';
      formatCodes.push(matches);
    }
    startIdx = codeRxp.lastIndex;
  }
  literals.push(prefix + fmt.substr(startIdx));

  return function() {
    var str = literals[0],
        n = arguments.length;
    if (n != formatCodes.length) {
      error("[format()] Data does not match format string; format:", fmt, "data:", arguments);
    }
    for (var i=0; i<n; i++) {
      str += formatValue(arguments[i], formatCodes[i]) + literals[i+1];
    }
    return str;
  };
};






utils.wildcardToRegExp = function(name) {
  var rxp = name.split('*').map(function(str) {
    return utils.regexEscape(str);
  }).join('.*');
  return new RegExp('^' + rxp + '$');
};

utils.expandoBuffer = function(constructor, rate) {
  var capacity = 0,
      k = rate >= 1 ? rate : 1.2,
      buf;
  return function(size) {
    if (size > capacity) {
      capacity = Math.ceil(size * k);
      buf = new constructor(capacity);
    }
    return buf;
  };
};

utils.copyElements = function(src, i, dest, j, n, rev) {
  if (src === dest && j > i) error ("copy error");
  var inc = 1,
      offs = 0;
  if (rev) {
    inc = -1;
    offs = n - 1;
  }
  for (var k=0; k<n; k++, offs += inc) {
    dest[k + j] = src[i + offs];
  }
};

utils.extendBuffer = function(src, newLen, copyLen) {
  var len = Math.max(src.length, newLen);
  var n = copyLen || src.length;
  var dest = new src.constructor(len);
  utils.copyElements(src, 0, dest, 0, n);
  return dest;
};

utils.mergeNames = function(name1, name2) {
  var merged;
  if (name1 && name2) {
    merged = utils.findStringPrefix(name1, name2).replace(/[-_]$/, '');
  }
  return merged || '';
};

utils.findStringPrefix = function(a, b) {
  var i = 0;
  for (var n=a.length; i<n; i++) {
    if (a[i] !== b[i]) break;
  }
  return a.substr(0, i);
};

// Similar to isFinite() but does not convert strings or other types
utils.isFiniteNumber = function(val) {
  return val === 0 || !!val && val.constructor == Number && val !== Infinity && val !== -Infinity;
};

utils.parsePercent = function(o) {
  var str = String(o);
  var isPct = str.indexOf('%') > 0;
  var pct;
  if (isPct) {
    pct = Number(str.replace('%', '')) / 100;
  } else {
    pct = Number(str);
  }
  if (!(pct >= 0 && pct <= 1)) {
    stop(utils.format("Invalid percentage: %s", str));
  }
  return pct;
};




// Use a proxy for Buffer if running in browser and using browserify shim
// (Mostly to improve performance of string conversion)
var Buffer = (function() {
  var Buffer = require('buffer').Buffer;
  var ProxyBuffer;
  if (typeof TextDecoder == 'undefined' || typeof TextEncoder == 'undefined') {
    return Buffer;
  }

  ProxyBuffer = function(arg, encodingOrOffset, length) {
    var buf;
    if (typeof arg == "string" && encodingIsUtf8(encodingOrOffset)) {
      arg = fromUtf8(arg);
      encodingOrOffset = null;
    }
    return init(new Buffer(arg, encodingOrOffset, length));
  };

  ProxyBuffer.concat = Buffer.concat;
  ProxyBuffer.from = Buffer.from;

  function encodingIsUtf8(enc) {
    return !enc || /^utf-?8$/i.test(String(enc));
  }

  function fromUtf8(str) {
    // returns ArrayBuffer
    return new TextEncoder('utf8').encode(str).buffer;
  }

  function init(buf) {
    buf.toString = toString;
    buf.slice = slice;
    return buf;
  }

  function slice(start, end) {
    return init(Buffer.prototype.slice.call(this, start, end));
  }

  function toString(enc, start, end) {
    if (encodingIsUtf8(enc)) {
      return new TextDecoder('utf8').decode(start || end ? this.slice(start || 0, end) : this);
    }
    return Buffer.prototype.toString.call(enc, start, end);
  }

  return ProxyBuffer;
}());




var api = {};
var internal = {
  VERSION: VERSION, // export version
  LOGGING: false,
  DEBUG: false,
  QUIET: false,
  VERBOSE: false,
  T: T,
  defs: {}
};

new Float64Array(1); // workaround for https://github.com/nodejs/node/issues/6006

function error() {
  internal.error.apply(null, utils.toArray(arguments));
}

// Handle an error caused by invalid input or misuse of API
function stop() {
  internal.stop.apply(null, messageArgs(arguments));
}

function APIError(msg) {
  var err = new Error(msg);
  err.name = 'APIError';
  return err;
}

function messageArgs(args) {
  var arr = utils.toArray(args);
  if (internal.CURR_CMD) {
    arr.unshift('[' + internal.CURR_CMD + ']');
  }
  return arr;
}

function message() {
  internal.message.apply(null, messageArgs(arguments));
}

function verbose() {
  if (internal.VERBOSE) {
    internal.logArgs(arguments);
  }
}

function debug() {
  if (internal.DEBUG) {
    internal.logArgs(arguments);
  }
}
var trace = debug; // TODO: rename debug() calls

function absArcId(arcId) {
  return arcId >= 0 ? arcId : ~arcId;
}

api.enableLogging = function() {
  internal.LOGGING = true;
  return api;
};

api.printError = function(err) {
  var msg;
  if (utils.isString(err)) {
    err = new APIError(err);
  }
  if (internal.LOGGING && err.name == 'APIError') {
    msg = err.message;
    if (!/Error/.test(msg)) {
      msg = "Error: " + msg;
    }
    console.error(msg);
    message("Run mapshaper -h to view help");
  } else {
    throw err;
  }
};

internal.error = function() {
  var msg = Utils.toArray(arguments).join(' ');
  throw new Error(msg);
};

internal.stop = function() {
  throw new APIError(internal.formatLogArgs(arguments));
};

internal.message = function() {
  internal.logArgs(arguments);
};

internal.formatLogArgs = function(args) {
  return utils.toArray(args).join(' ');
};

// Format an array of (preferably short) strings in columns for console logging.
internal.formatStringsAsGrid = function(arr) {
  // TODO: variable column width
  var longest = arr.reduce(function(len, str) {
        return Math.max(len, str.length);
      }, 0),
      colWidth = longest + 2,
      perLine = Math.floor(80 / colWidth) || 1;
  return arr.reduce(function(memo, name, i) {
    var col = i % perLine;
    if (i > 0 && col === 0) memo += '\n';
    if (col < perLine - 1) { // right-pad all but rightmost column
      name = utils.rpad(name, colWidth - 2, ' ');
    }
    return memo +  '  ' + name;
  }, '');
};

internal.logArgs = function(args) {
  if (internal.LOGGING && !internal.QUIET && utils.isArrayLike(args)) {
    (console.error || console.log).call(console, internal.formatLogArgs(args));
  }
};

internal.getWorldBounds = function(e) {
  e = utils.isFiniteNumber(e) ? e : 1e-10;
  return [-180 + e, -90 + e, 180 - e, 90 - e];
};

internal.probablyDecimalDegreeBounds = function(b) {
  var world = internal.getWorldBounds(-1), // add a bit of excess
      bbox = (b instanceof Bounds) ? b.toArray() : b;
  return containsBounds(world, bbox);
};

internal.layerHasGeometry = function(lyr) {
  return internal.layerHasPaths(lyr) || internal.layerHasPoints(lyr);
};

internal.layerHasPaths = function(lyr) {
  return (lyr.geometry_type == 'polygon' || lyr.geometry_type == 'polyline') &&
    internal.layerHasNonNullShapes(lyr);
};

internal.layerHasPoints = function(lyr) {
  return lyr.geometry_type == 'point' && internal.layerHasNonNullShapes(lyr);
};

internal.layerHasNonNullShapes = function(lyr) {
  return utils.some(lyr.shapes || [], function(shp) {
    return !!shp;
  });
};

internal.requireDataFields = function(table, fields) {
  if (!table) {
    stop("Missing attribute data");
  }
  var dataFields = table.getFields(),
      missingFields = utils.difference(fields, dataFields);
  if (missingFields.length > 0) {
    stop("Table is missing one or more fields:\n",
        missingFields, "\nExisting fields:", '\n' + internal.formatStringsAsGrid(dataFields));
  }
};

internal.requirePolygonLayer = function(lyr, msg) {
  if (!lyr || lyr.geometry_type !== 'polygon') stop(msg || "Expected a polygon layer");
};

internal.requirePathLayer = function(lyr, msg) {
  if (!lyr || !internal.layerHasPaths(lyr)) stop(msg || "Expected a polygon or polyline layer");
};




var R = 6378137;
var D2R = Math.PI / 180;

// Equirectangular projection
function degreesToMeters(deg) {
  return deg * D2R * R;
}

function distance3D(ax, ay, az, bx, by, bz) {
  var dx = ax - bx,
    dy = ay - by,
    dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function distanceSq(ax, ay, bx, by) {
  var dx = ax - bx,
      dy = ay - by;
  return dx * dx + dy * dy;
}

function distance2D(ax, ay, bx, by) {
  var dx = ax - bx,
      dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceSq3D(ax, ay, az, bx, by, bz) {
  var dx = ax - bx,
      dy = ay - by,
      dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
}

// Return id of nearest point to x, y, among x0, y0, x1, y1, ...
function nearestPoint(x, y, x0, y0) {
  var minIdx = -1,
      minDist = Infinity,
      dist;
  for (var i = 0, j = 2, n = arguments.length; j < n; i++, j += 2) {
    dist = distanceSq(x, y, arguments[j], arguments[j+1]);
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }
  return minIdx;
}


// atan2() makes this function fairly slow, replaced by ~2x faster formula
function innerAngle2(ax, ay, bx, by, cx, cy) {
  var a1 = Math.atan2(ay - by, ax - bx),
      a2 = Math.atan2(cy - by, cx - bx),
      a3 = Math.abs(a1 - a2);
  if (a3 > Math.PI) {
    a3 = 2 * Math.PI - a3;
  }
  return a3;
}

// Return angle abc in range [0, 2PI) or NaN if angle is invalid
// (e.g. if length of ab or bc is 0)
/*
function signedAngle2(ax, ay, bx, by, cx, cy) {
  var a1 = Math.atan2(ay - by, ax - bx),
      a2 = Math.atan2(cy - by, cx - bx),
      a3 = a2 - a1;

  if (ax == bx && ay == by || bx == cx && by == cy) {
    a3 = NaN; // Use NaN for invalid angles
  } else if (a3 >= Math.PI * 2) {
    a3 = 2 * Math.PI - a3;
  } else if (a3 < 0) {
    a3 = a3 + 2 * Math.PI;
  }
  return a3;
}
*/

function standardAngle(a) {
  var twoPI = Math.PI * 2;
  while (a < 0) {
    a += twoPI;
  }
  while (a >= twoPI) {
    a -= twoPI;
  }
  return a;
}

function signedAngle(ax, ay, bx, by, cx, cy) {
  if (ax == bx && ay == by || bx == cx && by == cy) {
    return NaN; // Use NaN for invalid angles
  }
  var abx = ax - bx,
      aby = ay - by,
      cbx = cx - bx,
      cby = cy - by,
      dotp = abx * cbx + aby * cby,
      crossp = abx * cby - aby * cbx,
      a = Math.atan2(crossp, dotp);
  return standardAngle(a);
}

// Calc bearing in radians at lng1, lat1
function bearing(lng1, lat1, lng2, lat2) {
  var D2R = Math.PI / 180;
  lng1 *= D2R;
  lng2 *= D2R;
  lat1 *= D2R;
  lat2 *= D2R;
  var y = Math.sin(lng2-lng1) * Math.cos(lat2),
      x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(lng2-lng1);
  return Math.atan2(y, x);
}

// Calc angle of turn from ab to bc, in range [0, 2PI)
// Receive lat-lng values in degrees
function signedAngleSph(alng, alat, blng, blat, clng, clat) {
  if (alng == blng && alat == blat || blng == clng && blat == clat) {
    return NaN;
  }
  var b1 = bearing(blng, blat, alng, alat), // calc bearing at b
      b2 = bearing(blng, blat, clng, clat),
      a = Math.PI * 2 + b1 - b2;
  return standardAngle(a);
}

/*
// Convert arrays of lng and lat coords (xsrc, ysrc) into
// x, y, z coords (meters) on the most common spherical Earth model.
//
function convLngLatToSph(xsrc, ysrc, xbuf, ybuf, zbuf) {
  var deg2rad = Math.PI / 180,
      r = R;
  for (var i=0, len=xsrc.length; i<len; i++) {
    var lng = xsrc[i] * deg2rad,
        lat = ysrc[i] * deg2rad,
        cosLat = Math.cos(lat);
    xbuf[i] = Math.cos(lng) * cosLat * r;
    ybuf[i] = Math.sin(lng) * cosLat * r;
    zbuf[i] = Math.sin(lat) * r;
  }
}
*/

// Convert arrays of lng and lat coords (xsrc, ysrc) into
// x, y, z coords (meters) on the most common spherical Earth model.
//
function convLngLatToSph(xsrc, ysrc, xbuf, ybuf, zbuf) {
  var p = [];
  for (var i=0, len=xsrc.length; i<len; i++) {
    lngLatToXYZ(xsrc[i], ysrc[i], p);
    xbuf[i] = p[0];
    ybuf[i] = p[1];
    zbuf[i] = p[2];
  }
}

function xyzToLngLat(x, y, z, p) {
  var d = distance3D(0, 0, 0, x, y, z); // normalize
  var lat = Math.asin(z / d) / D2R;
  var lng = Math.atan2(y / d, x / d) / D2R;
  p[0] = lng;
  p[1] = lat;
}

function lngLatToXYZ(lng, lat, p) {
  var cosLat;
  lng *= D2R;
  lat *= D2R;
  cosLat = Math.cos(lat);
  p[0] = Math.cos(lng) * cosLat * R;
  p[1] = Math.sin(lng) * cosLat * R;
  p[2] = Math.sin(lat) * R;
}

// Haversine formula (well conditioned at small distances)
function sphericalDistance(lam1, phi1, lam2, phi2) {
  var dlam = lam2 - lam1,
      dphi = phi2 - phi1,
      a = Math.sin(dphi / 2) * Math.sin(dphi / 2) +
          Math.cos(phi1) * Math.cos(phi2) *
          Math.sin(dlam / 2) * Math.sin(dlam / 2),
      c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return c;
}

// Receive: coords in decimal degrees;
// Return: distance in meters on spherical earth
function greatCircleDistance(lng1, lat1, lng2, lat2) {
  var D2R = Math.PI / 180,
      dist = sphericalDistance(lng1 * D2R, lat1 * D2R, lng2 * D2R, lat2 * D2R);
  return dist * R;
}

// TODO: make this safe for small angles
function innerAngle(ax, ay, bx, by, cx, cy) {
  var ab = distance2D(ax, ay, bx, by),
      bc = distance2D(bx, by, cx, cy),
      theta, dotp;
  if (ab === 0 || bc === 0) {
    theta = 0;
  } else {
    dotp = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by)) / (ab * bc);
    if (dotp >= 1 - 1e-14) {
      theta = 0;
    } else if (dotp <= -1 + 1e-14) {
      theta = Math.PI;
    } else {
      theta = Math.acos(dotp); // consider using other formula at small dp
    }
  }
  return theta;
}

function innerAngle3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var ab = distance3D(ax, ay, az, bx, by, bz),
      bc = distance3D(bx, by, bz, cx, cy, cz),
      theta, dotp;
  if (ab === 0 || bc === 0) {
    theta = 0;
  } else {
    dotp = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by) + (az - bz) * (cz - bz)) / (ab * bc);
    if (dotp >= 1) {
      theta = 0;
    } else if (dotp <= -1) {
      theta = Math.PI;
    } else {
      theta = Math.acos(dotp); // consider using other formula at small dp
    }
  }
  return theta;
}

function triangleArea(ax, ay, bx, by, cx, cy) {
  var area = Math.abs(((ay - cy) * (bx - cx) + (by - cy) * (cx - ax)) / 2);
  return area;
}

function detSq(ax, ay, bx, by, cx, cy) {
  var det = ax * by - ax * cy + bx * cy - bx * ay + cx * ay - cx * by;
  return det * det;
}

function cosine(ax, ay, bx, by, cx, cy) {
  var den = distance2D(ax, ay, bx, by) * distance2D(bx, by, cx, cy),
      cos = 0;
  if (den > 0) {
    cos = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by)) / den;
    if (cos > 1) cos = 1; // handle fp rounding error
    else if (cos < -1) cos = -1;
  }
  return cos;
}

function cosine3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var den = distance3D(ax, ay, az, bx, by, bz) * distance3D(bx, by, bz, cx, cy, cz),
      cos = 0;
  if (den > 0) {
    cos = ((ax - bx) * (cx - bx) + (ay - by) * (cy - by) + (az - bz) * (cz - bz)) / den;
    if (cos > 1) cos = 1; // handle fp rounding error
    else if (cos < -1) cos = -1;
  }
  return cos;
}

function triangleArea3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var area = 0.5 * Math.sqrt(detSq(ax, ay, bx, by, cx, cy) +
    detSq(ax, az, bx, bz, cx, cz) + detSq(ay, az, by, bz, cy, cz));
  return area;
}

// Given point B and segment AC, return the squared distance from B to the
// nearest point on AC
// Receive the squared length of segments AB, BC, AC
//
function apexDistSq(ab2, bc2, ac2) {
  var dist2;
  if (ac2 === 0) {
    dist2 = ab2;
  } else if (ab2 >= bc2 + ac2) {
    dist2 = bc2;
  } else if (bc2 >= ab2 + ac2) {
    dist2 = ab2;
  } else {
    var dval = (ab2 + ac2 - bc2);
    dist2 = ab2 -  dval * dval / ac2  * 0.25;
  }
  if (dist2 < 0) {
    dist2 = 0;
  }
  return dist2;
}

function pointSegDistSq(ax, ay, bx, by, cx, cy) {
  var ab2 = distanceSq(ax, ay, bx, by),
      ac2 = distanceSq(ax, ay, cx, cy),
      bc2 = distanceSq(bx, by, cx, cy);
  return apexDistSq(ab2, ac2, bc2);
}

function pointSegDistSq3D(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var ab2 = distanceSq3D(ax, ay, az, bx, by, bz),
      ac2 = distanceSq3D(ax, ay, az, cx, cy, cz),
      bc2 = distanceSq3D(bx, by, bz, cx, cy, cz);
  return apexDistSq(ab2, ac2, bc2);
}

internal.calcArcBounds = function(xx, yy, start, len) {
  var i = start | 0,
      n = isNaN(len) ? xx.length - i : len + i,
      x, y, xmin, ymin, xmax, ymax;
  if (n > 0) {
    xmin = xmax = xx[i];
    ymin = ymax = yy[i];
  }
  for (i++; i<n; i++) {
    x = xx[i];
    y = yy[i];
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }
  return [xmin, ymin, xmax, ymax];
};

internal.reversePathCoords = function(arr, start, len) {
  var i = start,
      j = start + len - 1,
      tmp;
  while (i < j) {
    tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    i++;
    j--;
  }
};

// merge B into A
function mergeBounds(a, b) {
  if (b[0] < a[0]) a[0] = b[0];
  if (b[1] < a[1]) a[1] = b[1];
  if (b[2] > a[2]) a[2] = b[2];
  if (b[3] > a[3]) a[3] = b[3];
}

function containsBounds(a, b) {
  return a[0] <= b[0] && a[2] >= b[2] && a[1] <= b[1] && a[3] >= b[3];
}

function boundsArea(b) {
  return (b[2] - b[0]) * (b[3] - b[1]);
}

// export functions so they can be tested
var geom = {
  R: R,
  D2R: D2R,
  degreesToMeters: degreesToMeters,
  segmentHit: segmentHit,
  segmentIntersection: segmentIntersection,
  distanceSq: distanceSq,
  distance2D: distance2D,
  distance3D: distance3D,
  innerAngle: innerAngle,
  innerAngle2: innerAngle2,
  signedAngle: signedAngle,
  bearing: bearing,
  signedAngleSph: signedAngleSph,
  standardAngle: standardAngle,
  convLngLatToSph: convLngLatToSph,
  lngLatToXYZ: lngLatToXYZ,
  xyzToLngLat: xyzToLngLat,
  sphericalDistance: sphericalDistance,
  greatCircleDistance: greatCircleDistance,
  pointSegDistSq: pointSegDistSq,
  pointSegDistSq3D: pointSegDistSq3D,
  innerAngle3D: innerAngle3D,
  triangleArea: triangleArea,
  triangleArea3D: triangleArea3D,
  cosine: cosine,
  cosine3D: cosine3D
};



// Constructor takes arrays of coords: xx, yy, zz (optional)
//
// Iterate over the points of an arc
// properties: x, y
// method: hasNext()
// usage:
//   while (iter.hasNext()) {
//     iter.x, iter.y; // do something w/ x & y
//   }
//
function ArcIter(xx, yy) {
  this._i = 0;
  this._n = 0;
  this._inc = 1;
  this._xx = xx;
  this._yy = yy;
  this.i = 0;
  this.x = 0;
  this.y = 0;
}

ArcIter.prototype.init = function(i, len, fw) {
  if (fw) {
    this._i = i;
    this._inc = 1;
  } else {
    this._i = i + len - 1;
    this._inc = -1;
  }
  this._n = len;
  return this;
};

ArcIter.prototype.hasNext = function() {
  var i = this._i;
  if (this._n > 0) {
    this._i = i + this._inc;
    this.x = this._xx[i];
    this.y = this._yy[i];
    this.i = i;
    this._n--;
    return true;
  }
  return false;
};

function FilteredArcIter(xx, yy, zz) {
  var _zlim = 0,
      _i = 0,
      _inc = 1,
      _stop = 0;

  this.init = function(i, len, fw, zlim) {
    _zlim = zlim || 0;
    if (fw) {
      _i = i;
      _inc = 1;
      _stop = i + len;
    } else {
      _i = i + len - 1;
      _inc = -1;
      _stop = i - 1;
    }
    return this;
  };

  this.hasNext = function() {
    // using local vars is significantly faster when skipping many points
    var zarr = zz,
        i = _i,
        j = i,
        zlim = _zlim,
        stop = _stop,
        inc = _inc;
    if (i == stop) return false;
    do {
      j += inc;
    } while (j != stop && zarr[j] < zlim);
    _i = j;
    this.x = xx[i];
    this.y = yy[i];
    this.i = i;
    return true;
  };
}

// Iterate along a path made up of one or more arcs.
// Similar interface to ArcIter()
//
function ShapeIter(arcs) {
  this._arcs = arcs;
  this._i = 0;
  this._n = 0;
  this.x = 0;
  this.y = 0;
}

ShapeIter.prototype.hasNext = function() {
  var arc = this._arc;
  if (this._i < this._n === false) {
    return false;
  }
  if (arc.hasNext()) {
    this.x = arc.x;
    this.y = arc.y;
    return true;
  }
  this.nextArc();
  return this.hasNext();
};

ShapeIter.prototype.init = function(ids) {
  this._ids = ids;
  this._n = ids.length;
  this.reset();
  return this;
};

ShapeIter.prototype.nextArc = function() {
  var i = this._i + 1;
  if (i < this._n) {
    this._arc = this._arcs.getArcIter(this._ids[i]);
    if (i > 0) this._arc.hasNext(); // skip first point
  }
  this._i = i;
};

ShapeIter.prototype.reset = function() {
  this._i = -1;
  this.nextArc();
};




// An interface for managing a collection of paths.
// Constructor signatures:
//
// ArcCollection(arcs)
//    arcs is an array of polyline arcs; each arc is an array of points: [[x0, y0], [x1, y1], ... ]
//
// ArcCollection(nn, xx, yy)
//    nn is an array of arc lengths; xx, yy are arrays of concatenated coords;
function ArcCollection() {
  var _xx, _yy,  // coordinates data
      _ii, _nn,  // indexes, sizes
      _zz, _zlimit = 0, // simplification
      _bb, _allBounds, // bounding boxes
      _arcIter, _filteredArcIter; // path iterators

  if (arguments.length == 1) {
    initLegacyArcs(arguments[0]);  // want to phase this out
  } else if (arguments.length == 3) {
    initXYData.apply(this, arguments);
  } else {
    error("ArcCollection() Invalid arguments");
  }

  function initLegacyArcs(arcs) {
    var xx = [], yy = [];
    var nn = arcs.map(function(points) {
      var n = points ? points.length : 0;
      for (var i=0; i<n; i++) {
        xx.push(points[i][0]);
        yy.push(points[i][1]);
      }
      return n;
    });
    initXYData(nn, xx, yy);
  }

  function initXYData(nn, xx, yy) {
    var size = nn.length;
    if (nn instanceof Array) nn = new Uint32Array(nn);
    if (xx instanceof Array) xx = new Float64Array(xx);
    if (yy instanceof Array) yy = new Float64Array(yy);
    _xx = xx;
    _yy = yy;
    _nn = nn;
    _zz = null;
    _zlimit = 0;
    _filteredArcIter = null;

    // generate array of starting idxs of each arc
    _ii = new Uint32Array(size);
    for (var idx = 0, j=0; j<size; j++) {
      _ii[j] = idx;
      idx += nn[j];
    }

    if (idx != _xx.length || _xx.length != _yy.length) {
      error("ArcCollection#initXYData() Counting error");
    }

    initBounds();
    // Pre-allocate some path iterators for repeated use.
    _arcIter = new ArcIter(_xx, _yy);
    return this;
  }

  function initZData(zz) {
    if (!zz) {
      _zz = null;
      _zlimit = 0;
      _filteredArcIter = null;
    } else {
      if (zz.length != _xx.length) error("ArcCollection#initZData() mismatched arrays");
      if (zz instanceof Array) zz = new Float64Array(zz);
      _zz = zz;
      _filteredArcIter = new FilteredArcIter(_xx, _yy, _zz);
    }
  }

  function initBounds() {
    var data = calcArcBounds(_xx, _yy, _nn);
    _bb = data.bb;
    _allBounds = data.bounds;
  }

  function calcArcBounds(xx, yy, nn) {
    var numArcs = nn.length,
        bb = new Float64Array(numArcs * 4),
        bounds = new Bounds(),
        arcOffs = 0,
        arcLen,
        j, b;
    for (var i=0; i<numArcs; i++) {
      arcLen = nn[i];
      if (arcLen > 0) {
        j = i * 4;
        b = internal.calcArcBounds(xx, yy, arcOffs, arcLen);
        bb[j++] = b[0];
        bb[j++] = b[1];
        bb[j++] = b[2];
        bb[j] = b[3];
        arcOffs += arcLen;
        bounds.mergeBounds(b);
      }
    }
    return {
      bb: bb,
      bounds: bounds
    };
  }

  this.updateVertexData = function(nn, xx, yy, zz) {
    initXYData(nn, xx, yy);
    initZData(zz || null);
  };

  // Give access to raw data arrays...
  this.getVertexData = function() {
    return {
      xx: _xx,
      yy: _yy,
      zz: _zz,
      bb: _bb,
      nn: _nn,
      ii: _ii
    };
  };

  this.getCopy = function() {
    var copy = new ArcCollection(new Int32Array(_nn), new Float64Array(_xx),
        new Float64Array(_yy));
    if (_zz) {
      copy.setThresholds(new Float64Array(_zz));
      copy.setRetainedInterval(_zlimit);
    }
    return copy;
  };

  function getFilteredPointCount() {
    var zz = _zz, z = _zlimit;
    if (!zz || !z) return this.getPointCount();
    var count = 0;
    for (var i=0, n = zz.length; i<n; i++) {
      if (zz[i] >= z) count++;
    }
    return count;
  }

  function getFilteredVertexData() {
    var len2 = getFilteredPointCount();
    var arcCount = _nn.length;
    var xx2 = new Float64Array(len2),
        yy2 = new Float64Array(len2),
        zz2 = new Float64Array(len2),
        nn2 = new Int32Array(arcCount),
        i=0, i2 = 0,
        n, n2;

    for (var arcId=0; arcId < arcCount; arcId++) {
      n2 = 0;
      n = _nn[arcId];
      for (var end = i+n; i < end; i++) {
        if (_zz[i] >= _zlimit) {
          xx2[i2] = _xx[i];
          yy2[i2] = _yy[i];
          zz2[i2] = _zz[i];
          i2++;
          n2++;
        }
      }
      if (n2 < 2) error("Collapsed arc"); // endpoints should be z == Infinity
      nn2[arcId] = n2;
    }
    return {
      xx: xx2,
      yy: yy2,
      zz: zz2,
      nn: nn2
    };
  }

  this.getFilteredCopy = function() {
    if (!_zz || _zlimit === 0) return this.getCopy();
    var data = getFilteredVertexData();
    var copy = new ArcCollection(data.nn, data.xx, data.yy);
    copy.setThresholds(data.zz);
    return copy;
  };

  // Return arcs as arrays of [x, y] points (intended for testing).
  this.toArray = function() {
    var arr = [];
    this.forEach(function(iter) {
      var arc = [];
      while (iter.hasNext()) {
        arc.push([iter.x, iter.y]);
      }
      arr.push(arc);
    });
    return arr;
  };

  this.toJSON = function() {
    return this.toArray();
  };

  // @cb function(i, j, xx, yy)
  this.forEachArcSegment = function(arcId, cb) {
    var fw = arcId >= 0,
        absId = fw ? arcId : ~arcId,
        zlim = this.getRetainedInterval(),
        n = _nn[absId],
        step = fw ? 1 : -1,
        v1 = fw ? _ii[absId] : _ii[absId] + n - 1,
        v2 = v1,
        count = 0;

    for (var j = 1; j < n; j++) {
      v2 += step;
      if (zlim === 0 || _zz[v2] >= zlim) {
        cb(v1, v2, _xx, _yy);
        v1 = v2;
        count++;
      }
    }
    return count;
  };

  // @cb function(i, j, xx, yy)
  this.forEachSegment = function(cb) {
    var count = 0;
    for (var i=0, n=this.size(); i<n; i++) {
      count += this.forEachArcSegment(i, cb);
    }
    return count;
  };

  this.transformPoints = function(f) {
    var xx = _xx, yy = _yy, arcId = -1, n = 0, p;
    for (var i=0, len=xx.length; i<len; i++, n--) {
      while (n === 0) {
        n = _nn[++arcId];
      }
      p = f(xx[i], yy[i], arcId);
      if (p) {
        xx[i] = p[0];
        yy[i] = p[1];
      }
    }
    initBounds();
  };

  // Return an ArcIter object for each path in the dataset
  //
  this.forEach = function(cb) {
    for (var i=0, n=this.size(); i<n; i++) {
      cb(this.getArcIter(i), i);
    }
  };

  // Iterate over arcs with access to low-level data
  //
  this.forEach2 = function(cb) {
    for (var arcId=0, n=this.size(); arcId<n; arcId++) {
      cb(_ii[arcId], _nn[arcId], _xx, _yy, _zz, arcId);
    }
  };

  this.forEach3 = function(cb) {
    var start, end, xx, yy, zz;
    for (var arcId=0, n=this.size(); arcId<n; arcId++) {
      start = _ii[arcId];
      end = start + _nn[arcId];
      xx = _xx.subarray(start, end);
      yy = _yy.subarray(start, end);
      if (_zz) zz = _zz.subarray(start, end);
      cb(xx, yy, zz, arcId);
    }
  };

  // Remove arcs that don't pass a filter test and re-index arcs
  // Return array mapping original arc ids to re-indexed ids. If arr[n] == -1
  // then arc n was removed. arr[n] == m indicates that the arc at n was
  // moved to index m.
  // Return null if no arcs were re-indexed (and no arcs were removed)
  //
  this.filter = function(cb) {
    var map = new Int32Array(this.size()),
        goodArcs = 0,
        goodPoints = 0;
    for (var i=0, n=this.size(); i<n; i++) {
      if (cb(this.getArcIter(i), i)) {
        map[i] = goodArcs++;
        goodPoints += _nn[i];
      } else {
        map[i] = -1;
      }
    }
    if (goodArcs === this.size()) {
      return null;
    } else {
      condenseArcs(map);
      if (goodArcs === 0) {
        // no remaining arcs
      }
      return map;
    }
  };

  function condenseArcs(map) {
    var goodPoints = 0,
        goodArcs = 0,
        copyElements = utils.copyElements,
        k, arcLen;
    for (var i=0, n=map.length; i<n; i++) {
      k = map[i];
      arcLen = _nn[i];
      if (k > -1) {
        copyElements(_xx, _ii[i], _xx, goodPoints, arcLen);
        copyElements(_yy, _ii[i], _yy, goodPoints, arcLen);
        if (_zz) copyElements(_zz, _ii[i], _zz, goodPoints, arcLen);
        _nn[k] = arcLen;
        goodPoints += arcLen;
        goodArcs++;
      }
    }

    initXYData(_nn.subarray(0, goodArcs), _xx.subarray(0, goodPoints),
        _yy.subarray(0, goodPoints));
    if (_zz) initZData(_zz.subarray(0, goodPoints));
  }

  this.dedupCoords = function() {
    var arcId = 0, i = 0, i2 = 0,
        arcCount = this.size(),
        zz = _zz,
        arcLen, arcLen2;
    while (arcId < arcCount) {
      arcLen = _nn[arcId];
      arcLen2 = internal.dedupArcCoords(i, i2, arcLen, _xx, _yy, zz);
      _nn[arcId] = arcLen2;
      i += arcLen;
      i2 += arcLen2;
      arcId++;
    }
    if (i > i2) {
      initXYData(_nn, _xx.subarray(0, i2), _yy.subarray(0, i2));
      if (zz) initZData(zz.subarray(0, i2));
    }
    return i - i2;
  };

  this.getVertex = function(arcId, nth) {
    var i = this.indexOfVertex(arcId, nth);
    return {
      x: _xx[i],
      y: _yy[i]
    };
  };

  this.indexOfVertex = function(arcId, nth) {
    var absId = arcId < 0 ? ~arcId : arcId,
        len = _nn[absId];
    if (nth < 0) nth = len + nth;
    if (absId != arcId) nth = len - nth - 1;
    if (nth < 0 || nth >= len) error("[ArcCollection] out-of-range vertex id");
    return _ii[absId] + nth;
  };

  // Test whether the vertex at index @idx is the endpoint of an arc
  this.pointIsEndpoint = function(idx) {
    var ii = _ii,
        nn = _nn;
    for (var j=0, n=ii.length; j<n; j++) {
      if (idx === ii[j] || idx === ii[j] + nn[j] - 1) return true;
    }
    return false;
  };

  // Tests if arc endpoints have same x, y coords
  // (arc may still have collapsed);
  this.arcIsClosed = function(arcId) {
    var i = this.indexOfVertex(arcId, 0),
        j = this.indexOfVertex(arcId, -1);
    return i != j && _xx[i] == _xx[j] && _yy[i] == _yy[j];
  };

  // Tests if first and last segments mirror each other
  // A 3-vertex arc with same endpoints tests true
  this.arcIsLollipop = function(arcId) {
    var len = this.getArcLength(arcId),
        i, j;
    if (len <= 2 || !this.arcIsClosed(arcId)) return false;
    i = this.indexOfVertex(arcId, 1);
    j = this.indexOfVertex(arcId, -2);
    return _xx[i] == _xx[j] && _yy[i] == _yy[j];
  };

  this.arcIsDegenerate = function(arcId) {
    var iter = this.getArcIter(arcId);
    var i = 0,
        x, y;
    while (iter.hasNext()) {
      if (i > 0) {
        if (x != iter.x || y != iter.y) return false;
      }
      x = iter.x;
      y = iter.y;
      i++;
    }
    return true;
  };

  this.getArcLength = function(arcId) {
    return _nn[absArcId(arcId)];
  };

  this.getArcIter = function(arcId) {
    var fw = arcId >= 0,
        i = fw ? arcId : ~arcId,
        iter = _zz && _zlimit ? _filteredArcIter : _arcIter;
    if (i >= _nn.length) {
      error("#getArcId() out-of-range arc id:", arcId);
    }
    return iter.init(_ii[i], _nn[i], fw, _zlimit);
  };

  this.getShapeIter = function(ids) {
    return new ShapeIter(this).init(ids);
  };

  // Add simplification data to the dataset
  // @thresholds is either a single typed array or an array of arrays of removal thresholds for each arc;
  //
  this.setThresholds = function(thresholds) {
    var n = this.getPointCount(),
        zz = null;
    if (!thresholds) {
      // nop
    } else if (thresholds.length == n) {
      zz = thresholds;
    } else if (thresholds.length == this.size()) {
      zz = flattenThresholds(thresholds, n);
    } else {
      error("Invalid threshold data");
    }
    initZData(zz);
    return this;
  };

  function flattenThresholds(arr, n) {
    var zz = new Float64Array(n),
        i = 0;
    arr.forEach(function(arr) {
      for (var j=0, n=arr.length; j<n; i++, j++) {
        zz[i] = arr[j];
      }
    });
    if (i != n) error("Mismatched thresholds");
    return zz;
  }

  // bake in current simplification level, if any
  this.flatten = function() {
    if (_zlimit > 0) {
      var data = getFilteredVertexData();
      this.updateVertexData(data.nn, data.xx, data.yy);
      _zlimit = 0;
    } else {
      _zz = null;
    }
  };

  this.getRetainedInterval = function() {
    return _zlimit;
  };

  this.setRetainedInterval = function(z) {
    _zlimit = z;
    return this;
  };

  this.getRetainedPct = function() {
    return this.getPctByThreshold(_zlimit);
  };

  this.setRetainedPct = function(pct) {
    if (pct >= 1) {
      _zlimit = 0;
    } else {
      _zlimit = this.getThresholdByPct(pct);
      _zlimit = internal.clampIntervalByPct(_zlimit, pct);
    }
    return this;
  };

  // Return array of z-values that can be removed for simplification
  //
  this.getRemovableThresholds = function(nth) {
    if (!_zz) error("[arcs] Missing simplification data.");
    var skip = nth | 1,
        arr = new Float64Array(Math.ceil(_zz.length / skip)),
        z;
    for (var i=0, j=0, n=this.getPointCount(); i<n; i+=skip) {
      z = _zz[i];
      if (z != Infinity) {
        arr[j++] = z;
      }
    }
    return arr.subarray(0, j);
  };

  this.getArcThresholds = function(arcId) {
    if (!(arcId >= 0 && arcId < this.size())) {
      error("[arcs] Invalid arc id:", arcId);
    }
    var start = _ii[arcId],
        end = start + _nn[arcId];
    return _zz.subarray(start, end);
  };

  this.getPctByThreshold = function(val) {
    var arr, rank, pct;
    if (val > 0) {
      arr = this.getRemovableThresholds();
      rank = utils.findRankByValue(arr, val);
      pct = arr.length > 0 ? 1 - (rank - 1) / arr.length : 1;
    } else {
      pct = 1;
    }
    return pct;
  };

  this.getThresholdByPct = function(pct) {
    var tmp = this.getRemovableThresholds(),
        rank, z;
    if (tmp.length === 0) { // No removable points
      rank = 0;
    } else {
      rank = Math.floor((1 - pct) * (tmp.length + 2));
    }

    if (rank <= 0) {
      z = 0;
    } else if (rank > tmp.length) {
      z = Infinity;
    } else {
      z = utils.findValueByRank(tmp, rank);
    }
    return z;
  };

  this.arcIntersectsBBox = function(i, b1) {
    var b2 = _bb,
        j = i * 4;
    return b2[j] <= b1[2] && b2[j+2] >= b1[0] && b2[j+3] >= b1[1] && b2[j+1] <= b1[3];
  };

  this.arcIsContained = function(i, b1) {
    var b2 = _bb,
        j = i * 4;
    return b2[j] >= b1[0] && b2[j+2] <= b1[2] && b2[j+1] >= b1[1] && b2[j+3] <= b1[3];
  };

  this.arcIsSmaller = function(i, units) {
    var bb = _bb,
        j = i * 4;
    return bb[j+2] - bb[j] < units && bb[j+3] - bb[j+1] < units;
  };

  // TODO: allow datasets in lat-lng coord range to be flagged as planar
  this.isPlanar = function() {
    return !internal.probablyDecimalDegreeBounds(this.getBounds());
  };

  this.size = function() {
    return _ii && _ii.length || 0;
  };

  this.getPointCount = function() {
    return _xx && _xx.length || 0;
  };

  this.getBounds = function() {
    return _allBounds.clone();
  };

  this.getSimpleShapeBounds = function(arcIds, bounds) {
    bounds = bounds || new Bounds();
    for (var i=0, n=arcIds.length; i<n; i++) {
      this.mergeArcBounds(arcIds[i], bounds);
    }
    return bounds;
  };

  this.getSimpleShapeBounds2 = function(arcIds, arr) {
    var bbox = arr || [],
        bb = _bb,
        id = absArcId(arcIds[0]) * 4;
    bbox[0] = bb[id];
    bbox[1] = bb[++id];
    bbox[2] = bb[++id];
    bbox[3] = bb[++id];
    for (var i=1, n=arcIds.length; i<n; i++) {
      id = absArcId(arcIds[i]) * 4;
      if (bb[id] < bbox[0]) bbox[0] = bb[id];
      if (bb[++id] < bbox[1]) bbox[1] = bb[id];
      if (bb[++id] > bbox[2]) bbox[2] = bb[id];
      if (bb[++id] > bbox[3]) bbox[3] = bb[id];
    }
    return bbox;
  };

  this.getMultiShapeBounds = function(shapeIds, bounds) {
    bounds = bounds || new Bounds();
    if (shapeIds) { // handle null shapes
      for (var i=0, n=shapeIds.length; i<n; i++) {
        this.getSimpleShapeBounds(shapeIds[i], bounds);
      }
    }
    return bounds;
  };

  this.mergeArcBounds = function(arcId, bounds) {
    if (arcId < 0) arcId = ~arcId;
    var offs = arcId * 4;
    bounds.mergeBounds(_bb[offs], _bb[offs+1], _bb[offs+2], _bb[offs+3]);
  };
}

ArcCollection.prototype.inspect = function() {
  var n = this.getPointCount(), str;
  if (n < 50) {
    str = JSON.stringify(this.toArray());
  } else {
    str = '[ArcCollection (' + this.size() + ')]';
  }
  return str;
};

// Remove duplicate coords and NaNs
internal.dedupArcCoords = function(src, dest, arcLen, xx, yy, zz) {
  var n = 0, n2 = 0; // counters
  var x, y, i, j, keep;
  while (n < arcLen) {
    j = src + n;
    x = xx[j];
    y = yy[j];
    keep = x == x && y == y && (n2 === 0 || x != xx[j-1] || y != yy[j-1]);
    if (keep) {
      i = dest + n2;
      xx[i] = x;
      yy[i] = y;
      n2++;
    }
    if (zz && n2 > 0 && (keep || zz[j] > zz[i])) {
      zz[i] = zz[j];
    }
    n++;
  }
  return n2 > 1 ? n2 : 0;
};




internal.countPointsInLayer = function(lyr) {
  var count = 0;
  if (internal.layerHasPoints(lyr)) {
    internal.forEachPoint(lyr.shapes, function() {count++;});
  }
  return count;
};

internal.getPointBounds = function(shapes) {
  var bounds = new Bounds();
  internal.forEachPoint(shapes, function(p) {
    bounds.mergePoint(p[0], p[1]);
  });
  return bounds;
};

internal.forEachPoint = function(shapes, cb) {
  shapes.forEach(function(shape, id) {
    var n = shape ? shape.length : 0;
    for (var i=0; i<n; i++) {
      cb(shape[i], id);
    }
  });
};

internal.transformPointsInLayer = function(lyr, f) {
  if (internal.layerHasPoints(lyr)) {
    internal.forEachPoint(lyr.shapes, function(p) {
      var p2 = f(p[0], p[1]);
      p[0] = p2[0];
      p[1] = p2[1];
    });
  }
};




// Utility functions for working with ArcCollection and arrays of arc ids.


// Return average segment length (with simplification)
internal.getAvgSegment = function(arcs) {
  var sum = 0;
  var count = arcs.forEachSegment(function(i, j, xx, yy) {
    var dx = xx[i] - xx[j],
        dy = yy[i] - yy[j];
    sum += Math.sqrt(dx * dx + dy * dy);
  });
  return sum / count || 0;
};

// Return average magnitudes of dx, dy (with simplification)
internal.getAvgSegment2 = function(arcs) {
  var dx = 0, dy = 0;
  var count = arcs.forEachSegment(function(i, j, xx, yy) {
    dx += Math.abs(xx[i] - xx[j]);
    dy += Math.abs(yy[i] - yy[j]);
  });
  return [dx / count || 0, dy / count || 0];
};


// Return average magnitudes of dx, dy (with simplification)
/*
this.getAvgSegmentSph2 = function() {
  var sumx = 0, sumy = 0;
  var count = this.forEachSegment(function(i, j, xx, yy) {
    var lat1 = yy[i],
        lat2 = yy[j];
    sumy += geom.degreesToMeters(Math.abs(lat1 - lat2));
    sumx += geom.degreesToMeters(Math.abs(xx[i] - xx[j]) *
        Math.cos((lat1 + lat2) * 0.5 * geom.D2R);
  });
  return [sumx / count || 0, sumy / count || 0];
};
*/


// @counts A typed array for accumulating count of each abs arc id
//   (assume it won't overflow)
internal.countArcsInShapes = function(shapes, counts) {
  internal.traversePaths(shapes, null, function(obj) {
    var arcs = obj.arcs,
        id;
    for (var i=0; i<arcs.length; i++) {
      id = arcs[i];
      if (id < 0) id = ~id;
      counts[id]++;
    }
  });
};

// Returns subset of shapes in @shapes that contain one or more arcs in @arcIds
internal.findShapesByArcId = function(shapes, arcIds, numArcs) {
  var index = numArcs ? new Uint8Array(numArcs) : [],
      found = [];
  arcIds.forEach(function(id) {
    index[absArcId(id)] = 1;
  });
  shapes.forEach(function(shp, shpId) {
    var isHit = false;
    internal.forEachArcId(shp || [], function(id) {
      isHit = isHit || index[absArcId(id)] == 1;
    });
    if (isHit) {
      found.push(shpId);
    }
  });
  return found;
};

// @shp An element of the layer.shapes array
//   (may be null, or, depending on layer type, an array of points or an array of arrays of arc ids)
internal.cloneShape = function(shp) {
  if (!shp) return null;
  return shp.map(function(part) {
    return part.concat();
  });
};

internal.cloneShapes = function(arr) {
  return utils.isArray(arr) ? arr.map(internal.cloneShape) : null;
};

// a and b are arrays of arc ids
internal.pathsAreIdentical = function(a, b) {
  if (a.length != b.length) return false;
  for (var i=0, n=a.length; i<n; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
};

internal.reversePath = function(ids) {
  ids.reverse();
  for (var i=0, n=ids.length; i<n; i++) {
    ids[i] = ~ids[i];
  }
};

internal.clampIntervalByPct = function(z, pct) {
  if (pct <= 0) z = Infinity;
  else if (pct >= 1) z = 0;
  return z;
};

internal.findNextRemovableVertices = function(zz, zlim, start, end) {
  var i = internal.findNextRemovableVertex(zz, zlim, start, end),
      arr, k;
  if (i > -1) {
    k = zz[i];
    arr = [i];
    while (++i < end) {
      if (zz[i] == k) {
        arr.push(i);
      }
    }
  }
  return arr || null;
};

// Return id of the vertex between @start and @end with the highest
// threshold that is less than @zlim, or -1 if none
//
internal.findNextRemovableVertex = function(zz, zlim, start, end) {
  var tmp, jz = 0, j = -1, z;
  if (start > end) {
    tmp = start;
    start = end;
    end = tmp;
  }
  for (var i=start+1; i<end; i++) {
    z = zz[i];
    if (z < zlim && z > jz) {
      j = i;
      jz = z;
    }
  }
  return j;
};

// Visit each arc id in a path, shape or array of shapes
// Use non-undefined return values of callback @cb as replacements.
internal.forEachArcId = function(arr, cb) {
  var item;
  for (var i=0; i<arr.length; i++) {
    item = arr[i];
    if (item instanceof Array) {
      internal.forEachArcId(item, cb);
    } else if (utils.isInteger(item)) {
      var val = cb(item);
      if (val !== void 0) {
        arr[i] = val;
      }
    } else if (item) {
      error("Non-integer arc id in:", arr);
    }
  }
};

internal.forEachPath = function(paths, cb) {
  internal.editPaths(paths, cb);
};

internal.editShapes = function(shapes, editPath) {
  for (var i=0, n=shapes.length; i<n; i++) {
    shapes[i] = internal.editPaths(shapes[i], editPath);
  }
};

// @paths: geometry of a feature (array of paths or null)
// @cb: function(path, i, paths)
//    If @cb returns an array, it replaces the existing value
//    If @cb returns null, the path is removed from the feature
//
internal.editPaths = function(paths, cb) {
  if (!paths) return null; // null shape
  if (!utils.isArray(paths)) error("[editPaths()] Expected an array, found:", arr);
  var nulls = 0,
      n = paths.length,
      retn;

  for (var i=0; i<n; i++) {
    retn = cb(paths[i], i, paths);
    if (retn === null) {
      nulls++;
      paths[i] = null;
    } else if (utils.isArray(retn)) {
      paths[i] = retn;
    }
  }
  if (nulls == n) {
    return null;
  } else if (nulls > 0) {
    return paths.filter(function(ids) {return !!ids;});
  } else {
    return paths;
  }
};

internal.forEachPathSegment = function(shape, arcs, cb) {
  internal.forEachArcId(shape, function(arcId) {
    arcs.forEachArcSegment(arcId, cb);
  });
};

internal.traversePaths = function traversePaths(shapes, cbArc, cbPart, cbShape) {
  var segId = 0;
  shapes.forEach(function(parts, shapeId) {
    if (!parts || parts.length === 0) return; // null shape
    var arcIds, arcId;
    if (cbShape) {
      cbShape(shapeId);
    }
    for (var i=0, m=parts.length; i<m; i++) {
      arcIds = parts[i];
      if (cbPart) {
        cbPart({
          i: i,
          shapeId: shapeId,
          shape: parts,
          arcs: arcIds
        });
      }

      if (cbArc) {
        for (var j=0, n=arcIds.length; j<n; j++, segId++) {
          arcId = arcIds[j];
          cbArc({
            i: j,
            shapeId: shapeId,
            partId: i,
            arcId: arcId,
            segId: segId
          });
        }
      }
    }
  });
};

internal.arcHasLength = function(id, coords) {
  var iter = coords.getArcIter(id), x, y;
  if (iter.hasNext()) {
    x = iter.x;
    y = iter.y;
    while (iter.hasNext()) {
      if (iter.x != x || iter.y != y) return true;
    }
  }
  return false;
};

internal.filterEmptyArcs = function(shape, coords) {
  if (!shape) return null;
  var shape2 = [];
  shape.forEach(function(ids) {
    var path = [];
    for (var i=0; i<ids.length; i++) {
      if (internal.arcHasLength(ids[i], coords)) {
        path.push(ids[i]);
      }
    }
    if (path.length > 0) shape2.push(path);
  });
  return shape2.length > 0 ? shape2 : null;
};

// Bundle holes with their containing rings for Topo/GeoJSON polygon export.
// Assumes outer rings are CW and inner (hole) rings are CCW.
// @paths array of objects with path metadata -- see internal.exportPathData()
//
// TODO: Improve reliability. Currently uses winding order, area and bbox to
//   identify holes and their enclosures -- could be confused by strange
//   geometry.
//
internal.groupPolygonRings = function(paths) {
  var pos = [],
      neg = [];
  if (paths) {
    paths.forEach(function(path) {
      if (path.area > 0) {
        pos.push(path);
      } else if (path.area < 0) {
        neg.push(path);
      } else {
        // verbose("Zero-area ring, skipping");
      }
    });
  }

  var output = pos.map(function(part) {
    return [part];
  });

  neg.forEach(function(hole) {
    var containerId = -1,
        containerArea = 0;
    for (var i=0, n=pos.length; i<n; i++) {
      var part = pos[i],
          contained = part.bounds.contains(hole.bounds) && part.area > -hole.area;
      if (contained && (containerArea === 0 || part.area < containerArea)) {
        containerArea = part.area;
        containerId = i;
      }
    }
    if (containerId == -1) {
      verbose("[groupPolygonRings()] polygon hole is missing a containing ring, dropping.");
    } else {
      output[containerId].push(hole);
    }
  });
  return output;
};

internal.getPathMetadata = function(shape, arcs, type) {
  var data = [],
      ids;
  for (var i=0, n=shape && shape.length; i<n; i++) {
    ids = shape[i];
    data.push({
      ids: ids,
      area: type == 'polygon' ? geom.getPlanarPathArea(ids, arcs) : 0,
      bounds: arcs.getSimpleShapeBounds(ids)
    });
  }
  return data;
};

internal.quantizeArcs = function(arcs, quanta) {
  // Snap coordinates to a grid of @quanta locations on both axes
  // This may snap nearby points to the same coordinates.
  // Consider a cleanup pass to remove dupes, make sure collapsed arcs are
  //   removed on export.
  //
  var bb1 = arcs.getBounds(),
      bb2 = new Bounds(0, 0, quanta-1, quanta-1),
      fw = bb1.getTransform(bb2),
      inv = fw.invert();

  arcs.transformPoints(function(x, y) {
    var p = fw.transform(x, y);
    return inv.transform(Math.round(p[0]), Math.round(p[1]));
  });
};




// Apply rotation, scale and/or shift to some or all of the features in a dataset
//
api.affine = function(targetLayers, dataset, opts) {
  // Need to separate the targeted shapes from any other shapes that share
  // the same topology. So we duplicate any arcs that are shared by the targeted
  // shapes and their topological neighbors and remap arc references in the
  // neighbors to point to the copies.
  // TODO: explore alternative: if some arcs are shared between transformed and
  //   non-transformed shapes, first remove topology, then tranform, then rebuild topology
  //
  var arcs = dataset.arcs;
  var targetShapes = [];
  var otherShapes = [];
  var targetPoints = [];
  var targetFlags, otherFlags, transform, transformOpts;
  dataset.layers.filter(internal.layerHasGeometry).forEach(function(lyr) {
    var hits = [],
        misses = [],
        test;
    if (targetLayers.indexOf(lyr) == -1) {
      misses = lyr.shapes;
    } else if (opts.where) {
      test = internal.compileValueExpression(opts.where, lyr, dataset.arcs);
      lyr.shapes.forEach(function(shp, i) {
        (test(i) ? hits : misses).push(shp);
      });
    } else {
      hits = lyr.shapes;
    }
    if (lyr.geometry_type == 'point') {
      targetPoints = targetPoints.concat(hits);
    } else {
      targetShapes = targetShapes.concat(hits);
      otherShapes = otherShapes.concat(misses);
    }
  });
  opts = internal.getAffineOpts({arcs: dataset.arcs, layers: [{
    geometry_type: 'point', shapes: targetPoints}, {geometry_type: 'polyline',
    shapes: targetShapes}]}, opts);
  transform = internal.getAffineTransform(opts.rotate, opts.scale, opts.shift, opts.anchor);
  if (targetShapes.length > 0) {
    targetFlags = new Uint8Array(arcs.size());
    otherFlags = new Uint8Array(arcs.size());
    internal.countArcsInShapes(targetShapes, targetFlags);
    if (otherShapes.length > 0) {
      internal.countArcsInShapes(otherShapes, otherFlags);
      internal.applyArrayMask(otherFlags, targetFlags);
      dataset.arcs = internal.duplicateSelectedArcs(otherShapes, arcs, otherFlags);
    }
    dataset.arcs.transformPoints(function(x, y, arcId) {
      if (arcId < targetFlags.length && targetFlags[arcId] > 0) {
        return transform(x, y);
      }
    });
  }
  internal.forEachPoint(targetPoints, function(p) {
    var p2 = transform(p[0], p[1]);
    p[0] = p2[0];
    p[1] = p2[1];
  });
};

internal.getAffineOpts = function(dataset, opts) {
  var o = {
    shift: opts.shift || [0, 0],
    rotate: opts.rotate || 0,
    scale: opts.scale || 1
  };
  var bounds;
  if (opts.anchor) {
    o.anchor = opts.anchor;
  } else {
    // get bounds of selected shapes to calculate center of rotation/scale
    bounds = internal.getDatasetBounds(dataset);
    o.anchor = [bounds.centerX(), bounds.centerY()];
  }
  return o;
};

// TODO: handle problems with unprojected datasets
//   option 1: don't allow affine transformation of unprojected data
//   option 2: error if transformed data exceeds valid coordinate range
// source: http://mathworld.wolfram.com/AffineTransformation.html
internal.getAffineTransform = function(rotation, scale, shift, anchor) {
  var angle = rotation * Math.PI / 180;
  var a = scale * Math.cos(angle);
  var b = -scale * Math.sin(angle);
  return function(x, y) {
    var x2 = a * (x - anchor[0]) - b * (y - anchor[1]) + shift[0] + anchor[0];
    var y2 = b * (x - anchor[0]) + a * (y - anchor[1]) + shift[1] + anchor[1];
    return [x2, y2];
  };
};

internal.applyArrayMask = function(destArr, maskArr) {
  for (var i=0, n=destArr.length; i<n; i++) {
    if (maskArr[i] === 0) destArr[i] = 0;
  }
};

internal.duplicateSelectedArcs = function(shapes, arcs, flags) {
  var arcCount = 0;
  var vertexCount = 0;
  var data = arcs.getVertexData();
  var xx = [], yy = [], nn = [], map = [], n;
  for (var i=0, len=flags.length; i<len; i++) {
    if (flags[i] > 0) {
      map[i] = arcs.size() + arcCount;
      n = data.nn[i];
      utils.copyElements(data.xx, data.ii[i], xx, vertexCount, n);
      utils.copyElements(data.yy, data.ii[i], yy, vertexCount, n);
      nn.push(n);
      vertexCount += n;
      arcCount++;
    }
  }
  internal.forEachArcId(shapes, function(id) {
    var absId = absArcId(id);
    if (flags[absId] > 0) {
      return id < 0 ? ~map[absId] : map[absId];
    }
  });
  return internal.mergeArcs([arcs, new ArcCollection(nn, xx, yy)]);
};




// utility functions for datasets and layers

// Divide a collection of features with mixed types into layers of a single type
// (Used for importing TopoJSON and GeoJSON features)
internal.divideFeaturesByType = function(shapes, properties, types) {
  var typeSet = utils.uniq(types);
  var layers = typeSet.map(function(geoType) {
    var p = [],
        s = [],
        dataNulls = 0,
        rec;
    for (var i=0, n=shapes.length; i<n; i++) {
      if (types[i] != geoType) continue;
      if (geoType) s.push(shapes[i]);
      rec = properties[i];
      p.push(rec);
      if (!rec) dataNulls++;
    }
    return {
      geometry_type: geoType,
      shapes: s,
      data: dataNulls < s.length ? new DataTable(p) : null
    };
  });
  return layers;
};

// Split into datasets with one layer each
internal.splitDataset = function(dataset) {
  return dataset.layers.map(function(lyr) {
    var split = {
      arcs: dataset.arcs,
      layers: [lyr],
      info: dataset.info
    };
    internal.dissolveArcs(split); // replace arcs with filtered + dissolved copy
    return split;
  });
};

// clone all layers, make a filtered copy of arcs
internal.copyDataset = function(dataset) {
  var d2 = utils.extend({}, dataset);
  d2.layers = d2.layers.map(internal.copyLayer);
  if (d2.arcs) {
    d2.arcs = d2.arcs.getFilteredCopy();
  }
  return d2;
};

// clone coordinate data, shallow-copy attribute data
internal.copyDatasetForExport = function(dataset) {
  var d2 = utils.extend({}, dataset);
  d2.layers = d2.layers.map(internal.copyLayerShapes);
  if (d2.arcs) {
    d2.arcs = d2.arcs.getFilteredCopy();
  }
  return d2;
};

// shallow-copy layers, so they can be renamed (for export)
internal.copyDatasetForRenaming = function(dataset) {
  return utils.defaults({
    layers: dataset.layers.map(function(lyr) {return utils.extend({}, lyr);})
  }, dataset);
};

// make a stub copy if the no_replace option is given, else pass thru src layer
internal.getOutputLayer = function(src, opts) {
  return opts && opts.no_replace ? {geometry_type: src.geometry_type} : src;
};

// Make a deep copy of a layer
internal.copyLayer = function(lyr) {
  var copy = internal.copyLayerShapes(lyr);
  if (copy.data) {
    copy.data = copy.data.clone();
  }
  return copy;
};

internal.copyLayerShapes = function(lyr) {
  var copy = utils.extend({}, lyr);
    if (lyr.shapes) {
      copy.shapes = internal.cloneShapes(lyr.shapes);
    }
    return copy;
};

internal.getDatasetBounds = function(data) {
  var bounds = new Bounds();
  data.layers.forEach(function(lyr) {
    var lyrbb = internal.getLayerBounds(lyr, data.arcs);
    if (lyrbb) bounds.mergeBounds(lyrbb);
  });
  return bounds;
};

internal.datasetHasPaths = function(dataset) {
  return utils.some(dataset.layers, function(lyr) {
    return internal.layerHasPaths(lyr);
  });
};

internal.cleanupArcs = function(dataset) {
  // remove arcs if no longer referenced by any layer
  // TODO: consider doing arc dissolve, or just removing unreferenced arcs
  if (dataset.arcs && !utils.some(dataset.layers, internal.layerHasPaths)) {
    dataset.arcs = null;
    return true;
  }
};

internal.countMultiPartFeatures = function(shapes) {
  var count = 0;
  for (var i=0, n=shapes.length; i<n; i++) {
    if (shapes[i] && shapes[i].length > 1) count++;
  }
  return count;
};

internal.getFeatureCount = function(lyr) {
  var count = 0;
  if (lyr.data) {
    count = lyr.data.size();
  } else if (lyr.shapes) {
    count = lyr.shapes.length;
  }
  return count;
};

internal.getLayerBounds = function(lyr, arcs) {
  var bounds = null;
  if (lyr.geometry_type == 'point') {
    bounds = internal.getPointBounds(lyr.shapes);
  } else if (lyr.geometry_type == 'polygon' || lyr.geometry_type == 'polyline') {
    bounds = internal.getPathBounds(lyr.shapes, arcs);
  } else {
    // just return null if layer has no bounds
    // error("Layer is missing a valid geometry type");
  }
  return bounds;
};


internal.getPathBounds = function(shapes, arcs) {
  var bounds = new Bounds();
  internal.forEachArcId(shapes, function(id) {
    arcs.mergeArcBounds(id, bounds);
  });
  return bounds;
};

// replace cut layers in-sequence (to maintain layer indexes)
// append any additional new layers
internal.replaceLayers = function(dataset, cutLayers, newLayers) {
  // modify a copy in case cutLayers == dataset.layers
  var currLayers = dataset.layers.concat();
  utils.repeat(Math.max(cutLayers.length, newLayers.length), function(i) {
    var cutLyr = cutLayers[i],
        newLyr = newLayers[i],
        idx = cutLyr ? currLayers.indexOf(cutLyr) : currLayers.length;

    if (cutLyr) {
      currLayers.splice(idx, 1);
    }
    if (newLyr) {
      currLayers.splice(idx, 0, newLyr);
    }
  });
  dataset.layers = currLayers;
};

internal.isolateLayer = function(layer, dataset) {
  return utils.defaults({
    layers: dataset.layers.filter(function(lyr) {return lyr == layer;})
  }, dataset);
};

// Transform the points in a dataset in-place; don't clean up corrupted shapes
internal.transformPoints = function(dataset, f) {
  if (dataset.arcs) {
    dataset.arcs.transformPoints(f);
  }
  dataset.layers.forEach(function(lyr) {
    if (internal.layerHasPoints(lyr)) {
      internal.transformPointsInLayer(lyr, f);
    }
  });
};

internal.initDataTable = function(lyr) {
  lyr.data = new DataTable(internal.getFeatureCount(lyr));
};




// @arcs ArcCollection
// @filter Optional filter function, arcIds that return false are excluded
//
function NodeCollection(arcs, filter) {
  if (utils.isArray(arcs)) {
    arcs = new ArcCollection(arcs);
  }
  var arcData = arcs.getVertexData(),
      nn = arcData.nn,
      xx = arcData.xx,
      yy = arcData.yy,
      chains;

  // Accessor function for arcs
  Object.defineProperty(this, 'arcs', {value: arcs});

  this.toArray = function() {
    var nodes = internal.findNodeTopology(arcs, filter),
        flags = new Uint8Array(nodes.xx.length),
        arr = [];
    utils.forEach(nodes.chains, function(next, i) {
      if (flags[i] == 1) return;
      arr.push([nodes.xx[i], nodes.yy[i]]);
      while (flags[next] != 1) {
        flags[next] = 1;
        next = nodes.chains[next];
      }
    });
    return arr;
  };

  this.size = function() {
    return this.toArray().length;
  };

  this.debugNode = function(arcId) {
    var ids = [arcId];
    this.forEachConnectedArc(arcId, function(id) {
      ids.push(id);
    });

    message("node ids:",  ids);
    ids.forEach(printArc);

    function printArc(id) {
      var str = id + ": ";
      var len = arcs.getArcLength(id);
      if (len > 0) {
        var p1 = arcs.getVertex(id, -1);
        str += utils.format("[%f, %f]", p1.x, p1.y);
        if (len > 1) {
          var p2 = arcs.getVertex(id, -2);
          str += utils.format(", [%f, %f]", p2.x, p2.y);
          if (len > 2) {
            var p3 = arcs.getVertex(id, 0);
            str += utils.format(", [%f, %f]", p3.x, p3.y);
          }
          str += " len: " + distance2D(p1.x, p1.y, p2.x, p2.y);
        }
      } else {
        str = "[]";
      }
      message(str);
    }
  };

  this.forEachConnectedArc = function(arcId, cb) {
    var nextId = nextConnectedArc(arcId),
        i = 0;
    while (nextId != arcId) {
      cb(nextId, i++);
      nextId = nextConnectedArc(nextId);
    }
  };

  this.getConnectedArcs = function(arcId) {
    var ids = [];
    var nextId = nextConnectedArc(arcId);
    while (nextId != arcId) {
      ids.push(nextId);
      nextId = nextConnectedArc(nextId);
    }
    return ids;
  };

  // Returns the id of the first identical arc or @arcId if none found
  // TODO: find a better function name
  this.findMatchingArc = function(arcId) {
    var nextId = nextConnectedArc(arcId),
        match = arcId;
    while (nextId != arcId) {
      if (testArcMatch(arcId, nextId)) {
        if (absArcId(nextId) < absArcId(match)) match = nextId;
      }
      nextId = nextConnectedArc(nextId);
    }
    if (match != arcId) {
      // console.log("found identical arc:", arcId, "->", match);
    }
    return match;
  };

  function getNodeChains() {
    var nodeData;
    if (!chains) {
      nodeData = internal.findNodeTopology(arcs, filter);
      chains = nodeData.chains;
      if (nn.length * 2 != chains.length) error("[NodeCollection] count error");
    }
    return chains;
  }

  function testArcMatch(a, b) {
    var absA = a >= 0 ? a : ~a,
        absB = b >= 0 ? b : ~b,
        lenA = nn[absA];
    if (lenA < 2) {
      // Don't throw error on collapsed arcs -- assume they will be handled
      //   appropriately downstream.
      // error("[testArcMatch() defective arc; len:", lenA);
      return false;
    }
    if (lenA != nn[absB]) return false;
    if (testVertexMatch(a, b, -1) &&
        testVertexMatch(a, b, 1) &&
        testVertexMatch(a, b, -2)) {
      return true;
    }
    return false;
  }

  function testVertexMatch(a, b, i) {
    var ai = arcs.indexOfVertex(a, i),
        bi = arcs.indexOfVertex(b, i);
    return xx[ai] == xx[bi] && yy[ai] == yy[bi];
  }

  // return arcId of next arc in the chain, pointed towards the shared vertex
  function nextConnectedArc(arcId) {
    var fw = arcId >= 0,
        absId = fw ? arcId : ~arcId,
        nodeId = fw ? absId * 2 + 1: absId * 2, // if fw, use end, if rev, use start
        chains = getNodeChains(),
        chainedId = chains[nodeId],
        nextAbsId = chainedId >> 1,
        nextArcId = chainedId & 1 == 1 ? nextAbsId : ~nextAbsId;

    if (chainedId < 0 || chainedId >= chains.length) error("out-of-range chain id");
    if (absId >= nn.length) error("out-of-range arc id");
    if (chains.length <= nodeId) error("out-of-bounds node id");
    return nextArcId;
  }

  // expose for testing
  this.internal = {
    testArcMatch: testArcMatch,
    testVertexMatch: testVertexMatch
  };
}

internal.findNodeTopology = function(arcs, filter) {
  var n = arcs.size() * 2,
      xx2 = new Float64Array(n),
      yy2 = new Float64Array(n),
      ids2 = new Int32Array(n);

  arcs.forEach2(function(i, n, xx, yy, zz, arcId) {
    if (filter && !filter(arcId)) {
      return;
    }
    var start = i,
        end = i + n - 1,
        start2 = arcId * 2,
        end2 = start2 + 1;
    xx2[start2] = xx[start];
    yy2[start2] = yy[start];
    ids2[start2] = arcId;
    xx2[end2] = xx[end];
    yy2[end2] = yy[end];
    ids2[end2] = arcId;
  });

  var chains = initPointChains(xx2, yy2);
  return {
    xx: xx2,
    yy: yy2,
    ids: ids2,
    chains: chains
  };
};




// Calculations for planar geometry of shapes
// TODO: consider 3D versions of some of these

geom.getShapeArea = function(shp, arcs) {
  return (arcs.isPlanar() ? geom.getPlanarShapeArea : geom.getSphericalShapeArea)(shp, arcs);
};

geom.getPlanarShapeArea = function(shp, arcs) {
  return (shp || []).reduce(function(area, ids) {
    return area + geom.getPlanarPathArea(ids, arcs);
  }, 0);
};

geom.getSphericalShapeArea = function(shp, arcs) {
  if (arcs.isPlanar()) {
    error("[getSphericalShapeArea()] Function requires decimal degree coordinates");
  }
  return (shp || []).reduce(function(area, ids) {
    return area + geom.getSphericalPathArea(ids, arcs);
  }, 0);
};

// Return path with the largest (area) bounding box
// @shp array of array of arc ids
// @arcs ArcCollection
geom.getMaxPath = function(shp, arcs) {
  var maxArea = 0;
  return (shp || []).reduce(function(maxPath, path) {
    var bbArea = arcs.getSimpleShapeBounds(path).area();
    if (bbArea > maxArea) {
      maxArea = bbArea;
      maxPath = path;
    }
    return maxPath;
  }, null);
};

// @ids array of arc ids
// @arcs ArcCollection
geom.getAvgPathXY = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids);
  if (!iter.hasNext()) return null;
  var x0 = iter.x,
      y0 = iter.y,
      count = 0,
      sumX = 0,
      sumY = 0;
  while (iter.hasNext()) {
    count++;
    sumX += iter.x;
    sumY += iter.y;
  }
  if (count === 0 || iter.x !== x0 || iter.y !== y0) {
    sumX += x0;
    sumY += y0;
    count++;
  }
  return {
    x: sumX / count,
    y: sumY / count
  };
};

// Return true if point is inside or on boundary of a shape
//
geom.testPointInPolygon = function(x, y, shp, arcs) {
  var isIn = false,
      isOn = false;
  if (shp) {
    shp.forEach(function(ids) {
      var inRing = geom.testPointInRing(x, y, ids, arcs);
      if (inRing == 1) {
        isIn = !isIn;
      } else if (inRing == -1) {
        isOn = true;
      }
    });
  }
  return isOn || isIn;
};


geom.getPointToPathDistance = function(px, py, ids, arcs) {
  var iter = arcs.getShapeIter(ids);
  if (!iter.hasNext()) return Infinity;
  var ax = iter.x,
      ay = iter.y,
      paSq = distanceSq(px, py, ax, ay),
      pPathSq = paSq,
      pbSq, abSq,
      bx, by;

  while (iter.hasNext()) {
    bx = iter.x;
    by = iter.y;
    pbSq = distanceSq(px, py, bx, by);
    abSq = distanceSq(ax, ay, bx, by);
    pPathSq = Math.min(pPathSq, apexDistSq(paSq, pbSq, abSq));
    ax = bx;
    ay = by;
    paSq = pbSq;
  }
  return Math.sqrt(pPathSq);
};

geom.getYIntercept = function(x, ax, ay, bx, by) {
  return ay + (x - ax) * (by - ay) / (bx - ax);
};

geom.getXIntercept = function(y, ax, ay, bx, by) {
  return ax + (y - ay) * (bx - ax) / (by - ay);
};

// Return unsigned distance of a point to a shape
//
geom.getPointToShapeDistance = function(x, y, shp, arcs) {
  var minDist = (shp || []).reduce(function(minDist, ids) {
    var pathDist = geom.getPointToPathDistance(x, y, ids, arcs);
    return Math.min(minDist, pathDist);
  }, Infinity);
  return minDist;
};

// Test if point (x, y) is inside, outside or on the boundary of a polygon ring
// Return 0: outside; 1: inside; -1: on boundary
//
geom.testPointInRing = function(x, y, ids, arcs) {
  /*
  // arcs.getSimpleShapeBounds() doesn't apply simplification, can't use here
  //// wait, why not? simplifcation shoudn't expand bounds, so this test makes sense
  if (!arcs.getSimpleShapeBounds(ids).containsPoint(x, y)) {
    return false;
  }
  */
  var isIn = false,
      isOn = false;
  internal.forEachPathSegment(ids, arcs, function(a, b, xx, yy) {
    var result = geom.testRayIntersection(x, y, xx[a], yy[a], xx[b], yy[b]);
    if (result == 1) {
      isIn = !isIn;
    } else if (isNaN(result)) {
      isOn = true;
    }
  });
  return isOn ? -1 : (isIn ? 1 : 0);
};

// test if a vertical ray originating at (x, y) intersects a segment
// returns 1 if intersection, 0 if no intersection, NaN if point touches segment
// (Special rules apply to endpoint intersections, to support point-in-polygon testing.)
geom.testRayIntersection = function(x, y, ax, ay, bx, by) {
  var val = geom.getRayIntersection(x, y, ax, ay, bx, by);
  if (val != val) {
    return NaN;
  }
  return val == -Infinity ? 0 : 1;
};

geom.getRayIntersection = function(x, y, ax, ay, bx, by) {
  var hit = -Infinity, // default: no hit
      yInt;

  // case: p is entirely above, left or right of segment
  if (x < ax && x < bx || x > ax && x > bx || y > ay && y > by) {
      // no intersection
  }
  // case: px aligned with a segment vertex
  else if (x === ax || x === bx) {
    // case: vertical segment or collapsed segment
    if (x === ax && x === bx) {
      // p is on segment
      if (y == ay || y == by || y > ay != y > by) {
        hit = NaN;
      }
      // else: no hit
    }
    // case: px equal to ax (only)
    else if (x === ax) {
      if (y === ay) {
        hit = NaN;
      } else if (bx < ax && y < ay) {
        // only score hit if px aligned to rightmost endpoint
        hit = ay;
      }
    }
    // case: px equal to bx (only)
    else {
      if (y === by) {
        hit = NaN;
      } else if (ax < bx && y < by) {
        // only score hit if px aligned to rightmost endpoint
        hit = by;
      }
    }
  // case: px is between endpoints
  } else {
    yInt = geom.getYIntercept(x, ax, ay, bx, by);
    if (yInt > y) {
      hit = yInt;
    } else if (yInt == y) {
      hit = NaN;
    }
  }
  return hit;
};

geom.getSphericalPathArea = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
      sum = 0,
      started = false,
      deg2rad = Math.PI / 180,
      x, y, xp, yp;
  while (iter.hasNext()) {
    x = iter.x * deg2rad;
    y = Math.sin(iter.y * deg2rad);
    if (started) {
      sum += (x - xp) * (2 + y + yp);
    } else {
      started = true;
    }
    xp = x;
    yp = y;
  }
  return sum / 2 * 6378137 * 6378137;
};

// Get path area from an array of [x, y] points
// TODO: consider removing duplication with getPathArea(), e.g. by
//   wrapping points in an iterator.
//
geom.getPlanarPathArea2 = function(points) {
  var sum = 0,
      ax, ay, bx, by, dx, dy, p;
  for (var i=0, n=points.length; i<n; i++) {
    p = points[i];
    if (i === 0) {
      ax = 0;
      ay = 0;
      dx = -p[0];
      dy = -p[1];
    } else {
      ax = p[0] + dx;
      ay = p[1] + dy;
      sum += ax * by - bx * ay;
    }
    bx = ax;
    by = ay;
  }
  return sum / 2;
};

geom.getPlanarPathArea = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
      sum = 0,
      ax, ay, bx, by, dx, dy;
  if (iter.hasNext()) {
    ax = 0;
    ay = 0;
    dx = -iter.x;
    dy = -iter.y;
    while (iter.hasNext()) {
      bx = ax;
      by = ay;
      ax = iter.x + dx;
      ay = iter.y + dy;
      sum += ax * by - bx * ay;
    }
  }
  return sum / 2;
};

geom.countVerticesInPath = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
      count = 0;
  while (iter.hasNext()) count++;
  return count;
};

geom.getPathBounds = function(points) {
  var bounds = new Bounds();
  for (var i=0, n=points.length; i<n; i++) {
    bounds.mergePoint(points[i][0], points[i][1]);
  }
  return bounds;
};

geom.transposePoints = function(points) {
  var xx = [], yy = [], n=points.length;
  for (var i=0; i<n; i++) {
    xx.push(points[i][0]);
    yy.push(points[i][1]);
  }
  return [xx, yy];
};

geom.calcPathLen = (function() {
  var len, calcLen;
  function addSegLen(i, j, xx, yy) {
    len += calcLen(xx[i], yy[i], xx[j], yy[j]);
  }
  // @spherical (optional bool) calculate great circle length in meters
  return function(path, arcs, spherical) {
    if (spherical && arcs.isPlanar()) {
      error("Expected lat-long coordinates");
    }
    calcLen = spherical ? greatCircleDistance : distance2D;
    len = 0;
    for (var i=0, n=path.length; i<n; i++) {
      arcs.forEachArcSegment(path[i], addSegLen);
    }
    return len;
  };
}());




// @xx array of x coords
// @ids an array of segment endpoint ids [a0, b0, a1, b1, ...]
// Sort @ids in place so that xx[a(n)] <= xx[b(n)] and xx[a(n)] <= xx[a(n+1)]
internal.sortSegmentIds = function(xx, ids) {
  internal.orderSegmentIds(xx, ids);
  internal.quicksortSegmentIds(xx, ids, 0, ids.length-2);
};

internal.orderSegmentIds = function(xx, ids, spherical) {
  function swap(i, j) {
    var tmp = ids[i];
    ids[i] = ids[j];
    ids[j] = tmp;
  }
  for (var i=0, n=ids.length; i<n; i+=2) {
    if (xx[ids[i]] > xx[ids[i+1]]) {
      swap(i, i+1);
    }
  }
};

internal.insertionSortSegmentIds = function(arr, ids, start, end) {
  var id, id2;
  for (var j = start + 2; j <= end; j+=2) {
    id = ids[j];
    id2 = ids[j+1];
    for (var i = j - 2; i >= start && arr[id] < arr[ids[i]]; i-=2) {
      ids[i+2] = ids[i];
      ids[i+3] = ids[i+1];
    }
    ids[i+2] = id;
    ids[i+3] = id2;
  }
};

internal.quicksortSegmentIds = function (a, ids, lo, hi) {
  var i = lo,
      j = hi,
      pivot, tmp;
  while (i < hi) {
    pivot = a[ids[(lo + hi >> 2) << 1]]; // avoid n^2 performance on sorted arrays
    while (i <= j) {
      while (a[ids[i]] < pivot) i+=2;
      while (a[ids[j]] > pivot) j-=2;
      if (i <= j) {
        tmp = ids[i];
        ids[i] = ids[j];
        ids[j] = tmp;
        tmp = ids[i+1];
        ids[i+1] = ids[j+1];
        ids[j+1] = tmp;
        i+=2;
        j-=2;
      }
    }

    if (j - lo < 40) internal.insertionSortSegmentIds(a, ids, lo, j);
    else internal.quicksortSegmentIds(a, ids, lo, j);
    if (hi - i < 40) {
      internal.insertionSortSegmentIds(a, ids, i, hi);
      return;
    }
    lo = i;
    j = hi;
  }
};




// PolygonIndex indexes the coordinates in one polygon feature for efficient
// point-in-polygon tests

function PolygonIndex(shape, arcs, opts) {
  var data = arcs.getVertexData(),
      polygonBounds = arcs.getMultiShapeBounds(shape),
      boundsLeft,
      xminIds, xmaxIds, // vertex ids of segment endpoints
      bucketCount,
      bucketOffsets,
      bucketWidth;

  init();

  // Return 0 if outside, 1 if inside, -1 if on boundary
  this.pointInPolygon = function(x, y) {
    if (!polygonBounds.containsPoint(x, y)) {
      return false;
    }
    var bucketId = getBucketId(x);
    var count = countCrosses(x, y, bucketId);
    if (bucketId > 0) {
      count += countCrosses(x, y, bucketId - 1);
    }
    count += countCrosses(x, y, bucketCount); // check oflo bucket
    if (isNaN(count)) return -1;
    return count % 2 == 1 ? 1 : 0;
  };

  function countCrosses(x, y, bucketId) {
    var offs = bucketOffsets[bucketId],
        count = 0,
        xx = data.xx,
        yy = data.yy,
        n, a, b;
    if (bucketId == bucketCount) { // oflo bucket
      n = xminIds.length - offs;
    } else {
      n = bucketOffsets[bucketId + 1] - offs;
    }
    for (var i=0; i<n; i++) {
      a = xminIds[i + offs];
      b = xmaxIds[i + offs];
      count += geom.testRayIntersection(x, y, xx[a], yy[a], xx[b], yy[b]);
    }
    return count;
  }

  function getBucketId(x) {
    var i = Math.floor((x - boundsLeft) / bucketWidth);
    if (i < 0) i = 0;
    if (i >= bucketCount) i = bucketCount - 1;
    return i;
  }

  function getBucketCount(segCount) {
    // default is 100 segs per bucket (average)
    var buckets = opts && opts.buckets > 0 ? opts.buckets : segCount / 100;
    return Math.ceil(buckets);
  }

  function init() {
    var xx = data.xx,
        segCount = 0,
        segId = 0,
        bucketId = -1,
        prevBucketId,
        segments,
        head, tail,
        a, b, i, j, xmin, xmax;

    // get array of segments as [s0p0, s0p1, s1p0, s1p1, ...], sorted by xmin coordinate
    internal.forEachPathSegment(shape, arcs, function() {
      segCount++;
    });
    segments = new Uint32Array(segCount * 2);
    i = 0;
    internal.forEachPathSegment(shape, arcs, function(a, b, xx, yy) {
      segments[i++] = a;
      segments[i++] = b;
    });
    internal.sortSegmentIds(xx, segments);

    // assign segments to buckets according to xmin coordinate
    xminIds = new Uint32Array(segCount);
    xmaxIds = new Uint32Array(segCount);
    bucketCount = getBucketCount(segCount);
    bucketOffsets = new Uint32Array(bucketCount + 1); // add an oflo bucket
    boundsLeft = xx[segments[0]]; // xmin of first segment
    bucketWidth = (xx[segments[segments.length - 2]] - boundsLeft) / bucketCount;
    head = 0; // insertion index for next segment in the current bucket
    tail = segCount - 1; // insertion index for next segment in oflo bucket

    while (segId < segCount) {
      j = segId * 2;
      a = segments[j];
      b = segments[j+1];
      xmin = xx[a];
      xmax = xx[b];
      prevBucketId = bucketId;
      bucketId = getBucketId(xmin);

      while (bucketId > prevBucketId) {
        prevBucketId++;
        bucketOffsets[prevBucketId] = head;
      }

      if (xmax - xmin >= 0 === false) error("Invalid segment");
      if (getBucketId(xmax) - bucketId > 1) {
        // if segment extends to more than two buckets, put it in the oflo bucket
        xminIds[tail] = a;
        xmaxIds[tail] = b;
        tail--; // oflo bucket fills from right to left
      } else {
        // else place segment in a bucket based on x coord of leftmost endpoint
        xminIds[head] = a;
        xmaxIds[head] = b;
        head++;
      }
      segId++;
    }
    bucketOffsets[bucketCount] = head;
    if (head != tail + 1) error("Segment indexing error");
  }
}




function PathIndex(shapes, arcs) {
  var _index;
  // var totalArea = arcs.getBounds().area();
  var totalArea = internal.getPathBounds(shapes, arcs).area();
  init(shapes);

  function init(shapes) {
    var boxes = [];

    shapes.forEach(function(shp, shpId) {
      var n = shp ? shp.length : 0;
      for (var i=0; i<n; i++) {
        addPath(shp[i], shpId);
      }
    });

    _index = require('rbush')();
    _index.load(boxes);

    function addPath(ids, shpId) {
      var bounds = arcs.getSimpleShapeBounds(ids);
      var bbox = bounds.toArray();
      bbox.ids = ids;
      bbox.bounds = bounds;
      bbox.id = shpId;
      boxes.push(bbox);
      // TODO: Better test for whether or not to index a path
      if (bounds.area() > totalArea * 0.02) {
        bbox.index = new PolygonIndex([ids], arcs);
      }
    }
  }

  this.findEnclosingShape = function(p) {
    var shpId = -1;
    var shapes = findPointHitShapes(p);
    shapes.forEach(function(paths) {
      if (testPointInRings(p, paths)) {
        shpId = paths[0].id;
      }
    });
    return shpId;
  };

  this.pointIsEnclosed = function(p) {
    return testPointInRings(p, findPointHitRings(p));
  };

  this.arcIsEnclosed = function(arcId) {
    return this.pointIsEnclosed(getTestPoint(arcId));
  };

  // Test if a polygon ring is contained within an indexed ring
  // Not a true polygon-in-polygon test
  // Assumes that the target ring does not cross an indexed ring at any point
  // or share a segment with an indexed ring. (Intersecting rings should have
  // been detected previously).
  //
  this.pathIsEnclosed = function(pathIds) {
    var arcId = pathIds[0];
    var p = getTestPoint(arcId);
    return this.pointIsEnclosed(p);
  };

  // return array of paths that are contained within a path, or null if none
  // @pathIds Array of arc ids comprising a closed path
  this.findEnclosedPaths = function(pathIds) {
    var pathBounds = arcs.getSimpleShapeBounds(pathIds),
        cands = _index.search(pathBounds.toArray()),
        paths = [],
        index;

    if (cands.length > 6) {
      index = new PolygonIndex([pathIds], arcs);
    }
    cands.forEach(function(cand) {
      var p = getTestPoint(cand.ids[0]);
      var isEnclosed = index ?
        index.pointInPolygon(p[0], p[1]) : pathContainsPoint(pathIds, pathBounds, p);
      if (isEnclosed) {
        paths.push(cand.ids);
      }
    });
    return paths.length > 0 ? paths : null;
  };

  this.findPathsInsideShape = function(shape) {
    var paths = [];
    shape.forEach(function(ids) {
      var enclosed = this.findEnclosedPaths(ids);
      if (enclosed) {
        paths = xorArrays(paths, enclosed);
      }
    }, this);
    return paths.length > 0 ? paths : null;
  };

  function testPointInRings(p, cands) {
    var isOn = false,
        isIn = false;
    cands.forEach(function(cand) {
      var inRing = cand.index ?
        cand.index.pointInPolygon(p[0], p[1]) :
        pathContainsPoint(cand.ids, cand.bounds, p);
      if (inRing == -1) {
        isOn = true;
      } else if (inRing == 1) {
        isIn = !isIn;
      }
    });
    return isOn || isIn;
  }

  function findPointHitShapes(p) {
    var rings = findPointHitRings(p),
        shapes = [],
        shape, bbox;
    if (rings.length > 0) {
      rings.sort(function(a, b) {return a.id - b.id;});
      for (var i=0; i<rings.length; i++) {
        bbox = rings[i];
        if (i === 0 || bbox.id != rings[i-1].id) {
          shapes.push(shape=[]);
        }
        shape.push(bbox);
      }
    }
    return shapes;
  }

  function findPointHitRings(p) {
    var x = p[0],
        y = p[1];
    return _index.search([x, y, x, y]);
  }

  function getTestPoint(arcId) {
    // test point halfway along first segment because ring might still be
    // enclosed if a segment endpoint touches an indexed ring.
    var p0 = arcs.getVertex(arcId, 0),
        p1 = arcs.getVertex(arcId, 1);
    return [(p0.x + p1.x) / 2, (p0.y + p1.y) / 2];
  }

  function pathContainsPoint(pathIds, pathBounds, p) {
    if (pathBounds.containsPoint(p[0], p[1]) === false) return 0;
    // A contains B iff some point on B is inside A
    return geom.testPointInRing(p[0], p[1], pathIds, arcs);
  }

  function xorArrays(a, b) {
    var xor = [];
    a.forEach(function(el) {
      if (b.indexOf(el) == -1) xor.push(el);
    });
    b.forEach(function(el) {
      if (xor.indexOf(el) == -1) xor.push(el);
    });
    return xor;
  }
}




geom.segmentIntersection = segmentIntersection;
geom.segmentHit = segmentHit;
geom.lineIntersection = lineIntersection;
geom.orient2D = orient2D;
geom.outsideRange = outsideRange;

// Find the interection between two 2D segments
// Returns 0, 1 or two x, y locations as null, [x, y], or [x1, y1, x2, y2]
// Special cases:
// If the segments touch at an endpoint of both segments, it is not treated as an intersection
// If the segments touch at a T-intersection, it is treated as an intersection
// If the segments are collinear and partially overlapping, each subsumed endpoint
//    is counted as an intersection (there will be one or two)
//
function segmentIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
  var hit = segmentHit(ax, ay, bx, by, cx, cy, dx, dy),
      p = null;
  if (hit) {
    p = crossIntersection(ax, ay, bx, by, cx, cy, dx, dy);
    if (!p) { // collinear if p is null
      p = collinearIntersection(ax, ay, bx, by, cx, cy, dx, dy);
    } else if (endpointHit(ax, ay, bx, by, cx, cy, dx, dy)) {
      p = null; // filter out segments that only intersect at an endpoint
    }
  }
  return p;
}

function lineIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
  var den = determinant2D(bx - ax, by - ay, dx - cx, dy - cy);
  var eps = 1e-18;
  var m, p;
  if (den === 0) return null;
  m = orient2D(cx, cy, dx, dy, ax, ay) / den;
  if (den <= eps && den >= -eps) {
    // tiny denominator = low precision; using one of the endpoints as intersection
    p = findEndpointInRange(ax, ay, bx, by, cx, cy, dx, dy);
    if (!p) {
      debug('[lineIntersection()]');
      geom.debugSegmentIntersection([], ax, ay, bx, by, cx, cy, dx, dy);
    }
  } else {
    p = [ax + m * (bx - ax), ay + m * (by - ay)];
  }
  return p;
}

function findEndpointInRange(ax, ay, bx, by, cx, cy, dx, dy) {
  var p = null;
  if (!outsideRange(ax, cx, dx) && !outsideRange(ay, cy, dy)) {
    p = [ax, ay];
  } else if (!outsideRange(bx, cx, dx) && !outsideRange(by, cy, dy)) {
    p = [bx, by];
  } else if (!outsideRange(cx, ax, bx) && !outsideRange(cy, ay, by)) {
    p = [cx, cy];
  } else if (!outsideRange(dx, ax, bx) && !outsideRange(dy, ay, by)) {
    p = [dx, dy];
  }
  return p;
}

// Get intersection point if segments are non-collinear, else return null
// Assumes that segments have been intersect
function crossIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
  var p = lineIntersection(ax, ay, bx, by, cx, cy, dx, dy);
  var nearest;
  if (p) {
    // Re-order operands so intersection point is closest to a (better precision)
    // Source: Jonathan Shewchuk http://www.cs.berkeley.edu/~jrs/meshpapers/robnotes.pdf
    nearest = nearestPoint(p[0], p[1], ax, ay, bx, by, cx, cy, dx, dy);
    if (nearest == 1) {
      p = lineIntersection(bx, by, ax, ay, cx, cy, dx, dy);
    } else if (nearest == 2) {
      p = lineIntersection(cx, cy, dx, dy, ax, ay, bx, by);
    } else if (nearest == 3) {
      p = lineIntersection(dx, dy, cx, cy, ax, ay, bx, by);
    }
  }
  if (p) {
    clampIntersectionPoint(p, ax, ay, bx, by, cx, cy, dx, dy);
  }
  return p;
}

function clampIntersectionPoint(p, ax, ay, bx, by, cx, cy, dx, dy) {
  // Handle intersection points that fall outside the x-y range of either
  // segment by snapping to nearest endpoint coordinate. Out-of-range
  // intersection points can be caused by floating point rounding errors
  // when a segment is vertical or horizontal. This has caused problems when
  // repeatedly applying bbox clipping along the same segment
  var x = p[0],
      y = p[1];
  // assumes that segment ranges intersect
  x = geom.clampToCloseRange(x, ax, bx);
  x = geom.clampToCloseRange(x, cx, dx);
  y = geom.clampToCloseRange(y, ay, by);
  y = geom.clampToCloseRange(y, cy, dy);
  p[0] = x;
  p[1] = y;
}

geom.debugSegmentIntersection = function(p, ax, ay, bx, by, cx, cy, dx, dy) {
  debug('[debugSegmentIntersection()]');
  debug('  s1\n  dx:', Math.abs(ax - bx), '\n  dy:', Math.abs(ay - by));
  debug('  s2\n  dx:', Math.abs(cx - dx), '\n  dy:', Math.abs(cy - dy));
  debug('  s1 xx:', ax, bx);
  debug('  s2 xx:', cx, dx);
  debug('  s1 yy:', ay, by);
  debug('  s2 yy:', cy, dy);
  debug('  angle:', geom.signedAngle(ax, ay, bx, by, dx - cx + bx, dy - cy + by));
};

// a: coordinate of point
// b: endpoint coordinate of segment
// c: other endpoint of segment
function outsideRange(a, b, c) {
  var out;
  if (b < c) {
    out = a < b || a > c;
  } else if (b > c) {
    out = a > b || a < c;
  } else {
    out = a != b;
  }
  return out;
}

geom.clampToCloseRange = function(a, b, c) {
  var lim;
  if (geom.outsideRange(a, b, c)) {
    lim = Math.abs(a - b) < Math.abs(a - c) ? b : c;
    if (Math.abs(a - lim) > 1e-16) {
      debug("[clampToCloseRange()] large clamping interval", a, b, c);
    }
    a = lim;
  }
  return a;
};

// Determinant of matrix
//  | a  b |
//  | c  d |
function determinant2D(a, b, c, d) {
  return a * d - b * c;
}

// returns a positive value if the points a, b, and c are arranged in
// counterclockwise order, a negative value if the points are in clockwise
// order, and zero if the points are collinear.
// Source: Jonathan Shewchuk http://www.cs.berkeley.edu/~jrs/meshpapers/robnotes.pdf
function orient2D(ax, ay, bx, by, cx, cy) {
  return determinant2D(ax - cx, ay - cy, bx - cx, by - cy);
}

// Source: Sedgewick, _Algorithms in C_
// (Tried various other functions that failed owing to floating point errors)
function segmentHit(ax, ay, bx, by, cx, cy, dx, dy) {
  return orient2D(ax, ay, bx, by, cx, cy) *
      orient2D(ax, ay, bx, by, dx, dy) <= 0 &&
      orient2D(cx, cy, dx, dy, ax, ay) *
      orient2D(cx, cy, dx, dy, bx, by) <= 0;
}

function inside(x, minX, maxX) {
  return x > minX && x < maxX;
}

function sortSeg(x1, y1, x2, y2) {
  return x1 < x2 || x1 == x2 && y1 < y2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
}

// Assume segments s1 and s2 are collinear and overlap; find one or two internal endpoints
function collinearIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
  var minX = Math.min(ax, bx, cx, dx),
      maxX = Math.max(ax, bx, cx, dx),
      minY = Math.min(ay, by, cy, dy),
      maxY = Math.max(ay, by, cy, dy),
      useY = maxY - minY > maxX - minX,
      coords = [];

  if (useY ? inside(ay, minY, maxY) : inside(ax, minX, maxX)) {
    coords.push(ax, ay);
  }
  if (useY ? inside(by, minY, maxY) : inside(bx, minX, maxX)) {
    coords.push(bx, by);
  }
  if (useY ? inside(cy, minY, maxY) : inside(cx, minX, maxX)) {
    coords.push(cx, cy);
  }
  if (useY ? inside(dy, minY, maxY) : inside(dx, minX, maxX)) {
    coords.push(dx, dy);
  }
  if (coords.length != 2 && coords.length != 4) {
    coords = null;
    debug("Invalid collinear segment intersection", coords);
  } else if (coords.length == 4 && coords[0] == coords[2] && coords[1] == coords[3]) {
    // segs that meet in the middle don't count
    coords = null;
  }
  return coords;
}

function endpointHit(ax, ay, bx, by, cx, cy, dx, dy) {
  return ax == cx && ay == cy || ax == dx && ay == dy ||
          bx == cx && by == cy || bx == dx && by == dy;
}




// Convert an array of intersections into an ArcCollection (for display)
//
internal.getIntersectionPoints = function(intersections) {
  return intersections.map(function(obj) {
        return [obj.x, obj.y];
      });
};

// Identify intersecting segments in an ArcCollection
//
// To find all intersections:
// 1. Assign each segment to one or more horizontal stripes/bins
// 2. Find intersections inside each stripe
// 3. Concat and dedup
//
internal.findSegmentIntersections = (function() {

  // Re-use buffer for temp data -- Chrome's gc starts bogging down
  // if large buffers are repeatedly created.
  var buf;
  function getUint32Array(count) {
    var bytes = count * 4;
    if (!buf || buf.byteLength < bytes) {
      buf = new ArrayBuffer(bytes);
    }
    return new Uint32Array(buf, 0, count);
  }

  return function(arcs) {
    var bounds = arcs.getBounds(),
        // TODO: handle spherical bounds
        spherical = !arcs.isPlanar() &&
            containsBounds(internal.getWorldBounds(), bounds.toArray()),
        ymin = bounds.ymin,
        yrange = bounds.ymax - ymin,
        stripeCount = internal.calcSegmentIntersectionStripeCount(arcs),
        stripeSizes = new Uint32Array(stripeCount),
        stripeId = stripeCount > 1 ? multiStripeId : singleStripeId,
        i, j;

    function multiStripeId(y) {
      return Math.floor((stripeCount-1) * (y - ymin) / yrange);
    }

    function singleStripeId(y) {return 0;}

    // Count segments in each stripe
    arcs.forEachSegment(function(id1, id2, xx, yy) {
      var s1 = stripeId(yy[id1]),
          s2 = stripeId(yy[id2]);
      while (true) {
        stripeSizes[s1] = stripeSizes[s1] + 2;
        if (s1 == s2) break;
        s1 += s2 > s1 ? 1 : -1;
      }
    });

    // Allocate arrays for segments in each stripe
    var stripeData = getUint32Array(utils.sum(stripeSizes)),
        offs = 0;
    var stripes = [];
    utils.forEach(stripeSizes, function(stripeSize) {
      var start = offs;
      offs += stripeSize;
      stripes.push(stripeData.subarray(start, offs));
    });
    // Assign segment ids to each stripe
    utils.initializeArray(stripeSizes, 0);

    arcs.forEachSegment(function(id1, id2, xx, yy) {
      var s1 = stripeId(yy[id1]),
          s2 = stripeId(yy[id2]),
          count, stripe;
      while (true) {
        count = stripeSizes[s1];
        stripeSizes[s1] = count + 2;
        stripe = stripes[s1];
        stripe[count] = id1;
        stripe[count+1] = id2;
        if (s1 == s2) break;
        s1 += s2 > s1 ? 1 : -1;
      }
    });

    // Detect intersections among segments in each stripe.
    var raw = arcs.getVertexData(),
        intersections = [],
        arr;
    for (i=0; i<stripeCount; i++) {
      arr = internal.intersectSegments(stripes[i], raw.xx, raw.yy);
      for (j=0; j<arr.length; j++) {
        intersections.push(arr[j]);
      }
    }
    return internal.dedupIntersections(intersections);
  };
})();

internal.sortIntersections = function(arr) {
  arr.sort(function(a, b) {
    return a.x - b.x || a.y - b.y;
  });
};

internal.dedupIntersections = function(arr) {
  var index = {};
  return arr.filter(function(o) {
    var key = internal.getIntersectionKey(o);
    if (key in index) {
      return false;
    }
    index[key] = true;
    return true;
  });
};

// Get an indexable key from an intersection object
// Assumes that vertex ids of o.a and o.b are sorted
internal.getIntersectionKey = function(o) {
  return o.a.join(',') + ';' + o.b.join(',');
};

internal.calcSegmentIntersectionStripeCount = function(arcs) {
  var yrange = arcs.getBounds().height(),
      segLen = internal.getAvgSegment2(arcs)[1],
      count = 1;
  if (segLen > 0 && yrange > 0) {
    count = Math.ceil(yrange / segLen / 20);
  }
  return count || 1;
};

// Find intersections among a group of line segments
//
// TODO: handle case where a segment starts and ends at the same point (i.e. duplicate coords);
//
// @ids: Array of indexes: [s0p0, s0p1, s1p0, s1p1, ...] where xx[sip0] <= xx[sip1]
// @xx, @yy: Arrays of x- and y-coordinates
//
internal.intersectSegments = function(ids, xx, yy) {
  var lim = ids.length - 2,
      intersections = [];
  var s1p1, s1p2, s2p1, s2p2,
      s1p1x, s1p2x, s2p1x, s2p2x,
      s1p1y, s1p2y, s2p1y, s2p2y,
      hit, seg1, seg2, i, j;

  // Sort segments by xmin, to allow efficient exclusion of segments with
  // non-overlapping x extents.
  internal.sortSegmentIds(xx, ids); // sort by ascending xmin

  i = 0;
  while (i < lim) {
    s1p1 = ids[i];
    s1p2 = ids[i+1];
    s1p1x = xx[s1p1];
    s1p2x = xx[s1p2];
    s1p1y = yy[s1p1];
    s1p2y = yy[s1p2];
    // count++;

    j = i;
    while (j < lim) {
      j += 2;
      s2p1 = ids[j];
      s2p1x = xx[s2p1];

      if (s1p2x < s2p1x) break; // x extent of seg 2 is greater than seg 1: done with seg 1
      //if (s1p2x <= s2p1x) break; // this misses point-segment intersections when s1 or s2 is vertical

      s2p1y = yy[s2p1];
      s2p2 = ids[j+1];
      s2p2x = xx[s2p2];
      s2p2y = yy[s2p2];

      // skip segments with non-overlapping y ranges
      if (s1p1y >= s2p1y) {
        if (s1p1y > s2p2y && s1p2y > s2p1y && s1p2y > s2p2y) continue;
      } else {
        if (s1p1y < s2p2y && s1p2y < s2p1y && s1p2y < s2p2y) continue;
      }

      // skip segments that are adjacent in a path (optimization)
      // TODO: consider if this eliminates some cases that should
      // be detected, e.g. spikes formed by unequal segments
      if (s1p1 == s2p1 || s1p1 == s2p2 || s1p2 == s2p1 || s1p2 == s2p2) {
        continue;
      }

      // test two candidate segments for intersection
      hit = segmentIntersection(s1p1x, s1p1y, s1p2x, s1p2y,
          s2p1x, s2p1y, s2p2x, s2p2y);
      if (hit) {
        seg1 = [s1p1, s1p2];
        seg2 = [s2p1, s2p2];
        intersections.push(internal.formatIntersection(hit, seg1, seg2, xx, yy));
        if (hit.length == 4) {
          // two collinear segments may have two endpoint intersections
          intersections.push(internal.formatIntersection(hit.slice(2), seg1, seg2, xx, yy));
        }
      }
    }
    i += 2;
  }
  return intersections;

  // @p is an [x, y] location along a segment defined by ids @id1 and @id2
  // return array [i, j] where i and j are the same endpoint ids with i <= j
  // if @p coincides with an endpoint, return the id of that endpoint twice
  function getEndpointIds(id1, id2, p) {
    var i = id1 < id2 ? id1 : id2,
        j = i === id1 ? id2 : id1;
    if (xx[i] == p[0] && yy[i] == p[1]) {
      j = i;
    } else if (xx[j] == p[0] && yy[j] == p[1]) {
      i = j;
    }
    return [i, j];
  }
};

internal.formatIntersection = function(xy, s1, s2, xx, yy) {
  var x = xy[0],
      y = xy[1],
      a, b;
  s1 = internal.formatIntersectingSegment(x, y, s1[0], s1[1], xx, yy);
  s2 = internal.formatIntersectingSegment(x, y, s2[0], s2[1], xx, yy);
  a = s1[0] < s2[0] ? s1 : s2;
  b = a == s1 ? s2 : s1;
  return {x: x, y: y, a: a, b: b};
};

internal.formatIntersectingSegment = function(x, y, id1, id2, xx, yy) {
  var i = id1 < id2 ? id1 : id2,
      j = i === id1 ? id2 : id1;
  if (xx[i] == x && yy[i] == y) {
    j = i;
  } else if (xx[j] == x && yy[j] == y) {
    i = j;
  }
  return [i, j];
};




// Return function for splitting self-intersecting polygon rings
// Splitter function receives a single path, returns an array of paths
// Intersections are assumed to occur at vertices, not along segments
// (requires that internal.addIntersectionCuts() has already been run)
//
internal.getSelfIntersectionSplitter = function(nodes) {
  return dividePath;

  // Returns array of 0 or more divided paths
  function dividePath(path) {
    var subPaths = null;
    for (var i=0; i<path.length - 1; i++) { // don't need to check last arc
      subPaths = dividePathAtNode(path, path[i]);
      if (subPaths) {
        return subPaths;
      }
    }
    // indivisible path -- clean it by removing any spikes
    internal.removeSpikesInPath(path);
    return path.length > 0 ? [path] : [];
  }

  // If arc @enterId enters a node with more than one open routes leading out:
  //   return array of sub-paths
  // else return null
  function dividePathAtNode(path, enterId) {
    var nodeIds = nodes.getConnectedArcs(enterId),
        exitIds = [],
        outId;
    for (var i=0; i<nodeIds.length; i++) {
      outId = ~nodeIds[i];
      if (contains(path, outId)) { // repeated scanning may be bottleneck
        exitIds.push(outId);
      }
    }
    if (exitIds.length > 1) {
      // path forks -- recursively subdivide
      return internal.splitPathByIds(path, exitIds).reduce(accumulatePaths, null);
    }
    return null;
  }

  function accumulatePaths(memo, path) {
    var subPaths = dividePath(path);
    return memo ? memo.concat(subPaths) : subPaths;
  }

  // Added as an optimization -- tested faster than using Array#indexOf()
  function contains(arr, el) {
    for (var i=0, n=arr.length; i<n; i++) {
      if (arr[i] === el) return true;
    }
    return false;
  }
};

// Function returns an array of split-apart rings
// @path An array of arc ids describing a self-intersecting polygon ring
// @ids An array of two or more ids of arcs that originate from a single vertex
//      where @path intersects itself.
internal.splitPathByIds = function(path, ids) {
  var subPaths = [];
  // Find array indexes in @path of each split id
  var indexes = ids.map(function(id) {
    var i = path.indexOf(id);
    if (i == -1) error("[splitPathByIds()] missing arc:", id);
    return i;
  });
  utils.genericSort(indexes, true); // sort ascending
  if (indexes[0] > 0) {
    subPaths.push(path.slice(0, indexes[0]));
  }
  for (var i=0, n=indexes.length; i<n; i++) {
    if (i < n-1) {
      subPaths.push(path.slice(indexes[i], indexes[i+1]));
    } else {
      subPaths.push(path.slice(indexes[i]));
    }
  }
  // handle case where first subring is split across endpoint of @path
  if (subPaths.length > ids.length) {
    subPaths[0] = subPaths[0].concat(subPaths.pop());
  }
  return subPaths;
};




// Returns a function that separates rings in a polygon into space-enclosing rings
// and holes. Also fixes self-intersections.
//
internal.getHoleDivider = function(nodes, spherical) {
  var split = internal.getSelfIntersectionSplitter(nodes);

  return function(rings, cw, ccw) {
    var pathArea = spherical ? geom.getSphericalPathArea : geom.getPlanarPathArea;
    internal.forEachPath(rings, function(ringIds) {
      var splitRings = split(ringIds);
      if (splitRings.length === 0) {
        debug("[getRingDivider()] Defective path:", ringIds);
      }
      splitRings.forEach(function(ringIds, i) {
        var ringArea = pathArea(ringIds, nodes.arcs);
        if (ringArea > 0) {
          cw.push(ringIds);
        } else if (ringArea < 0) {
          ccw.push(ringIds);
        }
      });
    });
  };
};




// clean polygon or polyline shapes, in-place
//
internal.cleanShapes = function(shapes, arcs, type) {
  for (var i=0, n=shapes.length; i<n; i++) {
    shapes[i] = internal.cleanShape(shapes[i], arcs, type);
  }
};

// Remove defective arcs and zero-area polygon rings
// Remove simple polygon spikes of form: [..., id, ~id, ...]
// Don't remove duplicate points
// Don't check winding order of polygon rings
internal.cleanShape = function(shape, arcs, type) {
  return internal.editPaths(shape, function(path) {
    var cleaned = internal.cleanPath(path, arcs);
    if (type == 'polygon' && cleaned) {
      internal.removeSpikesInPath(cleaned); // assumed by addIntersectionCuts()
      if (geom.getPlanarPathArea(cleaned, arcs) === 0) {
        cleaned = null;
      }
    }
    return cleaned;
  });
};

internal.cleanPath = function(path, arcs) {
  var nulls = 0;
  for (var i=0, n=path.length; i<n; i++) {
    if (arcs.arcIsDegenerate(path[i])) {
      nulls++;
      path[i] = null;
    }
  }
  return nulls > 0 ? path.filter(function(id) {return id !== null;}) : path;
};

// Remove pairs of ids where id[n] == ~id[n+1] or id[0] == ~id[n-1];
// (in place)
internal.removeSpikesInPath = function(ids) {
  var n = ids.length;
  if (n >= 2) {
    if (ids[0] == ~ids[n-1]) {
      ids.pop();
      ids.shift();
    } else {
      for (var i=1; i<n; i++) {
        if (ids[i-1] == ~ids[i]) {
          ids.splice(i-1, 2);
          break;
        }
      }
    }
    if (ids.length < n) {
      internal.removeSpikesInPath(ids);
    }
  }
};


// TODO: Need to rethink polygon repair: these function can cause problems
// when part of a self-intersecting polygon is removed
//
internal.repairPolygonGeometry = function(layers, dataset, opts) {
  var nodes = internal.addIntersectionCuts(dataset);
  layers.forEach(function(lyr) {
    internal.repairSelfIntersections(lyr, nodes);
  });
  return layers;
};

// Remove any small shapes formed by twists in each ring
// // OOPS, NO // Retain only the part with largest area
// // this causes problems when a cut-off hole has a matching ring in another polygon
// TODO: consider cases where cut-off parts should be retained
//
internal.repairSelfIntersections = function(lyr, nodes) {
  var splitter = internal.getSelfIntersectionSplitter(nodes);

  lyr.shapes = lyr.shapes.map(function(shp, i) {
    return cleanPolygon(shp);
  });

  function cleanPolygon(shp) {
    var cleanedPolygon = [];
    internal.forEachPath(shp, function(ids) {
      // TODO: consider returning null if path can't be split
      var splitIds = splitter(ids);
      if (splitIds.length === 0) {
        error("[cleanPolygon()] Defective path:", ids);
      } else if (splitIds.length == 1) {
        cleanedPolygon.push(splitIds[0]);
      } else {
        var shapeArea = geom.getPlanarPathArea(ids, nodes.arcs),
            sign = shapeArea > 0 ? 1 : -1,
            mainRing;

        var maxArea = splitIds.reduce(function(max, ringIds, i) {
          var pathArea = geom.getPlanarPathArea(ringIds, nodes.arcs) * sign;
          if (pathArea > max) {
            mainRing = ringIds;
            max = pathArea;
          }
          return max;
        }, 0);

        if (mainRing) {
          cleanedPolygon.push(mainRing);
        }
      }
    });
    return cleanedPolygon.length > 0 ? cleanedPolygon : null;
  }
};




// Functions for dividing polygons and polygons at points where arc-segments intersect

// TODO: rename this function to something like repairTopology
//    (consider using it at import to build initial topology)
//    Improve efficiency (e.g. only update ArcCollection once)
//    Remove junk arcs (collapsed and duplicate arcs) instead of just removing
//       references to them

// Divide a collection of arcs at points where segments intersect
// and re-index the paths of all the layers that reference the arc collection.
// (in-place)
internal.addIntersectionCuts = function(dataset, _opts) {
  var opts = _opts || {};
  var arcs = dataset.arcs;
  var snapDist = opts.snap_interval || internal.getHighPrecisionSnapInterval(arcs);
  var snapCount = opts.no_snap ? 0 : internal.snapCoordsByInterval(arcs, snapDist);
  var dupeCount = arcs.dedupCoords();
  if (snapCount > 0 || dupeCount > 0) {
    // Detect topology again if coordinates have changed
    api.buildTopology(dataset);
  }

  // cut arcs at points where segments intersect
  var map = internal.divideArcs(arcs);

  // update arc ids in arc-based layers and clean up arc geometry
  // to remove degenerate arcs and duplicate points
  var nodes = new NodeCollection(arcs);
  dataset.layers.forEach(function(lyr) {
    if (internal.layerHasPaths(lyr)) {
      internal.updateArcIds(lyr.shapes, map, nodes);
      // Clean shapes by removing collapsed arc references, etc.
      // TODO: consider alternative -- avoid creating degenerate arcs
      // in insertCutPoints()
      internal.cleanShapes(lyr.shapes, arcs, lyr.geometry_type);
    }
  });
  return nodes;
};

// Divides a collection of arcs at points where arc paths cross each other
// Returns array for remapping arc ids
internal.divideArcs = function(arcs) {
  var points = internal.findClippingPoints(arcs);
  // TODO: avoid the following if no points need to be added
  var map = internal.insertCutPoints(points, arcs);
  // segment-point intersections currently create duplicate points
  arcs.dedupCoords();
  return map;
};

// Inserts array of cutting points into an ArcCollection
// Returns array for remapping arc ids
internal.insertCutPoints = function(unfilteredPoints, arcs) {
  var data = arcs.getVertexData(),
      xx0 = data.xx,
      yy0 = data.yy,
      nn0 = data.nn,
      i0 = 0,
      i1 = 0,
      nn1 = [],
      srcArcTotal = arcs.size(),
      map = new Uint32Array(srcArcTotal),
      points = internal.filterSortedCutPoints(internal.sortCutPoints(unfilteredPoints, xx0, yy0), arcs),
      destPointTotal = arcs.getPointCount() + points.length * 2,
      xx1 = new Float64Array(destPointTotal),
      yy1 = new Float64Array(destPointTotal),
      n0, n1, arcLen, p;

  points.reverse(); // reverse sorted order to use pop()
  p = points.pop();

  for (var srcArcId=0, destArcId=0; srcArcId < srcArcTotal; srcArcId++) {
    // start merging an arc
    arcLen = nn0[srcArcId];
    map[srcArcId] = destArcId;
    n0 = 0;
    n1 = 0;
    while (n0 < arcLen) {
      // copy another point
      xx1[i1] = xx0[i0];
      yy1[i1] = yy0[i0];
      i1++;
      n1++;
      while (p && p.i == i0) {
        // interpolate any clip points that fall within the current segment
        xx1[i1] = p.x;
        yy1[i1] = p.y;
        i1++;
        n1++;
        nn1[destArcId++] = n1; // end current arc at intersection
        n1 = 0; // begin new arc
        xx1[i1] = p.x;
        yy1[i1] = p.y;
        i1++;
        n1++;
        p = points.pop();
      }
      n0++;
      i0++;
    }
    nn1[destArcId++] = n1;
  }

  if (i1 != destPointTotal) error("[insertCutPoints()] Counting error");
  arcs.updateVertexData(nn1, xx1, yy1, null);
  return map;
};

internal.convertIntersectionsToCutPoints = function(intersections, xx, yy) {
  var points = [], ix, a, b;
  for (var i=0, n=intersections.length; i<n; i++) {
    ix = intersections[i];
    a = internal.getCutPoint(ix.x, ix.y, ix.a[0], ix.a[1], xx, yy);
    b = internal.getCutPoint(ix.x, ix.y, ix.b[0], ix.b[1], xx, yy);
    if (a) points.push(a);
    if (b) points.push(b);
  }
  return points;
};

internal.getCutPoint = function(x, y, i, j, xx, yy) {
  var ix = xx[i],
      iy = yy[i],
      jx = xx[j],
      jy = yy[j];
  if (j < i || j > i + 1) {
    error("Out-of-sequence arc ids:", i, j);
  }
  if (geom.outsideRange(x, ix, jx) || geom.outsideRange(y, iy, jy)) {
    // out-of-range issues should have been handled upstream
    debug("[getCutPoint()] Coordinate range error");
    return null;
  }
  return {x: x, y: y, i: i};
};

// Sort insertion points in order of insertion
// Insertion order: ascending id of first endpoint of containing segment and
//   ascending distance from same endpoint.
internal.sortCutPoints = function(points, xx, yy) {
  points.sort(function(a, b) {
    return a.i - b.i ||
      Math.abs(a.x - xx[a.i]) - Math.abs(b.x - xx[b.i]) ||
      Math.abs(a.y - yy[a.i]) - Math.abs(b.y - yy[b.i]);
  });
  return points;
};

// Removes duplicate points and arc endpoints
internal.filterSortedCutPoints = function(points, arcs) {
  var filtered = [],
      pointId = 0;
  arcs.forEach2(function(i, n, xx, yy) {
    var j = i + n - 1,
        x0 = xx[i],
        y0 = yy[i],
        xn = xx[j],
        yn = yy[j],
        p, pp;

    while (pointId < points.length && points[pointId].i <= j) {
      p = points[pointId];
      pp = filtered[filtered.length - 1];
      if (p.x == x0 && p.y == y0 || p.x == xn && p.y == yn) {
        // clip point is an arc endpoint -- discard
      } else if (pp && pp.x == p.x && pp.y == p.y && pp.i == p.i) {
        // clip point is a duplicate -- discard
      } else {
        filtered.push(p);
      }
      pointId++;
    }
  });
  return filtered;
};

internal.findClippingPoints = function(arcs) {
  var intersections = internal.findSegmentIntersections(arcs),
      data = arcs.getVertexData();
  return internal.convertIntersectionsToCutPoints(intersections, data.xx, data.yy);
};

// Updates arc ids in @shapes array using @map object
// ... also, removes references to duplicate arcs
internal.updateArcIds = function(shapes, map, nodes) {
  var arcCount = nodes.arcs.size(),
      shape2;
  for (var i=0; i<shapes.length; i++) {
    shape2 = [];
    internal.forEachPath(shapes[i], remapPathIds);
    shapes[i] = shape2;
  }

  function remapPathIds(ids) {
    if (!ids) return; // null shape
    var ids2 = [];
    for (var j=0; j<ids.length; j++) {
      remapArcId(ids[j], ids2);
    }
    shape2.push(ids2);
  }

  function remapArcId(id, ids) {
    var rev = id < 0,
        absId = rev ? ~id : id,
        min = map[absId],
        max = (absId >= map.length - 1 ? arcCount : map[absId + 1]) - 1,
        id2;
    do {
      if (rev) {
        id2 = ~max;
        max--;
      } else {
        id2 = min;
        min++;
      }
      // If there are duplicate arcs, switch to the same one
      if (nodes) {
        id2 = nodes.findMatchingArc(id2);
      }
      ids.push(id2);
    } while (max - min >= 0);
  }
};




// Return id of rightmost connected arc in relation to @arcId
// Return @arcId if no arcs can be found
internal.getRightmostArc = function(arcId, nodes, filter) {
  var ids = nodes.getConnectedArcs(arcId);
  if (filter) {
    ids = ids.filter(filter);
  }
  if (ids.length === 0) {
    return arcId; // error condition, handled by caller
  }
  return internal.getRighmostArc2(arcId, ids, nodes.arcs);
};

internal.getRighmostArc2 = function(fromId, ids, arcs) {
  var coords = arcs.getVertexData(),
      xx = coords.xx,
      yy = coords.yy,
      inode = arcs.indexOfVertex(fromId, -1),
      nodeX = xx[inode],
      nodeY = yy[inode],
      ifrom = arcs.indexOfVertex(fromId, -2),
      fromX = xx[ifrom],
      fromY = yy[ifrom],
      toId = fromId, // initialize to from-arc -- an error
      ito, candId, icand, code, j;

  /*if (x == ax && y == ay) {
    error("Duplicate point error");
  }*/
  if (ids.length > 0) {
    toId = ids[0];
    ito = arcs.indexOfVertex(toId, -2);
  }

  for (j=1; j<ids.length; j++) {
    candId = ids[j];
    icand = arcs.indexOfVertex(candId, -2);
    code = internal.chooseRighthandPath(fromX, fromY, nodeX, nodeY, xx[ito], yy[ito], xx[icand], yy[icand]);
    if (code == 2) {
      toId = candId;
      ito = icand;
    }
  }
  if (toId == fromId) {
    // This shouldn't occur, assuming that other arcs are present
    error("Pathfinder error");
  }
  return toId;
};

// Returns 1 if node->a, return 2 if node->b, else return 0
// TODO: better handling of identical angles (better -- avoid creating them)
internal.chooseRighthandPath = function(fromX, fromY, nodeX, nodeY, ax, ay, bx, by) {
  var angleA = geom.signedAngle(fromX, fromY, nodeX, nodeY, ax, ay);
  var angleB = geom.signedAngle(fromX, fromY, nodeX, nodeY, bx, by);
  var code;
  if (angleA <= 0 || angleB <= 0) {
    debug("[chooseRighthandPath()] 0 angle(s):", angleA, angleB);
    if (angleA <= 0) {
      debug('  A orient2D:', geom.orient2D(fromX, fromY, nodeX, nodeY, ax, ay));
    }
    if (angleB <= 0) {
      debug('  B orient2D:', geom.orient2D(fromX, fromY, nodeX, nodeY, bx, by));
    }
    // TODO: test against "from" segment
    if (angleA > 0) {
      code = 1;
    } else if (angleB > 0) {
      code = 2;
    } else {
      code = 0;
    }
  } else if (angleA < angleB) {
    code = 1;
  } else if (angleB < angleA) {
    code = 2;
  } else if (isNaN(angleA) || isNaN(angleB)) {
    // probably a duplicate point, which should not occur
    error('Invalid node geometry');
  } else {
    // Equal angles: use fallback test that is less sensitive to rounding error
    code = internal.chooseRighthandVector(ax - nodeX, ay - nodeY, bx - nodeX, by - nodeY);
    debug("[chooseRighthandVector()] code:", code, 'angle:', angleA);
    debug(fromX, fromY, nodeX, nodeY, ax, ay, bx, by);
  }
  return code;
};

internal.chooseRighthandVector = function(ax, ay, bx, by) {
  var orient = geom.orient2D(ax, ay, 0, 0, bx, by);
  var code;
  if (orient > 0) {
    code = 2;
  } else if (orient < 0) {
    code = 1;
  } else {
    code = 0;
  }
  return code;
};




// Functions for redrawing polygons for clipping / erasing / flattening / division

internal.setBits = function(src, flags, mask) {
  return (src & ~mask) | (flags & mask);
};

internal.andBits = function(src, flags, mask) {
  return src & (~mask | flags);
};

internal.setRouteBits = function(bits, id, flags) {
  var abs = absArcId(id),
      mask;
  if (abs == id) { // fw
    mask = ~3;
  } else {
    mask = ~0x30;
    bits = bits << 4;
  }
  flags[abs] &= (bits | mask);
};

internal.getRouteBits = function(id, flags) {
  var abs = absArcId(id),
      bits = flags[abs];
  if (abs != id) bits = bits >> 4;
  return bits & 7;
};


// enable arc pathways in a single shape or array of shapes
// Uses 8 bits to control traversal of each arc
// 0-3: forward arc; 4-7: rev arc
// 0: fw path is visible
// 1: fw path is open for traversal
// ...
//
internal.openArcRoutes = function(arcIds, arcs, flags, fwd, rev, dissolve, orBits) {
  internal.forEachArcId(arcIds, function(id) {
    var isInv = id < 0,
        absId = isInv ? ~id : id,
        currFlag = flags[absId],
        openFwd = isInv ? rev : fwd,
        openRev = isInv ? fwd : rev,
        newFlag = currFlag;

    // error condition: lollipop arcs can cause problems; ignore these
    if (arcs.arcIsLollipop(id)) {
      debug('lollipop');
      newFlag = 0; // unset (i.e. make invisible)
    } else {
      if (openFwd) {
        newFlag |= 3; // visible / open
      }
      if (openRev) {
        newFlag |= 0x30; // visible / open
      }

      // placing this in front of dissolve - dissolve has to be able to hide
      // arcs that are set to visible
      if (orBits > 0) {
        newFlag |= orBits;
      }

      // dissolve hides arcs that have both fw and rev pathways open
      if (dissolve && (newFlag & 0x22) === 0x22) {
        newFlag &= ~0x11; // make invisible
      }
    }

    flags[absId] = newFlag;
  });
};

internal.closeArcRoutes = function(arcIds, arcs, flags, fwd, rev, hide) {
  internal.forEachArcId(arcIds, function(id) {
    var isInv = id < 0,
        absId = isInv ? ~id : id,
        currFlag = flags[absId],
        mask = 0xff,
        closeFwd = isInv ? rev : fwd,
        closeRev = isInv ? fwd : rev;

    if (closeFwd) {
      if (hide) mask &= ~1;
      mask ^= 0x2;
    }
    if (closeRev) {
      if (hide) mask &= ~0x10;
      mask ^= 0x20;
    }
    flags[absId] = currFlag & mask;
  });
};

// Return a function for generating a path across a field of intersecting arcs
// useRoute: function(arcId) {}
//           Tries to extend path to the given arc
//           Returns true and extends path by one arc on success
//           Returns false and rejects the entire path on failure
// routeIsUsable (optional): function(arcId) {}
//           An optional filter function; pathfinder ignores the given arc if
//           this function returns false;
// TODO: add option to use spherical geometry for lat-lng coords
//
internal.getPathFinder = function(nodes, useRoute, routeIsUsable) {
  var testArc = null;
  if (routeIsUsable) {
    testArc = function(arcId) {
      return routeIsUsable(~arcId); // outward path must be traversable
    };
  }

  function getNextArc(prevId) {
    // reverse arc to point onwards
    return ~internal.getRightmostArc(prevId, nodes, testArc);
  }

  return function(startId) {
    // console.log(" # from:" ,startId);
    var path = [],
        nextId, msg,
        candId = startId;

    do {
      if (useRoute(candId)) {
        path.push(candId);
        nextId = candId;
        candId = getNextArc(nextId);
      } else {
        return null;
      }

      if (candId == ~nextId) {
        // TODO: handle or prevent this error condition
        message("Pathfinder warning: dead-end path");
        return null;
      }
    } while (candId != startId);
    return path.length === 0 ? null : path;
  };
};

// types: "dissolve" "flatten"
// Returns a function for flattening or dissolving a collection of rings
// Assumes rings are oriented in CW direction
//
internal.getRingIntersector = function(nodes, type, flags) {
  var arcs = nodes.arcs;
  var findPath = internal.getPathFinder(nodes, useRoute, routeIsActive);
  flags = flags || new Uint8Array(arcs.size());

  return function(rings) {
    var dissolve = type == 'dissolve',
        openFwd = true,
        openRev = type == 'flatten',
        output;
    // even single rings get transformed (e.g. to remove spikes)
    if (rings.length > 0) {
      output = [];
      internal.openArcRoutes(rings, arcs, flags, openFwd, openRev, dissolve);
      internal.forEachPath(rings, function(ids) {
        var path;
        for (var i=0, n=ids.length; i<n; i++) {
          path = findPath(ids[i]);
          if (path) {
            output.push(path);
          }
        }
      });
      internal.closeArcRoutes(rings, arcs, flags, openFwd, openRev, true);
    } else {
      output = rings;
    }
    return output;
  };

  function routeIsActive(arcId) {
    var bits = internal.getRouteBits(arcId, flags);
    return (bits & 1) == 1;
  }

  function useRoute(arcId) {
    var route = internal.getRouteBits(arcId, flags),
        isOpen = false;
    if (route == 3) {
      isOpen = true;
      internal.setRouteBits(1, arcId, flags); // close the path, leave visible
    }
    return isOpen;
  }
};

internal.debugFlags = function(flags) {
  var arr = [];
  utils.forEach(flags, function(flag) {
    arr.push(bitsToString(flag));
  });
  message(arr);

  function bitsToString(bits) {
    var str = "";
    for (var i=0; i<8; i++) {
      str += (bits & (1 << i)) > 0 ? "1" : "0";
      if (i < 7) str += ' ';
      if (i == 3) str += ' ';
    }
    return str;
  }
};




// List of encodings supported by iconv-lite:
// https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings

// Return list of supported encodings
internal.getEncodings = function() {
  var iconv = require('iconv-lite');
  iconv.encodingExists('ascii'); // make iconv load its encodings
  return Object.keys(iconv.encodings);
};

internal.validateEncoding = function(enc) {
  if (!internal.encodingIsSupported(enc)) {
    stop("Unknown encoding:", enc, "\nRun the -encodings command see a list of supported encodings");
  }
  return enc;
};

internal.encodingIsSupported = function(raw) {
  var enc = internal.standardizeEncodingName(raw);
  return utils.contains(internal.getEncodings(), enc);
};

// @buf a Node Buffer
internal.decodeString = function(buf, encoding) {
  var iconv = require('iconv-lite'),
      str = iconv.decode(buf, encoding);
  // remove BOM if present
  if (str.charCodeAt(0) == 0xfeff) {
    str = str.substr(1);
  }
  return str;
};

// Ex. convert UTF-8 to utf8
internal.standardizeEncodingName = function(enc) {
  return enc.toLowerCase().replace(/[_-]/g, '');
};

internal.printEncodings = function() {
  var encodings = internal.getEncodings().filter(function(name) {
    // filter out some aliases and non-applicable encodings
    return !/^(_|cs|internal|ibm|isoir|singlebyte|table|[0-9]|l[0-9]|windows)/.test(name);
  });
  encodings.sort();
  message("Supported encodings:\n" + internal.formatStringsAsGrid(encodings));
};




// Try to detect the encoding of some sample text.
// Returns an encoding name or null.
// @samples Array of buffers containing sample text fields
// TODO: Improve reliability and number of detectable encodings.
internal.detectEncoding = function(samples) {
  var encoding = null;
  if (internal.looksLikeUtf8(samples)) {
    encoding = 'utf8';
  } else if (internal.looksLikeWin1252(samples)) {
    // Win1252 is the same as Latin1, except it replaces a block of control
    // characters with n-dash, Euro and other glyphs. Encountered in-the-wild
    // in Natural Earth (airports.dbf uses n-dash).
    encoding = 'win1252';
  }
  return encoding;
};

// Convert an array of text samples to a single string using a given encoding
internal.decodeSamples = function(enc, samples) {
  return samples.map(function(buf) {
    return internal.decodeString(buf, enc).trim();
  }).join('\n');
};

internal.formatSamples = function(str) {
  return internal.formatStringsAsGrid(str.split('\n'));
};

// Quick-and-dirty win1251 detection: decoded string contains mostly common ascii
// chars and almost no chars other than word chars + punctuation.
// This excludes encodings like Greek, Cyrillic or Thai, but
// is susceptible to false positives with encodings like codepage 1250 ("Eastern
// European").
internal.looksLikeWin1252 = function(samples) {
  var ascii = 'abcdefghijklmnopqrstuvwxyz0123456789.\'"?+-\n,:;/|_$% ', //common l.c. ascii chars
      extended = 'ßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýÿ°–', // common extended
      str = internal.decodeSamples('win1252', samples),
      asciiScore = internal.getCharScore(str, ascii),
      totalScore = internal.getCharScore(str, extended + ascii);
  return totalScore > 0.97 && asciiScore > 0.7;
};

// Reject string if it contains the "replacement character" after decoding to UTF-8
// (But remove the byte sequence for the utf-8-encoded replacement char before decoding)
internal.looksLikeUtf8 = function(samples) {
  // samples = samples.map(internal.replaceUtf8ReplacementChar);
  var str = internal.decodeSamples('utf8', samples);
  return str.indexOf('\ufffd') == -1;
};

internal.replaceUtf8ReplacementChar = function(buf) {
  var isCopy = false;
  for (var i=0, n=buf.length; i<n; i++) {
    // Check for UTF-8 encoded replacement char (0xEF 0xBF 0xBD)
    if (buf[i] == 0xef && i + 2 < n && buf[i+1] == 0xbf && buf[i+2] == 0xbd) {
      if (!isCopy) {
        buf = new Buffer(buf);
        isCopy = true;
      }
      buf[i] = buf[i+1] = buf[i+2] = 63; // ascii question mark
    }
  }
  return buf;
};

// Calc percentage of chars in a string that are present in a second string
// @chars String of chars to look for in @str
internal.getCharScore = function(str, chars) {
  var index = {},
      count = 0,
      score;
  str = str.toLowerCase();
  for (var i=0, n=chars.length; i<n; i++) {
    index[chars[i]] = 1;
  }
  for (i=0, n=str.length; i<n; i++) {
    count += index[str[i]] || 0;
  }
  return count / str.length;
};




// Insert a column of values into a (new or existing) data field
internal.insertFieldValues = function(lyr, fieldName, values) {
  var size = internal.getFeatureCount(lyr) || values.length,
      table = lyr.data = (lyr.data || new DataTable(size)),
      records = table.getRecords();
  internal.insertFieldValues2(fieldName, table.getRecords(), values);
};

internal.insertFieldValues2 = function(key, records, values) {
  var n = records.length,
      i, rec, val;
  for (i=0, n=records.length; i<n; i++) {
    rec = records[i];
    val = values[i];
    if (!rec) rec = records[i] = {};
    rec[key] = val === undefined ? null : val;
  }
};

internal.getValueType = function(val) {
  var type = null;
  if (utils.isString(val)) {
    type = 'string';
  } else if (utils.isNumber(val)) {
    type = 'number';
  } else if (utils.isBoolean(val)) {
    type = 'boolean';
  } else if (utils.isObject(val)) {
    type = 'object';
  }
  return type;
};

// Fill out a data table with undefined values
// The undefined members will disappear when records are exported as JSON,
// but will show up when fields are listed using Object.keys()
internal.fixInconsistentFields = function(records) {
  var fields = internal.findIncompleteFields(records);
  internal.patchMissingFields(records, fields);
};

internal.findIncompleteFields = function(records) {
  var counts = {},
      i, j, keys;
  for (i=0; i<records.length; i++) {
    keys = Object.keys(records[i] || {});
    for (j=0; j<keys.length; j++) {
      counts[keys[j]] = (counts[keys[j]] | 0) + 1;
    }
  }
  return Object.keys(counts).filter(function(k) {return counts[k] < records.length;});
};

internal.patchMissingFields = function(records, fields) {
  var rec, i, j, f;
  for (i=0; i<records.length; i++) {
    rec = records[i] || (records[i] = {});
    for (j=0; j<fields.length; j++) {
      f = fields[j];
      if (f in rec === false) {
        rec[f] = undefined;
      }
    }
  }
};

var c = 0;
internal.getColumnType = function(key, table) {
  var type = null,
      records = table.getRecords(),
      rec;
  for (var i=0, n=table.size(); i<n; i++) {
    c++;
    rec = records[i];
    type = rec ? internal.getValueType(rec[key]) : null;
    if (type) break;
  }
  return type;
};

internal.deleteFields = function(table, test) {
  table.getFields().forEach(function(name) {
    if (test(name)) {
      table.deleteField(name);
    }
  });
};

internal.isInvalidFieldName = function(f) {
  // Reject empty and all-whitespace strings. TODO: consider other criteria
  return /^\s*$/.test(f);
};

// Resolve name conflicts in field names by appending numbers
// @fields Array of field names
// @maxLen (optional) Maximum chars in name
//
internal.getUniqFieldNames = function(fields, maxLen) {
  var used = {};
  return fields.map(function(name) {
    var i = 0,
        validName;
    do {
      validName = internal.adjustFieldName(name, maxLen, i);
      i++;
    } while (validName in used);
    used[validName] = true;
    return validName;
  });
};

// Truncate and/or uniqify a name (if relevant params are present)
internal.adjustFieldName = function(name, maxLen, i) {
  var name2, suff;
  maxLen = maxLen || 256;
  if (!i) {
    name2 = name.substr(0, maxLen);
  } else {
    suff = String(i);
    if (suff.length == 1) {
      suff = '_' + suff;
    }
    name2 = name.substr(0, maxLen - suff.length) + suff;
  }
  return name2;
};




// DBF format references:
// http://www.dbf2002.com/dbf-file-format.html
// http://www.digitalpreservation.gov/formats/fdd/fdd000325.shtml
// http://www.clicketyclick.dk/databases/xbase/format/index.html
// http://www.clicketyclick.dk/databases/xbase/format/data_types.html

var Dbf = {};

// source: http://webhelp.esri.com/arcpad/8.0/referenceguide/index.htm#locales/task_code.htm
Dbf.languageIds = [0x01,'437',0x02,'850',0x03,'1252',0x08,'865',0x09,'437',0x0A,'850',0x0B,'437',0x0D,'437',0x0E,'850',0x0F,'437',0x10,'850',0x11,'437',0x12,'850',0x13,'932',0x14,'850',0x15,'437',0x16,'850',0x17,'865',0x18,'437',0x19,'437',0x1A,'850',0x1B,'437',0x1C,'863',0x1D,'850',0x1F,'852',0x22,'852',0x23,'852',0x24,'860',0x25,'850',0x26,'866',0x37,'850',0x40,'852',0x4D,'936',0x4E,'949',0x4F,'950',0x50,'874',0x57,'1252',0x58,'1252',0x59,'1252',0x64,'852',0x65,'866',0x66,'865',0x67,'861',0x6A,'737',0x6B,'857',0x6C,'863',0x78,'950',0x79,'949',0x7A,'936',0x7B,'932',0x7C,'874',0x86,'737',0x87,'852',0x88,'857',0xC8,'1250',0xC9,'1251',0xCA,'1254',0xCB,'1253',0xCC,'1257'];

// Language & Language family names for some code pages
Dbf.encodingNames = {
  '932': "Japanese",
  '936': "Simplified Chinese",
  '950': "Traditional Chinese",
  '1252': "Western European",
  '949': "Korean",
  '874': "Thai",
  '1250': "Eastern European",
  '1251': "Russian",
  '1254': "Turkish",
  '1253': "Greek",
  '1257': "Baltic"
};

Dbf.ENCODING_PROMPT =
  "To avoid corrupted text, re-import using the \"encoding=\" option.\n" +
  "To see a list of supported encodings, run the \"encodings\" command.";

Dbf.lookupCodePage = function(lid) {
  var i = Dbf.languageIds.indexOf(lid);
  return i == -1 ? null : Dbf.languageIds[i+1];
};

Dbf.readAsciiString = function(bin, size) {
  var require7bit = true;
  var str = bin.readCString(size, require7bit);
  if (str === null) {
    stop("DBF file contains non-ascii text.\n" + Dbf.ENCODING_PROMPT);
  }
  return utils.trim(str);
};

Dbf.readStringBytes = function(bin, size, buf) {
  var count = 0, c;
  for (var i=0; i<size; i++) {
    c = bin.readUint8();
    if (c === 0) break; // C string-terminator (observed in-the-wild)
    if (count > 0 || c != 32) { // ignore leading spaces (e.g. DBF numbers)
      buf[count++] = c;
    }
  }
  // ignore trailing spaces (DBF string fields are typically r-padded w/ spaces)
  while (count > 0 && buf[count-1] == 32) {
    count--;
  }
  return count;
};

Dbf.getAsciiStringReader = function() {
  var buf = new Uint8Array(256); // new Buffer(256);
  return function readAsciiString(bin, size) {
    var str = '',
        n = Dbf.readStringBytes(bin, size, buf);
    for (var i=0; i<n; i++) {
      str += String.fromCharCode(buf[i]);
    }
    return str;
  };
};

Dbf.getEncodedStringReader = function(encoding) {
  var buf = new Buffer(256),
      isUtf8 = internal.standardizeEncodingName(encoding) == 'utf8';
  return function readEncodedString(bin, size) {
    var i = Dbf.readStringBytes(bin, size, buf),
        str;
    if (i === 0) {
      str = '';
    } else if (isUtf8) {
      str = buf.toString('utf8', 0, i);
    } else {
      str = internal.decodeString(buf.slice(0, i), encoding); // slice references same memory
    }
    return str;
  };
};

Dbf.getStringReader = function(encoding) {
  if (!encoding || encoding === 'ascii') {
    return Dbf.getAsciiStringReader();
    // return Dbf.readAsciiString;
  } else {
    return Dbf.getEncodedStringReader(encoding);
  }
};

Dbf.bufferContainsHighBit = function(buf, n) {
  for (var i=0; i<n; i++) {
    if (buf[i] >= 128) return true;
  }
  return false;
};

Dbf.getNumberReader = function() {
  var read = Dbf.getAsciiStringReader();
  return function readNumber(bin, size) {
    var str = read(bin, size);
    var val;
    if (str.indexOf(',') >= 0) {
      str = str.replace(',', '.'); // handle comma decimal separator
    }
    val = parseFloat(str);
    return isNaN(val) ? null : val;
  };
};

Dbf.readInt = function(bin, size) {
  return bin.readInt32();
};

Dbf.readBool = function(bin, size) {
  var c = bin.readCString(size),
      val = null;
  if (/[ty]/i.test(c)) val = true;
  else if (/[fn]/i.test(c)) val = false;
  return val;
};

Dbf.readDate = function(bin, size) {
  var str = bin.readCString(size),
      yr = str.substr(0, 4),
      mo = str.substr(4, 2),
      day = str.substr(6, 2);
  return new Date(Date.UTC(+yr, +mo - 1, +day));
};

// cf. http://code.google.com/p/stringencoding/
//
// @src is a Buffer or ArrayBuffer or filename
//
function DbfReader(src, encodingArg) {
  if (utils.isString(src)) {
    error("[DbfReader] Expected a buffer, not a string");
  }
  var bin = new BinArray(src);
  var header = readHeader(bin);
  var encoding = encodingArg || null;

  this.size = function() {return header.recordCount;};

  this.readRow = function(i) {
    // create record reader on-the-fly
    // (delays encoding detection until we need to read data)
    return getRecordReader(header.fields)(i);
  };

  this.getFields = getFieldNames;

  this.getBuffer = function() {return bin.buffer();};

  this.deleteField = function(f) {
    header.fields = header.fields.filter(function(field) {
      return field.name != f;
    });
  };

  this.readRows = function() {
    var reader = getRecordReader(header.fields);
    var data = [];
    for (var r=0, n=this.size(); r<n; r++) {
      data.push(reader(r));
    }
    return data;
  };

  function readHeader(bin) {
    bin.position(0).littleEndian();
    var header = {
      version: bin.readInt8(),
      updateYear: bin.readUint8(),
      updateMonth: bin.readUint8(),
      updateDay: bin.readUint8(),
      recordCount: bin.readUint32(),
      dataOffset: bin.readUint16(),
      recordSize: bin.readUint16(),
      incompleteTransaction: bin.skipBytes(2).readUint8(),
      encrypted: bin.readUint8(),
      mdx: bin.skipBytes(12).readUint8(),
      ldid: bin.readUint8()
    };
    var colOffs = 1; // first column starts on second byte of record
    var field;
    bin.skipBytes(2);
    header.fields = [];

    // Detect header terminator (LF is standard, CR has been seen in the wild)
    while (bin.peek() != 0x0D && bin.peek() != 0x0A && bin.position() < header.dataOffset - 1) {
      field = readFieldHeader(bin);
      field.columnOffset = colOffs;
      header.fields.push(field);
      colOffs += field.size;
    }
    if (colOffs != header.recordSize) {
      error("Record length mismatch; header:", header.recordSize, "detected:", colOffs);
    }
    if (bin.peek() != 0x0D) {
      message('Found a non-standard DBF header terminator (' + bin.peek() + '). DBF file may be corrupted.');
    }

    // Uniqify header names
    internal.getUniqFieldNames(utils.pluck(header.fields, 'name')).forEach(function(name2, i) {
      header.fields[i].name = name2;
    });

    return header;
  }

  function readFieldHeader(bin) {
    return {
      name: bin.readCString(11),
      type: String.fromCharCode(bin.readUint8()),
      address: bin.readUint32(),
      size: bin.readUint8(),
      decimals: bin.readUint8(),
      id: bin.skipBytes(2).readUint8(),
      position: bin.skipBytes(2).readUint8(),
      indexFlag: bin.skipBytes(7).readUint8()
    };
  }

  function getFieldNames() {
    return utils.pluck(header.fields, 'name');
  }

  function getRowOffset(r) {
    return header.dataOffset + header.recordSize * r;
  }

  function getEncoding() {
    if (!encoding) {
      encoding = findStringEncoding();
      if (!encoding) {
        // fall back to utf8 if detection fails (so GUI can continue without further errors)
        encoding = 'utf8';
        stop("Unable to auto-detect the text encoding of the DBF file.\n" + Dbf.ENCODING_PROMPT);
      }
    }
    return encoding;
  }

  // Create new record objects using object literal syntax
  // (Much faster in v8 and other engines than assigning a series of properties
  //  to an object)
  function getRecordConstructor() {
    var args = getFieldNames().map(function(name, i) {
          return JSON.stringify(name) + ': arguments[' + i + ']';
        });
    return new Function('return {' + args.join(',') + '};');
  }

  function findEofPos(bin) {
    var pos = bin.size() - 1;
    if (bin.peek(pos) != 0x1A) { // last byte may or may not be EOF
      pos++;
    }
    return pos;
  }

  function getRecordReader(fields) {
    var readers = fields.map(getFieldReader),
        eofOffs = findEofPos(bin),
        create = getRecordConstructor(),
        values = [];

    return function readRow(r) {
      var offs = getRowOffset(r),
          fieldOffs, field;
      for (var c=0, cols=fields.length; c<cols; c++) {
        field = fields[c];
        fieldOffs = offs + field.columnOffset;
        if (fieldOffs + field.size > eofOffs) {
          stop('Invalid DBF file: encountered end-of-file while reading data');
        }
        bin.position(fieldOffs);
        values[c] = readers[c](bin, field.size);
      }
      return create.apply(null, values);
    };
  }

  // @f Field metadata from dbf header
  function getFieldReader(f) {
    var type = f.type,
        r = null;
    if (type == 'I') {
      r = Dbf.readInt;
    } else if (type == 'F' || type == 'N') {
      r = Dbf.getNumberReader();
    } else if (type == 'L') {
      r = Dbf.readBool;
    } else if (type == 'D') {
      r = Dbf.readDate;
    } else if (type == 'C') {
      r = Dbf.getStringReader(getEncoding());
    } else {
      message("Field \"" + field.name + "\" has an unsupported type (" + field.type + ") -- converting to null values");
      r = function() {return null;};
    }
    return r;
  }

  function findStringEncoding() {
    var ldid = header.ldid,
        codepage = Dbf.lookupCodePage(ldid),
        samples = getNonAsciiSamples(50),
        only7bit = samples.length === 0,
        encoding, msg;

    // First, check the ldid (language driver id) (an obsolete way to specify which
    // codepage to use for text encoding.)
    // ArcGIS up to v.10.1 sets ldid and encoding based on the 'locale' of the
    // user's Windows system :P
    //
    if (codepage && ldid != 87) {
      // if 8-bit data is found and codepage is detected, use the codepage,
      // except ldid 87, which some GIS software uses regardless of encoding.
      encoding = codepage;
    } else if (only7bit) {
      // Text with no 8-bit chars should be compatible with 7-bit ascii
      // (Most encodings are supersets of ascii)
      encoding = 'ascii';
    }

    // As a last resort, try to guess the encoding:
    if (!encoding) {
      encoding = internal.detectEncoding(samples);
    }

    // Show a sample of decoded text if non-ascii-range text has been found
    if (encoding && samples.length > 0) {
      msg = internal.decodeSamples(encoding, samples);
      msg = internal.formatStringsAsGrid(msg.split('\n'));
      msg = "\nSample text containing non-ascii characters:" + (msg.length > 60 ? '\n' : '') + msg;
      msg = "Detected DBF text encoding: " + encoding + (encoding in Dbf.encodingNames ? " (" + Dbf.encodingNames[encoding] + ")" : "") + msg;
      message(msg);
    }
    return encoding;
  }

  // Return up to @size buffers containing text samples
  // with at least one byte outside the 7-bit ascii range.
  function getNonAsciiSamples(size) {
    var samples = [];
    var stringFields = header.fields.filter(function(f) {
      return f.type == 'C';
    });
    var buf = new Buffer(256);
    var index = {};
    var f, chars, sample, hash;
    for (var r=0, rows=header.recordCount; r<rows; r++) {
      for (var c=0, cols=stringFields.length; c<cols; c++) {
        if (samples.length >= size) break;
        f = stringFields[c];
        bin.position(getRowOffset(r) + f.columnOffset);
        chars = Dbf.readStringBytes(bin, f.size, buf);
        if (chars > 0 && Dbf.bufferContainsHighBit(buf, chars)) {
          sample = new Buffer(buf.slice(0, chars)); //
          hash = sample.toString('hex');
          if (hash in index === false) { // avoid duplicate samples
            index[hash] = true;
            samples.push(sample);
          }
        }
      }
    }
    return samples;
  }

}




Dbf.MAX_STRING_LEN = 254;

Dbf.exportRecords = function(arr, encoding) {
  encoding = encoding || 'ascii';
  var fields = Dbf.getFieldNames(arr);
  var uniqFields = internal.getUniqFieldNames(fields, 10);
  var rows = arr.length;
  var fieldData = fields.map(function(name) {
    return Dbf.getFieldInfo(arr, name, encoding);
  });

  var headerBytes = Dbf.getHeaderSize(fieldData.length),
      recordBytes = Dbf.getRecordSize(utils.pluck(fieldData, 'size')),
      fileBytes = headerBytes + rows * recordBytes + 1;

  var buffer = new ArrayBuffer(fileBytes);
  var bin = new BinArray(buffer).littleEndian();
  var now = new Date();

  // write header
  bin.writeUint8(3);
  bin.writeUint8(now.getFullYear() - 1900);
  bin.writeUint8(now.getMonth() + 1);
  bin.writeUint8(now.getDate());
  bin.writeUint32(rows);
  bin.writeUint16(headerBytes);
  bin.writeUint16(recordBytes);
  bin.skipBytes(17);
  bin.writeUint8(0); // language flag; TODO: improve this
  bin.skipBytes(2);

  // field subrecords
  fieldData.reduce(function(recordOffset, obj, i) {
    var fieldName = uniqFields[i];
    bin.writeCString(fieldName, 11);
    bin.writeUint8(obj.type.charCodeAt(0));
    bin.writeUint32(recordOffset);
    bin.writeUint8(obj.size);
    bin.writeUint8(obj.decimals);
    bin.skipBytes(14);
    return recordOffset + obj.size;
  }, 1);

  bin.writeUint8(0x0d); // "field descriptor terminator"
  if (bin.position() != headerBytes) {
    error("Dbf#exportRecords() header size mismatch; expected:", headerBytes, "written:", bin.position());
  }

  arr.forEach(function(rec, i) {
    var start = bin.position();
    bin.writeUint8(0x20); // delete flag; 0x20 valid 0x2a deleted
    for (var j=0, n=fieldData.length; j<n; j++) {
      fieldData[j].write(i, bin);
    }
    if (bin.position() - start != recordBytes) {
      error("#exportRecords() Error exporting record:", rec);
    }
  });

  bin.writeUint8(0x1a); // end-of-file

  if (bin.position() != fileBytes) {
    error("Dbf#exportRecords() file size mismatch; expected:", fileBytes, "written:", bin.position());
  }
  return buffer;
};


Dbf.getFieldNames = function(records) {
  if (!records || !records.length) {
    return [];
  }
  var names = Object.keys(records[0]);
  names.sort(); // kludge: sorting gives correct order when truncating fields
  return names;
};


Dbf.getHeaderSize = function(numFields) {
  return 33 + numFields * 32;
};

Dbf.getRecordSize = function(fieldSizes) {
  return utils.sum(fieldSizes) + 1; // delete byte plus data bytes
};

/*
Dbf.getValidFieldName = function(name) {
  // TODO: handle non-ascii chars in name
  return name.substr(0, 10); // max 10 chars
};
*/

Dbf.initNumericField = function(info, arr, name) {
  var MAX_FIELD_SIZE = 18,
      data, size;

  data = this.getNumericFieldInfo(arr, name);
  info.decimals = data.decimals;
  size = Math.max(data.max.toFixed(info.decimals).length,
      data.min.toFixed(info.decimals).length);
  if (size > MAX_FIELD_SIZE) {
    size = MAX_FIELD_SIZE;
    info.decimals -= size - MAX_FIELD_SIZE;
    if (info.decimals < 0) {
      error ("Dbf#getFieldInfo() Out-of-range error.");
    }
  }
  info.size = size;

  var formatter = Dbf.getDecimalFormatter(size, info.decimals);
  info.write = function(i, bin) {
    var rec = arr[i],
        str = formatter(rec[name]);
    if (str.length < size) {
      str = utils.lpad(str, size, ' ');
    }
    bin.writeString(str, size);
  };
};

Dbf.initBooleanField = function(info, arr, name) {
  info.size = 1;
  info.write = function(i, bin) {
    var val = arr[i][name],
        c;
    if (val === true) c = 'T';
    else if (val === false) c = 'F';
    else c = '?';
    bin.writeString(c);
  };
};

Dbf.initDateField = function(info, arr, name) {
  info.size = 8;
  info.write = function(i, bin) {
    var d = arr[i][name],
        str;
    if (d instanceof Date === false) {
      str = '00000000';
    } else {
      str = utils.lpad(d.getUTCFullYear(), 4, '0') +
            utils.lpad(d.getUTCMonth() + 1, 2, '0') +
            utils.lpad(d.getUTCDate(), 2, '0');
    }
    bin.writeString(str);
  };
};

Dbf.initStringField = function(info, arr, name, encoding) {
  var formatter = Dbf.getStringWriter(encoding);
  var size = 0;
  var values = arr.map(function(rec) {
    var buf = formatter(rec[name]);
    size = Math.max(size, buf.byteLength);
    return buf;
  });
  info.size = size;
  info.write = function(i, bin) {
    var buf = values[i],
        bytes = Math.min(size, buf.byteLength),
        idx = bin.position();
    bin.writeBuffer(buf, bytes, 0);
    bin.position(idx + size);
  };
};

Dbf.getFieldInfo = function(arr, name, encoding) {
  var type = this.discoverFieldType(arr, name),
      info = {
        name: name,
        type: type,
        decimals: 0
      };
  if (type == 'N') {
    Dbf.initNumericField(info, arr, name);
  } else if (type == 'C') {
    Dbf.initStringField(info, arr, name, encoding);
  } else if (type == 'L') {
    Dbf.initBooleanField(info, arr, name);
  } else if (type == 'D') {
    Dbf.initDateField(info, arr, name);
  } else {
    // Treat null fields as empty numeric fields; this way, they will be imported
    // again as nulls.
    info.size = 0;
    info.type = 'N';
    info.write = function() {};
  }
  return info;
};

Dbf.discoverFieldType = function(arr, name) {
  var val;
  for (var i=0, n=arr.length; i<n; i++) {
    val = arr[i][name];
    if (utils.isString(val)) return "C";
    if (utils.isNumber(val)) return "N";
    if (utils.isBoolean(val)) return "L";
    if (val instanceof Date) return "D";
  }
  return null;
};

Dbf.getDecimalFormatter = function(size, decimals) {
  // TODO: find better way to handle nulls
  var nullValue = ' '; // ArcGIS may use 0
  return function(val) {
    // TODO: handle invalid values better
    var valid = utils.isFiniteNumber(val),
        strval = valid ? val.toFixed(decimals) : String(nullValue);
    return utils.lpad(strval, size, ' ');
  };
};

Dbf.getNumericFieldInfo = function(arr, name) {
  var min = 0,
      max = 0,
      k = 1,
      power = 1,
      decimals = 0,
      eps = 1e-15,
      val;
  for (var i=0, n=arr.length; i<n; i++) {
    val = arr[i][name];
    if (!utils.isFiniteNumber(val)) {
      continue;
    }
    if (val < min || val > max) {
      if (val < min) min = val;
      if (val > max) max = val;
      while (Math.abs(val) >= power) {
        power *= 10;
        eps *= 10;
      }
    }
    while (Math.abs(Math.round(val * k) - val * k) > eps) {
      if (decimals == 15) { // dbf limit
        // TODO: round overflowing values ?
        break;
      }
      decimals++;
      eps *= 10;
      k *= 10;
    }
  }
  return {
    decimals: decimals,
    min: min,
    max: max
  };
};

// Return function to convert a JS str to an ArrayBuffer containing encoded str.
Dbf.getStringWriter = function(encoding) {
  if (encoding === 'ascii') {
    return Dbf.getStringWriterAscii();
  } else {
    return Dbf.getStringWriterEncoded(encoding);
  }
};

// TODO: handle non-ascii chars. Option: switch to
// utf8 encoding if non-ascii chars are found.
Dbf.getStringWriterAscii = function() {
  return function(val) {
    var str = String(val),
        n = Math.min(str.length, Dbf.MAX_STRING_LEN),
        dest = new ArrayBuffer(n),
        view = new Uint8ClampedArray(dest);
    for (var i=0; i<n; i++) {
      view[i] = str.charCodeAt(i);
    }
    return dest;
  };
};

Dbf.getStringWriterEncoded = function(encoding) {
  var iconv = require('iconv-lite');
  return function(val) {
    var buf = iconv.encode(val, encoding);
    if (buf.length >= Dbf.MAX_STRING_LEN) {
      buf = Dbf.truncateEncodedString(buf, encoding, Dbf.MAX_STRING_LEN);
    }
    return BinArray.toArrayBuffer(buf);
  };
};

// try to remove partial multi-byte characters from the end of an encoded string.
Dbf.truncateEncodedString = function(buf, encoding, maxLen) {
  var truncated = buf.slice(0, maxLen);
  var len = maxLen;
  var tmp, str;
  while (len > 0 && len >= maxLen - 3) {
    tmp = len == maxLen ? truncated : buf.slice(0, len);
    str = internal.decodeString(tmp, encoding);
    if (str.charAt(str.length-1) != '\ufffd') {
      truncated = tmp;
      break;
    }
    len--;
  }
  return truncated;
};




var dataFieldRxp = /^[a-zA-Z_][a-zA-Z_0-9]*$/;

function DataTable(obj) {
  var records;
  if (utils.isArray(obj)) {
    records = obj;
  } else {
    records = [];
    // integer object: create empty records
    if (utils.isInteger(obj)) {
      for (var i=0; i<obj; i++) {
        records.push({});
      }
    } else if (obj) {
      error("Invalid DataTable constructor argument:", obj);
    }
  }

  this.exportAsDbf = function(encoding) {
    return Dbf.exportRecords(records, encoding);
  };

  this.getRecords = function() {
    return records;
  };

  this.getRecordAt = function(i) {
    return records[i];
  };
}

var dataTableProto = {

  fieldExists: function(name) {
    return utils.contains(this.getFields(), name);
  },

  toString: function() {return JSON.stringify(this);},

  toJSON: function() {
    return this.getRecords();
  },

  addField: function(name, init) {
    var useFunction = utils.isFunction(init);
    if (!utils.isNumber(init) && !utils.isString(init) && !useFunction) {
      error("DataTable#addField() requires a string, number or function for initialization");
    }
    if (this.fieldExists(name)) error("DataTable#addField() tried to add a field that already exists:", name);
    if (!dataFieldRxp.test(name)) error("DataTable#addField() invalid field name:", name);

    this.getRecords().forEach(function(obj, i) {
      obj[name] = useFunction ? init(obj, i) : init;
    });
  },

  addIdField: function() {
    this.addField('FID', function(obj, i) {
      return i;
    });
  },

  deleteField: function(f) {
    this.getRecords().forEach(function(o) {
      delete o[f];
    });
  },

  getFields: function() {
    var records = this.getRecords(),
        first = records[0];
    return first ? Object.keys(first) : [];
  },

  update: function(f) {
    var records = this.getRecords();
    for (var i=0, n=records.length; i<n; i++) {
      records[i] = f(records[i], i);
    }
  },

  clone: function() {
    // TODO: this could be sped up using a record constructor function
    // (see getRecordConstructor() in DbfReader)
    var records2 = this.getRecords().map(function(rec) {
      return utils.extend({}, rec);
    });
    return new DataTable(records2);
  },

  size: function() {
    return this.getRecords().length;
  }
};

utils.extend(DataTable.prototype, dataTableProto);




internal.simplifyArcsFast = function(arcs, dist) {
  var xx = [],
      yy = [],
      nn = [],
      count;
  for (var i=0, n=arcs.size(); i<n; i++) {
    count = internal.simplifyPathFast([i], arcs, dist, xx, yy);
    if (count == 1) {
      count = 0;
      xx.pop();
      yy.pop();
    }
    nn.push(count);
  }
  return new ArcCollection(nn, xx, yy);
};

internal.simplifyPolygonFast = function(shp, arcs, dist) {
  if (!shp || !dist) return null;
  var xx = [],
      yy = [],
      nn = [],
      shp2 = [];

  shp.forEach(function(path) {
    var count = internal.simplifyPathFast(path, arcs, dist, xx, yy);
    while (count < 4 && count > 0) {
      xx.pop();
      yy.pop();
      count--;
    }
    if (count > 0) {
      shp2.push([nn.length]);
      nn.push(count);
    }
  });
  return {
    shape: shp2.length > 0 ? shp2 : null,
    arcs: new ArcCollection(nn, xx, yy)
  };
};

internal.simplifyPathFast = function(path, arcs, dist, xx, yy) {
  var iter = arcs.getShapeIter(path),
      count = 0,
      prevX, prevY, x, y;
  while (iter.hasNext()) {
    x = iter.x;
    y = iter.y;
    if (count === 0 || distance2D(x, y, prevX, prevY) > dist) {
      xx.push(x);
      yy.push(y);
      prevX = x;
      prevY = y;
      count++;
    }
  }
  if (x != prevX || y != prevY) {
    xx.push(x);
    yy.push(y);
    count++;
  }
  return count;
};




// Get the centroid of the largest ring of a polygon
// TODO: Include holes in the calculation
// TODO: Add option to find centroid of all rings, not just the largest
geom.getShapeCentroid = function(shp, arcs) {
  var maxPath = geom.getMaxPath(shp, arcs);
  return maxPath ? geom.getPathCentroid(maxPath, arcs) : null;
};

geom.getPathCentroid = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
      sum = 0,
      sumX = 0,
      sumY = 0,
      ax, ay, tmp, area;
  if (!iter.hasNext()) return null;
  ax = iter.x;
  ay = iter.y;
  while (iter.hasNext()) {
    tmp = ax * iter.y - ay * iter.x;
    sum += tmp;
    sumX += tmp * (iter.x + ax);
    sumY += tmp * (iter.y + ay);
    ax = iter.x;
    ay = iter.y;
  }
  area = sum / 2;
  if (area === 0) {
    return geom.getAvgPathXY(ids, arcs);
  } else return {
    x: sumX / (6 * area),
    y: sumY / (6 * area)
  };
};

// Find a point inside a polygon and located away from the polygon edge
// Method:
// - get the largest ring of the polygon
// - get an array of x-values distributed along the horizontal extent of the ring
// - for each x:
//     intersect a vertical line with the polygon at x
//     find midpoints of each intersecting segment
// - for each midpoint:
//     adjust point vertically to maximize weighted distance from polygon edge
// - return the adjusted point having the maximum weighted distance from the edge
//
// (distance is weighted to slightly favor points near centroid)
//
geom.findInteriorPoint = function(shp, arcs) {
  var maxPath = shp && geom.getMaxPath(shp, arcs),
      pathBounds = maxPath && arcs.getSimpleShapeBounds(maxPath),
      thresh, simple;
  if (!pathBounds || !pathBounds.hasBounds() || pathBounds.area() === 0) {
    return null;
  }
  thresh = Math.sqrt(pathBounds.area()) * 0.01;
  simple = internal.simplifyPolygonFast(shp, arcs, thresh);
  if (!simple.shape) {
    return null; // collapsed shape
  }
  return geom.findInteriorPoint2(simple.shape, simple.arcs);
};

// Assumes: shp is a polygon with at least one space-enclosing ring
geom.findInteriorPoint2 = function(shp, arcs) {
  var maxPath = geom.getMaxPath(shp, arcs);
  var pathBounds = arcs.getSimpleShapeBounds(maxPath);
  var centroid = geom.getPathCentroid(maxPath, arcs);
  var weight = internal.getPointWeightingFunction(centroid, pathBounds);
  var area = geom.getPlanarPathArea(maxPath, arcs);
  var hrange, lbound, rbound, focus, htics, hstep, p, p2;

  // Limit test area if shape is simple and squarish
  if (shp.length == 1 && area * 1.2 > pathBounds.area()) {
    htics = 5;
    focus = 0.2;
  } else if (shp.length == 1 && area * 1.7 > pathBounds.area()) {
    htics = 7;
    focus = 0.4;
  } else {
    htics = 11;
    focus = 0.5;
  }
  hrange = pathBounds.width() * focus;
  lbound = centroid.x - hrange / 2;
  rbound = lbound + hrange;
  hstep = hrange / htics;

  // Find a best-fit point
  p = internal.probeForBestInteriorPoint(shp, arcs, lbound, rbound, htics, weight);
  if (!p) {
    verbose("[points inner] failed, falling back to centroid");
   p = centroid;
  } else {
    // Look for even better fit close to best-fit point
    p2 = internal.probeForBestInteriorPoint(shp, arcs, p.x - hstep / 2,
        p.x + hstep / 2, 2, weight);
    if (p2.distance > p.distance) {
      p = p2;
    }
  }
  return p;
};

internal.getPointWeightingFunction = function(centroid, pathBounds) {
  // Get a factor for weighting a candidate point
  // Points closer to the centroid are slightly preferred
  var referenceDist = Math.max(pathBounds.width(), pathBounds.height()) / 2;
  return function(x, y) {
    var offset = distance2D(centroid.x, centroid.y, x, y);
    return 1 - Math.min(0.6 * offset / referenceDist, 0.25);
  };
};

internal.findInteriorPointCandidates = function(shp, arcs, xx) {
  var ymin = arcs.getBounds().ymin - 1;
  return xx.reduce(function(memo, x) {
    var cands = internal.findHitCandidates(x, ymin, shp, arcs);
    return memo.concat(cands);
  }, []);
};

internal.probeForBestInteriorPoint = function(shp, arcs, lbound, rbound, htics, weight) {
  var tics = internal.getInnerTics(lbound, rbound, htics);
  var interval = (rbound - lbound) / htics;
  // Get candidate points, distributed along x-axis
  var candidates = internal.findInteriorPointCandidates(shp, arcs, tics);
  var bestP, adjustedP, candP;

  // Sort candidates so points at the center of longer segments are tried first
  candidates.forEach(function(p) {
    p.interval *= weight(p.x, p.y);
  });
  candidates.sort(function(a, b) {
    return b.interval - a.interval;
  });

  for (var i=0; i<candidates.length; i++) {
    candP = candidates[i];
    // Optimization: Stop searching if weighted half-segment length of remaining
    //   points is less than the weighted edge distance of the best candidate
    if (bestP && bestP.distance > candP.interval) {
      break;
    }
    adjustedP = internal.getAdjustedPoint(candP.x, candP.y, shp, arcs, interval, weight);

    if (!bestP || adjustedP.distance > bestP.distance) {
      bestP = adjustedP;
    }
  }
  return bestP;
};

// [x, y] is a point assumed to be inside a polygon @shp
// Try to move the point farther from the polygon edge
internal.getAdjustedPoint = function(x, y, shp, arcs, vstep, weight) {
  var p = {
    x: x,
    y: y,
    distance: geom.getPointToShapeDistance(x, y, shp, arcs) * weight(x, y)
  };
  internal.scanForBetterPoint(p, shp, arcs, vstep, weight); // scan up
  internal.scanForBetterPoint(p, shp, arcs, -vstep, weight); // scan down
  return p;
};

// Try to find a better-fit point than @p by scanning vertically
// Modify p in-place
internal.scanForBetterPoint = function(p, shp, arcs, vstep, weight) {
  var x = p.x,
      y = p.y,
      dmax = p.distance,
      d;

  while (true) {
    y += vstep;
    d = geom.getPointToShapeDistance(x, y, shp, arcs) * weight(x, y);
    // overcome vary small local minima
    if (d > dmax * 0.90 && geom.testPointInPolygon(x, y, shp, arcs)) {
      if (d > dmax) {
        p.distance = dmax = d;
        p.y = y;
      }
    } else {
      break;
    }
  }
};

// Return array of points at the midpoint of each line segment formed by the
//   intersection of a vertical ray at [x, y] and a polygon shape
internal.findHitCandidates = function(x, y, shp, arcs) {
  var yy = internal.findRayShapeIntersections(x, y, shp, arcs);
  var cands = [], y1, y2, interval;

  // sorting by y-coord organizes y-intercepts into interior segments
  utils.genericSort(yy);
  for (var i=0; i<yy.length; i+=2) {
    y1 = yy[i];
    y2 = yy[i+1];
    interval = (y2 - y1) / 2;
    if (interval > 0) {
      cands.push({
        y: (y1 + y2) / 2,
        x: x,
        interval: interval
      });
    }
  }
  return cands;
};

// Return array of y-intersections between vertical ray with origin at [x, y]
//   and a polygon
internal.findRayShapeIntersections = function(x, y, shp, arcs) {
  if (!shp) return [];
  return shp.reduce(function(memo, path) {
    var yy = internal.findRayRingIntersections(x, y, path, arcs);
    return memo.concat(yy);
  }, []);
};

// Return array of y-intersections between vertical ray and a polygon ring
internal.findRayRingIntersections = function(x, y, path, arcs) {
  var yints = [];
  internal.forEachPathSegment(path, arcs, function(a, b, xx, yy) {
    var result = geom.getRayIntersection(x, y, xx[a], yy[a], xx[b], yy[b]);
    if (result > -Infinity) {
      yints.push(result);
    }
  });
  // Ignore odd number of intersections -- probably caused by a ray that touches
  //   but doesn't cross the ring
  // TODO: improve method to handle edge case with two touches and no crosses.
  if (yints.length % 2 === 1) {
    yints = [];
  }
  return yints;
};

// TODO: find better home + name for this
internal.getInnerTics = function(min, max, steps) {
  var range = max - min,
      step = range / (steps + 1),
      arr = [];
  for (var i = 1; i<=steps; i++) {
    arr.push(min + step * i);
  }
  return arr;
};




function addGetters(obj, getters) {
  Object.keys(getters).forEach(function(name) {
    Object.defineProperty(obj, name, {get: getters[name]});
  });
}

internal.initFeatureProxy = function(lyr, arcs) {
  var hasPoints = internal.layerHasPoints(lyr),
      hasPaths = arcs && internal.layerHasPaths(lyr),
      _records = lyr.data ? lyr.data.getRecords() : null,
      _isPlanar = hasPaths && arcs.isPlanar(),
      ctx = {},
      _bounds, _centroid, _innerXY, _xy, _ids, _id;

  // all contexts have $.id
  addGetters(ctx, {id: function() { return _id; }});

  if (_records) {
    Object.defineProperty(ctx, 'properties',
      {set: function(obj) {
        if (utils.isObject(obj)) {
          _records[_id] = obj;
        } else {
          stop("Can't assign non-object to $.properties");
        }
      }, get: function() {
        var rec = _records[_id];
        if (!rec) {
          rec = _records[_id] = {};
        }
        return rec;
      }});
  }

  if (hasPaths) {
    addGetters(ctx, {
      // TODO: count hole/s + containing ring as one part
      partCount: function() {
        return _ids ? _ids.length : 0;
      },
      isNull: function() {
        return ctx.partCount === 0;
      },
      bounds: function() {
        return shapeBounds().toArray();
      },
      height: function() {
        return shapeBounds().height();
      },
      width: function() {
        return shapeBounds().width();
      }
    });

    if (lyr.geometry_type == 'polygon') {
      addGetters(ctx, {
        area: function() {
          return _isPlanar ? ctx.planarArea : geom.getSphericalShapeArea(_ids, arcs);
        },
        planarArea: function() {
          return geom.getPlanarShapeArea(_ids, arcs);
        },
        originalArea: function() {
          var i = arcs.getRetainedInterval(),
              area;
          arcs.setRetainedInterval(0);
          area = ctx.area;
          arcs.setRetainedInterval(i);
          return area;
        },
        centroidX: function() {
          var p = centroid();
          return p ? p.x : null;
        },
        centroidY: function() {
          var p = centroid();
          return p ? p.y : null;
        },
        innerX: function() {
          var p = innerXY();
          return p ? p.x : null;
        },
        innerY: function() {
          var p = innerXY();
          return p ? p.y : null;
        }
      });
    }

  } else if (hasPoints) {
    // TODO: add functions like bounds, isNull, pointCount
    Object.defineProperty(ctx, 'coordinates',
      {set: function(obj) {
        if (!obj || utils.isArray(obj)) {
          lyr.shapes[_id] = obj || null;
        } else {
          stop("Can't assign non-array to $.coordinates");
        }
      }, get: function() {
        return lyr.shapes[_id] || null;
      }});

    addGetters(ctx, {
      x: function() {
        xy();
        return _xy ? _xy[0] : null;
      },
      y: function() {
        xy();
        return _xy ? _xy[1] : null;
      }
    });
  }

  function xy() {
    var shape = lyr.shapes[_id];
    if (!_xy) {
      _xy = shape && shape[0] || null;
    }
    return _xy;
  }

  function centroid() {
    _centroid = _centroid || geom.getShapeCentroid(_ids, arcs);
    return _centroid;
  }

  function innerXY() {
    _innerXY = _innerXY || geom.findInteriorPoint(_ids, arcs);
    return _innerXY;
  }

  function shapeBounds() {
    if (!_bounds) {
      _bounds = arcs.getMultiShapeBounds(_ids);
    }
    return _bounds;
  }

  return function(id) {
    _id = id;
    // reset stored values
    if (hasPaths) {
      _bounds = null;
      _centroid = null;
      _innerXY = null;
      _ids = lyr.shapes[id];
    }
    if (hasPoints) {
      _xy = null;
    }
    return ctx;
  };
};




// Compiled expression returns a value
internal.compileValueExpression = function(exp, lyr, arcs, opts) {
  opts = opts || {};
  opts.returns = true;
  return internal.compileFeatureExpression(exp, lyr, arcs, opts);
};

internal.compileFeatureExpression = function(rawExp, lyr, arcs, opts_) {
  var opts = utils.extend({}, opts_),
      exp = rawExp || '',
      mutable = !opts.no_assign, // block assignment expressions
      vars = internal.getAssignedVars(exp),
      func, records;

  if (mutable && vars.length > 0 && !lyr.data) {
    internal.initDataTable(lyr);
  }

  if (!mutable) {
    // protect global object from assigned values
    opts.context = opts.context || {};
    internal.nullifyUnsetProperties(vars, opts.context);
  }

  records = lyr.data ? lyr.data.getRecords() : [];
  func = internal.getExpressionFunction(exp, lyr, arcs, opts);

  // @destRec (optional) substitute for records[recId] (used by -calc)
  return function(recId, destRec) {
    var record;
    if (destRec) {
      record = destRec;
    } else {
      record = records[recId] || (records[recId] = {});
    }

    // initialize new fields to null so assignments work
    if (mutable) {
      internal.nullifyUnsetProperties(vars, record);
    }
    return func(record, recId);
  };
};

// Return array of variables on the left side of assignment operations
// @hasDot (bool) Return property assignments via dot notation
internal.getAssignedVars = function(exp, hasDot) {
  var rxp = /[a-z_][.a-z0-9_]*(?= *=[^=])/ig;
  var matches = exp.match(rxp) || [];
  var f = function(s) {
    var i = s.indexOf('.');
    return hasDot ? i > -1 : i == -1;
  };
  return utils.uniq(matches.filter(f));
};

// Return array of objects with properties assigned via dot notation
// e.g.  'd.value = 45' ->  ['d']
internal.getAssignmentObjects = function(exp) {
  var matches = internal.getAssignedVars(exp, true),
      names = [];
  matches.forEach(function(s) {
    var match = /^([^.]+)\.[^.]+$/.exec(s);
    var name = match ? match[1] : null;
    if (name && name != 'this') {
      names.push(name);
    }
  });
  return utils.uniq(names);
};

internal.getExpressionFunction = function(exp, lyr, arcs, opts) {
  var getFeatureById = internal.initFeatureProxy(lyr, arcs);
  var ctx = internal.getExpressionContext(lyr, opts.context);
  var functionBody = "with(env){with(record){ " + (opts.returns ? 'return ' : '') +
        exp + "}}";
  var func;
  try {
    func = new Function("record,env",  functionBody);
  } catch(e) {
    stop(e.name, "in expression [" + exp + "]");
  }
  return function(rec, i) {
    var val;
    ctx.$ = getFeatureById(i);
    ctx._ = ctx; // provide access to functions when masked by variable names
    try {
      val = func.call(ctx.$, rec, ctx);
    } catch(e) {
      stop(e.name, "in expression [" + exp + "]:", e.message);
    }
    return val;
  };
};

internal.nullifyUnsetProperties = function(vars, obj) {
  for (var i=0; i<vars.length; i++) {
    if (vars[i] in obj === false) {
      obj[vars[i]] = null;
    }
  }
};

internal.getExpressionContext = function(lyr, mixins) {
  var env = internal.getBaseContext();
  if (lyr.data) {
    // default to null values when a data field is missing
    internal.nullifyUnsetProperties(lyr.data.getFields(), env);
  }
  if (mixins) {
    Object.keys(mixins).forEach(function(key) {
      // Catch name collisions between data fields and user-defined functions
      if (key in env) message('Warning: "' + key + '" has multiple definitions');
      env[key] = mixins[key];
    });
    utils.extend(env, mixins);
  }
  // make context properties non-writable, so they can't be replaced by an expression
  return Object.keys(env).reduce(function(memo, key) {
    Object.defineProperty(memo, key, {value: env[key]}); // writable: false is default
    return memo;
  }, {});
};

internal.getBaseContext = function() {
  var obj = {};
  // Mask global properties (is this effective/worth doing?)
  (function() {
    for (var key in this) {
      obj[key] = null;
    }
  }());
  obj.console = console;
  return obj;
};




api.filterFeatures = function(lyr, arcs, opts) {
  var records = lyr.data ? lyr.data.getRecords() : null,
      shapes = lyr.shapes || null,
      n = internal.getFeatureCount(lyr),
      filteredShapes = shapes ? [] : null,
      filteredRecords = records ? [] : null,
      filteredLyr = internal.getOutputLayer(lyr, opts),
      filter;

  if (opts.expression) {
    filter = internal.compileValueExpression(opts.expression, lyr, arcs);
  }

  if (opts.remove_empty) {
    filter = internal.combineFilters(filter, internal.getNullGeometryFilter(lyr, arcs));
  }

  if (!filter) {
    stop("Missing a filter expression");
  }

  utils.repeat(n, function(shapeId) {
    var result = filter(shapeId);
    if (result === true) {
      if (shapes) filteredShapes.push(shapes[shapeId] || null);
      if (records) filteredRecords.push(records[shapeId] || null);
    } else if (result !== false) {
      stop("Expression must return true or false");
    }
  });

  filteredLyr.shapes = filteredShapes;
  filteredLyr.data = filteredRecords ? new DataTable(filteredRecords) : null;
  if (opts.no_replace) {
    // if adding a layer, don't share objects between source and filtered layer
    filteredLyr = internal.copyLayer(filteredLyr);
  }

  if (opts.verbose !== false) {
    message(utils.format('Retained %,d of %,d features', internal.getFeatureCount(filteredLyr), n));
  }

  return filteredLyr;
};

internal.getNullGeometryFilter = function(lyr, arcs) {
  var shapes = lyr.shapes;
  if (lyr.geometry_type == 'polygon') {
    return internal.getEmptyPolygonFilter(shapes, arcs);
  }
  return function(i) {return !!shapes[i];};
};

internal.getEmptyPolygonFilter = function(shapes, arcs) {
  return function(i) {
    var shp = shapes[i];
    return !!shp && geom.getPlanarShapeArea(shapes[i], arcs) > 0;
  };
};

internal.combineFilters = function(a, b) {
  return (a && b && function(id) {
      return a(id) && b(id);
    }) || a || b;
};




internal.getMode = function(values) {
  var data = internal.getModeData(values);
  return data.modes[0];
};

internal.getModeData = function(values) {
  var maxCount = 0, nextCount = 0,
      uniq = [],
      modes = [],
      counts = {},
      val, i, count, margin;
  if (values.length == 1) {
    return {modes: values, margin: 1};
  }
  // get max count and array of uniq values
  for (i=0; i<values.length; i++) {
    val = values[i];
    if (val in counts === false) {
      count = 0;
      uniq.push(val);
    } else {
      count = counts[val];
    }
    counts[val] = ++count;
    if (count > maxCount) maxCount = count;
  }
  // get mode values (may be multiple) and margin
  margin = maxCount;
  for (i=0; i<uniq.length; i++) {
    count = counts[uniq[i]];
    if (count === maxCount) {
      modes.push(uniq[i]);
    } else if (count > nextCount) {
      nextCount = count;
    }
  }
  return {
    modes: modes,
    margin: modes.length > 1 ? 0 : maxCount - nextCount
  };
};




// Calculate an expression across a group of features, print and return the result
// Supported functions include sum(), average(), max(), min(), median(), count()
// Functions receive an expression to be applied to each feature (like the -each command)
// Examples: 'sum($.area)' 'min(income)'
// opts.expression  Expression to evaluate
// opts.where  Optional filter expression (see -filter command)
//
api.calc = function(lyr, arcs, opts) {
  var msg = opts.expression,
      result;
  if (opts.where) {
    // TODO: implement no_replace option for filter() instead of this
    lyr = {
      shapes: lyr.shapes,
      data: lyr.data
    };
    api.filterFeatures(lyr, arcs, {expression: opts.where});
    msg += ' where ' + opts.where;
  }
  result = internal.evalCalcExpression(lyr, arcs, opts.expression);
  message(msg + ":  " + result);
  return result;
};

internal.evalCalcExpression = function(lyr, arcs, exp) {
  return internal.compileCalcExpression(lyr, arcs, exp)();
};

internal.compileCalcExpression = function(lyr, arcs, exp) {
  var rowNo = 0, colNo = 0, cols = [];
  var ctx1 = { // context for first phase (capturing values for each feature)
        count: assign,
        sum: captureNum,
        average: captureNum,
        median: captureNum,
        min: captureNum,
        max: captureNum,
        mode: capture,
        collect: capture,
        first: assignOnce,
        last: assign
      },
      ctx2 = { // context for second phase (calculating results)
        count: wrap(function() {return rowNo;}, 0),
        sum: wrap(utils.sum, 0),
        median: wrap(utils.findMedian),
        min: wrap(min),
        max: wrap(max),
        average: wrap(utils.mean),
        mode: wrap(internal.getMode),
        collect: wrap(pass),
        first: wrap(pass),
        last: wrap(pass)
      },
      len = internal.getFeatureCount(lyr),
      calc1, calc2, result;

  if (lyr.geometry_type) {
    // add functions related to layer geometry (e.g. for subdivide())
    ctx1.width = ctx1.height = noop;
    ctx2.width = function() {return internal.getLayerBounds(lyr, arcs).width();};
    ctx2.height = function() {return internal.getLayerBounds(lyr, arcs).height();};
  }

  calc1 = internal.compileFeatureExpression(exp, lyr, arcs, {context: ctx1,
      no_assign: true});
  calc2 = internal.compileFeatureExpression(exp, {data: lyr.data}, null,
      {returns: true, context: ctx2});

  // @destRec: optional destination record for assignments
  return function(ids, destRec) {
    var result;
    // phase 1: capture data
    if (ids) procRecords(ids);
    else procAll();
    // phase 2: calculate
    result = calc2(undefined, destRec);
    reset();
    return result;
  };

  function pass(o) {return o;}

  function max(arr) {
    return utils.getArrayBounds(arr).max;
  }

  function min(arr) {
    return utils.getArrayBounds(arr).min;
  }

  // process captured data, or return nodata value if no records have been captured
  function wrap(proc, nullVal) {
    var nodata = arguments.length > 1 ? nullVal : null;
    return function() {
      var c = colNo++;
      return rowNo > 0 ? proc(cols[c]) : nodata;
    };
  }

  function procAll() {
    for (var i=0; i<len; i++) {
      procRecord(i);
    }
  }

  function procRecords(ids) {
    ids.forEach(procRecord);
  }

  function procRecord(i) {
    if (i < 0 || i >= len) error("Invalid record index");
    calc1(i);
    rowNo++;
    colNo = 0;
  }

  function noop() {}

  function reset() {
    rowNo = 0;
    colNo = 0;
    cols = [];
  }

  function captureNum(val) {
    if (isNaN(val) && val) { // accepting falsy values (be more strict?)
      stop("Expected a number, received:", val);
    }
    return capture(val);
  }

  function assignOnce(val) {
    if (rowNo === 0) cols[colNo] = val;
    colNo++;
    return val;
  }

  function assign(val) {
    cols[colNo++] = val;
    return val;
  }
  /*
  function captureArr(val) {
    capture(val);
    return [];
  }
  */

  function capture(val) {
    var col;
    if (rowNo === 0) {
      cols[colNo] = [];
    }
    col = cols[colNo];
    if (col.length != rowNo) {
      // make sure all functions are called each time
      // (if expression contains a condition, it will throw off the calculation)
      // TODO: allow conditions
      stop("Evaluation failed");
    }
    col.push(val);
    colNo++;
    return val;
  }
};




// get function that returns an object containing calculated values
internal.getJoinCalc = function(src, exp) {
  var calc = internal.compileCalcExpression({data: src}, null, exp);
  return function(ids, destRec) {
    if (!ids) ids = [];
    calc(ids, destRec);
  };
};




// Return a function to convert original feature ids into ids of combined features
// Use categorical classification (a different id for each unique value)
internal.getCategoryClassifier = function(field, data) {
  if (!field) return function(i) {return 0;};
  if (!data || !data.fieldExists(field)) {
    stop("Data table is missing field:", field);
  }
  var index = {},
      count = 0,
      records = data.getRecords();
  return function(i) {
    var val = String(records[i][field]);
    if (val in index === false) {
      index[val] = count++;
    }
    return index[val];
  };
};

// Return a properties array for a set of aggregated features
//
// @properties input records
// @getGroupId()  converts input record id to id of aggregated record
//
internal.aggregateDataRecords = function(properties, getGroupId, opts) {
  var groups = internal.groupIds(getGroupId, properties.length),
      sumFields = opts.sum_fields || [],
      copyFields = opts.copy_fields || [],
      calc;

  if (opts.field) {
    copyFields.push(opts.field);
  }

  if (opts.calc) {
    calc = internal.getJoinCalc(new DataTable(properties), opts.calc);
  }

  function sum(field, group) {
    var tot = 0, rec;
    for (var i=0; i<group.length; i++) {
      rec = properties[group[i]];
      tot += rec && rec[field] || 0;
    }
    return tot;
  }

  return groups.map(function(group) {
    var rec = {},
        j, first;
    group = group || [];
    first = properties[group[0]];
    for (j=0; j<sumFields.length; j++) {
      rec[sumFields[j]] = sum(sumFields[j], group);
    }
    for (j=0; j<copyFields.length; j++) {
      rec[copyFields[j]] = first ? first[copyFields[j]] : null;
    }
    if (calc) {
      calc(group, rec);
    }
    return rec;
  });
};

// Returns array containing groups of feature indexes
// @getId() (function) converts feature index into group index
// @n number of features
//
internal.groupIds = function(getId, n) {
  var groups = [], id;
  for (var i=0; i<n; i++) {
    id = getId(i);
    if (id in groups) {
      groups[id].push(i);
    } else {
      groups[id] = [i];
    }
  }
  return groups;
};




function dissolvePointLayerGeometry(lyr, getGroupId, opts) {
  var useSph = !opts.planar && internal.probablyDecimalDegreeBounds(internal.getLayerBounds(lyr));
  var getWeight = opts.weight ? internal.compileValueExpression(opts.weight, lyr) : null;
  var groups = [];

  // TODO: support multipoints
  if (internal.countMultiPartFeatures(lyr.shapes) !== 0) {
    stop("Dissolving multi-part points is not supported");
  }

  lyr.shapes.forEach(function(shp, i) {
    var groupId = getGroupId(i);
    var weight = getWeight ? getWeight(i) : 1;
    var p = shp && shp[0]; // Using first point (TODO: handle multi-point features)
    var tmp;
    if (!p) return;
    if (useSph) {
      tmp = [];
      lngLatToXYZ(p[0], p[1], tmp);
      p = tmp;
    }
    groups[groupId] = reducePointCentroid(groups[groupId], p, weight);
  });

  return groups.map(function(memo) {
    var p1, p2;
    if (!memo) return null;
    if (useSph) {
      p1 = memo.centroid;
      p2 = [];
      xyzToLngLat(p1[0], p1[1], p1[2], p2);
    } else {
      p2 = memo.centroid;
    }
    return memo ? [p2] : null;
  });
}

function reducePointCentroid(memo, p, weight) {
  var x = p[0],
      y = p[1],
      sum, k;

  if (x == x && y == y && weight > 0) {
    if (!memo) {
      memo = {sum: weight, centroid: p.concat()};
    } else {
      sum = memo.sum + weight;
      k = memo.sum / sum;
      memo.centroid[0] = k * memo.centroid[0] + weight * x / sum;
      memo.centroid[1] = k * memo.centroid[1] + weight * y / sum;
      if (p.length == 3) {
        memo.centroid[2] = k * memo.centroid[2] + weight * p[2] / sum;
      }
      memo.sum = sum;
    }
  }
  return memo;
}




function dissolvePolygonGeometry(shapes, getGroupId) {
  var segments = dissolveFirstPass(shapes, getGroupId);
  return dissolveSecondPass(segments, shapes, getGroupId);
}

// First pass -- identify pairs of segments that can be dissolved
function dissolveFirstPass(shapes, getGroupId) {
  var groups = [],
      largeGroups = [],
      segments = [],
      ids = shapes.map(function(shp, i) {
        return getGroupId(i);
      });

  internal.traversePaths(shapes, procArc);
  largeGroups.forEach(splitGroup);
  return segments;

  function procArc(obj) {
    var arcId = obj.arcId,
        idx = arcId < 0 ? ~arcId : arcId,
        segId = segments.length,
        group = groups[idx];
    if (!group) {
      group = [];
      groups[idx] = group;
    }
    group.push(segId);
    obj.group = group;
    segments.push(obj);

    // Three or more segments sharing the same arc is abnormal topology...
    // Need to try to identify pairs of matching segments in each of these
    // groups.
    //
    if (group.length == 3) {
      largeGroups.push(group);
    }
  }

  function findMatchingPair(group, cb) {
    var arc1, arc2;
    for (var i=0; i<group.length - 1; i++) {
      arc1 = segments[group[i]];
      for (var j=i+1; j<group.length; j++) {
        arc2 = segments[group[j]];
        if (cb(arc1, arc2)) {
          return [arc1.segId, arc2.segId];
        }
      }
    }
    return null;
  }

  function checkFwExtension(arc1, arc2) {
    return getNextSegment(arc1, segments, shapes).arcId ===
        ~getNextSegment(arc2, segments, shapes).arcId;
  }

  function checkBwExtension(arc1, arc2) {
    return getPrevSegment(arc1, segments, shapes).arcId ===
        ~getPrevSegment(arc2, segments, shapes).arcId;
  }

  function checkDoubleExtension(arc1, arc2) {
    return checkPairwiseMatch(arc1, arc2) &&
        checkFwExtension(arc1, arc2) &&
        checkBwExtension(arc1, arc2);
  }

  function checkSingleExtension(arc1, arc2) {
    return checkPairwiseMatch(arc1, arc2) &&
        (checkFwExtension(arc1, arc2) ||
        checkBwExtension(arc1, arc2));
  }

  function checkPairwiseMatch(arc1, arc2) {
    return arc1.arcId === ~arc2.arcId && ids[arc1.shapeId] ===
        ids[arc2.shapeId];
  }

  function updateGroupIds(ids) {
    ids.forEach(function(id) {
      segments[id].group = ids;
    });
  }

  // split a group of segments into pairs of matching segments + a residual group
  // @group Array of segment ids
  //
  function splitGroup(group) {
    // find best-match segment pair
    var group2 = findMatchingPair(group, checkDoubleExtension) ||
        findMatchingPair(group, checkSingleExtension) ||
        findMatchingPair(group, checkPairwiseMatch);
    if (group2) {
      group = group.filter(function(i) {
        return !utils.contains(group2, i);
      });
      updateGroupIds(group);
      updateGroupIds(group2);
      // Split again if reduced group is still large
      if (group.length > 2) splitGroup(group);
    }
  }
}

// Second pass -- generate dissolved shapes
//
function dissolveSecondPass(segments, shapes, getGroupId) {
  var dissolveShapes = [];
  segments.forEach(procSegment);
  return dissolveShapes;

  // @obj is an arc instance
  function procSegment(obj) {
    if (obj.used) return;
    var match = findDissolveArc(obj);
    if (!match) buildRing(obj);
  }

  function addRing(arcs, i) {
    if (i in dissolveShapes === false) {
      dissolveShapes[i] = [];
    }
    dissolveShapes[i].push(arcs);
  }

  // Generate a dissolved ring
  // @firstArc the first arc instance in the ring
  //
  function buildRing(firstArc) {
    var newArcs = [firstArc.arcId],
        nextArc = getNextArc(firstArc);
        firstArc.used = true;

    while (nextArc && nextArc != firstArc) {
      newArcs.push(nextArc.arcId);
      nextArc.used = true;
      nextArc = getNextArc(nextArc);
      if (nextArc && nextArc != firstArc && nextArc.used) error("buildRing() topology error");
    }

    if (!nextArc) error("buildRing() traversal error");
    firstArc.used = true;
    addRing(newArcs, getGroupId(firstArc.shapeId));
  }

  // Get the next arc in a dissolved polygon ring
  // @obj an undissolvable arc instance
  //
  function getNextArc(obj, depth) {
    var next = getNextSegment(obj, segments, shapes),
        match;
    depth = depth || 0;
    if (next != obj) {
      match = findDissolveArc(next);
      if (match) {
        if (depth > 100) {
          error ('deep recursion -- unhandled topology problem');
        }
        // if (match.part.arcs.length == 1) {
        if (shapes[match.shapeId][match.partId].length == 1) {
          // case: @obj has an island inclusion -- keep traversing @obj
          // TODO: test case if @next is first arc in the ring
          next = getNextArc(next, depth + 1);
        } else {
          next = getNextArc(match, depth + 1);
        }
      }
    }
    return next;
  }

  // Look for an arc instance that can be dissolved with segment @obj
  // (must be going the opposite direction and have same dissolve key, etc)
  // Return matching segment or null if no match
  //
  function findDissolveArc(obj) {
    var dissolveId = getGroupId(obj.shapeId), // obj.shape.dissolveKey,
        match, matchId;
    matchId = utils.find(obj.group, function(i) {
      var a = obj,
          b = segments[i];
      if (a == b ||
          b.used ||
          getGroupId(b.shapeId) !== dissolveId ||
          // don't prevent rings from dissolving with themselves (risky?)
          // a.shapeId == b.shapeId && a.partId == b.partId ||
          a.arcId != ~b.arcId) return false;
      return true;
    });
    match = matchId === null ? null : segments[matchId];
    return match;
  }
}

function getNextSegment(seg, segments, shapes) {
  return getSegmentByOffs(seg, segments, shapes, 1);
}

function getPrevSegment(seg, segments, shapes) {
  return getSegmentByOffs(seg, segments, shapes, -1);
}

function getSegmentByOffs(seg, segments, shapes, offs) {
  var arcs = shapes[seg.shapeId][seg.partId],
      partLen = arcs.length,
      nextOffs = (seg.i + offs) % partLen,
      nextSeg;
  if (nextOffs < 0) nextOffs += partLen;
  nextSeg = segments[seg.segId - seg.i + nextOffs];
  if (!nextSeg || nextSeg.shapeId != seg.shapeId) error("index error");
  return nextSeg;
}




// Dissolve polyline features, but also organize arcs into as few parts as possible,
// with the arcs in each part laid out in connected sequence
internal.dissolvePolylineGeometry = function(lyr, getGroupId, arcs, opts) {
  var groups = internal.getPolylineDissolveGroups(lyr.shapes, getGroupId);
  var shapes2 = groups.map(function(group) {
    return internal.dissolvePolylineArcs(group, arcs);
  });
  return shapes2;
};

// Create one array of arc ids for each group
internal.getPolylineDissolveGroups = function(shapes, getGroupId) {
  var groups = [];
  internal.traversePaths(shapes, function(o) {
    var groupId = getGroupId(o.shapeId);
    if (groupId in groups === false) {
      groups[groupId] = [];
    }
    groups[groupId].push(o.arcId);
  });
  return groups;
};

internal.dissolvePolylineArcs = function(ids, arcs) {
  var flags = new Uint8Array(arcs.size());
  ids.forEach(function(id) {flags[absArcId(id)] = 1;});
  var testArc = function(id) {return flags[absArcId(id)] > 0;};
  var useArc = function(id) {flags[absArcId(id)] = 0;};
  var nodes = new NodeCollection(arcs, testArc);
  var ends = internal.findPolylineEnds(ids, nodes);
  var straightParts = internal.collectPolylineArcs(ends, nodes, testArc, useArc);
  var ringParts = internal.collectPolylineArcs(ids, nodes, testArc, useArc);
  return straightParts.concat(ringParts);
};

// TODO: use polygon pathfinder shared code
internal.collectPolylineArcs = function(ids, nodes, testArc, useArc) {
  var parts = [];
  ids.forEach(function(startId) {
    var part = [];
    var nextId = startId;
    var nextIds;
    while(testArc(nextId)) {
      part.push(nextId);
      useArc(nextId);
      nextIds = nodes.getConnectedArcs(nextId).filter(testArc);
      if (nextIds.length > 0) {
        nextId = ~nextIds[0]; // switch arc direction to lead away from node
      } else {
        break;
      }
    }
    if (part.length > 0) parts.push(part);
  });
  return parts;
};

// Return array of dead-end arcs for a dissolved group.
internal.findPolylineEnds = function(ids, nodes) {
  var ends = [];
  ids.forEach(function(arcId) {
    if (nodes.getConnectedArcs(arcId).length === 0) {
      ends.push(~arcId); // arc points away from terminus
    }
    if (nodes.getConnectedArcs(~arcId).length === 0) {
      ends.push(arcId);
    }
  });
  return ends;
};




// Generate a dissolved layer
// @opts.field (optional) name of data field (dissolves all if falsy)
// @opts.sum-fields (Array) (optional)
// @opts.copy-fields (Array) (optional)
//
api.dissolve = function(lyr, arcs, o) {
  var opts = o || {},
      getGroupId = internal.getCategoryClassifier(opts.field, lyr.data),
      dissolveShapes = null;

  if (lyr.geometry_type == 'polygon') {
    dissolveShapes = dissolvePolygonGeometry(lyr.shapes, getGroupId);
  } else if (lyr.geometry_type == 'polyline') {
    dissolveShapes = internal.dissolvePolylineGeometry(lyr, getGroupId, arcs, opts);
  } else if (lyr.geometry_type == 'point') {
    dissolveShapes = dissolvePointLayerGeometry(lyr, getGroupId, opts);
  }
  return internal.composeDissolveLayer(lyr, dissolveShapes, getGroupId, opts);
};

// @lyr: original undissolved layer
// @shapes: dissolved shapes
internal.composeDissolveLayer = function(lyr, shapes, getGroupId, opts) {
  var records = null;
  var lyr2;
  if (lyr.data) {
    records = internal.aggregateDataRecords(lyr.data.getRecords(), getGroupId, opts);
    // replace missing shapes with nulls
    for (var i=0, n=records.length; i<n; i++) {
      if (shapes && !shapes[i]) {
        shapes[i] = null;
      }
    }
  }
  lyr2 = {
    name: opts.no_replace ? null : lyr.name,
    shapes: shapes,
    data: records ? new DataTable(records) : null,
    geometry_type: lyr.geometry_type
  };
  if (!opts.silent) {
    internal.printDissolveMessage(lyr, lyr2);
  }
  return lyr2;
};

internal.printDissolveMessage = function(pre, post) {
  var n1 = internal.getFeatureCount(pre),
      n2 = internal.getFeatureCount(post),
      msg = utils.format('Dissolved %,d feature%s into %,d feature%s',
        n1, utils.pluralSuffix(n1), n2,
        utils.pluralSuffix(n2));
  message(msg);
};




internal.dissolvePolygonLayer = function(lyr, nodes, opts) {
  opts = opts || {};
  var getGroupId = internal.getCategoryClassifier(opts.field, lyr.data);
  var groups = lyr.shapes.reduce(function(groups, shape, i) {
    var i2 = getGroupId(i);
    if (i2 in groups === false) {
      groups[i2] = [];
    }
    internal.extendShape(groups[i2], shape);
    return groups;
  }, []);
  var shapes2 = groups.map(internal.getPolygonDissolver(nodes));
  return internal.composeDissolveLayer(lyr, shapes2, getGroupId, opts);
};

internal.concatShapes = function(shapes) {
  return shapes.reduce(function(memo, shape) {
    internal.extendShape(memo, shape);
    return memo;
  }, []);
};

internal.extendShape = function(dest, src) {
  if (src) {
    for (var i=0, n=src.length; i<n; i++) {
      dest.push(src[i]);
    }
  }
};

internal.getPolygonDissolver = function(nodes, spherical) {
  spherical = spherical && !nodes.arcs.isPlanar();
  var flags = new Uint8Array(nodes.arcs.size());
  var divide = internal.getHoleDivider(nodes, spherical);
  var flatten = internal.getRingIntersector(nodes, 'flatten', flags, spherical);
  var dissolve = internal.getRingIntersector(nodes, 'dissolve', flags, spherical);

  return function(shp) {
    if (!shp) return null;
    var cw = [],
        ccw = [];

    divide(shp, cw, ccw);
    cw = flatten(cw);
    ccw.forEach(internal.reversePath);
    ccw = flatten(ccw);
    ccw.forEach(internal.reversePath);

    var shp2 = internal.appendHolestoRings(cw, ccw);
    var dissolved = dissolve(shp2);
    return dissolved.length > 0 ? dissolved : null;
  };
};

// TODO: to prevent invalid holes,
// could erase the holes from the space-enclosing rings.
internal.appendHolestoRings = function(cw, ccw) {
  for (var i=0, n=ccw.length; i<n; i++) {
    cw.push(ccw[i]);
  }
  return cw;
};




// src: single layer or array of layers (must belong to dataset)
api.dissolve2 = function(src, dataset, opts) {
  var multiple = Array.isArray(src);
  var layers = multiple ? src : [src];
  var nodes;
  var layers2 = layers.map(function(lyr) {
    internal.requirePolygonLayer(lyr);
    if (!nodes) nodes = internal.addIntersectionCuts(dataset, opts);
    return internal.dissolvePolygonLayer(lyr, nodes, opts);
  });
  return multiple ? layers2 : layers2[0];
};





internal.buildPolygonMosaic = function(nodes) {
  // Assumes that insertClippingPoints() has been run
  var arcs = nodes.arcs;
  var flags = new Uint8Array(arcs.size());
  var findPath = internal.getPathFinder(nodes, useRoute);
  var deadArcs = [];
  var rings = [], ring;
  var retn = {};

  for (var i=0, n=flags.length; i<n; i++) {
    tryPath(i);
    tryPath(~i);
  }
  retn.rings = rings;
  if (deadArcs.length > 0) retn.collisions = deadArcs;
  return retn;

  function tryPath(arcId) {
    var ring;
    if (!routeIsOpen(arcId)) return;
    ring = findPath(arcId);
    if (ring) {
      rings.push(ring);
    } else {
      deadArcs.push(arcId);
      debug("Dead-end arc:", arcId);
    }
  }

  function routeIsOpen(arcId, closeRoute) {
    var absId = absArcId(arcId);
    var bit = absId == arcId ? 1 : 2;
    var isOpen = (flags[absId] & bit) === 0;
    if (closeRoute && isOpen) flags[absId] |= bit;
    return isOpen;
  }

  function useRoute(arcId) {
    return routeIsOpen(arcId, true);
  }
};




api.clean2 = function(layers, dataset, opts) {
  layers.forEach(internal.requirePolygonLayer);
  var nodes = internal.addIntersectionCuts(dataset, opts);
  var out = internal.buildPolygonMosaic(nodes);
  if (out.collisions) {
    layers = layers.concat(getDebugLayers(out.collisions, nodes.arcs));
  }
  return layers;

  function getDebugLayers(collisions, arcs) {
    var arcLyr = {geometry_type: 'polyline', name: 'debug', shapes: []};
    var pointLyr = {geometry_type: 'point', name: 'debug', shapes: []};
    var arcData = [];
    var pointData = [];
    collisions.forEach(function(arcId) {
      var first = arcs.getVertex(arcId, 0);
      var last = arcs.getVertex(arcId, -1);
      arcData.push({ARCID: arcId});
      arcLyr.shapes.push([[arcId]]);
      pointData.push({ARCID: arcId}, {ARCID: arcId});
      pointLyr.shapes.push([[first.x, first.y]], [[last.x, last.y]]);
    });
    arcLyr.data = new DataTable(arcData);
    pointLyr.data = new DataTable(pointData);
    return [arcLyr, pointLyr];
  }
};


// (This doesn't currently do much)
// TODO: remove small overlaps
// TODO: patch small gaps
api.cleanLayers = function(layers, dataset, opts) {
  var nodes = internal.addIntersectionCuts(dataset);
  var flatten = internal.getPolygonFlattener(nodes);

  layers.forEach(function(lyr) {
    internal.requirePolygonLayer(lyr);
    lyr.shapes = lyr.shapes.map(flatten);
  });
};


internal.getPolygonFlattener = function(nodes) {
  var flags = new Uint8Array(nodes.arcs.size());
  var divide = internal.getHoleDivider(nodes);
  var flatten = internal.getRingIntersector(nodes, 'flatten', flags);

  return function(shp) {
    if (!shp) return null;
    var cw = [],
        ccw = [];

    divide(shp, cw, ccw);
    cw = flatten(cw);
    ccw.forEach(internal.reversePath);
    ccw = flatten(ccw);
    ccw.forEach(internal.reversePath);

    var shp2 = internal.appendHolestoRings(cw, ccw);
    return shp2 && shp2.length > 0 ? shp2 : null;
  };
};




// assumes layers and arcs have been prepared for clipping
internal.clipPolygons = function(targetShapes, clipShapes, nodes, type) {
  var arcs = nodes.arcs;
  var clipFlags = new Uint8Array(arcs.size());
  var routeFlags = new Uint8Array(arcs.size());
  var clipArcTouches = 0;
  var clipArcUses = 0;
  var usedClipArcs = [];
  var dividePath = internal.getPathFinder(nodes, useRoute, routeIsActive);
  var dissolvePolygon = internal.getPolygonDissolver(nodes);


  // clean each target polygon by dissolving its rings
  targetShapes = targetShapes.map(dissolvePolygon);

  // merge rings of clip/erase polygons and dissolve them all
  clipShapes = [dissolvePolygon(internal.concatShapes(clipShapes))];

  // Open pathways in the clip/erase layer
  // Need to expose clip/erase routes in both directions by setting route
  // in both directions to visible -- this is how cut-out shapes are detected
  // Or-ing with 0x11 makes both directions visible (so reverse paths will block)
  internal.openArcRoutes(clipShapes, arcs, clipFlags, type == 'clip', type == 'erase', !!"dissolve", 0x11);

  var index = new PathIndex(clipShapes, arcs);
  var clippedShapes = targetShapes.map(function(shape, i) {
    if (shape) {
      return clipPolygon(shape, type, index);
    }
    return null;
  });

  // add clip/erase polygons that are fully contained in a target polygon
  // need to index only non-intersecting clip shapes
  // (Intersecting shapes have one or more arcs that have been scanned)
  //
  var undividedClipShapes = findUndividedClipShapes(clipShapes);

  internal.closeArcRoutes(clipShapes, arcs, routeFlags, true, true); // not needed?
  index = new PathIndex(undividedClipShapes, arcs);
  targetShapes.forEach(function(shape, shapeId) {
    var paths = shape ? findInteriorPaths(shape, type, index) : null;
    if (paths) {
      clippedShapes[shapeId] = (clippedShapes[shapeId] || []).concat(paths);
    }
  });

  return clippedShapes;

  function clipPolygon(shape, type, index) {
    var dividedShape = [],
        clipping = type == 'clip',
        erasing = type == 'erase';

    // open pathways for entire polygon rather than one ring at a time --
    // need to create polygons that connect positive-space rings and holes
    internal.openArcRoutes(shape, arcs, routeFlags, true, false, false);

    internal.forEachPath(shape, function(ids) {
      var path;
      for (var i=0, n=ids.length; i<n; i++) {
        clipArcTouches = 0;
        clipArcUses = 0;
        path = dividePath(ids[i]);
        if (path) {
          // if ring doesn't touch/intersect a clip/erase polygon, check if it is contained
          // if (clipArcTouches === 0) {
          // if ring doesn't incorporate an arc from the clip/erase polygon,
          // check if it is contained (assumes clip shapes are dissolved)
          if (clipArcTouches === 0 || clipArcUses === 0) { //
            var contained = index.pathIsEnclosed(path);
            if (clipping && contained || erasing && !contained) {
              dividedShape.push(path);
            }
            // TODO: Consider breaking if polygon is unchanged
          } else {
            dividedShape.push(path);
          }
        }
      }
    });

    // Clear pathways of current target shape to hidden/closed
    internal.closeArcRoutes(shape, arcs, routeFlags, true, true, true);
    // Also clear pathways of any clip arcs that were used
    if (usedClipArcs.length > 0) {
      internal.closeArcRoutes(usedClipArcs, arcs, routeFlags, true, true, true);
      usedClipArcs = [];
    }

    return dividedShape.length === 0 ? null : dividedShape;
  }

  function routeIsActive(id) {
    var fw = id >= 0,
        abs = fw ? id : ~id,
        visibleBit = fw ? 1 : 0x10,
        targetBits = routeFlags[abs],
        clipBits = clipFlags[abs];

    if (clipBits > 0) clipArcTouches++;
    return (targetBits & visibleBit) > 0 || (clipBits & visibleBit) > 0;
  }

  function useRoute(id) {
    var fw = id >= 0,
        abs = fw ? id : ~id,
        targetBits = routeFlags[abs],
        clipBits = clipFlags[abs],
        targetRoute, clipRoute;

    if (fw) {
      targetRoute = targetBits;
      clipRoute = clipBits;
    } else {
      targetRoute = targetBits >> 4;
      clipRoute = clipBits >> 4;
    }
    targetRoute &= 3;
    clipRoute &= 3;

    var usable = false;
    // var usable = targetRoute === 3 || targetRoute === 0 && clipRoute == 3;
    if (targetRoute == 3) {
      // special cases where clip route and target route both follow this arc
      if (clipRoute == 1) {
        // 1. clip/erase polygon blocks this route, not usable
      } else if (clipRoute == 2 && type == 'erase') {
        // 2. route is on the boundary between two erase polygons, not usable
      } else {
        usable = true;
      }

    } else if (targetRoute === 0 && clipRoute == 3) {
      usedClipArcs.push(id);
      usable = true;
    }

    if (usable) {
      if (clipRoute == 3) {
        clipArcUses++;
      }
      // Need to close all arcs after visiting them -- or could cause a cycle
      //   on layers with strange topology
      if (fw) {
        targetBits = internal.setBits(targetBits, 1, 3);
      } else {
        targetBits = internal.setBits(targetBits, 0x10, 0x30);
      }
    }

    targetBits |= fw ? 4 : 0x40; // record as visited
    routeFlags[abs] = targetBits;
    return usable;
  }

  // Filter a collection of shapes to exclude paths that contain clip/erase arcs
  // and paths that are hidden (e.g. internal boundaries)
  function findUndividedClipShapes(clipShapes) {
    return clipShapes.map(function(shape) {
      var usableParts = [];
      internal.forEachPath(shape, function(ids) {
        var pathIsClean = true,
            pathIsVisible = false;
        for (var i=0; i<ids.length; i++) {
          // check if arc was used in fw or rev direction
          if (!arcIsUnused(ids[i], routeFlags)) {
            pathIsClean = false;
            break;
          }
          // check if clip arc is visible
          if (!pathIsVisible && arcIsVisible(ids[i], clipFlags)) {
            pathIsVisible = true;
          }
        }
        if (pathIsClean && pathIsVisible) usableParts.push(ids);
      });
      return usableParts.length > 0 ? usableParts : null;
    });
  }

  // Test if arc is unused in both directions
  // (not testing open/closed or visible/hidden)
  function arcIsUnused(id, flags) {
    var abs = absArcId(id),
        flag = flags[abs];
        return (flag & 0x44) === 0;
  }

  function arcIsVisible(id, flags) {
    var flag = flags[absArcId(id)];
    return (flag & 0x11) > 0;
  }

  // search for indexed clipping paths contained in a shape
  // dissolve them if needed
  function findInteriorPaths(shape, type, index) {
    var enclosedPaths = index.findPathsInsideShape(shape),
        dissolvedPaths = [];
    if (!enclosedPaths) return null;
    // ...
    if (type == 'erase') enclosedPaths.forEach(internal.reversePath);
    if (enclosedPaths.length <= 1) {
      dissolvedPaths = enclosedPaths; // no need to dissolve single-part paths
    } else {
      internal.openArcRoutes(enclosedPaths, arcs, routeFlags, true, false, true);
      enclosedPaths.forEach(function(ids) {
        var path;
        for (var j=0; j<ids.length; j++) {
          path = dividePath(ids[j]);
          if (path) {
            dissolvedPaths.push(path);
          }
        }
      });
    }

    return dissolvedPaths.length > 0 ? dissolvedPaths : null;
  }
}; // end clipPolygons()




// Assumes: Arcs have been divided
//
internal.clipPolylines = function(targetShapes, clipShapes, nodes, type) {
  var index = new PathIndex(clipShapes, nodes.arcs);

  return targetShapes.map(function(shp) {
    return clipPolyline(shp);
  });

  function clipPolyline(shp) {
    var clipped = null;
    if (shp) clipped = shp.reduce(clipPath, []);
    return clipped && clipped.length > 0 ? clipped : null;
  }

  function clipPath(memo, path) {
    var clippedPath = null,
        arcId, enclosed;
    for (var i=0; i<path.length; i++) {
      arcId = path[i];
      enclosed = index.arcIsEnclosed(arcId);
      if (enclosed && type == 'clip' || !enclosed && type == 'erase') {
        if (!clippedPath) {
          memo.push(clippedPath = []);
        }
        clippedPath.push(arcId);
      } else {
        clippedPath = null;
      }
    }
    return memo;
  }
};




//
internal.clipPoints = function(points, clipShapes, arcs, type) {
  var index = new PathIndex(clipShapes, arcs);

  var points2 = points.reduce(function(memo, feat) {
    var n = feat ? feat.length : 0,
        feat2 = [],
        enclosed;

    for (var i=0; i<n; i++) {
      enclosed = index.findEnclosingShape(feat[i]) > -1;
      if (type == 'clip' && enclosed || type == 'erase' && !enclosed) {
        feat2.push(feat[i].concat());
      }
    }

    memo.push(feat2.length > 0 ? feat2 : null);
    return memo;
  }, []);

  return points2;
};




// Test if the second endpoint of an arc is the endpoint of any path in any layer
internal.getPathEndpointTest = function(layers, arcs) {
  var index = new Uint8Array(arcs.size());
  layers.forEach(function(lyr) {
    if (internal.layerHasPaths(lyr)) {
      lyr.shapes.forEach(addShape);
    }
  });

  function addShape(shape) {
    internal.forEachPath(shape, addPath);
  }

  function addPath(path) {
    addEndpoint(~path[0]);
    addEndpoint(path[path.length - 1]);
  }

  function addEndpoint(arcId) {
    var absId = absArcId(arcId);
    var fwd = absId == arcId;
    index[absId] |= fwd ? 1 : 2;
  }

  return function(arcId) {
    var absId = absArcId(arcId);
    var fwd = absId == arcId;
    var code = index[absId];
    return fwd ? (code & 1) == 1 : (code & 2) == 2;
  };
};




// Dissolve arcs that can be merged without affecting topology of layers
// remove arcs that are not referenced by any layer; remap arc ids
// in layers. (In-place).
internal.dissolveArcs = function(dataset) {
  var arcs = dataset.arcs,
      layers = dataset.layers.filter(internal.layerHasPaths);

  if (!arcs || !layers.length) {
    dataset.arcs = null;
    return;
  }

  var arcsCanDissolve = internal.getArcDissolveTest(layers, arcs),
      newArcs = [],
      totalPoints = 0,
      arcIndex = new Int32Array(arcs.size()), // maps old arc ids to new ids
      arcStatus = new Uint8Array(arcs.size());
      // arcStatus: 0 = unvisited, 1 = dropped, 2 = remapped, 3 = remapped + reversed
  layers.forEach(function(lyr) {
    // modify copies of the original shapes; original shapes should be unmodified
    // (need to test this)
    lyr.shapes = lyr.shapes.map(function(shape) {
      return internal.editPaths(shape && shape.concat(), translatePath);
    });
  });
  dataset.arcs = internal.dissolveArcCollection(arcs, newArcs, totalPoints);

  function translatePath(path) {
    var pointCount = 0;
    var newPath = [];
    var newArc, arcId, absId, arcLen, fw, newArcId;

    for (var i=0, n=path.length; i<n; i++) {
      arcId = path[i];
      absId = absArcId(arcId);
      fw = arcId === absId;

      if (arcs.arcIsDegenerate(arcId)) {
        // arc has collapsed -- skip
      } else if (arcStatus[absId] !== 0) {
        // arc has already been translated -- skip
        newArc = null;
      } else {
        arcLen = arcs.getArcLength(arcId);

        if (newArc && arcsCanDissolve(path[i-1], arcId)) {
          if (arcLen > 0) {
            arcLen--; // shared endpoint not counted;
          }
          newArc.push(arcId);  // arc data is appended to previous arc
          arcStatus[absId] = 1; // arc is dropped from output
        } else {
          // start a new dissolved arc
          newArc = [arcId];
          arcIndex[absId] = newArcs.length;
          newArcs.push(newArc);
          arcStatus[absId] = fw ? 2 : 3; // 2: unchanged; 3: reversed
        }
        pointCount += arcLen;
      }

      if (arcStatus[absId] > 1) {
        // arc is retained (and renumbered) in the dissolved path -- add to path
        newArcId = arcIndex[absId];
        if (fw && arcStatus[absId] == 3 || !fw && arcStatus[absId] == 2) {
          newArcId = ~newArcId;
        }
        newPath.push(newArcId);
      }
    }
    totalPoints += pointCount;
    return newPath;
  }
};

internal.dissolveArcCollection = function(arcs, newArcs, newLen) {
  var nn2 = new Uint32Array(newArcs.length),
      xx2 = new Float64Array(newLen),
      yy2 = new Float64Array(newLen),
      src = arcs.getVertexData(),
      zz2 = src.zz ? new Float64Array(newLen) : null,
      interval = arcs.getRetainedInterval(),
      offs = 0;

  newArcs.forEach(function(newArc, newId) {
    newArc.forEach(function(oldId, i) {
      extendDissolvedArc(oldId, newId);
    });
  });

  return new ArcCollection(nn2, xx2, yy2).setThresholds(zz2).setRetainedInterval(interval);

  function extendDissolvedArc(oldId, newId) {
    var absId = absArcId(oldId),
        rev = oldId < 0,
        n = src.nn[absId],
        i = src.ii[absId],
        n2 = nn2[newId];

    if (n > 0) {
      if (n2 > 0) {
        n--;
        if (!rev) i++;
      }
      utils.copyElements(src.xx, i, xx2, offs, n, rev);
      utils.copyElements(src.yy, i, yy2, offs, n, rev);
      if (zz2) utils.copyElements(src.zz, i, zz2, offs, n, rev);
      nn2[newId] += n;
      offs += n;
    }
  }
};

// Test whether two arcs can be merged together
internal.getArcDissolveTest = function(layers, arcs) {
  var nodes = internal.getFilteredNodeCollection(layers, arcs),
      // don't allow dissolving through endpoints of polyline paths
      lineLayers = layers.filter(function(lyr) {return lyr.geometry_type == 'polyline';}),
      testLineEndpoint = internal.getPathEndpointTest(lineLayers, arcs),
      linkCount, lastId;

  return function(id1, id2) {
    if (id1 == id2 || id1 == ~id2) {
      verbose("Unexpected arc sequence:", id1, id2);
      return false; // This is unexpected; don't try to dissolve, anyway
    }
    linkCount = 0;
    nodes.forEachConnectedArc(id1, countLink);
    return linkCount == 1 && lastId == ~id2 && !testLineEndpoint(id1) && !testLineEndpoint(~id2);
  };

  function countLink(arcId, i) {
    linkCount++;
    lastId = arcId;
  }
};

internal.getFilteredNodeCollection = function(layers, arcs) {
  var counts = internal.countArcReferences(layers, arcs),
      test = function(arcId) {
        return counts[absArcId(arcId)] > 0;
      };
  return new NodeCollection(arcs, test);
};

internal.countArcReferences = function(layers, arcs) {
  var counts = new Uint32Array(arcs.size());
  layers.forEach(function(lyr) {
    internal.countArcsInShapes(lyr.shapes, counts);
  });
  return counts;
};




api.filterIslands = function(lyr, arcs, opts) {
  var removed = 0;
  if (lyr.geometry_type != 'polygon') {
    return;
  }

  if (opts.min_area || opts.min_vertices) {
    if (opts.min_area) {
      removed += internal.filterIslands(lyr, arcs, internal.getMinAreaTest(opts.min_area, arcs));
    }
    if (opts.min_vertices) {
      removed += internal.filterIslands(lyr, arcs, internal.getVertexCountTest(opts.min_vertices, arcs));
    }
    if (opts.remove_empty) {
      api.filterFeatures(lyr, arcs, {remove_empty: true, verbose: false});
    }
    message(utils.format("Removed %'d island%s", removed, utils.pluralSuffix(removed)));
  } else {
    message("Missing a criterion for filtering islands; use min-area or min-vertices");
  }
};

internal.getVertexCountTest = function(minVertices, arcs) {
  return function(path) {
    // first and last vertex in ring count as one
    return geom.countVerticesInPath(path, arcs) <= minVertices;
  };
};

internal.getMinAreaTest = function(minArea, arcs) {
  var pathArea = arcs.isPlanar() ? geom.getPlanarPathArea : geom.getSphericalPathArea;
  return function(path) {
    var area = pathArea(path, arcs);
    return Math.abs(area) < minArea;
  };
};

internal.filterIslands = function(lyr, arcs, ringTest) {
  var removed = 0;
  var counts = new Uint8Array(arcs.size());
  internal.countArcsInShapes(lyr.shapes, counts);

  var pathFilter = function(path, i, paths) {
    if (path.length == 1) { // got an island ring
      if (counts[absArcId(path[0])] === 1) { // and not part of a donut hole
        if (!ringTest || ringTest(path)) { // and it meets any filtering criteria
          // and it does not contain any holes itself
          // O(n^2), so testing this last
          if (!internal.ringHasHoles(path, paths, arcs)) {
            removed++;
            return null;
          }
        }
      }
    }
  };
  internal.editShapes(lyr.shapes, pathFilter);
  return removed;
};

internal.ringIntersectsBBox = function(ring, bbox, arcs) {
  for (var i=0, n=ring.length; i<n; i++) {
    if (arcs.arcIntersectsBBox(absArcId(ring[i]), bbox)) {
      return true;
    }
  }
  return false;
};

// Assumes that ring boundaries to not cross
internal.ringHasHoles = function(ring, rings, arcs) {
  var bbox = arcs.getSimpleShapeBounds2(ring);
  var sibling, p;
  for (var i=0, n=rings.length; i<n; i++) {
    sibling = rings[i];
    // try to avoid expensive point-in-ring test
    if (sibling && sibling != ring && internal.ringIntersectsBBox(sibling, bbox, arcs)) {
      p = arcs.getVertex(sibling[0], 0);
      if (geom.testPointInRing(p.x, p.y, ring, arcs)) {
        return true;
      }
    }
  }
  return false;
};




// Remove small-area polygon rings (very simple implementation of sliver removal)
// TODO: more sophisticated sliver detection (e.g. could consider ratio of area to perimeter)
// TODO: consider merging slivers into adjacent polygons to prevent gaps from forming
// TODO: consider separate gap removal function as an alternative to merging slivers
//
api.filterSlivers = function(lyr, arcs, opts) {
  if (lyr.geometry_type != 'polygon') {
    return 0;
  }
  return internal.filterSlivers(lyr, arcs, opts);
};

internal.filterSlivers = function(lyr, arcs, opts) {
  var ringTest = opts && opts.min_area ? internal.getMinAreaTest(opts.min_area, arcs) :
    internal.getSliverTest(arcs);
  var removed = 0;
  var pathFilter = function(path, i, paths) {
    if (ringTest(path)) {
      removed++;
      return null;
    }
  };

  internal.editShapes(lyr.shapes, pathFilter);
  message(utils.format("Removed %'d sliver%s", removed, utils.pluralSuffix(removed)));
  return removed;
};

internal.filterClipSlivers = function(lyr, clipLyr, arcs) {
  var flags = new Uint8Array(arcs.size());
  var ringTest = internal.getSliverTest(arcs);
  var removed = 0;
  var pathFilter = function(path) {
    var prevArcs = 0,
        newArcs = 0;
    for (var i=0, n=path && path.length || 0; i<n; i++) {
      if (flags[absArcId(path[i])] > 0) {
        newArcs++;
      } else {
        prevArcs++;
      }
    }
    // filter paths that contain arcs from both original and clip/erase layers
    //   and are small
    if (newArcs > 0 && prevArcs > 0 && ringTest(path)) {
      removed++;
      return null;
    }
  };

  internal.countArcsInShapes(clipLyr.shapes, flags);
  internal.editShapes(lyr.shapes, pathFilter);
  return removed;
};

internal.getSliverTest = function(arcs) {
  var maxSliverArea = internal.calcMaxSliverArea(arcs);
  return function(path) {
    // TODO: more sophisticated metric, perhaps considering shape
    return Math.abs(geom.getPlanarPathArea(path, arcs)) <= maxSliverArea;
  };
};


// Calculate an area threshold based on the average segment length,
// but disregarding very long segments (i.e. bounding boxes)
// TODO: need something more reliable
// consider: calculating the distribution of segment lengths in one pass
//
internal.calcMaxSliverArea = function(arcs) {
  var k = 2,
      dxMax = arcs.getBounds().width() / k,
      dyMax = arcs.getBounds().height() / k,
      count = 0,
      mean = 0;
  arcs.forEachSegment(function(i, j, xx, yy) {
    var dx = Math.abs(xx[i] - xx[j]),
        dy = Math.abs(yy[i] - yy[j]);
    if (dx < dxMax && dy < dyMax) {
      // TODO: write utility function for calculating mean this way
      mean += (Math.sqrt(dx * dx + dy * dy) - mean) / ++count;
    }
  });
  return mean * mean;
};




api.splitLayer = function(src, splitField, opts) {
  var lyr0 = opts && opts.no_replace ? internal.copyLayer(src) : src,
      properties = lyr0.data ? lyr0.data.getRecords() : null,
      shapes = lyr0.shapes,
      index = {},
      splitLayers = [],
      prefix;

  if (splitField && (!properties || !lyr0.data.fieldExists(splitField))) {
    stop("Missing attribute field:", splitField);
  }

  // if not splitting on a field and layer is unnamed, name split-apart layers
  // like: split-0, split-1, ...
  prefix = lyr0.name || (splitField ? '' : 'split');

  utils.repeat(internal.getFeatureCount(lyr0), function(i) {
    var key = internal.getSplitKey(i, splitField, properties),
        lyr;

    if (key in index === false) {
      index[key] = splitLayers.length;
      lyr = utils.defaults({
        name: internal.getSplitLayerName(prefix, key),
        data: properties ? new DataTable() : null,
        shapes: shapes ? [] : null
      }, lyr0);
      splitLayers.push(lyr);
    } else {
      lyr = splitLayers[index[key]];
    }
    if (shapes) {
      lyr.shapes.push(shapes[i]);
    }
    if (properties) {
      lyr.data.getRecords().push(properties[i]);
    }
  });
  return splitLayers;
};

internal.getSplitKey = function(i, field, properties) {
  var rec = field && properties ? properties[i] : null;
  return String(rec ? rec[field] : i + 1);
};

internal.getSplitLayerName = function(base, key) {
  return (base ? base + '-' : '') + key;
};




api.clipLayers = function(target, src, dataset, opts) {
  return internal.clipLayers(target, src, dataset, "clip", opts);
};

api.eraseLayers = function(target, src, dataset, opts) {
  return internal.clipLayers(target, src, dataset, "erase", opts);
};

api.clipLayer = function(targetLyr, src, dataset, opts) {
  return api.clipLayers([targetLyr], src, dataset, opts)[0];
};

api.eraseLayer = function(targetLyr, src, dataset, opts) {
  return api.eraseLayers([targetLyr], src, dataset, opts)[0];
};

api.sliceLayers = function(target, src, dataset, opts) {
  return internal.clipLayers(target, src, dataset, "slice", opts);
};

api.sliceLayer = function(targetLyr, src, dataset, opts) {
  return api.sliceLayers([targetLyr], src, dataset, opts);
};

// @clipSrc: layer in @dataset or filename
// @type: 'clip' or 'erase'
internal.clipLayers = function(targetLayers, clipSrc, targetDataset, type, opts) {
  var usingPathClip = utils.some(targetLayers, internal.layerHasPaths);
  var clipDataset, mergedDataset, clipLyr, nodes, tmp, outputLayers;
  opts = opts || {no_cleanup: true}; // TODO: update testing functions
  if (clipSrc && clipSrc.geometry_type) {
    // TODO: update tests to remove this case (clipSrc is a layer)
    clipSrc = {dataset: targetDataset, layer: clipSrc, disposable: true};
  }
  if (opts.bbox) {
    clipDataset = internal.convertClipBounds(opts.bbox);
    clipLyr = clipDataset.layers[0];
  } else if (clipSrc) {
    clipLyr = clipSrc.layer;
    clipDataset = utils.defaults({layers: [clipLyr]}, clipSrc.dataset);
  } else {
    stop("Missing clipping data");
  }
  if (targetDataset.arcs != clipDataset.arcs) {
    // using external dataset -- need to merge arcs
    if (clipSrc && !clipSrc.disposable) {
      // copy layer shapes because arc ids will be reindexed during merging
      clipLyr = clipDataset.layers[0] = internal.copyLayerShapes(clipDataset.layers[0]);
    }
    // merge external dataset with target dataset,
    // so arcs are shared between target layers and clipping lyr
    // Assumes that layers in clipDataset can be modified (if necessary, a copy should be passed in)
    mergedDataset = internal.mergeDatasets([targetDataset, clipDataset]);
    api.buildTopology(mergedDataset); // identify any shared arcs between clipping layer and target dataset
  } else {
    mergedDataset = targetDataset;
  }
  if (usingPathClip) {
    // add vertices at all line intersections
    // (generally slower than actual clipping)
    nodes = internal.addIntersectionCuts(mergedDataset, opts);
    targetDataset.arcs = mergedDataset.arcs;
  } else {
    nodes = new NodeCollection(mergedDataset.arcs);
  }
  outputLayers = internal.clipLayersByLayer(targetLayers, clipLyr, nodes, type, opts);
  if (usingPathClip && !opts.no_cleanup) {
    // Delete unused arcs, merge remaining arcs, remap arcs of retained shapes.
    // This is to remove arcs belonging to the clipping paths from the target
    // dataset, and to heal the cuts that were made where clipping paths
    // crossed target paths
    tmp = {
      arcs: mergedDataset.arcs,
      layers: targetDataset.layers
    };
    internal.replaceLayers(tmp, targetLayers, outputLayers);
    internal.dissolveArcs(tmp);
    targetDataset.arcs = tmp.arcs;
  }
  return outputLayers;
};

internal.clipLayersByLayer = function(targetLayers, clipLyr, nodes, type, opts) {
  internal.requirePolygonLayer(clipLyr, "Requires a polygon clipping layer");
  return targetLayers.reduce(function(memo, targetLyr) {
    if (opts.no_replace) {
      memo.push(targetLyr);
    }
    if (type == 'slice') {
      memo = memo.concat(internal.sliceLayerByLayer(targetLyr, clipLyr, nodes, opts));
    } else {
      memo.push(internal.clipLayerByLayer(targetLyr, clipLyr, nodes, type, opts));
    }
    return memo;
  }, []);
};

internal.getSliceLayerName = function(clipLyr, field, i) {
  var id = field ? clipLyr.data.getRecords()[0][field] : i + 1;
  return 'slice-' + id;
};

internal.sliceLayerByLayer = function(targetLyr, clipLyr, nodes, opts) {
  // may not need no_replace
  var clipLayers = api.splitLayer(clipLyr, opts.id_field, {no_replace: true});
  return clipLayers.map(function(clipLyr, i) {
    var outputLyr = internal.clipLayerByLayer(targetLyr, clipLyr, nodes, 'clip', opts);
    outputLyr.name = internal.getSliceLayerName(clipLyr, opts.id_field, i);
    return outputLyr;
  });
};

internal.clipLayerByLayer = function(targetLyr, clipLyr, nodes, type, opts) {
  var arcs = nodes.arcs;
  var shapeCount = targetLyr.shapes ? targetLyr.shapes.length : 0;
  var nullCount = 0, sliverCount = 0;
  var clippedShapes, outputLyr;
  if (shapeCount === 0) {
    return targetLyr; // ignore empty layer
  }
  if (targetLyr === clipLyr) {
    stop('Can\'t clip a layer with itself');
  }

  if (targetLyr.geometry_type == 'point') {
    clippedShapes = internal.clipPoints(targetLyr.shapes, clipLyr.shapes, arcs, type);
  } else if (targetLyr.geometry_type == 'polygon') {
    clippedShapes = internal.clipPolygons(targetLyr.shapes, clipLyr.shapes, nodes, type);
  } else if (targetLyr.geometry_type == 'polyline') {
    clippedShapes = internal.clipPolylines(targetLyr.shapes, clipLyr.shapes, nodes, type);
  } else {
    stop('Invalid target layer:', targetLyr.name);
  }

  outputLyr = {
    name: targetLyr.name,
    geometry_type: targetLyr.geometry_type,
    shapes: clippedShapes,
    data: targetLyr.data // replaced post-filter
  };

  // Remove sliver polygons
  if (opts.remove_slivers && outputLyr.geometry_type == 'polygon') {
    sliverCount = internal.filterClipSlivers(outputLyr, clipLyr, arcs);
  }

  // Remove null shapes (likely removed by clipping/erasing, although possibly already present)
  api.filterFeatures(outputLyr, arcs, {remove_empty: true, verbose: false});

  // clone data records (to avoid sharing records between layers)
  // TODO: this is not needed when replacing target with a single layer
  if (outputLyr.data) {
    outputLyr.data = outputLyr.data.clone();
  }

  // TODO: redo messages, now that many layers may be clipped
  nullCount = shapeCount - outputLyr.shapes.length;
  if (nullCount && sliverCount) {
    message(internal.getClipMessage(nullCount, sliverCount));
  }
  return outputLyr;
};

internal.getClipMessage = function(nullCount, sliverCount) {
  var nullMsg = nullCount ? utils.format('%,d null feature%s', nullCount, utils.pluralSuffix(nullCount)) : '';
  var sliverMsg = sliverCount ? utils.format('%,d sliver%s', sliverCount, utils.pluralSuffix(sliverCount)) : '';
  if (nullMsg || sliverMsg) {
    return utils.format('Removed %s%s%s', nullMsg, (nullMsg && sliverMsg ? ' and ' : ''), sliverMsg);
  }
  return '';
};

internal.convertClipBounds = function(bb) {
  var x0 = bb[0], y0 = bb[1], x1 = bb[2], y1 = bb[3],
      arc = [[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]];

  if (!(y1 > y0 && x1 > x0)) {
    stop("Invalid bbox (should be [xmin, ymin, xmax, ymax]):", bb);
  }
  return {
    arcs: new ArcCollection([arc]),
    layers: [{
      shapes: [[[0]]],
      geometry_type: 'polygon'
    }]
  };
};




internal.getArcClassifier = function(shapes, arcs) {
  var n = arcs.size(),
      a = new Int32Array(n),
      b = new Int32Array(n);

  utils.initializeArray(a, -1);
  utils.initializeArray(b, -1);

  internal.traversePaths(shapes, function(o) {
    var i = absArcId(o.arcId);
    var shpId = o.shapeId;
    var aval = a[i];
    if (aval == -1) {
      a[i] = shpId;
    } else if (shpId < aval) {
      b[i] = aval;
      a[i] = shpId;
    } else {
      b[i] = shpId;
    }
  });

  function classify(arcId, getKey) {
    var i = absArcId(arcId);
    var key = null;
    if (a[i] > -1) {
      key = getKey(a[i], b[i]);
      if (key) {
        a[i] = -1;
        b[i] = -1;
      }
    }
    return key;
  }

  return function(getKey) {
    return function(arcId) {
      return classify(arcId, getKey);
    };
  };
};




internal.findNeighbors = function(shapes, arcs) {
  var getKey = function(a, b) {
    return b > -1 && a > -1 ? [a, b] : null;
  };
  var classify = internal.getArcClassifier(shapes, arcs)(getKey);
  var arr = [];
  var index = {};
  var onArc = function(arcId) {
    var obj = classify(arcId);
    var key;
    if (obj) {
      key = obj.join('~');
      if (key in index === false) {
        arr.push(obj);
        index[key] = true;
      }
    }
  };
  internal.forEachArcId(shapes, onArc);
  return arr;
};




// Assign a cluster id to each polygon in a dataset, which can be used with
//   one of the dissolve commands to dissolve the clusters
// Works by iteratively grouping pairs of polygons with the smallest distance
//   between centroids.
// Results are not optimal -- may be useful for creating levels of detail on
//   interactive maps, not useful for analysis.
//
api.cluster = function(lyr, arcs, opts) {
  internal.requirePolygonLayer(lyr);
  var groups = internal.calcPolygonClusters(lyr, arcs, opts);
  var idField = opts.id_field || "cluster";
  internal.insertFieldValues(lyr, idField, groups);
  return lyr;
};

internal.calcPolygonClusters = function(lyr, arcs, opts) {
  var calcScore = internal.getPolygonClusterCalculator(opts);
  var size = lyr.shapes.length;
  var count = Math.round(size * (opts.pct || 1));
  var groupField = opts.group_by || null;

  // working set of polygon records
  var shapeItems = lyr.shapes.map(function(shp, i) {
    var groupId = groupField && lyr.data.getRecordAt(i)[groupField] || null;
    return {
      ids: [i],
      area: geom.getShapeArea(shp, arcs),
      bounds: arcs.getMultiShapeBounds(shp),
      centroid: geom.getShapeCentroid(shp, arcs), // centroid of largest ring
      group: groupId,
      friends: []
    };
  });

  var mergeItems = []; // list of pairs of shapes that can be merged
  var mergeIndex = {}; // keep track of merges, to prevent duplicates
  var next;

  if (groupField && !lyr.data) stop("Missing attribute data table");

  // Populate mergeItems array
  internal.findNeighbors(lyr.shapes, arcs).forEach(function(ab, i) {
    // ab: [a, b] indexes of two polygons
    var a = shapeItems[ab[0]],
        b = shapeItems[ab[1]],
        item, id;
    if (a.group !== b.group) return;
    item = {ids: ab};
    item.score = getScore(item);
    if (item.score < 0) return;
    id = mergeItems.length;
    a.friends.push(id);
    b.friends.push(id);
    mergeItems.push(item);
  });

  // main loop
  while (count-- > 0 && (next = nextItem())) {
    merge(next);
  }

  // Assign a sequential id to each of the remaining original shapes and the
  // new aggregated shapes
  return shapeItems.filter(Boolean).reduce(function(memo, shape, clusterId) {
    var ids = shape.ids;
    for (var i=0; i<ids.length; i++) {
      memo[ids[i]] = clusterId;
    }
    return memo;
  }, []);

  function merge(item) {
    var merged = mergeShapes(item.ids);
    var mergedId = shapeItems.length;
    shapeItems[mergedId] = merged;
    updateList(merged.friends, item.ids, mergedId);
  }

  // Find lowest-ranked merge candidate and remove it from the list
  // Scans entire list - n^2 performance - tested ~20sec for 50,000 polygons
  function nextItem() {
    var minId = -1,
        min = Infinity,
        item, i, n;
    for (i=0, n=mergeItems.length; i<n; i++) {
      item = mergeItems[i];
      if (item !== null && item.score < min) {
        min = item.score;
        minId = i;
      }
    }
    if (minId == -1) return null;
    item = mergeItems[minId];
    mergeItems[minId] = null;
    return item;
  }

  function getScore(item) {
    return calcScore(shapeItems[item.ids[0]], shapeItems[item.ids[1]]);
  }

  function mergeCentroids(dest, src) {
    var k = dest.area / (dest.area + src.area),
        a = dest.centroid,
        b = src.centroid;
    // TODO: consider using geodetic distance when appropriate
    a.x = a.x * k + b.x * (1 - k);
    a.y = a.y * k + b.y * (1 - k);
  }

  function mergeShapes(ids) {
    var dest = shapeItems[ids[0]];
    var src = shapeItems[ids[1]];
    dest.bounds.mergeBounds(src.bounds);
    dest.area += src.area;
    dest.ids = dest.ids.concat(src.ids);
    mergeCentroids(dest, src);
    shapeItems[ids[0]] = null;
    shapeItems[ids[1]] = null;
    dest.friends = filterFriends(dest.friends.concat(src.friends));
    return dest;
  }

  // remove ids of duplicate and invalid merge candidates
  function filterFriends(friends) {
    var index = {};
    var merged = [];
    var id;
    for (var i=0; i<friends.length; i++) {
      id = friends[i];
      if ((id in index === false) && mergeItems[id] !== null) {
        merged.push(id);
        index[id] = true;
      }
    }
    return merged;
  }

  // re-index merge candidates after merging two shapes into a new shape
  function updateList(friends, oldIds, newId) {
    var item, id;
    for (var i=0, n=friends.length; i<n; i++) {
      id = friends[i];
      item = mergeItems[id];
      if (contains(item.ids, oldIds)) {
        mergeItems[id] = updateItem(item, oldIds, newId);
      }
    }
  }

  // re-index a merge candidate; return null if it duplicates a previously merged
  //   pair of shapes
  function updateItem(item, oldIds, newId) {
    var a = item.ids[0];
    var b = item.ids[1];
    var key;
    if (oldIds[0] == a || oldIds[1] == a) a = newId;
    if (oldIds[0] == b || oldIds[1] == b) b = newId;
    if (a == b) return null;
    item.ids = [a, b];
    key = clusterKey(item);
    if (key in mergeIndex) return null;
    mergeIndex[key] = true;
    item.score = getScore(item);
    if (item.score < 0) return null;
    return item;
  }

  function contains(a, b) {
    return a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1];
  }

  function clusterKey(friend) {
    var a = friend.ids[0],
        b = friend.ids[1];
    if (b < a) {
      a = b;
      b = friend.ids[0];
    }
    return a + ',' + b;
  }
};

internal.getPolygonClusterCalculator = function(opts) {
  var maxWidth = opts.max_width || Infinity;
  var maxHeight = opts.max_height || Infinity;
  var maxArea = opts.max_area || Infinity;
  return function(a, b) {
    var area = a.area + b.area,
        // TODO: use geodetic distance when appropriate
        score = geom.distance2D(a.centroid.x, a.centroid.y, b.centroid.x, b.centroid.y),
        bounds = a.bounds.clone().mergeBounds(b.bounds);
    if (area > maxArea || bounds.width() > maxWidth ||
        bounds.height() > maxHeight) {
      score = -1;
    }
    return score;
  };
};




internal.roundPoints = function(lyr, round) {
  internal.forEachPoint(lyr.shapes, function(p) {
    p[0] = round(p[0]);
    p[1] = round(p[1]);
  });
};

internal.setCoordinatePrecision = function(dataset, precision) {
  var round = utils.getRoundingFunction(precision);
  var dissolvePolygon, nodes;
  internal.transformPoints(dataset, function(x, y) {
    return [round(x), round(y)];
  });
  if (dataset.arcs) {
    nodes = internal.addIntersectionCuts(dataset);
    dissolvePolygon = internal.getPolygonDissolver(nodes);
  }
  dataset.layers.forEach(function(lyr) {
    if (lyr.geometry_type == 'polygon' && dissolvePolygon) {
      // clean each polygon -- use dissolve function to remove spikes
      // TODO: better handling of corrupted polygons
      lyr.shapes = lyr.shapes.map(dissolvePolygon);
    }
  });
  return dataset;
};

utils.getRoundingFunction = function(inc) {
  if (!utils.isNumber(inc) || inc === 0) {
    error("Rounding increment must be a non-zero number.");
  }
  var inv = 1 / inc;
  if (inv > 1) inv = Math.round(inv);
  return function(x) {
    return Math.round(x * inv) / inv;
    // these alternatives show rounding error after JSON.stringify()
    // return Math.round(x / inc) / inv;
    // return Math.round(x / inc) * inc;
    // return Math.round(x * inv) * inc;
  };
};




api.colorizer = function(opts) {
  if (!opts.name) {
    stop("Missing required name= parameter");
  }
  if (internal.isReservedName(opts.name)) {
    stop('"' + opts.name + '" is a reserved name');
  }
  internal.defs[opts.name] = internal.getColorizerFunction(opts);
};

internal.isReservedName = function(name) {
  return /^(stroke|stroke-width|fill|opacity|r|class)$/.test(name);
};

internal.getColorizerFunction = function(opts) {
  var nodataColor = opts.nodata || 'white';
  var round = opts.precision ? utils.getRoundingFunction(opts.precision) : null;
  var colorFunction;

  if (!opts.colors || !opts.colors.length) {
    stop("Missing colors= parameter");
  }

  if (opts.breaks) {
    colorFunction = internal.getSequentialColorFunction(opts.colors, opts.breaks, round);
  } else if (opts.categories) {
    colorFunction = internal.getCategoricalColorFunction(opts.colors, opts.other, opts.categories);
  } else {
    stop("Missing categories= or breaks= parameter");
  }

  return function(val) {
    var col = colorFunction(val);
    return col || nodataColor;
  };
};

internal.getCategoricalColorFunction = function(colors, otherColor, keys) {
  if (colors.length != keys.length) {
    stop("Number of colors should be equal to the number of categories");
  }

  return function(val) {
    var i = keys.indexOf(val);
    if (i >= 0) return colors[i];
    return val && otherColor ? otherColor : null;
  };
};

internal.validateSequentialBreaks = function(breaks) {
  // Accepts repeated values -- should this be allowed?
  var arr2 = breaks.map(parseFloat);
  utils.genericSort(arr2);
  for (var i=0; i<breaks.length; i++) {
    if (breaks[i] !== arr2[i]) stop('Invalid class breaks:', breaks.join(','));
  }
};

internal.getSequentialColorFunction = function(colors, breaks, round) {
  if (colors.length != breaks.length + 1) {
    stop("Number of colors should be one more than number of class breaks");
  }
  internal.validateSequentialBreaks(breaks);
  return function(val) {
    var i = -1;
    if (Number(val) === val) { // exclude null, NaN, strings, etc.
      if (round) val = val(round);
      i = utils.getClassId(val, breaks);
    }
    return i > -1 && i < colors.length ? colors[i] : null;
  };
};

// breaks: threshold values between ranges (ascending order)
// Returns array index of a sequential range, or -1 if @val not numeric
utils.getClassId = function(val, breaks) {
  var minVal = -Infinity,
      maxVal = Infinity,
      i = 0;
  if (!(val >= minVal && val <= maxVal)) {
    return -1;
  }
  while (i < breaks.length && val >= breaks[i]) i++;
  return i;
};




api.dataFill = function(lyr, arcs, opts) {

  var field = opts.field;
  var count;
  if (!field) stop("Missing required field= parameter");
  if (lyr.geometry_type != 'polygon') stop("Target layer must be polygon type");

  // first, fill some holes?
  count = internal.fillMissingValues(lyr, field, internal.getSingleAssignment(lyr, field, arcs));
  verbose("first pass:", count);
  do {
    count = internal.fillMissingValues(lyr, field, internal.getMultipleAssignment(lyr, field, arcs));
    verbose("count:", count);
  } while (count > 0);

  if (opts.postprocess) {
    internal.fillDataIslands(lyr, field, arcs);
    internal.fillDataIslands(lyr, field, arcs); // kludge: second pass removes flipped donut-holes
  }
};

internal.fillDataIslands = function(lyr, field, arcs) {
  var records = lyr.data.getRecords();
  var getValue = internal.getSingleAssignment(lyr, field, arcs, {min_border_pct: 0.5});
  records.forEach(function(rec, shpId) {
    var val = rec[field];
    var nabe = getValue(shpId);
    if (nabe && nabe != val) {
      rec[field] = nabe;
    }
  });
};

internal.fillMissingValues = function(lyr, field, getValue) {
  var records = lyr.data.getRecords();
  var unassigned = internal.getEmptyRecordIds(records, field);
  var count = 0;
  unassigned.forEach(function(shpId) {
    var value = getValue(shpId);
    if (!internal.isEmptyValue(value)) {
      count++;
      records[shpId][field] = value;
    }
  });
  return count;
};

internal.getSingleAssignment = function(lyr, field, arcs, opts) {
  var index = internal.buildAssignmentIndex(lyr, field, arcs);
  var minBorderPct = opts && opts.min_border_pct || 0;

  return function(shpId) {
    var nabes = index[shpId];
    var emptyLen = 0;
    var fieldLen = 0;
    var fieldVal = null;
    var nabe, val, len;

    for (var i=0; i<nabes.length; i++) {
      nabe = nabes[i];
      val = nabe.value;
      len = nabe.length;
      if (internal.isEmptyValue(val)) {
        emptyLen += len;
      } else if (fieldVal === null || fieldVal == val) {
        fieldVal = val;
        fieldLen += len;
      } else {
        // this shape has neighbors with different field values
        return null;
      }
    }

    if (fieldLen / (fieldLen + emptyLen) < minBorderPct) return null;

    return fieldLen > 0 ? fieldVal : null;
  };
};

internal.isEmptyValue = function(val) {
  return !val && val !== 0;
};

internal.getMultipleAssignment = function(lyr, field, arcs) {
  var index;
  return function(shpId) {
    // create index on first use
    index = index || internal.buildAssignmentIndex(lyr, field, arcs);
    var nabes = index[shpId];
    var nabeIndex = {}; // boundary length indexed by value
    var emptyLen = 0;
    var maxLen = 0;
    var maxVal = null;
    var nabe, val, len;

    for (var i=0; i<nabes.length; i++) {
      nabe = nabes[i];
      val = nabe.value;
      len = nabe.length;
      if (internal.isEmptyValue(val)) {
        emptyLen += len;
        continue;
      }
      if (val in nabeIndex) {
        len += nabeIndex[val];
      }
      if (len > maxLen) {
        maxLen = len;
        maxVal = val;
      }
      nabeIndex[val] = len;
    }
    return maxVal; // may be null
  };
};

internal.getEmptyRecordIds = function(records, field) {
  var ids = [];
  for (var i=0, n=records.length; i<n; i++) {
    if (internal.isEmptyValue(records[i][field])) {
      ids.push(i);
    }
  }
  return ids;
};

internal.buildAssignmentIndex = function(lyr, field, arcs) {
  var shapes = lyr.shapes;
  var records = lyr.data.getRecords();
  var classify = internal.getArcClassifier(shapes, arcs)(filter);
  var index = {};
  var index2 = {};

  // calculate length of shared boundaries of each shape, indexed by shape id
  internal.forEachArcId(shapes, onArc);

  // build final index
  // collects border length and data value of each neighbor, indexed by shape id
  Object.keys(index).forEach(function(shpId) {
    var o = index[shpId];
    var nabes = Object.keys(o);
    var arr = index2[shpId] = [];
    var nabeId;
    for (var i=0; i<nabes.length; i++) {
      nabeId = nabes[i];
      arr.push({
        length: o[nabeId],
        value: nabeId > -1 ? records[nabeId][field] : null
      });
    }
  });

  return index2;

  function filter(a, b) {
    return a > -1 ? [a, b] : null;  // edges are b == -1
  }

  function onArc(arcId) {
    var ab = classify(arcId);
    var len;
    if (ab) {
      len = geom.calcPathLen([arcId], arcs, !arcs.isPlanar());
      addArc(ab[0], ab[1], len);
      if (ab[1] > -1) { // arc is not an outside boundary
        addArc(ab[1], ab[0], len);
      }
    }
  }

  function addArc(shpA, shpB, len) {
    var o = index[shpA] || (index[shpA] = {});
    o[shpB] = len + (o[shpB] || 0);
  }
};




var GeoJSON = {};
GeoJSON.ID_FIELD = "FID"; // default field name of imported *JSON feature ids

GeoJSON.typeLookup = {
  LineString: 'polyline',
  MultiLineString: 'polyline',
  Polygon: 'polygon',
  MultiPolygon: 'polygon',
  Point: 'point',
  MultiPoint: 'point'
};

GeoJSON.translateGeoJSONType = function(type) {
  return GeoJSON.typeLookup[type] || null;
};




internal.FileReader = FileReader;
internal.BufferReader = BufferReader;

// Same interface as FileReader, for reading from a Buffer or ArrayBuffer instead of a file.
function BufferReader(src) {
  var bufSize = src.byteLength || src.length,
      binArr, buf;

  this.readToBinArray = function(start, length) {
    if (bufSize < start + length) error("Out-of-range error");
    if (!binArr) binArr = new BinArray(src);
    binArr.position(start);
    return binArr;
  };

  this.toString = function(enc) {
    return buffer().toString(enc);
  };

  this.readSync = function(start, length) {
    // TODO: consider using a default length like FileReader
    return buffer().slice(start, length || bufSize);
  };

  function buffer() {
    if (!buf) {
      buf = (src instanceof ArrayBuffer) ? new Buffer(src) : src;
    }
    return buf;
  }

  this.findString = FileReader.prototype.findString;
  this.expandBuffer = function() {return this;};
  this.size = function() {return bufSize;};
  this.close = function() {};
}


function FileReader(path, opts) {
  var fs = require('fs'),
      fileLen = fs.statSync(path).size,
      DEFAULT_CACHE_LEN = opts && opts.cacheSize || 0x800000, // 8MB
      DEFAULT_BUFFER_LEN = opts && opts.bufferSize || 0x4000, // 32K
      fd, cacheOffs, cache, binArr;

  this.expandBuffer = function() {
    DEFAULT_BUFFER_LEN *= 2;
    return this;
  };

  // Read to BinArray (for compatibility with ShpReader)
  this.readToBinArray = function(start, length) {
    if (updateCache(start, length)) {
      binArr = new BinArray(cache);
    }
    binArr.position(start - cacheOffs);
    return binArr;
  };

  // Read to Buffer
  this.readSync = function(start, length) {
    if (length > 0 === false) {
      // use default (but variable) size if length is not specified
      length = DEFAULT_BUFFER_LEN;
      if (start + length > fileLen) {
        length = fileLen - start; // truncate at eof
      }
      if (length === 0) {
        return new Buffer(0); // kludge to allow reading up to eof
      }
    }
    updateCache(start, length);
    return cache.slice(start - cacheOffs, start - cacheOffs + length);
  };

  this.size = function() {
    return fileLen;
  };

  this.toString = function(enc) {
    // TODO: use fd
    return cli.readFile(path, enc || 'utf8');
  };

  this.close = function() {
    if (fd) {
      fs.closeSync(fd);
      fd = null;
      cache = null;
    }
  };

  // Receive offset and length of byte string that must be read
  // Return true if cache was updated, or false
  function updateCache(fileOffs, bufLen) {
    var headroom = fileLen - fileOffs,
        bytesRead, bytesToRead;
    if (headroom < bufLen || headroom < 0) {
      error("Tried to read past end-of-file");
    }
    if (cache && fileOffs >= cacheOffs && cacheOffs + cache.length >= fileOffs + bufLen) {
      return false;
    }
    bytesToRead = Math.max(DEFAULT_CACHE_LEN, bufLen);
    if (headroom < bytesToRead) {
      bytesToRead = headroom;
    }
    if (!cache || bytesToRead != cache.length) {
      cache = new Buffer(bytesToRead);
    }
    if (!fd) {
      fd = fs.openSync(path, 'r');
    }
    bytesRead = fs.readSync(fd, cache, 0, bytesToRead, fileOffs);
    cacheOffs = fileOffs;
    if (bytesRead != bytesToRead) error("Error reading file");
    return true;
  }
}

FileReader.prototype.findString = function (str, maxLen) {
  var len = Math.min(this.size(), maxLen || this.size());
  var buf = this.readSync(0, len);
  var strLen = str.length;
  var n = buf.length - strLen;
  var firstByte = str.charCodeAt(0);
  var i;
  for (i=0; i < n; i++) {
    if (buf[i] == firstByte && buf.toString('utf8', i, i + strLen) == str) {
      return {
        offset: i + strLen,
        text: buf.toString('utf8', 0, i)
      };
    }
  }
  return null;
};




internal.GeoJSONReader = GeoJSONReader;

// Read GeoJSON Features or geometry objects from a file
// @reader: a FileReader
function GeoJSONReader(reader) {

  // Read objects synchronously, with callback
  this.readObjects = function(onObject) {
    // Search first x bytes of file for features|geometries key
    var bytesToSearch = 300;
    var start = reader.findString('"features"', bytesToSearch) ||
        reader.findString('"geometries"', bytesToSearch);
    // Assume single Feature or geometry if collection not found
    var offset = start ? start.offset : 0;
    readObjects(offset, onObject);
  };

  this.readObject = readObject;

  function readObjects(start, cb) {
    var obj = readObject(start);
    while (obj) {
      cb(JSON.parse(obj.text)); // Use JSON.parse to parse object
      obj = readObject(obj.offset);
    }
  }

  // Search for a JSON object starting at position @offs
  // Returns {text: "<object>", offset: <offset>} or null
  //   <offset> is the file position directly after the object's closing brace
  // Skips characters in front of first left curly brace
  function readObject(offs) {
    var LBRACE = 123,
        RBRACE = 125,
        BSLASH = 92,
        DQUOTE = 34,
        level = 0,
        inString = false,
        escapeNext = false,
        buf = reader.readSync(offs),
        retn = null,
        startPos, i, n, c;
    for (i=0, n=buf.length; i<n; i++) {
      c = buf[i];
      if (inString) {
        if (escapeNext) {
          escapeNext = false;
        } else if (c == DQUOTE) {
          inString = false;
        } else if (c == BSLASH) {
          escapeNext = true;
        }
      } else if (c == DQUOTE) {
        inString = true;
      } else if (c == LBRACE) {
        if (level === 0) {
          startPos = i;
        }
        level++;
      } else if (c == RBRACE) {
        level--;
        if (level === 0) {
          retn = {text: buf.toString('utf8', startPos, i + 1), offset: offs + i + 1};
          break;
        } else if (level == -1) {
          break; // error -- "}" encountered before "{"
        }
      }
      if (i == n-1) {
        buf = reader.expandBuffer().readSync(offs);
        n = buf.length;
      }
    }
    return retn;
  }
}




// Get function to Hash an x, y point to a non-negative integer
function getXYHash(size) {
  var buf = new ArrayBuffer(16),
      floats = new Float64Array(buf),
      uints = new Uint32Array(buf),
      lim = size | 0;
  if (lim > 0 === false) {
    throw new Error("Invalid size param: " + size);
  }

  return function(x, y) {
    var u = uints, h;
    floats[0] = x;
    floats[1] = y;
    h = u[0] ^ u[1];
    h = h << 5 ^ h >> 7 ^ u[2] ^ u[3];
    return (h & 0x7fffffff) % lim;
  };
}

// Get function to Hash a single coordinate to a non-negative integer
function getXHash(size) {
  var buf = new ArrayBuffer(8),
      floats = new Float64Array(buf),
      uints = new Uint32Array(buf),
      lim = size | 0;
  if (lim > 0 === false) {
    throw new Error("Invalid size param: " + size);
  }

  return function(x) {
    var h;
    floats[0] = x;
    h = uints[0] ^ uints[1];
    h = h << 5 ^ h >> 7;
    return (h & 0x7fffffff) % lim;
  };
}




// Used for building topology
//
function ArcIndex(pointCount) {
  var hashTableSize = Math.floor(pointCount * 0.25 + 1),
      hash = getXYHash(hashTableSize),
      hashTable = new Int32Array(hashTableSize),
      chainIds = [],
      arcs = [],
      arcPoints = 0;

  utils.initializeArray(hashTable, -1);

  this.addArc = function(xx, yy) {
    var end = xx.length - 1,
        key = hash(xx[end], yy[end]),
        chainId = hashTable[key],
        arcId = arcs.length;
    hashTable[key] = arcId;
    arcs.push([xx, yy]);
    arcPoints += xx.length;
    chainIds.push(chainId);
    return arcId;
  };

  // Look for a previously generated arc with the same sequence of coords, but in the
  // opposite direction. (This program uses the convention of CW for space-enclosing rings, CCW for holes,
  // so coincident boundaries should contain the same points in reverse sequence).
  //
  this.findMatchingArc = function(xx, yy, start, end, getNext, getPrev) {
    // First, look for a reverse match
    var arcId = findArcNeighbor(xx, yy, start, end, getNext);
    if (arcId === null) {
      // Look for forward match
      // (Abnormal topology, but we're accepting it because in-the-wild
      // Shapefiles sometimes have duplicate paths)
      arcId = findArcNeighbor(xx, yy, end, start, getPrev);
    } else {
      arcId = ~arcId;
    }
    return arcId;
  };

  function findArcNeighbor(xx, yy, start, end, getNext) {
    var next = getNext(start),
        key = hash(xx[start], yy[start]),
        arcId = hashTable[key],
        arcX, arcY, len;

    while (arcId != -1) {
      // check endpoints and one segment...
      // it would be more rigorous but slower to identify a match
      // by comparing all segments in the coordinate sequence
      arcX = arcs[arcId][0];
      arcY = arcs[arcId][1];
      len = arcX.length;
      if (arcX[0] === xx[end] && arcX[len-1] === xx[start] && arcX[len-2] === xx[next] &&
          arcY[0] === yy[end] && arcY[len-1] === yy[start] && arcY[len-2] === yy[next]) {
        return arcId;
      }
      arcId = chainIds[arcId];
    }
    return null;
  }

  this.getVertexData = function() {
    var xx = new Float64Array(arcPoints),
        yy = new Float64Array(arcPoints),
        nn = new Uint32Array(arcs.length),
        copied = 0,
        arc, len;
    for (var i=0, n=arcs.length; i<n; i++) {
      arc = arcs[i];
      len = arc[0].length;
      utils.copyElements(arc[0], 0, xx, copied, len);
      utils.copyElements(arc[1], 0, yy, copied, len);
      nn[i] = len;
      copied += len;
    }
    return {
      xx: xx,
      yy: yy,
      nn: nn
    };
  };
}




function initHashChains(xx, yy) {
  // Performance doesn't improve much above ~1.3 * point count
  var n = xx.length,
      m = Math.floor(n * 1.3) || 1,
      hash = getXYHash(m),
      hashTable = new Int32Array(m),
      chainIds = new Int32Array(n), // Array to be filled with chain data
      key, j;

  for (var i=0; i<n; i++) {
    key = hash(xx[i], yy[i]);
    j = hashTable[key] - 1; // coord ids are 1-based in hash table; 0 used as null value.
    hashTable[key] = i + 1;
    chainIds[i] = j < 0 ? i : j; // first item in a chain points to self
  }
  return chainIds;
}

function initPointChains(xx, yy) {
  var chainIds = initHashChains(xx, yy),
      j, next, prevMatchId, prevUnmatchId;

  // disentangle, reverse and close the chains created by initHashChains()
  for (var i = xx.length-1; i>=0; i--) {
    next = chainIds[i];
    if (next >= i) continue;
    prevMatchId = i;
    prevUnmatchId = -1;
    do {
      j = next;
      next = chainIds[j];
      if (yy[j] == yy[i] && xx[j] == xx[i]) {
        chainIds[j] = prevMatchId;
        prevMatchId = j;
      } else {
        if (prevUnmatchId > -1) {
          chainIds[prevUnmatchId] = j;
        }
        prevUnmatchId = j;
      }
    } while (next < j);
    if (prevUnmatchId > -1) {
      // Make sure last unmatched entry is terminated
      chainIds[prevUnmatchId] = prevUnmatchId;
    }
    chainIds[i] = prevMatchId; // close the chain
  }
  return chainIds;
}




// Converts all polygon and polyline paths in a dataset to a topological format,
// (in-place);
api.buildTopology = function(dataset) {
  if (!dataset.arcs) return;
  var raw = dataset.arcs.getVertexData(),
      cooked = internal.buildPathTopology(raw.nn, raw.xx, raw.yy);
  dataset.arcs.updateVertexData(cooked.nn, cooked.xx, cooked.yy);
  dataset.layers.forEach(function(lyr) {
    if (lyr.geometry_type == 'polyline' || lyr.geometry_type == 'polygon') {
      lyr.shapes = internal.replaceArcIds(lyr.shapes, cooked.paths);
    }
  });
};

// buildPathTopology() converts non-topological paths into
// a topological format
//
// Arguments:
//    xx: [Array|Float64Array],   // x coords of each point in the dataset
//    yy: [Array|Float64Array],   // y coords ...
//    nn: [Array]  // length of each path
//
// (x- and y-coords of all paths are concatenated into two arrays)
//
// Returns:
// {
//    xx, yy (array)   // coordinate data
//    nn: (array)      // points in each arc
//    paths: (array)   // Paths are arrays of one or more arc id.
// }
//
// Negative arc ids in the paths array indicate a reversal of arc -(id + 1)
//
internal.buildPathTopology = function(nn, xx, yy) {
  var pointCount = xx.length,
      chainIds = initPointChains(xx, yy),
      pathIds = initPathIds(pointCount, nn),
      index = new ArcIndex(pointCount),
      slice = usingTypedArrays() ? xx.subarray : Array.prototype.slice,
      paths, retn;
  paths = convertPaths(nn);
  retn = index.getVertexData();
  retn.paths = paths;
  return retn;

  function usingTypedArrays() {
    return !!(xx.subarray && yy.subarray);
  }

  function convertPaths(nn) {
    var paths = [],
        pointId = 0,
        pathLen;
    for (var i=0, len=nn.length; i<len; i++) {
      pathLen = nn[i];
      paths.push(pathLen < 2 ? null : convertPath(pointId, pointId + pathLen - 1));
      pointId += pathLen;
    }
    return paths;
  }

  function nextPoint(id) {
    var partId = pathIds[id],
        nextId = id + 1;
    if (nextId < pointCount && pathIds[nextId] === partId) {
      return id + 1;
    }
    var len = nn[partId];
    return sameXY(id, id - len + 1) ? id - len + 2 : -1;
  }

  function prevPoint(id) {
    var partId = pathIds[id],
        prevId = id - 1;
    if (prevId >= 0 && pathIds[prevId] === partId) {
      return id - 1;
    }
    var len = nn[partId];
    return sameXY(id, id + len - 1) ? id + len - 2 : -1;
  }

  function sameXY(a, b) {
    return xx[a] == xx[b] && yy[a] == yy[b];
  }

  // Convert a non-topological path to one or more topological arcs
  // @start, @end are ids of first and last points in the path
  // TODO: don't allow id ~id pairs
  //
  function convertPath(start, end) {
    var arcIds = [],
        firstNodeId = -1,
        arcStartId;

    // Visit each point in the path, up to but not including the last point
    for (var i = start; i < end; i++) {
      if (pointIsArcEndpoint(i)) {
        if (firstNodeId > -1) {
          arcIds.push(addEdge(arcStartId, i));
        } else {
          firstNodeId = i;
        }
        arcStartId = i;
      }
    }

    // Identify the final arc in the path
    if (firstNodeId == -1) {
      // Not in an arc, i.e. no nodes have been found...
      // Assuming that path is either an island or is congruent with one or more rings
      arcIds.push(addRing(start, end));
    }
    else if (firstNodeId == start) {
      // path endpoint is a node;
      if (!pointIsArcEndpoint(end)) {
        error("Topology error"); // TODO: better error handling
      }
      arcIds.push(addEdge(arcStartId, i));
    } else {
      // final arc wraps around
      arcIds.push(addSplitEdge(arcStartId, end, start + 1, firstNodeId));
    }
    return arcIds;
  }

  // Test if a point @id is an endpoint of a topological path
  function pointIsArcEndpoint(id) {
    var id2 = chainIds[id],
        prev = prevPoint(id),
        next = nextPoint(id),
        prev2, next2;
    if (prev == -1 || next == -1) {
      // @id is an endpoint if it is the start or end of an open path
      return true;
    }
    while (id != id2) {
      prev2 = prevPoint(id2);
      next2 = nextPoint(id2);
      if (prev2 == -1 || next2 == -1 || brokenEdge(prev, next, prev2, next2)) {
        // there is a discontinuity at @id -- point is arc endpoint
        return true;
      }
      id2 = chainIds[id2];
    }
    return false;
  }

  // a and b are two vertices with the same x, y coordinates
  // test if the segments on either side of them are also identical
  function brokenEdge(aprev, anext, bprev, bnext) {
    var apx = xx[aprev],
        anx = xx[anext],
        bpx = xx[bprev],
        bnx = xx[bnext],
        apy = yy[aprev],
        any = yy[anext],
        bpy = yy[bprev],
        bny = yy[bnext];
    if (apx == bnx && anx == bpx && apy == bny && any == bpy ||
        apx == bpx && anx == bnx && apy == bpy && any == bny) {
      return false;
    }
    return true;
  }

  function mergeArcParts(src, startId, endId, startId2, endId2) {
    var len = endId - startId + endId2 - startId2 + 2,
        ArrayClass = usingTypedArrays() ? Float64Array : Array,
        dest = new ArrayClass(len),
        j = 0, i;
    for (i=startId; i <= endId; i++) {
      dest[j++] = src[i];
    }
    for (i=startId2; i <= endId2; i++) {
      dest[j++] = src[i];
    }
    return dest;
  }

  function addSplitEdge(start1, end1, start2, end2) {
    var arcId = index.findMatchingArc(xx, yy, start1, end2, nextPoint, prevPoint);
    if (arcId === null) {
      arcId = index.addArc(mergeArcParts(xx, start1, end1, start2, end2),
          mergeArcParts(yy, start1, end1, start2, end2));
    }
    return arcId;
  }

  function addEdge(start, end) {
    // search for a matching edge that has already been generated
    var arcId = index.findMatchingArc(xx, yy, start, end, nextPoint, prevPoint);
    if (arcId === null) {
      arcId = index.addArc(slice.call(xx, start, end + 1),
          slice.call(yy, start, end + 1));
    }
    return arcId;
  }

  function addRing(startId, endId) {
    var chainId = chainIds[startId],
        pathId = pathIds[startId],
        arcId;

    while (chainId != startId) {
      if (pathIds[chainId] < pathId) {
        break;
      }
      chainId = chainIds[chainId];
    }

    if (chainId == startId) {
      return addEdge(startId, endId);
    }

    for (var i=startId; i<endId; i++) {
      arcId = index.findMatchingArc(xx, yy, i, i, nextPoint, prevPoint);
      if (arcId !== null) return arcId;
    }
    error("Unmatched ring; id:", pathId, "len:", nn[pathId]);
  }
};


// Create a lookup table for path ids; path ids are indexed by point id
//
function initPathIds(size, pathSizes) {
  var pathIds = new Int32Array(size),
      j = 0;
  for (var pathId=0, pathCount=pathSizes.length; pathId < pathCount; pathId++) {
    for (var i=0, n=pathSizes[pathId]; i<n; i++, j++) {
      pathIds[j] = pathId;
    }
  }
  return pathIds;
}

internal.replaceArcIds = function(src, replacements) {
  return src.map(function(shape) {
    return replaceArcsInShape(shape, replacements);
  });

  function replaceArcsInShape(shape, replacements) {
    if (!shape) return null;
    return shape.map(function(path) {
      return replaceArcsInPath(path, replacements);
    });
  }

  function replaceArcsInPath(path, replacements) {
    return path.reduce(function(memo, id) {
      var abs = absArcId(id);
      var topoPath = replacements[abs];
      if (topoPath) {
        if (id < 0) {
          topoPath = topoPath.concat(); // TODO: need to copy?
          internal.reversePath(topoPath);
        }
        for (var i=0, n=topoPath.length; i<n; i++) {
          memo.push(topoPath[i]);
        }
      }
      return memo;
    }, []);
  }
};




internal.getHighPrecisionSnapInterval = function(arcs) {
  var bb = arcs.getBounds();
  if (!bb.hasBounds()) return 0;
  var maxCoord = Math.max(Math.abs(bb.xmin), Math.abs(bb.ymin),
      Math.abs(bb.xmax), Math.abs(bb.ymax));
  return maxCoord * 1e-14;
};

internal.snapCoords = function(arcs, threshold) {
    var avgDist = internal.getAvgSegment(arcs),
        autoSnapDist = avgDist * 0.0025,
        snapDist = autoSnapDist;

  if (threshold > 0) {
    snapDist = threshold;
    message(utils.format("Applying snapping threshold of %s -- %.6f times avg. segment length", threshold, threshold / avgDist));
  }

  var snapCount = internal.snapCoordsByInterval(arcs, snapDist);
  if (snapCount > 0) arcs.dedupCoords();
  message(utils.format("Snapped %s point%s", snapCount, utils.pluralSuffix(snapCount)));
};

// Snap together points within a small threshold
//
internal.snapCoordsByInterval = function(arcs, snapDist) {
  var snapCount = 0,
      data = arcs.getVertexData();

  // Get sorted coordinate ids
  // Consider: speed up sorting -- try bucket sort as first pass.
  //
  var ids = utils.sortCoordinateIds(data.xx);
  for (var i=0, n=ids.length; i<n; i++) {
    snapCount += snapPoint(i, snapDist, ids, data.xx, data.yy);
  }
  return snapCount;

  function snapPoint(i, limit, ids, xx, yy) {
    var j = i,
        n = ids.length,
        x = xx[ids[i]],
        y = yy[ids[i]],
        snaps = 0,
        id2, dx, dy;

    while (++j < n) {
      id2 = ids[j];
      dx = xx[id2] - x;
      if (dx > limit) break;
      dy = yy[id2] - y;
      if (dx === 0 && dy === 0 || dx * dx + dy * dy > limit * limit) continue;
      xx[id2] = x;
      yy[id2] = y;
      snaps++;
    }
    return snaps;
  }
};

utils.sortCoordinateIds = function(a) {
  var n = a.length,
      ids = new Uint32Array(n);
  for (var i=0; i<n; i++) {
    ids[i] = i;
  }
  utils.quicksortIds(a, ids, 0, ids.length-1);
  return ids;
};

/*
// Returns array of array ids, in ascending order.
// @a array of numbers
//
utils.sortCoordinateIds = function(a) {
  return utils.bucketSortIds(a);
};

// This speeds up sorting of large datasets (~2x faster for 1e7 values)
// worth the additional code?
utils.bucketSortIds = function(a, n) {
  var len = a.length,
      ids = new Uint32Array(len),
      bounds = utils.getArrayBounds(a),
      buckets = Math.ceil(n > 0 ? n : len / 10),
      counts = new Uint32Array(buckets),
      offsets = new Uint32Array(buckets),
      i, j, offs, count;

  // get bucket sizes
  for (i=0; i<len; i++) {
    j = bucketId(a[i], bounds.min, bounds.max, buckets);
    counts[j]++;
  }

  // convert counts to offsets
  offs = 0;
  for (i=0; i<buckets; i++) {
    offsets[i] = offs;
    offs += counts[i];
  }

  // assign ids to buckets
  for (i=0; i<len; i++) {
    j = bucketId(a[i], bounds.min, bounds.max, buckets);
    offs = offsets[j]++;
    ids[offs] = i;
  }

  // sort each bucket with quicksort
  for (i = 0; i<buckets; i++) {
    count = counts[i];
    if (count > 1) {
      offs = offsets[i] - count;
      utils.quicksortIds(a, ids, offs, offs + count - 1);
    }
  }
  return ids;

  function bucketId(val, min, max, buckets) {
    var id = (buckets * (val - min) / (max - min)) | 0;
    return id < buckets ? id : buckets - 1;
  }
};
*/

utils.quicksortIds = function (a, ids, lo, hi) {
  if (hi - lo > 24) {
    var pivot = a[ids[lo + hi >> 1]],
        i = lo,
        j = hi,
        tmp;
    while (i <= j) {
      while (a[ids[i]] < pivot) i++;
      while (a[ids[j]] > pivot) j--;
      if (i <= j) {
        tmp = ids[i];
        ids[i] = ids[j];
        ids[j] = tmp;
        i++;
        j--;
      }
    }
    if (j > lo) utils.quicksortIds(a, ids, lo, j);
    if (i < hi) utils.quicksortIds(a, ids, i, hi);
  } else {
    utils.insertionSortIds(a, ids, lo, hi);
  }
};

utils.insertionSortIds = function(arr, ids, start, end) {
  var id, i, j;
  for (j = start + 1; j <= end; j++) {
    id = ids[j];
    for (i = j - 1; i >= start && arr[id] < arr[ids[i]]; i--) {
      ids[i+1] = ids[i];
    }
    ids[i+1] = id;
  }
};




// Accumulates points in buffers until #endPath() is called
// @drain callback: function(xarr, yarr, size) {}
//
function PathImportStream(drain) {
  var buflen = 10000,
      xx = new Float64Array(buflen),
      yy = new Float64Array(buflen),
      i = 0;

  this.endPath = function() {
    drain(xx, yy, i);
    i = 0;
  };

  this.addPoint = function(x, y) {
    if (i >= buflen) {
      buflen = Math.ceil(buflen * 1.3);
      xx = utils.extendBuffer(xx, buflen);
      yy = utils.extendBuffer(yy, buflen);
    }
    xx[i] = x;
    yy[i] = y;
    i++;
  };
}

// Import path data from a non-topological source (Shapefile, GeoJSON, etc)
// in preparation for identifying topology.
// @opts.reserved_points -- estimate of points in dataset, for pre-allocating buffers
//
function PathImporter(opts) {
  var bufSize = opts.reserved_points > 0 ? opts.reserved_points : 20000,
      xx = new Float64Array(bufSize),
      yy = new Float64Array(bufSize),
      shapes = [],
      properties = [],
      nn = [],
      types = [],
      collectionType = opts.type || null, // possible values: polygon, polyline, point
      round = null,
      pathId = -1,
      shapeId = -1,
      pointId = 0,
      dupeCount = 0,
      openRingCount = 0;

  if (opts.precision) {
    round = utils.getRoundingFunction(opts.precision);
  }

  // mix in #addPoint() and #endPath() methods
  utils.extend(this, new PathImportStream(importPathCoords));

  this.startShape = function(d) {
    shapes[++shapeId] = null;
    if (d) properties[shapeId] = d;
  };

  this.importLine = function(points) {
    setShapeType('polyline');
    this.importPath(points);
  };

  this.importPoints = function(points) {
    setShapeType('point');
    if (round) {
      points.forEach(function(p) {
        p[0] = round(p[0]);
        p[1] = round(p[1]);
      });
    }
    points.forEach(appendToShape);
  };

  this.importRing = function(points, isHole) {
    var area = geom.getPlanarPathArea2(points);
    setShapeType('polygon');
    if (isHole === true && area > 0 || isHole === false && area < 0) {
      verbose("Warning: reversing", isHole ? "a CW hole" : "a CCW ring");
      points.reverse();
    }
    this.importPath(points);
  };

  // Import an array of [x, y] Points
  this.importPath = function importPath(points) {
    var p;
    for (var i=0, n=points.length; i<n; i++) {
      p = points[i];
      this.addPoint(p[0], p[1]);
    }
    this.endPath();
  };

  // Return imported dataset
  // Apply any requested snapping and rounding
  // Remove duplicate points, check for ring inversions
  //
  this.done = function() {
    var arcs;
    var layers;
    var lyr = {name: ''};

    if (dupeCount > 0) {
      verbose(utils.format("Removed %,d duplicate point%s", dupeCount, utils.pluralSuffix(dupeCount)));
    }
    if (openRingCount > 0) {
      message(utils.format("Closed %,d open polygon ring%s", openRingCount, utils.pluralSuffix(openRingCount)));
    }
    if (pointId > 0) {
       if (pointId < xx.length) {
        xx = xx.subarray(0, pointId);
        yy = yy.subarray(0, pointId);
      }
      arcs = new ArcCollection(nn, xx, yy);

      if (opts.auto_snap || opts.snap_interval) {
        internal.snapCoords(arcs, opts.snap_interval);
      }
    }

    if (collectionType == 'mixed') {
      layers = internal.divideFeaturesByType(shapes, properties, types);

    } else {
      lyr = {geometry_type: collectionType};
      if (collectionType) {
        lyr.shapes = shapes;
      }
      if (properties.length > 0) {
        lyr.data = new DataTable(properties);
      }
      layers = [lyr];
    }

    layers.forEach(function(lyr) {
      if (internal.layerHasPaths(lyr)) {
        internal.cleanShapes(lyr.shapes, arcs, lyr.geometry_type);
      }
      if (lyr.data) {
        internal.fixInconsistentFields(lyr.data.getRecords());
      }
    });

    return {
      arcs: arcs || null,
      info: {},
      layers: layers
    };
  };

  function setShapeType(t) {
    var currType = shapeId < types.length ? types[shapeId] : null;
    if (!currType) {
      types[shapeId] = t;
      if (!collectionType) {
        collectionType = t;
      } else if (t != collectionType) {
        collectionType = 'mixed';
      }
    } else if (currType != t) {
      stop("Unable to import mixed-geometry GeoJSON features");
    }
  }

  function checkBuffers(needed) {
    if (needed > xx.length) {
      var newLen = Math.max(needed, Math.ceil(xx.length * 1.5));
      xx = utils.extendBuffer(xx, newLen, pointId);
      yy = utils.extendBuffer(yy, newLen, pointId);
    }
  }

  function appendToShape(part) {
    var currShape = shapes[shapeId] || (shapes[shapeId] = []);
    currShape.push(part);
  }

  function appendPath(n) {
    pathId++;
    nn[pathId] = n;
    appendToShape([pathId]);
  }

  function importPathCoords(xsrc, ysrc, n) {
    var count = 0;
    var x, y, prevX, prevY;
    checkBuffers(pointId + n);
    for (var i=0; i<n; i++) {
      x = xsrc[i];
      y = ysrc[i];
      if (round) {
        x = round(x);
        y = round(y);
      }
      if (i > 0 && x == prevX && y == prevY) {
        dupeCount++;
      } else {
        xx[pointId] = x;
        yy[pointId] = y;
        pointId++;
        count++;
      }
      prevY = y;
      prevX = x;
    }

    // check for open rings
    if (collectionType == 'polygon' && count > 0) {
      if (xsrc[0] != xsrc[n-1] || ysrc[0] != ysrc[n-1]) {
        checkBuffers(pointId + 1);
        xx[pointId] = xsrc[0];
        yy[pointId] = ysrc[0];
        openRingCount++;
        pointId++;
        count++;
      }
    }

    appendPath(count);
  }
}




function GeoJSONParser(opts) {
  var idField = opts.id_field || GeoJSON.ID_FIELD,
      importer = new PathImporter(opts),
      dataset;

  this.parseObject = function(o) {
    var geom, rec;
    if (o.type == 'Feature') {
      geom = o.geometry;
      rec = o.properties || {};
      if ('id' in o) {
        rec[idField] = o.id;
      }
    } else if (o.type) {
      geom = o;
    }
    importer.startShape(rec);
    if (geom) GeoJSON.importGeometry(geom, importer);
  };

  this.done = function() {
    return importer.done();
  };
}

internal.importGeoJSON = function(src, opts) {
  var supportedGeometries = Object.keys(GeoJSON.pathImporters),
      srcObj = utils.isString(src) ? JSON.parse(src) : src,
      importer = new GeoJSONParser(opts),
      srcCollection, dataset;

  // Convert single feature or geometry into a collection with one member
  if (srcObj.type == 'Feature') {
    srcCollection = {
      type: 'FeatureCollection',
      features: [srcObj]
    };
  } else if (utils.contains(supportedGeometries, srcObj.type)) {
    srcCollection = {
      type: 'GeometryCollection',
      geometries: [srcObj]
    };
  } else {
    srcCollection = srcObj;
  }
  (srcCollection.features || srcCollection.geometries || []).forEach(importer.parseObject);
  dataset = importer.done();
  internal.importCRS(dataset, srcObj); // TODO: remove this
  return dataset;
};


GeoJSON.importGeometry = function(geom, importer) {
  var type = geom.type;
  if (type in GeoJSON.pathImporters) {
    GeoJSON.pathImporters[type](geom.coordinates, importer);
  } else if (type == 'GeometryCollection') {
    geom.geometries.forEach(function(geom) {
      GeoJSON.importGeometry(geom, importer);
    });
  } else {
    verbose("GeoJSON.importGeometry() Unsupported geometry type:", geom.type);
  }
};

// Functions for importing geometry coordinates using a PathImporter
//
GeoJSON.pathImporters = {
  LineString: function(coords, importer) {
    importer.importLine(coords);
  },
  MultiLineString: function(coords, importer) {
    for (var i=0; i<coords.length; i++) {
      GeoJSON.pathImporters.LineString(coords[i], importer);
    }
  },
  Polygon: function(coords, importer) {
    for (var i=0; i<coords.length; i++) {
      importer.importRing(coords[i], i > 0);
    }
  },
  MultiPolygon: function(coords, importer) {
    for (var i=0; i<coords.length; i++) {
      GeoJSON.pathImporters.Polygon(coords[i], importer);
    }
  },
  Point: function(coord, importer) {
    importer.importPoints([coord]);
  },
  MultiPoint: function(coords, importer) {
    importer.importPoints(coords);
  }
};

internal.importCRS = function(dataset, jsonObj) {
  if ('crs' in jsonObj) {
    dataset.info.input_geojson_crs = jsonObj.crs;
  }
};




internal.getFormattedStringify = function(numArrayKeys) {
  var keyIndex = utils.arrayToIndex(numArrayKeys);
  var sentinel = '\u1000\u2FD5\u0310';
  var stripRxp = new RegExp('"' + sentinel + '|' + sentinel + '"', 'g');
  var indentChars = '  ';

  function replace(key, val) {
    // We want to format numerical arrays like [1, 2, 3] instead of
    // the way JSON.stringify() behaves when applying indentation.
    // This kludge converts arrays to strings with sentinel strings inside the
    // surrounding quotes. At the end, the sentinel strings and quotes
    // are replaced by array brackets.
    if (key in keyIndex && utils.isArray(val)) {
      var str = JSON.stringify(val);
      // make sure the array does not contain any strings
      if (str.indexOf('"' == -1)) {
        return sentinel + str.replace(/,/g, ', ') + sentinel;
      }
    }
    return val;
  }

  return function(obj) {
    var json = JSON.stringify(obj, replace, indentChars);
    return json.replace(stripRxp, '');
  };
};




internal.exportPointData = function(points) {
  var data, path;
  if (!points || points.length === 0) {
    data = {partCount: 0, pointCount: 0};
  } else {
    path = {
      points: points,
      pointCount: points.length,
      bounds: geom.getPathBounds(points)
    };
    data = {
      bounds: path.bounds,
      pathData: [path],
      partCount: 1,
      pointCount: path.pointCount
    };
  }
  return data;
};

// TODO: remove duplication with internal.getPathMetadata()
internal.exportPathData = function(shape, arcs, type) {
  // kludge until Shapefile exporting is refactored
  if (type == 'point') return internal.exportPointData(shape);

  var pointCount = 0,
      bounds = new Bounds(),
      paths = [];

  if (shape && (type == 'polyline' || type == 'polygon')) {
    shape.forEach(function(arcIds, i) {
      var iter = arcs.getShapeIter(arcIds),
          path = internal.exportPathCoords(iter),
          valid = true;
      if (type == 'polygon') {
        path.area = geom.getPlanarPathArea2(path.points);
        valid = path.pointCount > 3 && path.area !== 0;
      } else if (type == 'polyline') {
        valid = path.pointCount > 1;
      }
      if (valid) {
        pointCount += path.pointCount;
        path.bounds = geom.getPathBounds(path.points);
        bounds.mergeBounds(path.bounds);
        paths.push(path);
      } else {
        verbose("Skipping a collapsed", type, "path");
      }
    });
  }

  return {
    pointCount: pointCount,
    pathData: paths,
    pathCount: paths.length,
    bounds: bounds
  };
};

internal.exportPathCoords = function(iter) {
  var points = [],
      i = 0,
      x, y, prevX, prevY;
  while (iter.hasNext()) {
    x = iter.x;
    y = iter.y;
    if (i === 0 || prevX != x || prevY != y) {
      points.push([x, y]);
      i++;
    }
    prevX = x;
    prevY = y;
  }
  return {
    points: points,
    pointCount: points.length
  };
};




// Don't modify input layers (mergeDatasets() updates arc ids in-place)
internal.mergeDatasetsForExport = function(arr) {
  // copy layers but not arcs, which get copied in mergeDatasets()
  var copy = arr.map(function(dataset) {
    return utils.defaults({
      layers: dataset.layers.map(internal.copyLayerShapes)
    }, dataset);
  });
  return internal.mergeDatasets(copy);
};

internal.mergeDatasets = function(arr) {
  var arcSources = [],
      arcCount = 0,
      mergedLayers = [],
      mergedInfo = {},
      mergedIsLatLng = null,
      mergedArcs;

  arr.forEach(function(dataset) {
    var bounds = internal.getDatasetBounds(dataset);
    var n = dataset.arcs ? dataset.arcs.size() : 0;
    var isLatLng;
    if (n > 0) {
      arcSources.push(dataset.arcs);
    }
    // check for incompatible CRS
    if (bounds.hasBounds()) {
      isLatLng = internal.probablyDecimalDegreeBounds(bounds);
      if (mergedIsLatLng === null) {
        mergedIsLatLng = isLatLng;
      } else if (mergedIsLatLng !== isLatLng) {
        // TODO: consider stricter CRS rules
        stop("Unable to combine projected and unprojected datasets");
      }
    }
    internal.mergeDatasetInfo(mergedInfo, dataset);
    dataset.layers.forEach(function(lyr) {
      if (lyr.geometry_type == 'polygon' || lyr.geometry_type == 'polyline') {
        internal.forEachArcId(lyr.shapes, function(id) {
          return id < 0 ? id - arcCount : id + arcCount;
        });
      }
      mergedLayers.push(lyr);
    });
    arcCount += n;
  });

  mergedArcs = internal.mergeArcs(arcSources);
  if (mergedArcs.size() != arcCount) {
    error("[mergeDatasets()] Arc indexing error");
  }

  return {
    info: mergedInfo,
    arcs: mergedArcs,
    layers: mergedLayers
  };
};

internal.mergeDatasetInfo = function(merged, dataset) {
  var info = dataset.info || {};
  merged.input_files = utils.uniq((merged.input_files || []).concat(info.input_files || []));
  merged.input_formats = utils.uniq((merged.input_formats || []).concat(info.input_formats || []));
  // merge other info properties (e.g. input_geojson_crs, input_delimiter, prj, crs)
  utils.defaults(merged, info);
};

internal.mergeArcs = function(arr) {
  var dataArr = arr.map(function(arcs) {
    if (arcs.getRetainedInterval() > 0) {
      verbose("Baking-in simplification setting.");
      arcs.flatten();
    }
    return arcs.getVertexData();
  });
  var xx = utils.mergeArrays(utils.pluck(dataArr, 'xx'), Float64Array),
      yy = utils.mergeArrays(utils.pluck(dataArr, 'yy'), Float64Array),
      nn = utils.mergeArrays(utils.pluck(dataArr, 'nn'), Int32Array);

  return new ArcCollection(nn, xx, yy);
};

utils.countElements = function(arrays) {
  return arrays.reduce(function(memo, arr) {
    return memo + (arr.length || 0);
  }, 0);
};

utils.mergeArrays = function(arrays, TypedArr) {
  var size = utils.countElements(arrays),
      Arr = TypedArr || Array,
      merged = new Arr(size),
      offs = 0;
  arrays.forEach(function(src) {
    var n = src.length;
    for (var i = 0; i<n; i++) {
      merged[i + offs] = src[i];
    }
    offs += n;
  });
  return merged;
};




// Merge layers; assumes that layers belong to the same dataset and have compatible
// geometries and data fields.
api.mergeLayers = function(layers) {
  var merged;
  if (!layers.length) return null;
  internal.checkLayersCanMerge(layers);
  layers.forEach(function(lyr) {
    if (!merged) {
      merged = lyr;
    } else {
      if (merged.shapes && lyr.shapes) {
        merged.shapes = merged.shapes.concat(lyr.shapes);
      } else {
        merged.shapes = null;
      }
      if (merged.data && lyr.data) {
        merged.data = new DataTable(merged.data.getRecords().concat(lyr.data.getRecords()));
      } else {
        merged.data = null;
      }
    }
  });
  merged.name = internal.mergeLayerNames(layers);
  return [merged];
};

internal.mergeLayerNames = function(layers) {
  return layers.reduce(function(memo, lyr) {
    if (memo === null) {
      memo = lyr.name || null;
    } else if (memo && lyr.name) {
      memo = utils.mergeNames(memo, lyr.name);
    }
    return memo;
  }, null) || '';
};

internal.checkFieldTypes = function(key, layers) {
  // ignores empty-type fields
  return layers.reduce(function(memo, lyr) {
    var type = lyr.data ? internal.getColumnType(key, lyr.data) : null;
    if (type && memo.indexOf(type) == -1) {
      memo.push(type);
    }
    return memo;
  }, []);
};

internal.findMissingFields = function(layers) {
  var matrix = layers.map(function(lyr) {return lyr.data ? lyr.data.getFields() : [];});
  var allFields = matrix.reduce(function(memo, fields) {
    return utils.uniq(memo.concat(fields));
  }, []);
  return matrix.reduce(function(memo, fields) {
    var diff = utils.difference(allFields, fields);
    return utils.uniq(memo.concat(diff));
  }, []);
};

internal.checkLayersCanMerge = function(layers) {
  var geoTypes = utils.uniq(utils.pluck(layers, 'geometry_type')),
      fields = layers[0].data ? layers[0].data.getFields() : [],
      missingFields = internal.findMissingFields(layers);
  if (utils.uniq(geoTypes).length > 1) {
    stop("Incompatible geometry types:",
      geoTypes.map(function(type) {return type || '[none]';}).join(', '));
  }
  if (missingFields.length > 0) {
    stop("Field" + utils.pluralSuffix(missingFields.length), "missing from one or more layers:",
        missingFields.join(', '));
  }
  fields.forEach(function(key) {
    var types = internal.checkFieldTypes(key, layers);
    if (types.length > 1) {
      stop("Inconsistent data types in \"" + key + "\" field:", types.join(', '));
    }
  });
};




internal.exportGeoJSON = function(dataset, opts) {
  opts = opts || {};
  var extension = opts.extension || "json";
  var layerGroups;
  if (opts.file) {
    // Override default output extension if output filename is given
    extension = utils.getFileExtension(opts.file);
  }
  if (opts.combine_layers) {
    layerGroups = [dataset.layers];
  } else {
    layerGroups = dataset.layers.map(function(lyr) {
      return [lyr];
    });
  }
  return layerGroups.map(function(layers) {
    // Use common part of layer names if multiple layers are being merged
    var name = internal.mergeLayerNames(layers) || 'output';
    return {
      content: internal.exportLayersAsGeoJSON(layers, dataset, opts, 'buffer'),
      filename: name + '.' + extension
    };
  });
};

// Return an array of Features or Geometries as objects or strings
//
internal.exportLayerAsGeoJSON = function(lyr, dataset, opts, asFeatures, ofmt) {
  var properties = internal.exportProperties(lyr.data, opts),
      shapes = lyr.shapes,
      ids = internal.exportIds(lyr.data, opts),
      items, stringify;

  if (ofmt) {
    stringify = opts.prettify ?
      internal.getFormattedStringify(['bbox', 'coordinates']) :
      JSON.stringify;
  }

  if (properties && shapes && properties.length !== shapes.length) {
    error("Mismatch between number of properties and number of shapes");
  }

  return (shapes || properties || []).reduce(function(memo, o, i) {
    var shape = shapes ? shapes[i] : null,
        exporter = GeoJSON.exporters[lyr.geometry_type],
        obj = shape ? exporter(shape, dataset.arcs) : null;
    if (asFeatures) {
      obj = {
        type: 'Feature',
        geometry: obj,
        properties: properties ? properties[i] : null
      };
      if (ids) {
        obj.id = ids[i];
      }
    } else if (!obj) {
      return memo; // don't add null objects to GeometryCollection
    }
    if (ofmt) {
      // stringify features as soon as they are generated, to reduce the
      // number of JS objects in memory (so larger files can be exported)
      obj = stringify(obj);
      if (ofmt == 'buffer') {
        obj = new Buffer(obj, 'utf8');
      }
    }
    memo.push(obj);
    return memo;
  }, []);
};

// TODO: remove
internal.exportGeoJSONCollection = function(lyr, dataset, opts) {
  return internal.exportLayersAsGeoJSON([lyr], dataset, opts || {});
};

internal.exportLayersAsGeoJSON = function(layers, dataset, opts, ofmt) {
  var geojson = {};
  var useFeatures = internal.useFeatureCollection(layers, opts);
  var parts, collection, bounds, collname;

  if (useFeatures) {
    geojson.type = 'FeatureCollection';
    collname = 'features';
  } else {
    geojson.type = 'GeometryCollection';
    collname = 'geometries';
  }

  internal.exportCRS(dataset, geojson);
  if (opts.bbox) {
    bounds = internal.getDatasetBounds(dataset);
    if (bounds.hasBounds()) {
      geojson.bbox = bounds.toArray();
    }
  }

  collection = layers.reduce(function(memo, lyr, i) {
    var items = internal.exportLayerAsGeoJSON(lyr, dataset, opts, useFeatures, ofmt);
    return memo.length > 0 ? memo.concat(items) : items;
  }, []);

  if (ofmt) {
    return GeoJSON.formatGeoJSON(geojson, collection, collname, ofmt);
  } else {
    geojson[collname] = collection;
    return geojson;
  }
};

GeoJSON.formatGeoJSON = function(container, collection, collType, ofmt) {
  // collection is an array of individual GeoJSON Feature|geometry strings or buffers
  var head = JSON.stringify(container).replace(/\}$/, ', "' + collType + '": [\n');
  var tail = '\n]}';
  if (ofmt == 'buffer') {
    return GeoJSON.joinOutputBuffers(head, tail, collection);
  }
  return head + collection.join(',\n') + tail;
};

GeoJSON.joinOutputBuffers = function(head, tail, collection) {
  var comma = new Buffer(',\n', 'utf8');
  var parts = collection.reduce(function(memo, buf, i) {
    if (i > 0) memo.push(comma);
    memo.push(buf);
    return memo;
  }, [new Buffer(head, 'utf8')]);
  parts.push(new Buffer(tail, 'utf8'));
  return Buffer.concat(parts);
};

// export GeoJSON or TopoJSON point geometry
GeoJSON.exportPointGeom = function(points, arcs) {
  var geom = null;
  if (points.length == 1) {
    geom = {
      type: "Point",
      coordinates: points[0]
    };
  } else if (points.length > 1) {
    geom = {
      type: "MultiPoint",
      coordinates: points
    };
  }
  return geom;
};
GeoJSON.exportLineGeom = function(ids, arcs) {
  var obj = internal.exportPathData(ids, arcs, "polyline");
  if (obj.pointCount === 0) return null;
  var coords = obj.pathData.map(function(path) {
    return path.points;
  });
  return coords.length == 1 ? {
    type: "LineString",
    coordinates: coords[0]
  } : {
    type: "MultiLineString",
    coordinates: coords
  };
};

GeoJSON.exportPolygonGeom = function(ids, arcs) {
  var obj = internal.exportPathData(ids, arcs, "polygon");
  if (obj.pointCount === 0) return null;
  var groups = internal.groupPolygonRings(obj.pathData);
  var coords = groups.map(function(paths) {
    return paths.map(function(path) {
      return path.points;
    });
  });
  return coords.length == 1 ? {
    type: "Polygon",
    coordinates: coords[0]
  } : {
    type: "MultiPolygon",
    coordinates: coords
  };
};

GeoJSON.exporters = {
  polygon: GeoJSON.exportPolygonGeom,
  polyline: GeoJSON.exportLineGeom,
  point: GeoJSON.exportPointGeom
};

// @jsonObj is a top-level GeoJSON or TopoJSON object
// TODO: generate crs if projection is known
// TODO: handle case of non-WGS84 geodetic coordinates
internal.exportCRS = function(dataset, jsonObj) {
  var info = dataset.info || {};
  if (!info.crs && 'input_geojson_crs' in info) {
    // use input geojson crs if available and coords have not changed
    jsonObj.crs = info.input_geojson_crs;
  } else if (info.crs && !info.crs.is_latlong) {
    // Setting output crs to null if coords have been projected
    // "If the value of CRS is null, no CRS can be assumed"
    // source: http://geojson.org/geojson-spec.html#coordinate-reference-system-objects
    jsonObj.crs = null;
  } else {
    // crs property not set: assuming WGS84
  }
};

internal.useFeatureCollection = function(layers, opts) {
  return utils.some(layers, function(lyr) {
    var fields = lyr.data ? lyr.data.getFields() : [];
    var haveData = internal.useFeatureProperties(fields, opts);
    var haveId = !!internal.getIdField(fields, opts);
    return haveData || haveId;
  });
};

internal.useFeatureProperties = function(fields, opts) {
  return !(opts.drop_table || opts.cut_table || fields.length === 0 ||
      fields.length == 1 && fields[0] == GeoJSON.ID_FIELD);
};

internal.exportProperties = function(table, opts) {
  var fields = table ? table.getFields() : [],
      idField = internal.getIdField(fields, opts),
      properties, records;
  if (!internal.useFeatureProperties(fields, opts)) {
    return null;
  }
  records = table.getRecords();
  if (idField == GeoJSON.ID_FIELD) {// delete default id field, not user-set fields
    properties = records.map(function(rec) {
      rec = utils.extend({}, rec); // copy rec;
      delete rec[idField];
      return rec;
    });
  } else {
    properties = records;
  }
  return properties;
};

// @opt value of id-field option (empty, string or array of strings)
// @fields array
internal.getIdField = function(fields, opts) {
  var ids = [];
  var opt = opts.id_field;
  if (utils.isString(opt)) {
    ids.push(opt);
  } else if (utils.isArray(opt)) {
    ids = opt;
  }
  ids.push(GeoJSON.ID_FIELD); // default id field
  return utils.find(ids, function(name) {
    return utils.contains(fields, name);
  });
};

internal.exportIds = function(table, opts) {
  var fields = table ? table.getFields() : [],
      idField = internal.getIdField(fields, opts);
  if (!idField) return null;
  return table.getRecords().map(function(rec) {
    return idField in rec ? rec[idField] : null;
  });
};







var TopoJSON = {};

// Iterate over all arrays of arc is in a geometry object
// @cb callback: function(ids)
// callback returns undefined or an array of replacement ids
//
TopoJSON.forEachPath = function forEachPath(obj, cb) {
  var iterators = {
        GeometryCollection: function(o) {o.geometries.forEach(eachGeom);},
        LineString: function(o) {
          var retn = cb(o.arcs);
          if (retn) o.arcs = retn;
        },
        MultiLineString: function(o) {eachMultiPath(o.arcs);},
        Polygon: function(o) {eachMultiPath(o.arcs);},
        MultiPolygon: function(o) {o.arcs.forEach(eachMultiPath);}
      };

  eachGeom(obj);

  function eachGeom(o) {
    if (o.type in iterators) {
      iterators[o.type](o);
    }
  }

  function eachMultiPath(arr) {
    var retn;
    for (var i=0; i<arr.length; i++) {
      retn = cb(arr[i]);
      if (retn) arr[i] = retn;
    }
  }
};

TopoJSON.forEachArc = function forEachArc(obj, cb) {
  TopoJSON.forEachPath(obj, function(ids) {
    var retn;
    for (var i=0; i<ids.length; i++) {
      retn = cb(ids[i]);
      if (utils.isInteger(retn)) {
        ids[i] = retn;
      }
    }
  });
};




// Convert a TopoJSON topology into mapshaper's internal format
// Side-effect: data in topology is modified
//
internal.importTopoJSON = function(topology, opts) {
  var dataset, arcs, layers;

  if (utils.isString(topology)) {
    topology = JSON.parse(topology);
  }

  if (topology.arcs && topology.arcs.length > 0) {
    // TODO: apply transform to ArcCollection, not input arcs
    if (topology.transform) {
      TopoJSON.decodeArcs(topology.arcs, topology.transform);
    }

    if (opts && opts.precision) {
      TopoJSON.roundCoords(topology.arcs, opts.precision);
    }

    arcs = new ArcCollection(topology.arcs);
  }

  layers = Object.keys(topology.objects).reduce(function(memo, name) {
    var layers = TopoJSON.importObject(topology.objects[name], arcs, opts),
        lyr;
    for (var i=0, n=layers.length; i<n; i++) {
      lyr = layers[i];
      lyr.name = name; // TODO: consider type-suffixes if different-typed layers
      memo.push(lyr);
    }
    return memo;
  }, []);

  layers.forEach(function(lyr) {
    if (internal.layerHasPaths(lyr)) {
      internal.cleanShapes(lyr.shapes, arcs, lyr.geometry_type);
    }
    if (lyr.geometry_type == 'point' && topology.transform) {
      TopoJSON.decodePoints(lyr.shapes, topology.transform);
    }
    if (lyr.data) {
      internal.fixInconsistentFields(lyr.data.getRecords());
    }
  });

  dataset = {
    layers: layers,
    arcs: arcs,
    info: {}
  };
  internal.importCRS(dataset, topology);
  return dataset;
};

TopoJSON.decodePoints = function(shapes, transform) {
  internal.forEachPoint(shapes, function(p) {
    p[0] = p[0] * transform.scale[0] + transform.translate[0];
    p[1] = p[1] * transform.scale[1] + transform.translate[1];
  });
};

TopoJSON.decodeArcs = function(arcs, transform) {
  var mx = transform.scale[0],
      my = transform.scale[1],
      bx = transform.translate[0],
      by = transform.translate[1];

  arcs.forEach(function(arc) {
    var prevX = 0,
        prevY = 0,
        xy, x, y;
    for (var i=0, len=arc.length; i<len; i++) {
      xy = arc[i];
      x = xy[0] + prevX;
      y = xy[1] + prevY;
      xy[0] = x * mx + bx;
      xy[1] = y * my + by;
      prevX = x;
      prevY = y;
    }
  });
};

// TODO: consider removing dupes...
TopoJSON.roundCoords = function(arcs, precision) {
  var round = utils.getRoundingFunction(precision),
      p;
  arcs.forEach(function(arc) {
    for (var i=0, len=arc.length; i<len; i++) {
      p = arc[i];
      p[0] = round(p[0]);
      p[1] = round(p[1]);
    }
  });
};

TopoJSON.importObject = function(obj, arcs, opts) {
  var importer = new TopoJSON.GeometryImporter(arcs, opts);
  var geometries = obj.type == 'GeometryCollection' ? obj.geometries : [obj];
  geometries.forEach(importer.addGeometryObject, importer);
  return importer.done();
};

//
//
TopoJSON.GeometryImporter = function(arcs, opts) {
  var idField = opts && opts.id_field || GeoJSON.ID_FIELD,
      properties = [],
      shapes = [], // topological ids
      types = [],
      dataNulls = 0,
      shapeNulls = 0,
      collectionType = null,
      shapeId;

  this.addGeometryObject = function(geom) {
    var rec = geom.properties || null;
    shapeId = shapes.length;
    shapes[shapeId] = null;
    if ('id' in geom) {
      rec = rec || {};
      rec[idField] = geom.id;
    }
    properties[shapeId] = rec;
    if (!rec) dataNulls++;
    if (geom.type) {
      this.addShape(geom);
    }
    if (shapes[shapeId] === null) {
      shapeNulls++;
    }
  };

  this.addShape = function(geom) {
    var curr = shapes[shapeId];
    var type = GeoJSON.translateGeoJSONType(geom.type);
    var shape, importer;
    if (geom.type == "GeometryCollection") {
      geom.geometries.forEach(this.addShape, this);
    } else if (type) {
      this.setGeometryType(type);
      shape = TopoJSON.shapeImporters[geom.type](geom, arcs);
      // TODO: better shape validation
      if (!shape || !shape.length) {
        // do nothing
      } else if (!Array.isArray(shape[0])) {
        stop("Invalid TopoJSON", geom.type, "geometry");
      } else {
        shapes[shapeId] = curr ? curr.concat(shape) : shape;
      }
    } else if (geom.type) {
      stop("Invalid TopoJSON geometry type:", geom.type);
    }
  };

  this.setGeometryType = function(type) {
    var currType = shapeId < types.length ? types[shapeId] : null;
    if (!currType) {
      types[shapeId] = type;
      this.updateCollectionType(type);
    } else if (currType != type) {
      stop("Unable to import mixed-type TopoJSON geometries");
    }
  };

  this.updateCollectionType = function(type) {
    if (!collectionType) {
      collectionType = type;
    } else if (type && collectionType != type) {
      collectionType = 'mixed';
    }
  };

  this.done = function() {
    var layers;
    if (collectionType == 'mixed') {
      layers = internal.divideFeaturesByType(shapes, properties, types);
    } else {
      layers = [{
        geometry_type: collectionType,
        shapes : collectionType ? shapes : null,
        data: dataNulls < shapes.length ? new DataTable(properties) : null
      }];
    }
    return layers;
  };
};

// TODO: check that interior ring bboxes are contained in external ring
// TODO: check that rings are closed
TopoJSON.importPolygonArcs = function(rings, arcs) {
  var ring = rings[0],
      imported = null, area;
  if (!arcs) stop("Invalid TopoJSON file: missing arc data.");
  area = geom.getPlanarPathArea(ring, arcs);
  if (!area) {
    return null;
  }
  if (area < 0) internal.reversePath(ring);
  imported = [ring];
  for (var i=1; i<rings.length; i++) {
    ring = rings[i];
    area = geom.getPlanarPathArea(ring, arcs);
    if (!area) continue;
    if (area > 0) internal.reversePath(ring);
    imported.push(ring);
  }
  return imported;
};

TopoJSON.shapeImporters = {
  Point: function(geom) {
    return [geom.coordinates];
  },
  MultiPoint: function(geom) {
    return geom.coordinates;
  },
  LineString: function(geom) {
    return [geom.arcs];
  },
  MultiLineString: function(geom) {
    return geom.arcs;
  },
  Polygon: function(geom, arcColl) {
    return TopoJSON.importPolygonArcs(geom.arcs, arcColl);
  },
  MultiPolygon: function(geom, arcColl) {
    return geom.arcs.reduce(function(memo, arr) {
      var rings = TopoJSON.importPolygonArcs(arr, arcColl);
      if (rings) {
        memo = memo ? memo.concat(rings) : rings;
      }
      return memo;
    }, null);
  }
};




TopoJSON.getPresimplifyFunction = function(width) {
  var quanta = 10000,  // enough resolution for pixel-level detail at 1000px width and 10x zoom
      k = quanta / width;
  return function(z) {
    // could substitute a rounding function with decimal precision
    return z === Infinity ? 0 : Math.ceil(z * k);
  };
};




api.explodeFeatures = function(lyr, arcs, opts) {
  var properties = lyr.data ? lyr.data.getRecords() : null,
      explodedProperties = properties ? [] : null,
      explodedShapes = [],
      explodedLyr = utils.extend({}, lyr);

  lyr.shapes.forEach(function explodeShape(shp, shpId) {
    var exploded;
    if (!shp) {
      explodedShapes.push(null);
    } else {
      if (lyr.geometry_type == 'polygon' && shp.length > 1) {
        if (opts && opts.naive) {
          exploded = internal.explodePolygonNaive(shp, arcs);
        } else {
          exploded = internal.explodePolygon(shp, arcs);
        }
      } else {
        exploded = internal.explodeShape(shp);
      }
      utils.merge(explodedShapes, exploded);
    }
    if (explodedProperties !== null) {
      for (var i=0, n=exploded ? exploded.length : 1; i<n; i++) {
        explodedProperties.push(internal.cloneProperties(properties[shpId]));
      }
    }
  });

  explodedLyr.shapes = explodedShapes;
  if (explodedProperties !== null) {
    explodedLyr.data = new DataTable(explodedProperties);
  }
  return explodedLyr;
};

internal.explodeShape = function(shp) {
  return shp.map(function(part) {
    return [part.concat()];
  });
};

internal.explodePolygon = function(shape, arcs) {
  var paths = internal.getPathMetadata(shape, arcs, "polygon");
  var groups = internal.groupPolygonRings(paths);
  return groups.map(function(group) {
    return group.map(function(ring) {
      return ring.ids;
    });
  });
};

internal.explodePolygonNaive = function(shape, arcs) {
  var paths = internal.getPathMetadata(shape, arcs, "polygon");
  console.log("Naive");
  return paths.map(function(path) {
    if (path.area < 0) {
      internal.reversePath(path.ids);
    }
    return [path.ids];
  });
};

internal.cloneProperties = function(obj) {
  var clone = {};
  for (var key in obj) {
    clone[key] = obj[key];
  }
  return clone;
};




internal.exportTopoJSON = function(dataset, opts) {
  var extension = '.' + (opts.extension || 'json'),
      needCopy = !opts.final || internal.datasetHasPaths(dataset) && dataset.arcs.getRetainedInterval() > 0,
      stringify = JSON.stringify;

  if (opts.prettify) {
    stringify = internal.getFormattedStringify('coordinates,arcs,bbox,translate,scale'.split(','));
  }

  if (opts.singles) {
    return internal.splitDataset(dataset).map(function(dataset) {
      if (needCopy) dataset = internal.copyDatasetForExport(dataset);
      return {
        content: stringify(TopoJSON.exportTopology(dataset, opts)),
        filename: (dataset.layers[0].name || 'output') + extension
      };
    });
  } else {
    if (needCopy) {
      // TODO: redundant if precision was applied in mapshaper-export.js
      dataset = internal.copyDatasetForExport(dataset);
    }
    return [{
      filename: opts.file || utils.getOutputFileBase(dataset) + extension,
      content: stringify(TopoJSON.exportTopology(dataset, opts))
    }];
  }
};

// Convert a dataset object to a TopoJSON topology object
// Careful -- arcs must be a copy if further processing will occur.
TopoJSON.exportTopology = function(dataset, opts) {
  var topology = {type: "Topology", arcs: []},
      hasPaths = internal.datasetHasPaths(dataset),
      bounds = internal.getDatasetBounds(dataset);

  if (opts.bbox && bounds.hasBounds()) {
    topology.bbox = bounds.toArray();
  }

  if (hasPaths && opts.presimplify && !dataset.arcs.getVertexData().zz) {
    // Calculate simplification thresholds if needed
    api.simplify(dataset, opts);
  }
  // auto-detect quantization if arcs are present
  if (!opts.no_quantization && (opts.quantization || hasPaths)) {
    topology.transform = TopoJSON.transformDataset(dataset, bounds, opts);
  }
  if (hasPaths) {
    internal.dissolveArcs(dataset); // dissolve/prune arcs for more compact output
    topology.arcs = TopoJSON.exportArcs(dataset.arcs, bounds, opts);
    if (topology.transform) {
      TopoJSON.deltaEncodeArcs(topology.arcs);
    }
  }

  // export layers as TopoJSON named objects
  topology.objects = dataset.layers.reduce(function(objects, lyr, i) {
    var name = lyr.name || "layer" + (i + 1);
    objects[name] = TopoJSON.exportLayer(lyr, dataset.arcs, opts);
    return objects;
  }, {});

  // retain crs data if relevant
  internal.exportCRS(dataset, topology);
  return topology;
};

TopoJSON.transformDataset = function(dataset, bounds, opts) {
  var bounds2 = TopoJSON.calcExportBounds(bounds, dataset.arcs, opts),
      fw = bounds.getTransform(bounds2),
      inv = fw.invert();

  function transform(x, y) {
    var p = fw.transform(x, y);
    return [Math.round(p[0]), Math.round(p[1])];
  }

  if (dataset.arcs) {
    dataset.arcs.transformPoints(transform);
  }
  // support non-standard format with quantized arcs and non-quantized points
  if (!opts.no_point_quantization) {
    dataset.layers.filter(internal.layerHasPoints).forEach(function(lyr) {
      internal.transformPointsInLayer(lyr, transform);
    });
  }

  // TODO: think about handling geometrical errors introduced by quantization,
  // e.g. segment intersections and collapsed polygon rings.
  return {
    scale: [inv.mx, inv.my],
    translate: [inv.bx, inv.by]
  };
};

// Export arcs as arrays of [x, y] and possibly [z] coordinates
TopoJSON.exportArcs = function(arcs, bounds, opts) {
  var fromZ = null,
      output = [];
  if (opts.presimplify) {
    fromZ = TopoJSON.getPresimplifyFunction(bounds.width());
  }
  arcs.forEach2(function(i, n, xx, yy, zz) {
    var arc = [], p;
    for (var j=i + n; i<j; i++) {
      p = [xx[i], yy[i]];
      if (fromZ) {
        p.push(fromZ(zz[i]));
      }
      arc.push(p);
    }
    output.push(arc.length > 1 ? arc : null);
  });
  return output;
};

// Apply delta encoding in-place to an array of topojson arcs
TopoJSON.deltaEncodeArcs = function(arcs) {
  arcs.forEach(function(arr) {
    var ax, ay, bx, by, p;
    for (var i=0, n=arr.length; i<n; i++) {
      p = arr[i];
      bx = p[0];
      by = p[1];
      if (i > 0) {
        p[0] = bx - ax;
        p[1] = by - ay;
      }
      ax = bx;
      ay = by;
    }
  });
};

// Calculate the x, y extents that map to an integer unit in topojson output
// as a fraction of the x- and y- extents of the average segment.
TopoJSON.calcExportResolution = function(arcs, k) {
  // TODO: think about the effect of long lines, e.g. from polar cuts.
  var xy = internal.getAvgSegment2(arcs);
  return [xy[0] * k, xy[1] * k];
};

// Calculate the bounding box of quantized topojson coordinates using one
// of several methods.
TopoJSON.calcExportBounds = function(bounds, arcs, opts) {
  var unitXY, xmax, ymax;
  if (opts.topojson_precision > 0) {
    unitXY = TopoJSON.calcExportResolution(arcs, opts.topojson_precision);
  } else if (opts.quantization > 0) {
    unitXY = [bounds.width() / (opts.quantization-1), bounds.height() / (opts.quantization-1)];
  } else if (opts.precision > 0) {
    unitXY = [opts.precision, opts.precision];
  } else {
    // default -- auto quantization at 0.02 of avg. segment len
    unitXY = TopoJSON.calcExportResolution(arcs, 0.02);
  }
  xmax = Math.ceil(bounds.width() / unitXY[0]) || 0;
  ymax = Math.ceil(bounds.height() / unitXY[1]) || 0;
  return new Bounds(0, 0, xmax, ymax);
};

TopoJSON.exportProperties = function(geometries, table, opts) {
  var properties = internal.exportProperties(table, opts),
      ids = internal.exportIds(table, opts);
  geometries.forEach(function(geom, i) {
    if (properties) {
      geom.properties = properties[i];
    }
    if (ids) {
      geom.id = ids[i];
    }
  });
};

// Export a mapshaper layer as a GeometryCollection
TopoJSON.exportLayer = function(lyr, arcs, opts) {
  var n = internal.getFeatureCount(lyr),
      geometries = [];
  // initialize to null geometries
  for (var i=0; i<n; i++) {
    geometries[i] = {type: null};
  }
  if (internal.layerHasGeometry(lyr)) {
    TopoJSON.exportGeometries(geometries, lyr.shapes, arcs, lyr.geometry_type);
  }
  if (lyr.data) {
    TopoJSON.exportProperties(geometries, lyr.data, opts);
  }
  return {
    type: "GeometryCollection",
    geometries: geometries
  };
};

TopoJSON.exportGeometries = function(geometries, shapes, coords, type) {
  var exporter = TopoJSON.exporters[type];
  if (exporter && shapes) {
    shapes.forEach(function(shape, i) {
      if (shape && shape.length > 0) {
        geometries[i] = exporter(shape, coords);
      }
    });
  }
};

TopoJSON.exportPolygonGeom = function(shape, coords) {
  var geom = {};
  shape = internal.filterEmptyArcs(shape, coords);
  if (!shape || shape.length === 0) {
    geom.type = null;
  } else if (shape.length > 1) {
    geom.arcs = internal.explodePolygon(shape, coords);
    if (geom.arcs.length == 1) {
      geom.arcs = geom.arcs[0];
      geom.type = "Polygon";
    } else {
      geom.type = "MultiPolygon";
    }
  } else {
    geom.arcs = shape;
    geom.type = "Polygon";
  }
  return geom;
};

TopoJSON.exportLineGeom = function(shape, coords) {
  var geom = {};
  shape = internal.filterEmptyArcs(shape, coords);
  if (!shape || shape.length === 0) {
    geom.type = null;
  } else if (shape.length == 1) {
    geom.type = "LineString";
    geom.arcs = shape[0];
  } else {
    geom.type = "MultiLineString";
    geom.arcs = shape;
  }
  return geom;
};

TopoJSON.exporters = {
  polygon: TopoJSON.exportPolygonGeom,
  polyline: TopoJSON.exportLineGeom,
  point: GeoJSON.exportPointGeom
};





var ShpType = {
  NULL: 0,
  POINT: 1,
  POLYLINE: 3,
  POLYGON: 5,
  MULTIPOINT: 8,
  POINTZ: 11,
  POLYLINEZ: 13,
  POLYGONZ: 15,
  MULTIPOINTZ: 18,
  POINTM: 21,
  POLYLINEM: 23,
  POLYGONM: 25,
  MULIPOINTM: 28,
  MULTIPATCH: 31 // not supported
};

ShpType.isPolygonType = function(t) {
  return t == 5 || t == 15 || t == 25;
};

ShpType.isPolylineType = function(t) {
  return t == 3 || t == 13 || t == 23;
};

ShpType.isMultiPartType = function(t) {
  return ShpType.isPolygonType(t) || ShpType.isPolylineType(t);
};

ShpType.isMultiPointType = function(t) {
  return t == 8 || t == 18 || t == 28;
};

ShpType.isZType = function(t) {
  return utils.contains([11,13,15,18], t);
};

ShpType.isMType = function(t) {
  return ShpType.isZType(t) || utils.contains([21,23,25,28], t);
};

ShpType.hasBounds = function(t) {
  return ShpType.isMultiPartType(t) || ShpType.isMultiPointType(t);
};




internal.translateShapefileType = function(shpType) {
  if (utils.contains([ShpType.POLYGON, ShpType.POLYGONM, ShpType.POLYGONZ], shpType)) {
    return 'polygon';
  } else if (utils.contains([ShpType.POLYLINE, ShpType.POLYLINEM, ShpType.POLYLINEZ], shpType)) {
    return 'polyline';
  } else if (utils.contains([ShpType.POINT, ShpType.POINTM, ShpType.POINTZ,
      ShpType.MULTIPOINT, ShpType.MULTIPOINTM, ShpType.MULTIPOINTZ], shpType)) {
    return 'point';
  }
  return null;
};

internal.isSupportedShapefileType = function(t) {
  return utils.contains([0,1,3,5,8,11,13,15,18,21,23,25,28], t);
};

internal.getShapefileType = function(type) {
  return {
    polygon: ShpType.POLYGON,
    polyline: ShpType.POLYLINE,
    point: ShpType.MULTIPOINT  // TODO: use POINT when possible
  }[type] || ShpType.NULL;
};





var NullRecord = function() {
  return {
    isNull: true,
    pointCount: 0,
    partCount: 0,
    byteLength: 12
  };
};

// Returns a constructor function for a shape record class with
//   properties and methods for reading coordinate data.
//
// Record properties
//   type, isNull, byteLength, pointCount, partCount (all types)
//
// Record methods
//   read(), readPoints() (all types)
//   readBounds(), readCoords()  (all but single point types)
//   readPartSizes() (polygon and polyline types)
//   readZBounds(), readZ() (Z types except POINTZ)
//   readMBounds(), readM(), hasM() (M and Z types, except POINT[MZ])
//
function ShpRecordClass(type) {
  var hasBounds = ShpType.hasBounds(type),
      hasParts = ShpType.isMultiPartType(type),
      hasZ = ShpType.isZType(type),
      hasM = ShpType.isMType(type),
      singlePoint = !hasBounds,
      mzRangeBytes = singlePoint ? 0 : 16,
      constructor;

  if (type === 0) {
    return NullRecord;
  }

  // @bin is a BinArray set to the first data byte of a shape record
  constructor = function ShapeRecord(bin, bytes) {
    var pos = bin.position();
    this.id = bin.bigEndian().readUint32();
    this.type = bin.littleEndian().skipBytes(4).readUint32();
    if (this.type === 0) {
      return new NullRecord();
    }
    if (bytes > 0 !== true || (this.type != type && this.type !== 0)) {
      error("Unable to read a shape -- .shp file may be corrupted");
    }
    this.byteLength = bytes; // bin.readUint32() * 2 + 8; // bytes in content section + 8 header bytes
    if (singlePoint) {
      this.pointCount = 1;
      this.partCount = 1;
    } else {
      bin.skipBytes(32); // skip bbox
      this.partCount = hasParts ? bin.readUint32() : 1;
      this.pointCount = bin.readUint32();
    }
    this._data = function() {
      return bin.position(pos);
    };
  };

  // base prototype has methods shared by all Shapefile types except NULL type
  // (Type-specific methods are mixed in below)
  var proto = {
    // return offset of [x, y] point data in the record
    _xypos: function() {
      var offs = 12; // skip header & record type
      if (!singlePoint) offs += 4; // skip point count
      if (hasBounds) offs += 32;
      if (hasParts) offs += 4 * this.partCount + 4; // skip part count & index
      return offs;
    },

    readCoords: function() {
      if (this.pointCount === 0) return null;
      var partSizes = this.readPartSizes(),
          xy = this._data().skipBytes(this._xypos());

      return partSizes.map(function(pointCount) {
        return xy.readFloat64Array(pointCount * 2);
      });
    },

    readXY: function() {
      if (this.pointCount === 0) return new Float64Array(0);
      return this._data().skipBytes(this._xypos()).readFloat64Array(this.pointCount * 2);
    },

    readPoints: function() {
      var xy = this.readXY(),
          zz = hasZ ? this.readZ() : null,
          mm = hasM && this.hasM() ? this.readM() : null,
          points = [], p;

      for (var i=0, n=xy.length / 2; i<n; i++) {
        p = [xy[i*2], xy[i*2+1]];
        if (zz) p.push(zz[i]);
        if (mm) p.push(mm[i]);
        points.push(p);
      }
      return points;
    },

    // Return an array of point counts in each part
    // Parts containing zero points are skipped (Shapefiles with zero-point
    // parts are out-of-spec but exist in the wild).
    readPartSizes: function() {
      var sizes = [];
      var partLen, startId, bin;
      if (this.pointCount === 0) {
        // no parts
      } else if (this.partCount == 1) {
        // single-part type or multi-part type with one part
        sizes.push(this.pointCount);
      } else {
        // more than one part
        startId = 0;
        bin = this._data().skipBytes(56); // skip to second entry in part index
        for (var i=0, n=this.partCount; i<n; i++) {
          partLen = (i < n - 1 ? bin.readUint32() : this.pointCount) - startId;
          if (partLen > 0) {
            sizes.push(partLen);
            startId += partLen;
          }
        }
      }
      return sizes;
    }
  };

  var singlePointProto = {
    read: function() {
      var n = 2;
      if (hasZ) n++;
      if (this.hasM()) n++;
      return this._data().skipBytes(12).readFloat64Array(n);
    },

    stream: function(sink) {
      var src = this._data().skipBytes(12);
      sink.addPoint(src.readFloat64(), src.readFloat64());
      sink.endPath();
    }
  };

  var multiCoordProto = {
    readBounds: function() {
      return this._data().skipBytes(12).readFloat64Array(4);
    },

    stream: function(sink) {
      var sizes = this.readPartSizes(),
          xy = this.readXY(),
          i = 0, j = 0, n;
      while (i < sizes.length) {
        n = sizes[i];
        while (n-- > 0) {
          sink.addPoint(xy[j++], xy[j++]);
        }
        sink.endPath();
        i++;
      }
      if (xy.length != j) error('Counting error');
    },

    read: function() {
      var parts = [],
          sizes = this.readPartSizes(),
          points = this.readPoints();
      for (var i=0, n = sizes.length - 1; i<n; i++) {
        parts.push(points.splice(0, sizes[i]));
      }
      parts.push(points);
      return parts;
    }
  };

  var mProto = {
    _mpos: function() {
      var pos = this._xypos() + this.pointCount * 16;
      if (hasZ) {
        pos += this.pointCount * 8 + mzRangeBytes;
      }
      return pos;
    },

    readMBounds: function() {
      return this.hasM() ? this._data().skipBytes(this._mpos()).readFloat64Array(2) : null;
    },

    // TODO: group into parts, like readCoords()
    readM: function() {
      return this.hasM() ? this._data().skipBytes(this._mpos() + mzRangeBytes).readFloat64Array(this.pointCount) : null;
    },

    // Test if this record contains M data
    // (according to the Shapefile spec, M data is optional in a record)
    //
    hasM: function() {
      var bytesWithoutM = this._mpos(),
          bytesWithM = bytesWithoutM + this.pointCount * 8 + mzRangeBytes;
      if (this.byteLength == bytesWithoutM) {
        return false;
      } else if (this.byteLength == bytesWithM) {
        return true;
      } else {
        error("#hasM() Counting error");
      }
    }
  };

  var zProto = {
    _zpos: function() {
      return this._xypos() + this.pointCount * 16;
    },

    readZBounds: function() {
      return this._data().skipBytes(this._zpos()).readFloat64Array(2);
    },

    // TODO: group into parts, like readCoords()
    readZ: function() {
      return this._data().skipBytes(this._zpos() + mzRangeBytes).readFloat64Array(this.pointCount);
    }
  };

  if (singlePoint) {
    utils.extend(proto, singlePointProto);
  } else {
    utils.extend(proto, multiCoordProto);
  }
  if (hasZ) utils.extend(proto, zProto);
  if (hasM) utils.extend(proto, mProto);

  constructor.prototype = proto;
  proto.constructor = constructor;
  return constructor;
}




// Read data from a .shp file
// @src is an ArrayBuffer, Node.js Buffer or filename
//
//    // Example: iterating using #nextShape()
//    var reader = new ShpReader(buf), s;
//    while (s = reader.nextShape()) {
//      // process the raw coordinate data yourself...
//      var coords = s.readCoords(); // [[x,y,x,y,...], ...] Array of parts
//      var zdata = s.readZ();  // [z,z,...]
//      var mdata = s.readM();  // [m,m,...] or null
//      // .. or read the shape into nested arrays
//      var data = s.read();
//    }
//
//    // Example: reading records using a callback
//    var reader = new ShpReader(buf);
//    reader.forEachShape(function(s) {
//      var data = s.read();
//    });
//
function ShpReader(src) {
  if (this instanceof ShpReader === false) {
    return new ShpReader(src);
  }

  var file = utils.isString(src) ? new FileReader(src) : new BufferReader(src);
  var header = parseHeader(file.readToBinArray(0, 100));
  var fileSize = file.size();
  var RecordClass = new ShpRecordClass(header.type);
  var recordOffs, i, skippedBytes;

  reset();

  this.header = function() {
    return header;
  };

  // Callback interface: for each record in a .shp file, pass a
  //   record object to a callback function
  //
  this.forEachShape = function(callback) {
    var shape = this.nextShape();
    while (shape) {
      callback(shape);
      shape = this.nextShape();
    }
  };

  // Iterator interface for reading shape records
  this.nextShape = function() {
    var shape = readShapeAtOffset(recordOffs, i),
        offs2, skipped;
    if (!shape && recordOffs + 12 <= fileSize) {
      // Very rarely, in-the-wild .shp files may contain junk bytes between
      // records; it may be possible to scan past the junk to find the next record.
      shape = huntForNextShape(recordOffs + 4, i);
    }
    if (shape) {
      recordOffs += shape.byteLength;
      if (shape.id < i) {
        // Encountered in ne_10m_railroads.shp from natural earth v2.0.0
        message("Shapefile record " + shape.id + " appears more than once -- possible file corruption.");
        return this.nextShape();
      }
      i++;
    } else {
      if (skippedBytes > 0) {
        // Encountered in ne_10m_railroads.shp from natural earth v2.0.0
        message("Skipped " + skippedBytes + " bytes in .shp file -- possible data loss.");
      }
      file.close();
      reset();
    }
    return shape;
  };

  function reset() {
    recordOffs = 100;
    skippedBytes = 0;
    i = 1; // Shapefile id of first record
  }

  function parseHeader(bin) {
    var header = {
      signature: bin.bigEndian().readUint32(),
      byteLength: bin.skipBytes(20).readUint32() * 2,
      version: bin.littleEndian().readUint32(),
      type: bin.readUint32(),
      bounds: bin.readFloat64Array(4), // xmin, ymin, xmax, ymax
      zbounds: bin.readFloat64Array(2),
      mbounds: bin.readFloat64Array(2)
    };

    if (header.signature != 9994) {
      error("Not a valid .shp file");
    }

    if (!internal.isSupportedShapefileType(header.type)) {
      error("Unsupported .shp type:", header.type);
    }

    if (header.byteLength != file.size()) {
      error("File size of .shp doesn't match size in header");
    }

    return header;
  }

  function readShapeAtOffset(recordOffs, i) {
    var shape = null,
        recordSize, recordType, recordId, goodId, goodSize, goodType, bin;

    if (recordOffs + 12 <= fileSize) {
      bin = file.readToBinArray(recordOffs, 12);
      recordId = bin.bigEndian().readUint32();
      // record size is bytes in content section + 8 header bytes
      recordSize = bin.readUint32() * 2 + 8;
      recordType = bin.littleEndian().readUint32();
      goodId = recordId == i; // not checking id ...
      goodSize = recordOffs + recordSize <= fileSize && recordSize >= 12;
      goodType = recordType === 0 || recordType == header.type;
      if (goodSize && goodType) {
        bin = file.readToBinArray(recordOffs, recordSize);
        shape = new RecordClass(bin, recordSize);
      }
    }
    return shape;
  }

  // TODO: add tests
  // Try to scan past unreadable content to find next record
  function huntForNextShape(start, id) {
    var offset = start,
        shape = null,
        bin, recordId, recordType;
    while (offset + 12 <= fileSize) {
      bin = file.readToBinArray(offset, 12);
      recordId = bin.bigEndian().readUint32();
      recordType = bin.littleEndian().skipBytes(4).readUint32();
      if (recordId == id && (recordType == header.type || recordType === 0)) {
        // we have a likely position, but may still be unparsable
        shape = readShapeAtOffset(offset, id);
        break;
      }
      offset += 4; // try next integer position
    }
    skippedBytes += shape ? offset - start : fileSize - start;
    return shape;
  }
}

ShpReader.prototype.type = function() {
  return this.header().type;
};

ShpReader.prototype.getCounts = function() {
  var counts = {
    nullCount: 0,
    partCount: 0,
    shapeCount: 0,
    pointCount: 0
  };
  this.forEachShape(function(shp) {
    if (shp.isNull) counts.nullCount++;
    counts.pointCount += shp.pointCount;
    counts.partCount += shp.partCount;
    counts.shapeCount++;
  });
  return counts;
};




// Read Shapefile data from a file, ArrayBuffer or Buffer
// @src filename or buffer
internal.importShp = function(src, opts) {
  var reader = new ShpReader(src),
      shpType = reader.type(),
      type = internal.translateShapefileType(shpType),
      importOpts = utils.defaults({
        type: type,
        reserved_points: Math.round(reader.header().byteLength / 16)
      }, opts),
      importer = new PathImporter(importOpts);

  if (!internal.isSupportedShapefileType(shpType)) {
    stop("Unsupported Shapefile type:", shpType);
  }
  if (ShpType.isZType(shpType)) {
    message("Warning: Shapefile Z data will be lost.");
  } else if (ShpType.isMType(shpType)) {
    message("Warning: Shapefile M data will be lost.");
  }

  // TODO: test cases: null shape; non-null shape with no valid parts
  reader.forEachShape(function(shp) {
    importer.startShape();
    if (shp.isNull) {
      // skip
    } else if (type == 'point') {
      importer.importPoints(shp.readPoints());
    } else {
      shp.stream(importer);
    }
  });

  return importer.done();
};



// A matrix class that supports affine transformations (scaling, translation, rotation).
// Elements:
//   a  c  tx
//   b  d  ty
//   0  0  1  (u v w are not used)
//
function Matrix2D() {
  this.a = 1;
  this.c = 0;
  this.tx = 0;
  this.b = 0;
  this.d = 1;
  this.ty = 0;
}

Matrix2D.prototype.transformXY = function(x, y, p) {
  p = p || {};
  p.x = x * this.a + y * this.c + this.tx;
  p.y = x * this.b + y * this.d + this.ty;
  return p;
};

Matrix2D.prototype.translate = function(dx, dy) {
  this.tx += dx;
  this.ty += dy;
};

Matrix2D.prototype.rotate = function(q, x, y) {
  var cos = Math.cos(q);
  var sin = Math.sin(q);
  x = x || 0;
  y = y || 0;
  this.a = cos;
  this.c = -sin;
  this.b = sin;
  this.d = cos;
  this.tx += x - x * cos + y * sin;
  this.ty += y - x * sin - y * cos;
};

Matrix2D.prototype.scale = function(sx, sy) {
  this.a *= sx;
  this.c *= sx;
  this.b *= sy;
  this.d *= sy;
};




// A compound projection, consisting of a default projection and one or more rectangular frames
// that are reprojected and/or affine transformed.
// @proj Default projection.
function MixedProjection(proj) {
  var frames = [];
  var mixed = utils.extend({}, proj);
  var mproj = require('mproj');

  // @proj2 projection to use.
  // @ctr1 {lam, phi} center of the frame contents.
  // @ctr2 {lam, phi} geo location to move the frame center
  // @frameWidth Width of the frame in base projection units
  // @frameHeight Height of the frame in base projection units
  // @scale Scale factor; 1 = no scaling.
  // @rotation Rotation in degrees; 0 = no rotation.
  mixed.addFrame = function(proj2, ctr1, ctr2, frameWidth, frameHeight, scale, rotation) {
    var m = new Matrix2D(),
        a2 = proj.a * 2,
        xy1 = toRawXY(ctr1, proj),
        xy2 = toRawXY(ctr2, proj),
        bbox = [xy1.x - frameWidth / a2, xy1.y - frameHeight / a2,
            xy1.x + frameWidth / a2, xy1.y + frameHeight / a2];
    m.rotate(rotation * Math.PI / 180.0, xy1.x, xy1.y);
    m.scale(scale, scale);
    m.transformXY(xy1.x, xy1.y, xy1);
    m.translate(xy2.x - xy1.x, xy2.y - xy1.y);
    frames.push({
      bbox: bbox,
      matrix: m,
      projection: proj2
    });
    return this;
  };

  // convert a latlon position to x,y in earth radii relative to datum origin
  function toRawXY(lp, P) {
    var xy = mproj.pj_fwd_deg(lp, P);
    return {
      x: (xy.x / P.fr_meter - P.x0) / P.a,
      y: (xy.y / P.fr_meter - P.y0) / P.a
    };
  }

  mixed.fwd = function(lp, xy) {
    var lam = lp.lam,
        phi = lp.phi,
        frame, bbox;
    proj.fwd(lp, xy);
    for (var i=0, n=frames.length; i<n; i++) {
      frame = frames[i];
      bbox = frame.bbox;
      if (xy.x >= bbox[0] && xy.x <= bbox[2] && xy.y >= bbox[1] && xy.y <= bbox[3]) {
        // copy lp (some proj functions may modify it)
        frame.projection.fwd({lam: lam, phi: phi}, xy);
        frame.matrix.transformXY(xy.x, xy.y, xy);
        break;
      }
    }
  };

  return mixed;
}




// some aliases
internal.projectionIndex = {
  robinson: '+proj=robin +datum=WGS84',
  webmercator: '+proj=merc +a=6378137 +b=6378137',
  wgs84: '+proj=longlat +datum=WGS84',
  albersusa: AlbersNYT
};

internal.getProjInfo = function(dataset) {
  var P, info;
  try {
    P = internal.getDatasetProjection(dataset);
    if (P) {
      info = internal.crsToProj4(P);
    }
  } catch(e) {}
  return info || "[unknown]";
};

internal.crsToProj4 = function(P) {
  return require('mproj').internal.get_proj_defn(P);
};

internal.crsToPrj = function(P) {
  var wkt;
  try {
    wkt = require('mproj').internal.wkt_from_proj4(P);
  } catch(e) {

  }
  return wkt;
};

internal.crsAreEqual = function(a, b) {
  var str = internal.crsToProj4(a);
  return !!str && str == internal.crsToProj4(b);
};

internal.getProjDefn = function(str) {
  var mproj = require('mproj');
  var defn;
  if (str in internal.projectionIndex) {
    defn = internal.projectionIndex[str];
  } else if (str in mproj.internal.pj_list) {
    defn = '+proj=' + str;
  } else if (/^\+/.test(str)) {
    defn = str;
  } else {
    stop("Unknown projection definition:", str);
  }
  return defn;
};

internal.getProjection = function(str) {
  var defn = internal.getProjDefn(str);
  var P;
  if (typeof defn == 'function') {
    P = defn();
  } else {
    try {
      P = require('mproj').pj_init(defn);
    } catch(e) {
      stop('Unable to use projection', defn, '(' + e.message + ')');
    }
  }
  return P || null;
};

internal.setDatasetProjection = function(dataset, info) {
  dataset.info = dataset.info || {};
  dataset.info.crs = info.crs;
  dataset.info.prj = info.prj;
};

internal.getDatasetProjection = function(dataset) {
  var info = dataset.info || {},
      P = info.crs;
  if (!P && info.prj) {
    P = internal.parsePrj(info.prj);
  }
  if (!P && internal.probablyDecimalDegreeBounds(internal.getDatasetBounds(dataset))) {
    // use wgs84 for probable latlong datasets with unknown datums
    P = internal.getProjection('wgs84');
  }
  return P;
};

internal.printProjections = function() {
  var index = require('mproj').internal.pj_list;
  var msg = 'Proj4 projections\n';
  Object.keys(index).sort().forEach(function(id) {
    msg += '  ' + utils.rpad(id, 7, ' ') + '  ' + index[id].name + '\n';
  });
  msg += '\nAliases';
  Object.keys(internal.projectionIndex).sort().forEach(function(n) {
    msg += '\n  ' + n;
  });
  message(msg);
};

internal.translatePrj = function(str) {
  var proj4;
  try {
    proj4 = require('mproj').internal.wkt_to_proj4(str);
  } catch(e) {
    stop('Unusable .prj file (' + e.message + ')');
  }
  return proj4;
};

// Convert contents of a .prj file to a projection object
internal.parsePrj = function(str) {
  return internal.getProjection(internal.translatePrj(str));
};

function AlbersNYT() {
  var mproj = require('mproj');
  var lcc = mproj.pj_init('+proj=lcc +lon_0=-96 +lat_0=39 +lat_1=33 +lat_2=45');
  var aea = mproj.pj_init('+proj=aea +lon_0=-96 +lat_0=37.5 +lat_1=29.5 +lat_2=45.5');
  var mixed = new MixedProjection(aea)
    .addFrame(lcc, {lam: -152, phi: 63}, {lam: -115, phi: 27}, 6e6, 3e6, 0.31, 29.2) // AK
    .addFrame(lcc, {lam: -157, phi: 20.9}, {lam: -106.6, phi: 28.2}, 3e6, 5e6, 0.9, 40); // HI
  return mixed;
}




// Convert a dataset to Shapefile files
internal.exportShapefile = function(dataset, opts) {
  return dataset.layers.reduce(function(files, lyr) {
    var prj = internal.exportPrjFile(lyr, dataset);
    files = files.concat(internal.exportShpAndShxFiles(lyr, dataset, opts));
    files = files.concat(internal.exportDbfFile(lyr, dataset, opts));
    if (prj) files.push(prj);
    return files;
  }, []);
};

internal.exportPrjFile = function(lyr, dataset) {
  var info = dataset.info || {};
  var prj = info.prj;
  if (!prj) {
    try {
      prj = internal.crsToPrj(internal.getDatasetProjection(dataset));
    } catch(e) {}
  }
  if (!prj) {
    message("Unable to generate .prj file for", lyr.name + '.shp');
  }
  return prj ? {
    content: prj,
    filename: lyr.name + '.prj'
  } : null;
};

internal.exportShpAndShxFiles = function(layer, dataset, opts) {
  var geomType = layer.geometry_type;
  var shpType = internal.getShapefileType(geomType);
  var fileBytes = 100;
  var bounds = new Bounds();
  var shapes = layer.shapes || utils.initializeArray(new Array(internal.getFeatureCount(layer)), null);
  var shapeBuffers = shapes.map(function(shape, i) {
    var pathData = internal.exportPathData(shape, dataset.arcs, geomType);
    var rec = internal.exportShpRecord(pathData, i+1, shpType);
    fileBytes += rec.buffer.byteLength;
    if (rec.bounds) bounds.mergeBounds(rec.bounds);
    return rec.buffer;
  });

  // write .shp header section
  var shpBin = new BinArray(fileBytes, false)
    .writeInt32(9994)
    .skipBytes(5 * 4)
    .writeInt32(fileBytes / 2)
    .littleEndian()
    .writeInt32(1000)
    .writeInt32(shpType);

  if (bounds.hasBounds()) {
    shpBin.writeFloat64(bounds.xmin || 0) // using 0s as empty value
      .writeFloat64(bounds.ymin || 0)
      .writeFloat64(bounds.xmax || 0)
      .writeFloat64(bounds.ymax || 0);
  } else {
    // no bounds -- assume no shapes or all null shapes -- using 0s as bbox
    shpBin.skipBytes(4 * 8);
  }

  shpBin.skipBytes(4 * 8); // skip Z & M type bounding boxes;

  // write .shx header
  var shxBytes = 100 + shapeBuffers.length * 8;
  var shxBin = new BinArray(shxBytes, false)
    .writeBuffer(shpBin.buffer(), 100) // copy .shp header to .shx
    .position(24)
    .bigEndian()
    .writeInt32(shxBytes/2)
    .position(100);

  // write record sections of .shp and .shx
  shapeBuffers.forEach(function(buf, i) {
    var shpOff = shpBin.position() / 2,
        shpSize = (buf.byteLength - 8) / 2; // alternative: shxBin.writeBuffer(buf, 4, 4);
    shxBin.writeInt32(shpOff);
    shxBin.writeInt32(shpSize);
    shpBin.writeBuffer(buf);
  });

  return [{
      content: shpBin.buffer(),
      filename: layer.name + ".shp"
    }, {
      content: shxBin.buffer(),
      filename: layer.name + ".shx"
    }];
};

// Returns an ArrayBuffer containing a Shapefile record for one shape
//   and the bounding box of the shape.
// TODO: remove collapsed rings, convert to null shape if necessary
//
internal.exportShpRecord = function(data, id, shpType) {
  var bounds = null,
      bin = null;
  if (data.pointCount > 0) {
    var multiPart = ShpType.isMultiPartType(shpType),
        partIndexIdx = 52,
        pointsIdx = multiPart ? partIndexIdx + 4 * data.pathCount : 48,
        recordBytes = pointsIdx + 16 * data.pointCount,
        pointCount = 0;

    bounds = data.bounds;
    bin = new BinArray(recordBytes, false)
      .writeInt32(id)
      .writeInt32((recordBytes - 8) / 2)
      .littleEndian()
      .writeInt32(shpType)
      .writeFloat64(bounds.xmin)
      .writeFloat64(bounds.ymin)
      .writeFloat64(bounds.xmax)
      .writeFloat64(bounds.ymax);

    if (multiPart) {
      bin.writeInt32(data.pathCount);
    } else {
      if (data.pathData.length > 1) {
        error("[exportShpRecord()] Tried to export multiple paths as type:", shpType);
      }
    }

    bin.writeInt32(data.pointCount);

    data.pathData.forEach(function(path, i) {
      if (multiPart) {
        bin.position(partIndexIdx + i * 4).writeInt32(pointCount);
      }
      bin.position(pointsIdx + pointCount * 16);

      var points = path.points;
      for (var j=0, len=points.length; j<len; j++) {
        bin.writeFloat64(points[j][0]);
        bin.writeFloat64(points[j][1]);
      }
      pointCount += j;
    });
    if (data.pointCount != pointCount)
      error("Shp record point count mismatch; pointCount:",
          pointCount, "data.pointCount:", data.pointCount);

  } else {
    // no data -- export null record
    bin = new BinArray(12, false)
      .writeInt32(id)
      .writeInt32(2)
      .littleEndian()
      .writeInt32(0);
  }

  return {bounds: bounds, buffer: bin.buffer()};
};




internal.importDbfTable = function(buf, o) {
  var opts = o || {};
  return new ShapefileTable(buf, opts.encoding);
};

// Implements the DataTable api for DBF file data.
// We avoid touching the raw DBF field data if possible. This way, we don't need
// to parse the DBF at all in common cases, like importing a Shapefile, editing
// just the shapes and exporting in Shapefile format.
// TODO: consider accepting just the filename, so buffer doesn't consume memory needlessly.
//
function ShapefileTable(buf, encoding) {
  var reader = new DbfReader(buf, encoding),
      altered = false,
      table;

  function getTable() {
    if (!table) {
      // export DBF records on first table access
      table = new DataTable(reader.readRows());
      reader = null;
      buf = null; // null out references to DBF data for g.c.
    }
    return table;
  }

  this.exportAsDbf = function(encoding) {
    // export original dbf bytes if records haven't been touched.
    return reader && !altered ? reader.getBuffer() : getTable().exportAsDbf(encoding);
  };

  this.getRecordAt = function(i) {
    return reader ? reader.readRow(i) : table.getRecordAt(i);
  };

  this.deleteField = function(f) {
    if (table) {
      table.deleteField(f);
    } else {
      altered = true;
      reader.deleteField(f);
    }
  };

  this.getRecords = function() {
    return getTable().getRecords();
  };

  this.getFields = function() {
    return reader ? reader.getFields() : table.getFields();
  };

  this.size = function() {
    return reader ? reader.size() : table.size();
  };
}

utils.extend(ShapefileTable.prototype, dataTableProto);




internal.exportDbf = function(dataset, opts) {
  return dataset.layers.reduce(function(files, lyr) {
    if (lyr.data) {
      files = files.concat(internal.exportDbfFile(lyr, dataset, opts));
    }
    return files;
  }, []);
};

internal.exportDbfFile = function(lyr, dataset, opts) {
  var data = lyr.data,
      buf;
  // create empty data table if missing a table or table is being cut out
  if (!data || opts.cut_table || opts.drop_table) {
    data = new DataTable(lyr.shapes ? lyr.shapes.length : 0);
  }
  // dbfs should have at least one column; add id field if none
  if (data.getFields().length === 0) {
    data.addIdField();
  }
  buf = data.exportAsDbf(opts.encoding || 'utf8');
  if (utils.isInteger(opts.ldid)) {
    new Uint8Array(buf)[29] = opts.ldid; // set language driver id
  }
  // TODO: also export .cpg page
  return [{
    content: buf,
    filename: lyr.name + '.dbf'
  }];
};







// Converts geometry in-place
GeoJSON.convertPointFeatureToSquare = function(feature, radiusField, fixedRadius) {
  var geom = feature.geometry;
  var side = (radiusField in feature.properties ? feature.properties[radiusField] : fixedRadius) * 2;
  if (side > 0 === false) {
    feature.geometry = null;
  } else if (geom.type == 'Point') {
    feature.geometry = {
      type: 'Polygon',
      coordinates: GeoJSON.convertPointCoordsToSquareCoords(geom.coordinates, side)
    };
  } else if (geom.type == 'MultiPoint') {
    feature.geometry = {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map(function(p) {
        return GeoJSON.convertPointCoordsToSquareCoords(p, side);
      })
    };
  }
};

GeoJSON.convertPointCoordsToSquareCoords = function(p, side) {
  var offs = side / 2,
      l = p[0] - offs,
      r = p[0] + offs,
      t = p[1] + offs,
      b = p[1] - offs;
  return [[[l, t], [r, t], [r, b], [l, b], [l, t]]];
};




api.svgStyle = function(lyr, dataset, opts) {
  var keys = Object.keys(opts),
      svgFields = internal.getStyleFields(keys, internal.svgStyles, internal.invalidSvgTypes[lyr.geometry_type]);

  svgFields.forEach(function(f) {
    var val = opts[f];
    var literal = null;
    var records, func;
    var type = internal.svgStyleTypes[f];
    if (!lyr.data) {
      internal.initDataTable(lyr);
    }
    if (type == 'number' && internal.isSvgNumber(val)) {
      literal = Number(val);
    } else if (type == 'color' && internal.isSvgColor(val, lyr.data.getFields())) {
      literal = val;
    } else if (type == 'classname' && internal.isSvgClassName(val, lyr.data.getFields())) {
      literal = val;
    }
    if (literal === null) {
      func = internal.compileValueExpression(val, lyr, dataset.arcs, {context: internal.defs});
    }
    records = lyr.data.getRecords();
    records.forEach(function(rec, i) {
      rec[f] = func ? func(i) : literal;
    });
  });
};

internal.isSvgClassName = function(str, fields) {
  str = str.trim();
  return (!fields || fields.indexOf(str) == -1) && /^( ?[_a-z][-_a-z0-9]*\b)+$/i.test(str);
};

internal.isSvgNumber = function(o) {
  return utils.isFiniteNumber(o) || utils.isString(o) && /^-?[.0-9]+$/.test(o);
};

internal.isSvgColor = function(str, fields) {
  str = str.trim();
  return (!fields || fields.indexOf(str) == -1) && /^[a-z]+$/i.test(str) ||
    /^#[0-9a-f]+$/i.test(str) || /^rgba?\([0-9,. ]+\)$/.test(str);
};

internal.getStyleFields = function(fields, index, blacklist) {
  return fields.reduce(function(memo, f) {
    if (f in index) {
      if (!blacklist || blacklist.indexOf(f) == -1) {
        memo.push(f);
      }
    }
    return memo;
  }, []);
};

internal.getSvgStyleFields = function(lyr) {
  var fields = lyr.data ? lyr.data.getFields() : [];
  return internal.getStyleFields(fields, internal.svgStyles, internal.invalidSvgTypes[lyr.geometry_type]);
};

// check if layer should be displayed with styles
internal.layerHasSvgDisplayStyle = function(lyr) {
  var fields = internal.getSvgStyleFields(lyr);
  if (lyr.geometry_type == 'point') {
    return fields.indexOf('r') > -1; // require 'r' field for point symbols
  }
  return utils.difference(fields, ['opacity', 'class']).length > 0;
};

internal.invalidSvgTypes = {
  polygon: ['r'],
  polyline: ['r', 'fill']
};

internal.svgStyles = {
  'class': 'class',
  opacity: 'opacity',
  r: 'radius',
  fill: 'fillColor',
  stroke: 'strokeColor',
  stroke_width: 'strokeWidth'
};

internal.svgStyleTypes = {
  class: 'classname',
  opacity: 'number',
  r: 'number',
  fill: 'color',
  stroke: 'color',
  stroke_width: 'number'
};




var SVG = {};

SVG.importGeoJSONFeatures = function(features) {
  return features.map(function(obj, i) {
    var geom = obj.type == 'Feature' ? obj.geometry : obj; // could be null
    var geomType = geom && geom.type;
    var svgObj = null;
    if (geomType && geom.coordinates) {
      svgObj = SVG.geojsonImporters[geomType](geom.coordinates);
    }
    if (!svgObj) {
      return {tag: 'g'}; // empty element
    }
    // TODO: fix error caused by null svgObj (caused by e.g. MultiPolygon with [] coordinates)
    if (obj.properties) {
      SVG.applyStyleAttributes(svgObj, geomType, obj.properties);
    }
    if ('id' in obj) {
      if (!svgObj.properties) {
        svgObj.properties = {};
      }
      svgObj.properties.id = obj.id;
    }
    return svgObj;
  });
};

SVG.stringify = function(obj) {
  var svg = '<' + obj.tag;
  if (obj.properties) {
    svg += SVG.stringifyProperties(obj.properties);
  }
  if (obj.children) {
    svg += '>\n';
    svg += obj.children.map(SVG.stringify).join('\n');
    svg += '\n</' + obj.tag + '>';
  } else {
    svg += '/>';
  }
  return svg;
};

SVG.stringEscape = (function() {
  // See http://commons.oreilly.com/wiki/index.php/SVG_Essentials/The_XML_You_Need_for_SVG
  var rxp = /[&<>"']/g,
      map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
      };
  return function(s) {
    return String(s).replace(rxp, function(s) {
      return map[s];
    });
  };
}());

SVG.stringifyProperties = function(o) {
  return Object.keys(o).reduce(function(memo, key, i) {
    var val = o[key],
        strval = utils.isString(val) ? val : JSON.stringify(val);
    return memo + ' ' + key + '="' + SVG.stringEscape(strval) + '"';
  }, '');
};


SVG.applyStyleAttributes = function(svgObj, geomType, rec) {
  var properties = svgObj.properties;
  var invalidStyles = internal.invalidSvgTypes[GeoJSON.translateGeoJSONType(geomType)];
  var fields = internal.getStyleFields(Object.keys(rec), internal.svgStyles, invalidStyles);
  var k;
  for (var i=0, n=fields.length; i<n; i++) {
    k = fields[i];
    SVG.setAttribute(svgObj, k.replace('_', '-'), rec[k]);
  }
};

SVG.setAttribute = function(obj, k, v) {
  var children, child;
  if ((k == 'r' || k == 'class') && obj.children) {
    // 'r' is a geometry attribute and can't be applied to a 'g' container
    // 'class' may refer to a CSS class with a value for 'r'
    children = obj.children;
    for (var i=0; i<children.length; i++) {
      child = children[i];
      if (!child.properties) child.properties = {};
      child.properties[k] = v;
    }
  } else {
    if (!obj.properties) obj.properties = {};
    obj.properties[k] = v;
  }
};

SVG.importMultiGeometry = function(coords, importer) {
  var children = [];
  for (var i=0; i<coords.length; i++) {
    children.push(importer(coords[i]));
  }
  return children.length > 0 ? {tag: 'g', children: children} : null;
};

SVG.importMultiPath = function(coords, importer) {
  var o;
  for (var i=0; i<coords.length; i++) {
    if (i === 0) {
      o = importer(coords[i]);
    } else {
      o.properties.d += ' ' + importer(coords[i]).properties.d;
    }
  }
  return o;
};

SVG.mapVertex = function(p) {
  return p[0] + ' ' + -p[1];
};

SVG.importLineString = function(coords) {
  var d = 'M ' + coords.map(SVG.mapVertex).join(' ');
  return {
    tag: 'path',
    properties: {d: d}
  };
};

SVG.importPoint = function(p) {
  return {
    tag: 'circle',
    properties: {
      cx: p[0],
      cy: -p[1]
    }
  };
};

SVG.importPolygon = function(coords) {
  var d, o;
  for (var i=0; i<coords.length; i++) {
    d = o ? o.properties.d + ' ' : '';
    o = SVG.importLineString(coords[i]);
    o.properties.d = d + o.properties.d + ' Z';
  }
  return o;
};

SVG.geojsonImporters = {
  Point: SVG.importPoint,
  Polygon: SVG.importPolygon,
  LineString: SVG.importLineString,
  MultiPoint: function(coords) {
    return SVG.importMultiGeometry(coords, SVG.importPoint);
  },
  MultiLineString: function(coords) {
    return SVG.importMultiPath(coords, SVG.importLineString);
  },
  MultiPolygon: function(coords) {
    return SVG.importMultiPath(coords, SVG.importPolygon);
  }
};




//
//
internal.exportSVG = function(dataset, opts) {
  var template = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" ' +
    'version="1.2" baseProfile="tiny" width="%d" height="%d" viewBox="%s %s %s %s" stroke-linecap="round" stroke-linejoin="round">\n%s\n</svg>';
  var b, svg;

  // TODO: consider moving this logic to mapshaper-export.js
  if (opts.final) {
    if (dataset.arcs) dataset.arcs.flatten();
  } else {
    dataset = internal.copyDataset(dataset); // Modify a copy of the dataset
  }

  b = internal.transformCoordsForSVG(dataset, opts);
  svg = dataset.layers.map(function(lyr) {
    return internal.exportLayerAsSVG(lyr, dataset, opts);
  }).join('\n');
  svg = utils.format(template, b.width(), b.height(), 0, 0, b.width(), b.height(), svg);
  return [{
    content: svg,
    filename: opts.file || utils.getOutputFileBase(dataset) + '.svg'
  }];
};

internal.transformCoordsForSVG = function(dataset, opts) {
  var width = opts.width > 0 ? opts.width : 800;
  var margin = opts.margin >= 0 ? opts.margin : 1;
  var bounds = internal.getDatasetBounds(dataset);
  var precision = opts.precision || 0.0001;
  var height, bounds2, fwd;

  if (opts.svg_scale > 0) {
    // alternative to using a fixed width (e.g. when generating multiple files
    // at a consistent geographic scale)
    width = bounds.width() / opts.svg_scale;
    margin = 0;
  }
  internal.padViewportBoundsForSVG(bounds, width, margin);
  height = Math.ceil(width * bounds.height() / bounds.width());
  bounds2 = new Bounds(0, -height, width, 0);
  fwd = bounds.getTransform(bounds2);
  internal.transformPoints(dataset, function(x, y) {
    return fwd.transform(x, y);
  });

  internal.setCoordinatePrecision(dataset, precision);
  return bounds2;
};

// pad bounds to accomodate stroke width and circle radius
internal.padViewportBoundsForSVG = function(bounds, width, marginPx) {
  var bw = bounds.width() || bounds.height() || 1; // handle 0 width bbox
  var marg;
  if (marginPx >= 0 === false) {
    marginPx = 1;
  }
  marg = bw / (width - marginPx * 2) * marginPx;
  bounds.padBounds(marg, marg, marg, marg);
};

internal.exportGeoJSONForSVG = function(lyr, dataset, opts) {
  var geojson = internal.exportGeoJSONCollection(lyr, dataset, opts);
  if (opts.point_symbol == 'square' && geojson.features) {
    geojson.features.forEach(function(feat) {
      GeoJSON.convertPointFeatureToSquare(feat, 'r', 2);
    });
  }
  return geojson;
};

internal.exportLayerAsSVG = function(lyr, dataset, opts) {
  // TODO: convert geojson features one at a time
  var geojson = internal.exportGeoJSONForSVG(lyr, dataset, opts);
  var features = geojson.features || geojson.geometries || (geojson.type ? [geojson] : []);
  var symbols = SVG.importGeoJSONFeatures(features);
  var layerObj = {
    tag: 'g',
    children: symbols,
    properties: {id: lyr.name}
  };

  // add default display properties to line layers
  // (these are overridden by feature-level styles set via -svg-style)
  if (lyr.geometry_type == 'polyline') {
    layerObj.properties.fill = 'none';
    layerObj.properties.stroke = 'black';
    layerObj.properties['stroke-width'] = 1;
  }

  return SVG.stringify(layerObj);
};




// Generate output content from a dataset object
internal.exportDelim = function(dataset, opts) {
  var delim = internal.getExportDelimiter(dataset.info, opts),
      ext = internal.getDelimFileExtension(delim, opts);
  return dataset.layers.reduce(function(arr, lyr) {
    if (lyr.data){
      arr.push({
        // TODO: consider supporting encoding= option
        content: internal.exportDelimTable(lyr, delim),
        filename: (lyr.name || 'output') + '.' + ext
      });
    }
    return arr;
  }, []);
};

/* default d3 formatting doesn't serialize objects
internal.exportDelimTable = function(lyr, delim) {
  var dsv = require("d3-dsv").dsvFormat(delim);
  return dsv.format(lyr.data.getRecords());
};
*/

internal.exportDelimTable = function(lyr, delim) {
  var dsv = require("d3-dsv").dsvFormat(delim);
  var fields = lyr.data.getFields();
  var formatRow = internal.getDelimRowFormatter(fields, lyr.data);
  var records = lyr.data.getRecords();
  var str = dsv.formatRows([fields]); // headers
  var tmp = [];
  var n = records.length;
  var i = 0;
  // Formatting rows in groups avoids a memory allocation error that occured when
  // generating a file containing 2.8 million rows.
  while (i < n) {
    tmp.push(formatRow(records[i]));
    i++;
    if (i % 50 === 0 || i == n) {
      str += '\n' + dsv.formatRows(tmp);
      tmp = [];
    }
  }
  return str;
};

// Return a function for converting a record into an array of values
// to pass to dsv.formatRows()
internal.getDelimRowFormatter = function(fields, data) {
  var formatters = fields.map(function(f) {
    var type = internal.getColumnType(f, data);
    return function(rec) {
      if (type == 'object') {
        return JSON.stringify(rec[f]);
      }
      return rec[f]; // use default d3-dsv formatting
    };
  });
  return function(rec) {
    var values = [];
    for (var i=0; i<formatters.length; i++) {
      values.push(formatters[i](rec));
    }
    return values;
  };
};

internal.getExportDelimiter = function(info, opts) {
  var delim = ','; // default
  var outputExt = opts.file ? utils.getFileExtension(opts.file) : '';
  if (opts.delimiter) {
    delim = opts.delimiter;
  } else if (outputExt == 'tsv') {
    delim = '\t';
  } else if (outputExt == 'csv') {
    delim = ',';
  } else if (info.input_delimiter) {
    delim = info.input_delimiter;
  }
  return delim;
};

// If output filename is not specified, use the delimiter char to pick
// an extension.
internal.getDelimFileExtension = function(delim, opts) {
  var ext = 'txt'; // default
  if (opts.file) {
    ext = utils.getFileExtension(opts.file);
  } else if (delim == '\t') {
    ext = 'tsv';
  } else if (delim == ',') {
    ext = 'csv';
  }
  return ext;
};




internal.importJSONTable = function(arr) {
  internal.fixInconsistentFields(arr);
  return {
    layers: [{
      data: new DataTable(arr)
    }],
    info: {}
  };
};

internal.exportJSON = function(dataset, opts) {
  return dataset.layers.reduce(function(arr, lyr) {
    if (lyr.data){
      arr.push({
        content: internal.exportJSONTable(lyr),
        filename: (lyr.name || 'output') + '.json'
      });
    }
    return arr;
  }, []);
};

internal.exportJSONTable = function(lyr) {
  return JSON.stringify(lyr.data.getRecords());
};





// @targets - non-empty output from Catalog#findCommandTargets()
//
internal.exportTargetLayers = function(targets, opts) {
  // convert target fmt to dataset fmt
  var datasets = targets.map(function(target) {
    return utils.defaults({layers: target.layers}, target.dataset);
  });
  return internal.exportDatasets(datasets, opts);
};

//
//
internal.exportDatasets = function(datasets, opts) {
  var format = internal.getOutputFormat(datasets[0], opts);
  var files;
  if (format == 'svg' || format == 'topojson' || format == 'geojson' && opts.combine_layers) {
    // multi-layer formats: combine multiple datasets into one
    if (datasets.length > 1) {
      datasets = [internal.mergeDatasetsForExport(datasets)];
      if (format == 'topojson') {
        // Build topology, in case user has loaded several
        // files derived from the same source, with matching coordinates
        // (Downsides: useless work if geometry is unrelated;
        // could create many small arcs if layers are partially related)
        api.buildTopology(datasets[0]);
      }
      // KLUDGE let exporter know that copying is not needed
      // (because shape data was deep-copied during merge)
      opts = utils.defaults({final: true}, opts);
    }
  } else {
    datasets = datasets.map(internal.copyDatasetForRenaming);
    internal.assignUniqueLayerNames2(datasets);
  }
  files = datasets.reduce(function(memo, dataset) {
    if (opts.target) {
      // kludge to export layers in order that target= option matched them
      // (useful mainly for SVG output)
      // match_id was assigned to each layer by findCommandTargets()
      utils.sortOn(dataset.layers, 'match_id', true);
    }
    return memo.concat(internal.exportFileContent(dataset, opts));
  }, []);
  // need unique names for multiple output files
  internal.assignUniqueFileNames(files);
  return files;
};

// Return an array of objects with "filename" and "content" members.
//
internal.exportFileContent = function(dataset, opts) {
  var outFmt = opts.format = internal.getOutputFormat(dataset, opts),
      exporter = internal.exporters[outFmt],
      files = [];

  if (!outFmt) {
    error("Missing output format");
  } else if (!exporter) {
    error("Unknown output format:", outFmt);
  }

  // shallow-copy dataset and layers, so layers can be renamed for export
  dataset = utils.defaults({
    layers: dataset.layers.map(function(lyr) {return utils.extend({}, lyr);})
  }, dataset);

  // Adjust layer names, so they can be used as output file names
  if (opts.file && outFmt != 'topojson') {
    dataset.layers.forEach(function(lyr) {
      lyr.name = utils.getFileBase(opts.file);
    });
  }
  internal.assignUniqueLayerNames(dataset.layers);

  // apply coordinate precision, except for svg precision, which is applied
  // during export, after rescaling
  if (opts.precision && outFmt != 'svg') {
    dataset = internal.copyDatasetForExport(dataset);
    internal.setCoordinatePrecision(dataset, opts.precision);
  }

  if (opts.cut_table) {
    files = internal.exportDataTables(dataset.layers, opts).concat(files);
  }

  if (opts.extension) {
    opts.extension = internal.fixFileExtension(opts.extension, outFmt);
  }

  internal.validateLayerData(dataset.layers);

  files = exporter(dataset, opts).concat(files);
  // If rounding or quantization are applied during export, bounds may
  // change somewhat... consider adding a bounds property to each layer during
  // export when appropriate.
  if (opts.bbox_index) {
    files.push(internal.createIndexFile(dataset));
  }

  internal.validateFileNames(files);
  return files;
};

internal.exporters = {
  geojson: internal.exportGeoJSON,
  topojson: internal.exportTopoJSON,
  shapefile: internal.exportShapefile,
  dsv: internal.exportDelim,
  dbf: internal.exportDbf,
  json: internal.exportJSON,
  svg: internal.exportSVG
};

internal.getOutputFormat = function(dataset, opts) {
  var outFile = opts.file || null,
      inFmt = dataset.info && dataset.info.input_formats && dataset.info.input_formats[0],
      outFmt = null;

  if (opts.format) {
    outFmt = opts.format;
  } else if (outFile) {
    outFmt = internal.inferOutputFormat(outFile, inFmt);
  } else if (inFmt) {
    outFmt = inFmt;
  }
  return outFmt;
};

// Generate json file with bounding boxes and names of each export layer
// TODO: consider making this a command, or at least make format settable
//
internal.createIndexFile = function(dataset) {
  var index = dataset.layers.map(function(lyr) {
    var bounds = internal.getLayerBounds(lyr, dataset.arcs);
    return {
      bbox: bounds.toArray(),
      name: lyr.name
    };
  });

  return {
    content: JSON.stringify(index),
    filename: "bbox-index.json"
  };
};

// Throw errors for various error conditions
internal.validateLayerData = function(layers) {
  layers.forEach(function(lyr) {
    if (!lyr.geometry_type) {
      // allowing data-only layers
      if (lyr.shapes && utils.some(lyr.shapes, function(o) {
        return !!o;
      })) {
        error("A layer contains shape records and a null geometry type");
      }
    } else {
      if (!utils.contains(['polygon', 'polyline', 'point'], lyr.geometry_type)) {
        error ("A layer has an invalid geometry type:", lyr.geometry_type);
      }
      if (!lyr.shapes) {
        error ("A layer is missing shape data");
      }
    }
  });
};

internal.validateFileNames = function(files) {
  var index = {};
  files.forEach(function(file, i) {
    var filename = file.filename;
    if (!filename) error("Missing a filename for file" + i);
    if (filename in index) error("Duplicate filename", filename);
    index[filename] = true;
  });
};

internal.assignUniqueLayerNames = function(layers) {
  var names = layers.map(function(lyr) {
    return lyr.name || "layer";
  });
  var uniqueNames = internal.uniqifyNames(names);
  layers.forEach(function(lyr, i) {
    lyr.name = uniqueNames[i];
  });
};

// Assign unique layer names across multiple datasets
internal.assignUniqueLayerNames2 = function(datasets) {
  var layers = datasets.reduce(function(memo, dataset) {
    return memo.concat(dataset.layers);
  }, []);
  internal.assignUniqueLayerNames(layers);
};

internal.assignUniqueFileNames = function(output) {
  var names = output.map(function(o) {return o.filename;});
  var uniqnames = internal.uniqifyNames(names, internal.formatVersionedFileName);
  output.forEach(function(o, i) {o.filename = uniqnames[i];});
};

// TODO: remove this -- format=json creates the same output
//   (but need to make sure there's a way to prevent names of json data files
//    from colliding with names of GeoJSON or TopoJSON files)
internal.exportDataTables = function(layers, opts) {
  var tables = [];
  layers.forEach(function(lyr) {
    if (lyr.data) {
      tables.push({
        content: JSON.stringify(lyr.data),
        filename: (lyr.name ? lyr.name + '-' : '') + 'table.json'
      });
    }
  });
  return tables;
};

internal.formatVersionedName = function(name, i) {
  var suffix = String(i);
  if (/[0-9]$/.test(name)) {
    suffix = '-' + suffix;
  }
  return name + suffix;
};

internal.formatVersionedFileName = function(filename, i) {
  var parts = filename.split('.');
  var ext, base;
  if (parts.length < 2) {
    return internal.formatVersionedName(filename, i);
  }
  ext = parts.pop();
  base = parts.join('.');
  return internal.formatVersionedName(base, i) + '.' + ext;
};

internal.fixFileExtension = function(ext, fmt) {
  // TODO: use fmt to validate
  return ext.replace(/^\.+/, '');
};

internal.uniqifyNames = function(names, formatter) {
  var counts = utils.countValues(names),
      format = formatter || internal.formatVersionedName,
      blacklist = {};

  Object.keys(counts).forEach(function(name) {
    if (counts[name] > 1) blacklist[name] = true; // uniqify all instances of a name
  });
  return names.map(function(name) {
    var i = 1, // first version id
        candidate = name,
        versionedName;
    while (candidate in blacklist) {
      versionedName = format(name, i);
      if (!versionedName || versionedName == candidate) {
        throw new Error("Naming error"); // catch buggy versioning function
      }
      candidate = versionedName;
      i++;
    }
    blacklist[candidate] = true;
    return candidate;
  });
};




api.evaluateEachFeature = function(lyr, arcs, exp, opts) {
  var n = internal.getFeatureCount(lyr),
      compiled, filter;

  // TODO: consider not creating a data table -- not needed if expression only references geometry
  if (n > 0 && !lyr.data) {
    lyr.data = new DataTable(n);
  }
  if (opts && opts.where) {
    filter = internal.compileValueExpression(opts.where, lyr, arcs);
  }
  compiled = internal.compileFeatureExpression(exp, lyr, arcs, {context: internal.defs});
  // call compiled expression with id of each record
  for (var i=0; i<n; i++) {
    if (!filter || filter(i)) {
      compiled(i);
    }
  }
};




// Identify JSON type from the initial subset of a JSON string
internal.identifyJSONString = function(str) {
  var maxChars = 1000;
  var fmt = null;
  if (str.length > maxChars) str = str.substr(0, maxChars);
  str = str.replace(/\s/g, '');
  if (/^\[[{\]]/.test(str)) {
    // empty array of array of objects
    fmt = 'json';
  } else if (/"arcs":\[|"objects":\{|"transform":\{/.test(str)) {
    fmt =  'topojson';
  } else if (/^\{"/.test(str)) {
    fmt = 'geojson';
  }
  return fmt;
};

internal.identifyJSONObject = function(o) {
  var fmt = null;
  if (o.type == 'Topology') {
    fmt = 'topojson';
  } else if (o.type) {
    fmt = 'geojson';
  } else if (utils.isArray(o)) {
    fmt = 'json';
  }
  return fmt;
};

internal.importGeoJSONFile = function(fileReader, opts) {
  var importer = new GeoJSONParser(opts);
  new GeoJSONReader(fileReader).readObjects(importer.parseObject);
  return importer.done();
};

internal.importJSONFile = function(reader, opts) {
  var str = reader.readSync(0, Math.min(1000, reader.size())).toString('utf8');
  var type = internal.identifyJSONString(str);
  var dataset, retn;
  if (type == 'geojson') { // consider only for larger files
    dataset = internal.importGeoJSONFile(reader, opts);
    retn = {
      dataset: dataset,
      format: 'geojson'
    };
  } else {
    retn = {
      // content: cli.readFile(path, 'utf8')}
      content: reader.toString('utf8')
    };
  }
  reader.close();
  return retn;
};

internal.importJSON = function(data, opts) {
  var content = data.content,
      filename = data.filename,
      retn = {filename: filename},
      reader;

  if (!content) {
    reader = new FileReader(filename);
  } else if (content instanceof ArrayBuffer) {
    // Web API imports JSON as ArrayBuffer, to support larger files
    if (content.byteLength < 1e7) {
      content = new Buffer(content).toString();
    } else {
      reader = new BufferReader(content);
      content = null;
    }
  }

  if (reader) {
    data = internal.importJSONFile(reader, opts);
    if (data.dataset) {
      retn.dataset = data.dataset;
      retn.format = data.format;
    } else {
      content = data.content;
    }
  }

  if (content) {
    if (utils.isString(content)) {
      try {
        content = JSON.parse(content); // ~3sec for 100MB string
      } catch(e) {
        stop("Unable to parse JSON");
      }
    }
    retn.format = internal.identifyJSONObject(content);
    if (retn.format == 'topojson') {
      retn.dataset = internal.importTopoJSON(content, opts);
    } else if (retn.format == 'geojson') {
      retn.dataset = internal.importGeoJSON(content, opts);
    } else if (retn.format == 'json') {
      retn.dataset = internal.importJSONTable(content, opts);
    } else {
      stop("Unknown JSON format");
    }
  }

  return retn;
};



// Parse content of one or more input files and return a dataset
// @obj: file data, indexed by file type
// File data objects have two properties:
//    content: Buffer, ArrayBuffer, String or Object
//    filename: String or null
//
internal.importContent = function(obj, opts) {
  var dataset, content, fileFmt, data;
  opts = opts || {};
  if (obj.json) {
    data = internal.importJSON(obj.json, opts);
    fileFmt = data.format;
    dataset = data.dataset;
  } else if (obj.text) {
    fileFmt = 'dsv';
    data = obj.text;
    dataset = internal.importDelim(data.content, opts);
  } else if (obj.shp) {
    fileFmt = 'shapefile';
    data = obj.shp;
    dataset = internal.importShapefile(obj, opts);
  } else if (obj.dbf) {
    fileFmt = 'dbf';
    data = obj.dbf;
    dataset = internal.importDbf(obj, opts);
  } else if (obj.prj) {
    // added for -proj command source
    fileFmt = 'prj';
    data = obj.prj;
    dataset = {layers: [], info: {prj: data.content}};
  }

  if (!dataset) {
    stop("Missing an expected input type");
  }

  // Convert to topological format, if needed
  if (dataset.arcs && !opts.no_topology && fileFmt != 'topojson') {
    api.buildTopology(dataset);
  }

  // Use file basename for layer name, except TopoJSON, which uses object names
  if (fileFmt != 'topojson') {
    dataset.layers.forEach(function(lyr) {
      internal.setLayerName(lyr, internal.filenameToLayerName(data.filename || ''));
    });
  }

  // Add input filename and format to the dataset's 'info' object
  // (this is useful when exporting if format or name has not been specified.)
  if (data.filename) {
    dataset.info.input_files = [data.filename];
  }
  dataset.info.input_formats = [fileFmt];
  return dataset;
};

// Deprecated (included for compatibility with older tests)
internal.importFileContent = function(content, filename, opts) {
  var type = internal.guessInputType(filename, content),
      input = {};
  input[type] = {filename: filename, content: content};
  return internal.importContent(input, opts);
};


internal.importShapefile = function(obj, opts) {
  var shpSrc = obj.shp.content || obj.shp.filename, // content may be missing
      dataset = internal.importShp(shpSrc, opts),
      lyr = dataset.layers[0],
      dbf;
  if (obj.dbf) {
    dbf = internal.importDbf(obj, opts);
    utils.extend(dataset.info, dbf.info);
    lyr.data = dbf.layers[0].data;
    if (lyr.shapes && lyr.data.size() != lyr.shapes.length) {
      message("Mismatched .dbf and .shp record count -- possible data loss.");
    }
  }
  if (obj.prj) {
    dataset.info.prj = obj.prj.content;
  }
  return dataset;
};

internal.importDbf = function(input, opts) {
  var table;
  opts = utils.extend({}, opts);
  if (input.cpg && !opts.encoding) {
    opts.encoding = input.cpg.content;
  }
  table = internal.importDbfTable(input.dbf.content, opts);
  return {
    info: {},
    layers: [{data: table}]
  };
};

internal.filenameToLayerName = function(path) {
  var name = 'layer1';
  var obj = utils.parseLocalPath(path);
  if (obj.basename && obj.extension) { // exclude paths like '/dev/stdin'
    name = obj.basename;
  }
  return name;
};

// initialize layer name using filename
internal.setLayerName = function(lyr, path) {
  if (!lyr.name) {
    lyr.name = utils.getFileBase(path);
  }
};




api.importFiles = function(opts) {
  var files = opts.files || [],
      dataset;

  if (opts.stdin) {
    return api.importFile('/dev/stdin', opts);
  }

  if (files.length > 0 === false) {
    stop('Missing input file(s)');
  }

  if (files.length == 1) {
    dataset = api.importFile(files[0], opts);
  } else if (opts.merge_files) {
    // TODO: deprecate and remove this option (use -merge-layers cmd instead)
    dataset = internal.importFiles(files, opts);
    dataset.layers = api.mergeLayers(dataset.layers);
  } else if (opts.combine_files) {
    dataset = internal.importFiles(files, opts);
  } else {
    stop('Invalid inputs');
  }
  return dataset;
};

api.importFile = function(path, opts) {
  var isBinary = internal.isBinaryFile(path),
      apparentType = internal.guessInputFileType(path),
      input = {},
      encoding = opts && opts.encoding || null,
      cache = opts && opts.input || null,
      cached = cache && (path in cache),
      type, content;

  cli.checkFileExists(path, cache);
  if (apparentType == 'shp' && !cached) {
    // let ShpReader read the file (supports larger files)
    content = null;
  } else if (apparentType == 'json' && !cached) {
    // postpone reading of JSON files, to support incremental parsing of GeoJSON
    content = null;
  } else if (isBinary) {
    content = cli.readFile(path, null, cache);
  } else { // assuming text file
    content = cli.readFile(path, encoding || 'utf-8', cache);
  }
  type = apparentType || internal.guessInputContentType(content);
  if (!type) {
    stop("Unable to import", path);
  }
  input[type] = {filename: path, content: content};
  content = null; // for g.c.
  if (type == 'shp' || type == 'dbf') {
    internal.readShapefileAuxFiles(path, input, cache);
  }
  if (type == 'shp' && !input.dbf) {
    message(utils.format("[%s] .dbf file is missing - shapes imported without attribute data.", path));
  }
  return internal.importContent(input, opts);
};

internal.readShapefileAuxFiles = function(path, obj, cache) {
  var dbfPath = utils.replaceFileExtension(path, 'dbf');
  var cpgPath = utils.replaceFileExtension(path, 'cpg');
  var prjPath = utils.replaceFileExtension(path, 'prj');
  if (cli.isFile(prjPath, cache)) {
    obj.prj = {filename: prjPath, content: cli.readFile(prjPath, 'utf-8', cache)};
  }
  if (!obj.dbf && cli.isFile(dbfPath, cache)) {
    obj.dbf = {filename: dbfPath, content: cli.readFile(dbfPath, null, cache)};
  }
  if (obj.dbf && cli.isFile(cpgPath, cache)) {
    obj.cpg = {filename: cpgPath, content: cli.readFile(cpgPath, 'utf-8', cache).trim()};
  }
};




internal.writeFiles = function(exports, opts, cb) {
  if (exports.length > 0 === false) {
    message("No files to save");
  } else if (opts.dry_run) {
    // no output
  } else if (opts.stdout) {
    // Pass callback for asynchronous output (synchronous output to stdout can
    // trigger EAGAIN error, e.g. when piped to less)
    return cli.writeFile('/dev/stdout', exports[0].content, cb);
  } else {
    var paths = internal.getOutputPaths(utils.pluck(exports, 'filename'), opts);
    exports.forEach(function(obj, i) {
      var path = paths[i];
      if (obj.content instanceof ArrayBuffer) {
        // replacing content so ArrayBuffers can be gc'd
        obj.content = cli.convertArrayBuffer(obj.content); // convert to Buffer
      }
      if (opts.output) {
        opts.output.push({filename: path, content: obj.content});
      } else {
        cli.writeFile(path, obj.content);
        message("Wrote " + path);
      }
    });
  }
  if (cb) cb(null);
};

internal.getOutputPaths = function(files, opts) {
  var odir = opts.directory;
  if (opts.force) {
    message("The force option is obsolete, files are now overwritten by default");
  }
  if (odir) {
    files = files.map(function(file) {
      return require('path').join(odir, file);
    });
  }
  return files;
};




api.filterFields = function(lyr, names) {
  var table = lyr.data;
  names = names || [];
  internal.requireDataFields(table, names);
  utils.difference(table.getFields(), names).forEach(table.deleteField, table);
};

api.renameFields = function(lyr, names) {
  var map = internal.mapFieldNames(names);
  internal.requireDataFields(lyr.data, Object.keys(map));
  utils.defaults(map, internal.mapFieldNames(lyr.data.getFields()));
  lyr.data.update(internal.getRecordMapper(map));
};

internal.mapFieldNames = function(names) {
  return (names || []).reduce(function(memo, str) {
    var parts = str.split('='),
        dest = utils.trimQuotes(parts[0]),
        src = parts.length > 1 ? utils.trimQuotes(parts[1]) : dest;
    if (!src || !dest) stop("Invalid field description:", str);
    memo[src] = dest;
    return memo;
  }, {});
};

internal.getRecordMapper = function(map) {
  var fields = Object.keys(map);
  return function(src) {
    var dest = {}, key;
    for (var i=0, n=fields.length; i<n; i++) {
      key = fields[i];
      dest[map[key]] = src[key];
    }
    return dest;
  };
};




api.graticule = function(dataset, opts) {
  var graticule = internal.createGraticule(opts);
  var dest, src;
  if (dataset) {
    // project graticule to match dataset
    dest = internal.getDatasetProjection(dataset);
    src = internal.getProjection('wgs84');
    if (!dest) stop("Coordinate system is unknown, unable to create a graticule");
    internal.projectDataset(graticule, src, dest, {}); // TODO: densify?
  }
  return graticule;
};

// create graticule as a dataset
internal.createGraticule = function(opts) {
  var precision = 1; // degrees between each vertex
  var step = 10;
  var majorStep = 90;
  var xn = Math.round(360 / step) + 1;
  var yn = Math.round(180 / step) + 1;
  var xx = utils.range(xn, -180, step);
  var yy = utils.range(yn, -90, step);
  var meridians = xx.map(function(x) {
    var ymin = -90,
        ymax = 90;
    if (x % majorStep !== 0) {
      ymin += step;
      ymax -= step;
    }
    return internal.createMeridian(x, ymin, ymax, precision);
  });
  var parallels = yy.map(function(y) {
    return internal.createParallel(y, -180, 180, precision);
  });
  var geojson = {
    type: 'FeatureCollection',
    features: meridians.concat(parallels)
  };
  var graticule = internal.importGeoJSON(geojson, {});
  graticule.layers[0].name = 'graticule';
  return graticule;
};

internal.graticuleFeature = function(coords, o) {
  return {
    type: 'Feature',
    properties: o,
    geometry: {
      type: 'LineString',
      coordinates: coords
    }
  };
};

internal.createMeridian = function(x, ymin, ymax, precision) {
  var coords = [];
  for (var y = ymin; y < ymax; y += precision) {
    coords.push([x, y]);
  }
  coords.push([x, ymax]);
  return internal.graticuleFeature(coords, {type: 'meridian', value: x});
};

internal.createParallel = function(y, xmin, xmax, precision) {
  var coords = [];
  for (var x = xmin; x < xmax; x += precision) {
    coords.push([x, y]);
  }
  coords.push([xmax, y]);
  return internal.graticuleFeature(coords, {type: 'parallel', value: y});
};




internal.printInfo = function(layers) {
  var str = '';
  layers.forEach(function(o, i) {
    if (i > 0) str += '\n';
    str += '\nLayer ' + (i + 1) + '\n' + internal.getLayerInfo(o.layer, o.dataset);
  });
  message(str);
};

// TODO: consider polygons with zero area or other invalid geometries
internal.countNullShapes = function(shapes) {
  var count = 0;
  for (var i=0; i<shapes.length; i++) {
    if (!shapes[i] || shapes[i].length === 0) count++;
  }
  return count;
};

internal.getLayerInfo = function(lyr, dataset) {
  var str = "Layer name: " + (lyr.name || "[unnamed]") + "\n";
  str += utils.format("Records: %,d\n", internal.getFeatureCount(lyr));
  str += internal.getGeometryInfo(lyr, dataset);
  str += internal.getTableInfo(lyr);
  return str;
};

internal.getGeometryInfo = function(lyr, dataset) {
  var shapeCount = lyr.shapes ? lyr.shapes.length : 0,
      nullCount = shapeCount > 0 ? internal.countNullShapes(lyr.shapes) : 0,
      lines;
  if (!lyr.geometry_type) {
    lines = ["Geometry: [none]"];
  } else {
    lines = ["Geometry", "Type: " + lyr.geometry_type];
    if (nullCount > 0) {
      lines.push(utils.format("Null shapes: %'d", nullCount));
    }
    if (shapeCount > nullCount) {
      lines.push("Bounds: " + internal.getLayerBounds(lyr, dataset.arcs).toArray().join(' '));
      lines.push("Proj.4: " + internal.getProjInfo(dataset));
    }
  }
  return lines.join('\n  ') + '\n';
};

internal.getTableInfo = function(lyr, i) {
  if (!lyr.data || lyr.data.size() === 0 || lyr.data.getFields().length === 0) {
    return "Attribute data: [none]";
  }
  return internal.getAttributeInfo(lyr.data, i);
};

internal.getAttributeInfo = function(data, i) {
  var featureId = i || 0;
  var featureLabel = i >= 0 ? 'Value' : 'First value';
  var fields = data.getFields().sort();
  var col1Chars = fields.reduce(function(memo, name) {
    return Math.max(memo, name.length);
  }, 5) + 2;
  var vals = fields.map(function(fname) {
    return data.getRecordAt(featureId)[fname];
  });
  var maxIntegralChars = vals.reduce(function(max, val) {
    if (utils.isNumber(val)) {
      max = Math.max(max, internal.countIntegralChars(val));
    }
    return max;
  }, 0);
  var table = vals.map(function(val, i) {
    return '  ' + internal.formatTableItem(fields[i], val, col1Chars, maxIntegralChars);
  }).join('\n');
  return "Attribute data\n  " +
      utils.rpad('Field', col1Chars, ' ') + featureLabel + "\n" + table;
};

internal.formatNumber = function(val) {
  return val + '';
};

internal.formatString = function(str) {
  var replacements = {
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t'
  };
  var cleanChar = function(c) {
    // convert newlines and carriage returns
    // TODO: better handling of non-printing chars
    return c in replacements ? replacements[c] : '';
  };
  str = str.replace(/[\r\t\n]/g, cleanChar);
  return "'" + str + "'";
};

internal.countIntegralChars = function(val) {
  return utils.isNumber(val) ? (internal.formatNumber(val) + '.').indexOf('.') : 0;
};

internal.formatTableItem = function(name, val, col1Chars, integralChars) {
  var str = utils.rpad(name, col1Chars, ' ');
  if (utils.isNumber(val)) {
    str += utils.lpad("", integralChars - internal.countIntegralChars(val), ' ') +
      internal.formatNumber(val);
  } else if (utils.isString(val)) {
    str += internal.formatString(val);
  } else if (utils.isObject(val)) { // if {} or [], display JSON
    str += JSON.stringify(val);
  } else {
    str += String(val);
  }
  return str;
};

internal.getSimplificationInfo = function(arcs) {
  var nodeCount = new NodeCollection(arcs).size();
  // get count of non-node vertices
  var internalVertexCount = internal.countInteriorVertices(arcs);
};

internal.countInteriorVertices = function(arcs) {
  var count = 0;
  arcs.forEach2(function(i, n) {
    if (n > 2) {
      count += n - 2;
    }
  });
  return count;
};




api.innerlines = function(lyr, arcs, opts) {
  internal.requirePolygonLayer(lyr);
  var classifier = internal.getArcClassifier(lyr.shapes, arcs);
  var lines = internal.extractInnerLines(lyr.shapes, classifier);
  var outputLyr = internal.createLineLayer(lines, null);

  if (lines.length === 0) {
    message("No shared boundaries were found");
  }
  outputLyr.name = opts && opts.no_replace ? null : lyr.name;
  return outputLyr;
};

api.lines = function(lyr, arcs, opts) {
  opts = opts || {};
  var classifier = internal.getArcClassifier(lyr.shapes, arcs),
      fields = utils.isArray(opts.fields) ? opts.fields : [],
      rankId = 0,
      shapes = [],
      records = [],
      outputLyr;

  internal.requirePolygonLayer(lyr, "Command requires a polygon layer");
  if (fields.length > 0 && !lyr.data) {
    stop("Missing a data table");
  }

  addLines(internal.extractOuterLines(lyr.shapes, classifier), 'outer');

  fields.forEach(function(field) {
    var data = lyr.data.getRecords();
    var key = function(a, b) {
      var arec = data[a];
      var brec = data[b];
      var aval, bval;
      if (!arec || !brec || arec[field] === brec[field]) {
        return null;
      }
      return a + '-' + b;
    };
    if (!lyr.data.fieldExists(field)) {
      stop("Unknown data field:", field);
    }
    addLines(internal.extractLines(lyr.shapes, classifier(key)), field);
  });

  addLines(internal.extractInnerLines(lyr.shapes, classifier), 'inner');
  outputLyr = internal.createLineLayer(shapes, records);
  outputLyr.name = opts.no_replace ? null : lyr.name;
  return outputLyr;

  function addLines(lines, typeName) {
    var attr = lines.map(function(shp, i) {
      return {RANK: rankId, TYPE: typeName};
    });
    shapes = utils.merge(lines, shapes);
    records = utils.merge(attr, records);
    rankId++;
  }
};

internal.createLineLayer = function(lines, records) {
  return {
    geometry_type: 'polyline',
    shapes: lines,
    data: records ? new DataTable(records) : null
  };
};

internal.extractOuterLines = function(shapes, classifier) {
  var key = function(a, b) {return b == -1 ? String(a) : null;};
  return internal.extractLines(shapes, classifier(key));
};

internal.extractInnerLines = function(shapes, classifier) {
  var key = function(a, b) {return b > -1 ? a + '-' + b : null;};
  return internal.extractLines(shapes, classifier(key));
};

internal.extractLines = function(shapes, classify) {
  var lines = [],
      index = {},
      prev = null,
      prevKey = null,
      part;

  internal.traversePaths(shapes, onArc, onPart);

  function onArc(o) {
    var arcId = o.arcId,
        key = classify(arcId),
        isContinuation, line;
    if (!!key) {
      line = key in index ? index[key] : null;
      isContinuation = key == prevKey && o.shapeId == prev.shapeId && o.partId == prev.partId;
      if (!line) {
        line = [[arcId]]; // new shape
        index[key] = line;
        lines.push(line);
      } else if (isContinuation) {
        line[line.length-1].push(arcId); // extending prev part
      } else {
        line.push([arcId]); // new part
      }

      // if extracted line is split across endpoint of original polygon ring, then merge
      if (o.i == part.arcs.length - 1 &&  // this is last arc in ring
          line.length > 1 &&              // extracted line has more than one part
          line[0][0] == part.arcs[0]) {   // first arc of first extracted part is first arc in ring
        line[0] = line.pop().concat(line[0]);
      }
    }
    prev = o;
    prevKey = key;
  }

  function onPart(o) {
    part = o;
  }

  return lines;
};




api.inspect = function(lyr, arcs, opts) {
  var ids = internal.selectFeatures(lyr, arcs, opts);
  var msg;
  if (ids.length == 1) {
    msg = internal.getFeatureInfo(ids[0], lyr, arcs);
  } else {
    msg = utils.format("Expression matched %d feature%s. Select one feature for details", ids.length, utils.pluralSuffix(ids.length));
  }
  message(msg);
};

internal.getFeatureInfo = function(id, lyr, arcs) {
    var msg = "Feature " + id + '\n';
    msg += internal.getShapeInfo(id, lyr, arcs);
    msg += internal.getTableInfo(lyr, id);
    return msg;
};

internal.getShapeInfo = function(id, lyr, arcs) {
  var shp = lyr.shapes ? lyr.shapes[id] : null;
  var type = lyr.geometry_type;
  var info, msg;
  if (!shp || !type) {
    return 'Geometry: [null]\n';
  }
  msg = 'Geometry\n  Type: ' + type + '\n';
  if (type == 'point') {
    msg += '  Points: ' + shp.length + '\n';
  } else if (type == 'polyline') {
    msg += '  Parts: ' + shp.length + '\n';
  } else if (type == 'polygon') {
    info = internal.getPolygonInfo(shp, arcs);
    msg += utils.format('  Rings: %d cw, %d ccw\n', info.cw, info.ccw);
    msg += '  Planar area: ' + info.area + '\n';
    if (info.sph_area) {
      msg += '  Spherical area: ' + info.sph_area + ' sq. meters\n';
    }
  }
  return msg;
};

internal.getPolygonInfo = function(shp, arcs) {
  var o = {rings: shp.length, cw: 0, ccw: 0, area: 0};
  var area;
  for (var i=0; i<shp.length; i++) {
    area = geom.getPlanarPathArea(shp[i], arcs);
    if (area > 0) {
      o.cw++;
    } else if (area < 0) {
      o.ccw++;
    }
    o.area += area;
  }
  if (!arcs.isPlanar()) {
    o.sph_area = geom.getSphericalShapeArea(shp, arcs);
  }
  return o;
};

internal.selectFeatures = function(lyr, arcs, opts) {
  var n = internal.getFeatureCount(lyr),
      ids = [],
      filter;
  if (!opts.expression) {
    stop("Missing a JS expression for selecting a feature");
  }
  filter = internal.compileValueExpression(opts.expression, lyr, arcs);
  utils.repeat(n, function(id) {
    var result = filter(id);
    if (result === true) {
      ids.push(id);
    } else if (result !== false) {
      stop("Expression must return true or false");
    }
  });
  return ids;
};




// Convert a string containing delimited text data into a dataset object
internal.importDelim = function(str, opts) {
  var delim = internal.guessDelimiter(str);
  return {
    layers: [{
      data: internal.importDelimTable(str, delim, opts)
    }],
    info: {
      input_delimiter: delim
    }
  };
};

internal.importDelimTable = function(str, delim, opts) {
  var records = require("d3-dsv").dsvFormat(delim).parse(str);
  var table;
  if (records.length === 0) {
    stop("Unable to read any records");
  }
  delete records.columns; // added by d3-dsv
  internal.adjustRecordTypes(records, opts);
  table = new DataTable(records);
  internal.deleteFields(table, internal.isInvalidFieldName);
 return table;
};

internal.supportedDelimiters = ['|', '\t', ',', ';'];

internal.isSupportedDelimiter = function(d) {
  return utils.contains(internal.supportedDelimiters, d);
};

internal.guessDelimiter = function(content) {
  return utils.find(internal.supportedDelimiters, function(delim) {
    var rxp = internal.getDelimiterRxp(delim);
    return rxp.test(content);
  }) || ',';
};

// Get RegExp to test for a delimiter before first line break of a string
// Assumes that the first line does not contain alternate delim chars (this will
// be true if the first line has field headers composed of word characters).
internal.getDelimiterRxp = function(delim) {
  var rxp = "^[^\\n\\r]+" + utils.regexEscape(delim);
  return new RegExp(rxp);
};

internal.getFieldTypeHints = function(opts) {
  var hints = {};
  opts = opts || {};
  if (opts.string_fields) {
    opts.string_fields.forEach(function(f) {
      hints[f] = 'string';
    });
  }
  if (opts.field_types) {
    opts.field_types.forEach(function(raw) {
      var parts, name, type;
      if (raw.indexOf(':') != -1) {
        parts = raw.split(':');
        name = parts[0];
        type = internal.validateFieldType(parts[1]);
      } else if (raw[0] === '+') { // d3-style type hint: unary plus
        name = raw.substr(1);
        type = 'number';
      }
      if (type) {
        hints[name] = type;
      } else {
        message("Invalid type hint (expected :str or :num) [" + raw + "]");
      }
    });
  }
  return hints;
};

// Detect and convert data types of data from csv files.
// TODO: decide how to handle records with inconstent properties. Mapshaper
//    currently assumes tabular data
internal.adjustRecordTypes = function(records, opts) {
  var typeIndex = internal.getFieldTypeHints(opts),
      fields = Object.keys(records[0] || []),
      detectedNumFields = [];
  fields.forEach(function(key) {
    var typeHint = typeIndex[key];
    var type = internal.adjustFieldValues(key, records, typeHint);
    if (!typeHint && type == 'number') {
      detectedNumFields.push(key);
    }
  });
  if (detectedNumFields.length > 0) {
    message(utils.format("Auto-detected number field%s: %s",
        detectedNumFields.length == 1 ? '' : 's', detectedNumFields.join(', ')));
  }
};

internal.adjustFieldValues = function(key, records, type) {
  var values;
  if (!type) {
    values = internal.tryNumericField(key, records);
  }
  if (values) {
    type = 'number';
    internal.insertFieldValues2(key, records, values);
  } else if (type == 'number') {
    internal.convertDataField(key, records, utils.parseNumber);
  } else {
    type = 'string';
    internal.convertDataField(key, records, utils.parseString);
  }
  return type;
};

internal.tryNumericField = function(key, records) {
  var arr = [],
      count = 0,
      raw, num;
  for (var i=0, n=records.length; i<n; i++) {
    raw = records[i][key];
    num = utils.parseNumber(raw);
    if (num !== null) {
      count++;
    } else if (raw && raw.trim()) {
      return null; // unparseable value -- fail
    }
    arr.push(num);
  }
  return count > 0 ? arr : null;
};

internal.convertDataField = function(name, records, f) {
  for (var i=0, n=records.length; i<n; i++) {
    records[i][name] = f(records[i][name]);
  }
};

// Accept a type hint from a header like "FIPS:str"
// Return standard type name (number|string) or null if hint is not recognized
internal.validateFieldType = function(hint) {
  var str = hint.toLowerCase(),
      type = null;
  if (str[0] == 'n') {
    type = 'number';
  } else if (str[0] == 's') {
    type = 'string';
  }
  return type;
};


// Remove comma separators from strings
// TODO: accept European-style numbers?
utils.cleanNumericString = function(raw) {
  return raw.replace(/,/g, '');
};

// Assume: @raw is string, undefined or null
utils.parseString = function(raw) {
  return raw ? raw : "";
};

// Assume: @raw is string, undefined or null
// Use null instead of NaN for unparsable values
// (in part because if NaN is used, empty strings get converted to "NaN"
// when re-exported).
utils.parseNumber = function(raw) {
  var str = String(raw).trim();
  var parsed = str ? Number(utils.cleanNumericString(str)) : NaN;
  return isNaN(parsed) ? null : parsed;
};




// TODO: use an actual index instead of linear search
function PointIndex(shapes, opts) {
  var buf = opts.buffer >= 0 ? opts.buffer : 1e-3;
  var minDistSq, minId, target;
  this.findNearestPointFeature = function(shape) {
    minDistSq = Infinity;
    minId = -1;
    target = shape || [];
    internal.forEachPoint(shapes, testPoint);
    return minId;
  };

  function testPoint(p, id) {
    var distSq;
    for (var i=0; i<target.length; i++) {
      distSq = distanceSq(target[i][0], target[i][1], p[0], p[1]);
      if (distSq < minDistSq && distSq <= buf * buf) {
        minDistSq = distSq;
        minId = id;
      }
    }
  }
}




api.joinPointsToPolygons = function(targetLyr, arcs, pointLyr, opts) {
  // TODO: copy points that can't be joined to a new layer
  var joinFunction = internal.getPolygonToPointsFunction(targetLyr, arcs, pointLyr, opts);
  internal.prepJoinLayers(targetLyr, pointLyr);
  return internal.joinTables(targetLyr.data, pointLyr.data, joinFunction, opts);
};

api.joinPolygonsToPoints = function(targetLyr, polygonLyr, arcs, opts) {
  var joinFunction = internal.getPointToPolygonFunction(targetLyr, polygonLyr, arcs, opts);
  internal.prepJoinLayers(targetLyr, polygonLyr);
  return internal.joinTables(targetLyr.data, polygonLyr.data, joinFunction, opts);
};

api.joinPointsToPoints = function(targetLyr, srcLyr, opts) {
  var joinFunction = internal.getPointToPointFunction(targetLyr, srcLyr, opts);
  internal.prepJoinLayers(targetLyr, srcLyr);
  return internal.joinTables(targetLyr.data, srcLyr.data, joinFunction, opts);
};

internal.prepJoinLayers = function(targetLyr, srcLyr) {
  if (!targetLyr.data) {
    // create an empty data table if target layer is missing attributes
    targetLyr.data = new DataTable(targetLyr.shapes.length);
  }
  if (!srcLyr.data) {
    stop("Can't join a layer that is missing attribute data");
  }
};

internal.getPointToPointFunction = function(targetLyr, srcLyr, opts) {
  var shapes = targetLyr.shapes;
  var index = new PointIndex(srcLyr.shapes, {});
  return function(targId) {
    var srcId = index.findNearestPointFeature(shapes[targId]);
    // TODO: accept multiple hits
    return srcId > -1 ? [srcId] : null;
  };
};

internal.getPolygonToPointsFunction = function(polygonLyr, arcs, pointLyr, opts) {
  var joinFunction = internal.getPointToPolygonFunction(pointLyr, polygonLyr, arcs, opts);
  var index = [];
  var hit, polygonId;
  for (var i=0, n=pointLyr.shapes.length; i<n; i++) {
    hit = joinFunction(i);
    if (hit) {
      polygonId = hit[0]; // TODO: handle multiple hits
      if (polygonId in index) {
        index[polygonId].push(i);
      } else {
        index[polygonId] = [i];
      }
    }
  }
  // @i id of a polygon feature
  return function(i) {
    return index[i] || null;
  };
};

internal.getPointToPolygonFunction = function(pointLyr, polygonLyr, arcs, opts) {
  var index = new PathIndex(polygonLyr.shapes, arcs),
      points = pointLyr.shapes;

  // @i id of a point feature
  return function(i) {
    var shp = points[i],
        shpId = -1;
    if (shp) {
      // TODO: handle multiple hits
      shpId = index.findEnclosingShape(shp[0]);
    }
    return shpId == -1 ? null : [shpId];
  };
};




internal.getJoinFilter = function(data, exp) {
  var test = internal.getJoinFilterTestFunction(exp, data);
  var calc = null;
  if (internal.expressionHasCalcFunction(exp)) {
    calc = internal.getJoinFilterCalcFunction(exp, data);
  }

  return function(ids) {
    var d = calc ? calc(ids) : null;
    var filtered = [],
        retn, i;
    for (i=0; i<ids.length; i++) {
      retn = test(ids[i], d);
      if (retn === true) {
        filtered.push(ids[i]);
      } else if (retn !== false) {
        stop('"where" expression must return true or false');
      }
    }
    return filtered;
  };
};

internal.expressionHasCalcFunction = function(exp) {
  return utils.some(['isMax', 'isMin', 'isMode'], function(name) {
    return exp.indexOf(name) > -1;
  });
};


internal.getJoinFilterCalcFunction = function(exp, data) {
  var values, counts, max, min, context, calc, n;

  context = {
    isMax: function(val) {
      if (val > max) max = val;
    },
    isMin: function(val) {
      if (val < min) min = val;
    },
    isMode: function(val) {
      if (!values) {
        values = [];
      }
      values.push(val);
    }
  };

  calc = internal.compileFeatureExpression(exp, {data: data}, null, {context: context});

  function reset() {
    max = -Infinity;
    min = Infinity;
    values = null;
  }

  return function(ids) {
    var mode;
    reset();
    for (var i=0; i<ids.length; i++) {
      calc(ids[i]);
    }
    mode = values ? internal.getModeData(values) : null;
    return {
      max: max,
      min: min,
      modes: mode ? mode.modes : null,
      margin: mode ? mode.margin : null
    };
  };
};


internal.getJoinFilterTestFunction = function(exp, data) {
  var context, test, d;
  context = {
    isMax: function(val) {
      return val === d.max;
    },
    isMin: function(val) {
      return val === d.min;
    },
    isMode: function(val) {
      return d.modes.indexOf(val) > -1;
    }
  };
  test = internal.compileFeatureExpression(exp, {data: data}, null, {context: context, returns: true});
  // @datum  results from calculation phase
  return function(i, datum) {
    d = datum;
    return test(i);
  };
};




api.join = function(targetLyr, dataset, src, opts) {
  var srcType, targetType, retn;
  if (!src || !src.layer.data || !src.dataset) {
    stop("Missing a joinable data source");
  }
  if (opts.keys) {
    // join using data in attribute fields
    if (opts.keys.length != 2) {
      stop("Expected two key fields: a target field and a source field");
    }
    retn = api.joinAttributesToFeatures(targetLyr, src.layer.data, opts);
  } else {
    // spatial join
    srcType = src.layer.geometry_type;
    targetType = targetLyr.geometry_type;
    if (srcType == 'point' && targetType == 'polygon') {
      retn = api.joinPointsToPolygons(targetLyr, dataset.arcs, src.layer, opts);
    } else if (srcType == 'polygon' && targetType == 'point') {
      retn = api.joinPolygonsToPoints(targetLyr, src.layer, src.dataset.arcs, opts);
    } else if (srcType == 'point' && targetType == 'point') {
      retn = api.joinPointsToPoints(targetLyr, src.layer, opts);
    } else {
      stop(utils.format("Unable to join %s geometry to %s geometry",
          srcType || 'null', targetType || 'null'));
    }
  }

  if (retn.unmatched) {
    dataset.layers.push(retn.unmatched);
  }
  if (retn.unjoined) {
    dataset.layers.push(retn.unjoined);
  }
};

internal.validateFieldNames = function(arr) {
  arr.forEach(function(name) {
    if (/:(str|num)/.test(name)) {
      stop("Unsupported use of type hints. Use string-fields= or field-types= options instead");
    }
  });
};

api.joinAttributesToFeatures = function(lyr, srcTable, opts) {
  var keys = opts.keys,
      destKey = keys[0],
      srcKey = keys[1],
      destTable = lyr.data,
      // exclude source key field from join unless explicitly listed
      joinFields = opts.fields || utils.difference(srcTable.getFields(), [srcKey]),
      joinFunction = internal.getJoinByKey(destTable, destKey, srcTable, srcKey);
  internal.validateFieldNames(keys);
  opts = utils.defaults({fields: joinFields}, opts);
  return internal.joinTables(destTable, srcTable, joinFunction, opts);
};

// Join data from @src table to records in @dest table
// @join function
//    Receives index of record in the dest table
//    Returns array of matching records in src table, or null if no matches
//
internal.joinTables = function(dest, src, join, opts) {
  var srcRecords = src.getRecords(),
      destRecords = dest.getRecords(),
      unmatchedRecords = [],
      joinFields = internal.getFieldsToJoin(dest.getFields(), src.getFields(), opts),
      sumFields = opts.sum_fields || [],
      copyFields = utils.difference(joinFields, sumFields),
      joinCounts = new Uint32Array(srcRecords.length),
      matchCount = 0,
      collisionCount = 0,
      skipCount = 0,
      retn = {},
      srcRec, srcId, destRec, joinIds, joins, count, filter, calc, i, j, n, m;

  if (opts.where) {
    filter = internal.getJoinFilter(src, opts.where);
  }

  if (opts.calc) {
    calc = internal.getJoinCalc(src, opts.calc);
  }

  // join source records to target records
  for (i=0, n=destRecords.length; i<n; i++) {
    destRec = destRecords[i];
    joins = join(i);
    if (joins && filter) {
      skipCount += joins.length;
      joins = filter(joins);
      skipCount -= joins.length;
    }
    for (j=0, count=0, m=joins ? joins.length : 0; j<m; j++) {
      srcId = joins[j];
      srcRec = srcRecords[srcId];
      if (count === 0) {
        if (copyFields.length > 0) {
          // only copying the first match
          internal.joinByCopy(destRec, srcRec, copyFields);
        }
      } else if (count == 1) {
        collisionCount++; // count target records with multiple joins
      }
      if (sumFields.length > 0) {
        internal.joinBySum(destRec, srcRec, sumFields);
      }
      joinCounts[srcId]++;
      count++;
    }
    if (calc) {
      calc(joins, destRec);
    }
    if (count > 0) {
      matchCount++;
    } else if (destRec) {
      if (opts.unmatched) {
        // Save a copy of unmatched record, before null values from join fields
        // are added.
        unmatchedRecords.push(utils.extend({}, destRec));
      }
      internal.updateUnmatchedRecord(destRec, copyFields, sumFields);
    }
  }
  if (matchCount === 0) {
    stop("No records could be joined");
  }

  internal.printJoinMessage(matchCount, destRecords.length,
      internal.countJoins(joinCounts), srcRecords.length, collisionCount, skipCount);

  if (opts.unjoined) {
    retn.unjoined = {
      name: 'unjoined',
      data: new DataTable(srcRecords.filter(function(o, i) {
        return joinCounts[i] === 0;
      }))
    };
  }
  if (opts.unmatched) {
    retn.unmatched = {
      name: 'unmatched',
      data: new DataTable(unmatchedRecords)
    };
  }
  return retn;
};

internal.countJoins = function(counts) {
  var joinCount = 0;
  for (var i=0, n=counts.length; i<n; i++) {
    if (counts[i] > 0) {
      joinCount++;
    }
  }
  return joinCount;
};

// Unset fields of unmatched records get null/empty values
internal.updateUnmatchedRecord = function(rec, copyFields, sumFields) {
  internal.joinByCopy(rec, {}, copyFields);
  internal.joinBySum(rec, {}, sumFields);
};

/*
internal.getCountFieldName = function(fields) {
  var uniq = internal.getUniqFieldNames(fields.concat("joins"));
  return uniq.pop();
};
*/

internal.joinByCopy = function(dest, src, fields) {
  var f;
  for (var i=0, n=fields.length; i<n; i++) {
    // dest[fields[i]] = src[fields[i]];
    // Use null when the source record is missing an expected value
    // TODO: think some more about whether this is desirable
    f = fields[i];
    if (Object.prototype.hasOwnProperty.call(src, f)) {
      dest[f] = src[f];
    } else if (!Object.prototype.hasOwnProperty.call(dest, f)) {
      dest[f] = null;
    }
  }
};

internal.joinBySum = function(dest, src, fields) {
  var f;
  for (var j=0; j<fields.length; j++) {
    f = fields[j];
    dest[f] = (dest[f] || 0) + (src[f] || 0);
  }
};

internal.printJoinMessage = function(matches, n, joins, m, collisions, skipped) {
  // TODO: add tip for generating layer containing unmatched records, when
  // this option is implemented.
  message(utils.format("Joined %'d data record%s", joins, utils.pluralSuffix(joins)));
  if (matches < n) {
    message(utils.format('%d/%d target records received no data', n-matches, n));
  }
  if (collisions > 0) {
    message(utils.format('%d/%d target records were matched by multiple source records', collisions, n));
  }
  if (joins < m) {
    message(utils.format("%d/%d source records could not be joined", m-joins, m));
  }
  if (skipped > 0) {
    message(utils.format("%d/%d source records were skipped", skipped, m));
  }
};

internal.getFieldsToJoin = function(destFields, srcFields, opts) {
  var joinFields;
  if (opts.fields) {
    if (opts.fields.indexOf('*') > -1) {
      joinFields = srcFields;
    } else {
      joinFields = opts.fields;
      internal.validateFieldNames(joinFields);
    }
  } else {
    // If a list of fields to join is not given, try to join all the
    // source fields, unless calc= option is present
    joinFields = opts.calc ? [] : srcFields;
  }
  if (!opts.force) {
    // only overwrite existing fields if the "force" option is set.
    joinFields = utils.difference(joinFields, destFields);
  }
  return joinFields;
};

// Return a function for translating a target id to an array of source ids based on values
// of two key fields.
internal.getJoinByKey = function(dest, destKey, src, srcKey) {
  var destRecords = dest.getRecords();
  var index = internal.createTableIndex(src.getRecords(), srcKey);
  if (src.fieldExists(srcKey) === false) {
    stop("External table is missing a field named:", srcKey);
  }
  if (!dest || !dest.fieldExists(destKey)) {
    stop("Target layer is missing key field:", destKey);
  }
  return function(i) {
    var destRec = destRecords[i],
        val = destRec ? destRec[destKey] : null;
    return destRec && val in index ? index[val] : null;
  };
};


internal.createTableIndex = function(records, f) {
  var index = {}, rec, key;
  for (var i=0, n=records.length; i<n; i++) {
    rec = records[i];
    key = rec[f];
    if (key in index) {
      index[key].push(i);
    } else {
      index[key] = [i];
    }
  }
  return index;
};




api.keepEveryPolygon =
internal.keepEveryPolygon = function(arcData, layers) {
  layers.forEach(function(lyr) {
    if (lyr.geometry_type == 'polygon') {
      internal.protectLayerShapes(arcData, lyr.shapes);
    }
  });
};

internal.protectLayerShapes = function(arcData, shapes) {
  shapes.forEach(function(shape) {
    internal.protectShape(arcData, shape);
  });
};

// Protect a single shape from complete removal by simplification
// @arcData an ArcCollection
// @shape an array containing one or more arrays of arc ids, or null if null shape
//
internal.protectShape = function(arcData, shape) {
  var maxArea = 0,
      arcCount = shape ? shape.length : 0,
      maxRing, area;
  // Find ring with largest bounding box
  for (var i=0; i<arcCount; i++) {
    area = arcData.getSimpleShapeBounds(shape[i]).area();
    if (area > maxArea) {
      maxRing = shape[i];
      maxArea = area;
    }
  }

  if (!maxRing || maxRing.length === 0) {
    // invald shape
    verbose("[protectShape()] Invalid shape:", shape);
  } else if (maxRing.length == 1) {
    internal.protectIslandRing(arcData, maxRing);
  } else {
    internal.protectMultiRing(arcData, maxRing);
  }
};

// Add two vertices to the ring to form a triangle.
// Assuming that this will inflate the ring.
// Consider using the function for multi-arc rings, which
//   calculates ring area...
internal.protectIslandRing = function(arcData, ring) {
  var added = internal.lockMaxThreshold(arcData, ring);
  if (added == 1) {
    added += internal.lockMaxThreshold(arcData, ring);
  }
  if (added < 2) verbose("[protectIslandRing()] Failed on ring:", ring);
};

internal.protectMultiRing = function(arcData, ring) {
  var zlim = arcData.getRetainedInterval(),
      minArea = 0, // 0.00000001, // Need to handle rounding error?
      area, added;
  arcData.setRetainedInterval(Infinity);
  area = geom.getPlanarPathArea(ring, arcData);
  while (area <= minArea) {
    added = internal.lockMaxThreshold(arcData, ring);
    if (added === 0) {
      verbose("[protectMultiRing()] Failed on ring:", ring);
      break;
    }
    area = geom.getPlanarPathArea(ring, arcData);
  }
  arcData.setRetainedInterval(zlim);
};

// Protect the vertex or vertices with the largest non-infinite
// removal threshold in a ring.
//
internal.lockMaxThreshold = function(arcData, ring) {
  var targZ = 0,
      targArcId,
      raw = arcData.getVertexData(),
      arcId, id, z,
      start, end;

  for (var i=0; i<ring.length; i++) {
    arcId = ring[i];
    if (arcId < 0) arcId = ~arcId;
    start = raw.ii[arcId];
    end = start + raw.nn[arcId] - 1;
    id = internal.findNextRemovableVertex(raw.zz, Infinity, start, end);
    if (id == -1) continue;
    z = raw.zz[id];
    if (z > targZ) {
      targZ = z;
      targArcId = arcId;
    }
  }
  if (targZ > 0) {
    // There may be more than one vertex with the target Z value; lock them all.
    start = raw.ii[targArcId];
    end = start + raw.nn[targArcId] - 1;
    return internal.replaceInArray(raw.zz, targZ, Infinity, start, end);
  }
  return 0;
};

internal.replaceInArray = function(zz, value, replacement, start, end) {
  var count = 0;
  for (var i=start; i<=end; i++) {
    if (zz[i] === value) {
      zz[i] = replacement;
      count++;
    }
  }
  return count;
};




// Import multiple files to a single dataset
internal.importFiles = function(files, opts) {
  var unbuiltTopology = false;
  var datasets = files.map(function(fname) {
    // import without topology or snapping
    var importOpts = utils.defaults({no_topology: true, auto_snap: false, snap_interval: null, files: [fname]}, opts);
    var dataset = api.importFile(fname, importOpts);
    // check if dataset contains non-topological paths
    // TODO: may also need to rebuild topology if multiple topojson files are merged
    if (dataset.arcs && dataset.arcs.size() > 0 && dataset.info.input_formats[0] != 'topojson') {
      unbuiltTopology = true;
    }
    return dataset;
  });
  var combined = internal.mergeDatasets(datasets);

  // Build topology, if needed
  // TODO: consider updating topology of TopoJSON files instead of concatenating arcs
  // (but problem of mismatched coordinates due to quantization in input files.)
  if (unbuiltTopology && !opts.no_topology) {
    // TODO: remove duplication with mapshaper-path-import.js; consider applying
    //   snapping option inside buildTopology()
    if (opts.auto_snap || opts.snap_interval) {
      internal.snapCoords(combined.arcs, opts.snap_interval);
    }
    api.buildTopology(combined);
  }
  return combined;
};




api.createPointLayer = function(srcLyr, arcs, opts) {
  var destLyr = internal.getOutputLayer(srcLyr, opts);
  if (opts.interpolated) {
    // TODO: consider making attributed points, including distance from origin
    destLyr.shapes = internal.interpolatedPointsFromVertices(srcLyr, arcs, opts);
  } else if (opts.vertices) {
    destLyr.shapes = internal.pointsFromVertices(srcLyr, arcs, opts);
  } else if (opts.x || opts.y) {
    destLyr.shapes = internal.pointsFromDataTable(srcLyr.data, opts);
  } else {
    destLyr.shapes = internal.pointsFromPolygons(srcLyr, arcs, opts);
  }
  destLyr.geometry_type = 'point';

  var nulls = destLyr.shapes.reduce(function(sum, shp) {
    if (!shp) sum++;
    return sum;
  }, 0);

  if (nulls > 0) {
    message(utils.format('%,d of %,d points are null', nulls, destLyr.shapes.length));
  }
  if (srcLyr.data) {
    destLyr.data = opts.no_replace ? srcLyr.data.clone() : srcLyr.data;
  }
  return destLyr;
};

internal.interpolatePoint2D = function(ax, ay, bx, by, k) {
  var j = 1 - k;
  return [ax * j + bx * k, ay * j + by * k];
};

internal.interpolatePointsAlongArc = function(ids, arcs, interval) {
  var iter = arcs.getShapeIter(ids);
  var distance = arcs.isPlanar() ? distance2D : greatCircleDistance;
  var coords = [];
  var elapsedDist = 0;
  var prevX, prevY;
  var segLen, k, p;
  if (iter.hasNext()) {
    coords.push([iter.x, iter.y]);
    prevX = iter.x;
    prevY = iter.y;
  }
  while (iter.hasNext()) {
    segLen = distance(prevX, prevY, iter.x, iter.y);
    while (elapsedDist + segLen >= interval) {
      k = (interval - elapsedDist) / segLen;
      // TODO: consider using great-arc distance for lat-long points
      p = internal.interpolatePoint2D(prevX, prevY, iter.x, iter.y, k);
      elapsedDist = 0;
      coords.push(p);
      prevX = p[0];
      prevY = p[1];
      segLen = distance(prevX, prevY, iter.x, iter.y);
    }
    elapsedDist += segLen;
    prevX = iter.x;
    prevY = iter.y;
  }
  if (elapsedDist > 0) {
    coords.push([prevX, prevY]);
  }
  return coords;
};

internal.interpolatedPointsFromVertices = function(lyr, arcs, opts) {
  var interval = opts.interval;
  var coords;
  if (interval > 0 === false) stop("Invalid interpolation interval:", interval);
  if (lyr.geometry_type != 'polyline') stop("Expected a polyline layer");
  return lyr.shapes.map(function(shp, shpId) {
    coords = [];
    if (shp) shp.forEach(nextPart);
    return coords.length > 0 ? coords : null;
  });
  function nextPart(ids) {
    var points = internal.interpolatePointsAlongArc(ids, arcs, interval);
    coords = coords.concat(points);
  }
};

internal.pointsFromVertices = function(lyr, arcs, opts) {
  var coords, index;
  if (lyr.geometry_type != "polygon" && lyr.geometry_type != 'polyline') {
    stop("Expected a polygon or polyline layer");
  }
  return lyr.shapes.map(function(shp, shpId) {
    coords = [];
    index = {}; // TODO: use more efficient index
    (shp || []).forEach(nextPart);
    return coords.length > 0 ? coords : null;
  });

  function nextPart(ids) {
    var iter = arcs.getShapeIter(ids);
    var key;
    while (iter.hasNext()) {
      key = iter.x + '~' + iter.y;
      if (key in index === false) {
        index[key] = true;
        coords.push([iter.x, iter.y]);
      }
    }
  }
};

internal.pointsFromPolygons = function(lyr, arcs, opts) {
  if (lyr.geometry_type != "polygon") {
    stop("Expected a polygon layer");
  }
  var func = opts.inner ? geom.findInteriorPoint : geom.getShapeCentroid;
  return lyr.shapes.map(function(shp) {
    var p = func(shp, arcs);
    return p ? [[p.x, p.y]] : null;
  });
};

internal.pointsFromDataTable = function(data, opts) {
  if (!data) stop("Layer is missing a data table");
  if (!opts.x || !opts.y || !data.fieldExists(opts.x) || !data.fieldExists(opts.y)) {
    stop("Missing x,y data fields");
  }

  return data.getRecords().map(function(rec) {
    var x = rec[opts.x],
        y = rec[opts.y];
    if (!utils.isFiniteNumber(x) || !utils.isFiniteNumber(y)) {
      return null;
    }
    return [[x, y]];
  });

};




api.pointGrid = function(dataset, opts) {
  var bbox, gridLyr;
  if (opts.bbox) {
    bbox = opts.bbox;
  } else if (dataset) {
    bbox = internal.getDatasetBounds(dataset).toArray();
  } else {
    bbox = [-180, -90, 180, 90];
  }
  return internal.createPointGrid(bbox, opts);
};

internal.createPointGrid = function(bbox, opts) {
  var w = bbox[2] - bbox[0],
      h = bbox[3] - bbox[1],
      points = [],
      cols, rows, dx, dy, x0, y0, x, y;

  if (opts.interval > 0) {
    dx = opts.interval;
    dy = opts.interval;
    cols = Math.round(w / dx) - 1;
    rows = Math.round(h / dy) - 1;
    x0 = bbox[0] + (w - cols * dx) / 2;
    y0 = bbox[1] + (h - rows * dy) / 2;
  } else if (opts.rows > 0 && opts.cols > 0) {
    cols = opts.cols;
    rows = opts.rows;
    dx = (w / cols);
    dy = (h / rows);
    x0 = bbox[0] + dx / 2;
    y0 = bbox[1] + dy / 2;
  }

  if (dx > 0 === false || dy > 0 === false) {
    stop('Invalid grid parameters');
  }

  y = y0;
  while (y <= bbox[3]) {
    x = x0;
    while (x <= bbox[2]) {
      points.push([[x, y]]);
      x += dx;
    }
    y += dy;
  }
  return {
    geometry_type: 'point',
    shapes: points
  };
};




internal.editArcs = function(arcs, onPoint) {
  var nn2 = [],
      xx2 = [],
      yy2 = [],
      n;

  arcs.forEach(function(arc, i) {
    editArc(arc, onPoint);
  });
  arcs.updateVertexData(nn2, xx2, yy2);

  function append(p) {
    xx2.push(p[0]);
    yy2.push(p[1]);
    n++;
  }

  function editArc(arc, cb) {
    var x, y, xp, yp;
    var i = 0;
    n = 0;
    while (arc.hasNext()) {
      x = arc.x;
      y = arc.y;
      cb(append, x, y, xp, yp, i++);
      xp = x;
      yp = y;
    }
    if (n == 1) { // invalid arc len
      error("An invalid arc was created");
    }
    nn2.push(n);
  }
};




api.proj = function(dataset, destInfo, opts) {
  // modify copy of coordinate data when running in web UI, so original shapes
  // are preserved if an error occurs
  var modifyCopy = !!api.gui,
      originals = [],
      target = {},
      src, dest;

  src = internal.getDatasetProjection(dataset);
  if (!src) {
    stop("Unable to project -- source coordinate system is unknown");
  }

  dest = destInfo.crs;
  if (!dest) {
    stop("Missing projection data");
  }
  if (internal.crsAreEqual(src, dest)) {
    message("Source and destination CRS are the same");
    return;
  }

  if (dataset.arcs) {
    dataset.arcs.flatten(); // bake in any pending simplification
    target.arcs = modifyCopy ? dataset.arcs.getCopy() : dataset.arcs;
  }

  target.layers = dataset.layers.filter(internal.layerHasPoints).map(function(lyr) {
    if (modifyCopy) {
      originals.push(lyr);
      lyr = utils.extend({}, lyr);
      lyr.shapes = internal.cloneShapes(lyr.shapes);
    }
    return lyr;
  });

  try {
    internal.projectDataset(target, src, dest, opts || {});
  } catch(e) {
    stop(utils.format("Projection failure%s (%s)",
      e.point ? ' at ' + e.point.join(' ') : '', e.message));
  }

  dataset.info.crs = dest;
  dataset.info.prj = destInfo.prj; // may be undefined
  dataset.arcs = target.arcs;
  originals.forEach(function(lyr, i) {
    // replace original layers with modified layers
    utils.extend(lyr, target.layers[i]);
  });
};


// @source: a layer identifier, .prj file or projection defn
// Converts layer ids and .prj files to projection defn
// Returns projection defn
internal.getProjectionInfo = function(name, catalog) {
  var dataset, sources, info = {};
  if (/\.prj$/i.test(name)) {
    dataset = api.importFile(name, {});
    if (dataset) {
      info.prj = dataset.info.prj;
      info.crs = internal.parsePrj(info.prj);
    }
  } else {
    sources = catalog.findCommandTargets(name);
    if (sources.length > 0) {
      dataset = sources[0].dataset;
      info.crs = internal.getDatasetProjection(dataset);
      info.prj = dataset.info.prj; // may be undefined
      // defn = internal.crsToProj4(P);
    } else {
      // assume name is a projection defn
      info.crs = internal.getProjection(name);
    }
  }
  return info;
};

internal.projectDataset = function(dataset, src, dest, opts) {
  var proj = internal.getProjTransform(src, dest);
  dataset.layers.forEach(function(lyr) {
    if (internal.layerHasPoints(lyr)) {
      internal.projectPointLayer(lyr, proj);
    }
  });
  if (dataset.arcs) {
    if (opts.densify) {
      internal.projectAndDensifyArcs(dataset.arcs, proj);
    } else {
      internal.projectArcs(dataset.arcs, proj);
    }
  }
};

internal.getProjTransform = function(src, dest) {
  var mproj = require('mproj');
  var clampSrc = src.is_latlong;
  return function(x, y) {
    var xy;
    if (clampSrc) {
      // snap lng to bounds
      if (x < -180) x = -180;
      else if (x > 180) x = 180;
    }
    xy = [x, y];
    mproj.pj_transform_point(src, dest, xy);
    return xy;
  };
};

internal.projectPointLayer = function(lyr, proj) {
  internal.forEachPoint(lyr.shapes, function(p) {
    var p2 = proj(p[0], p[1]);
    p[0] = p2[0];
    p[1] = p2[1];
  });
};

internal.projectArcs = function(arcs, proj) {
  var data = arcs.getVertexData(),
      xx = data.xx,
      yy = data.yy,
      // old simplification data  will not be optimal after reprojection;
      // re-using for now to avoid error in web ui
      zz = data.zz,
      p;

  for (var i=0, n=xx.length; i<n; i++) {
    p = proj(xx[i], yy[i]);
    xx[i] = p[0];
    yy[i] = p[1];
  }
  arcs.updateVertexData(data.nn, xx, yy, zz);
};

internal.getDefaultDensifyInterval = function(arcs, proj) {
  var xy = internal.getAvgSegment2(arcs),
      bb = arcs.getBounds(),
      a = proj(bb.centerX(), bb.centerY()),
      b = proj(bb.centerX() + xy[0], bb.centerY() + xy[1]);
  return distance2D(a[0], a[1], b[0], b[1]);
};

// Interpolate points into a projected line segment if needed to prevent large
//   deviations from path of original unprojected segment.
// @points (optional) array of accumulated points
internal.densifySegment = function(lng0, lat0, x0, y0, lng2, lat2, x2, y2, proj, interval, points) {
  // Find midpoint between two endpoints and project it (assumes longitude does
  // not wrap). TODO Consider bisecting along great circle path -- although this
  // would not be good for boundaries that follow line of constant latitude.
  var lng1 = (lng0 + lng2) / 2,
      lat1 = (lat0 + lat2) / 2,
      p = proj(lng1, lat1),
      distSq = geom.pointSegDistSq(p[0], p[1], x0, y0, x2, y2); // sq displacement
  points = points || [];
  // Bisect current segment if the projected midpoint deviates from original
  //   segment by more than the @interval parameter.
  //   ... but don't bisect very small segments to prevent infinite recursion
  //   (e.g. if projection function is discontinuous)
  if (distSq > interval * interval * 0.25 && distance2D(lng0, lat0, lng2, lat2) > 0.01) {
    internal.densifySegment(lng0, lat0, x0, y0, lng1, lat1, p[0], p[1], proj, interval, points);
    points.push(p);
    internal.densifySegment(lng1, lat1, p[0], p[1], lng2, lat2, x2, y2, proj, interval, points);
  }
  return points;
};

internal.projectAndDensifyArcs = function(arcs, proj) {
  var interval = internal.getDefaultDensifyInterval(arcs, proj);
  var p = [0, 0];
  internal.editArcs(arcs, onPoint);

  function onPoint(append, lng, lat, prevLng, prevLat, i) {
    var prevX = p[0],
        prevY = p[1];
    p = proj(lng, lat);
    // Don't try to optimize shorter segments (optimization)
    if (i > 0 && distanceSq(p[0], p[1], prevX, prevY) > interval * interval * 25) {
      internal.densifySegment(prevLng, prevLat, prevX, prevY, lng, lat, p[0], p[1], proj, interval)
        .forEach(append);
    }
    append(p);
  }
};




api.renameLayers = function(layers, names) {
  var nameCount = names && names.length || 0;
  var name = 'layer';
  var suffix = '';
  layers.forEach(function(lyr, i) {
    if (i < nameCount) {
      name = names[i];
    }
    if (nameCount < layers.length && (i >= nameCount - 1)) {
      suffix = (suffix || 0) + 1;
    }
    lyr.name = name + suffix;
  });
};




api.shape = function(source, opts) {
  var bounds, coords;
  if (source) {
    bounds = internal.getLayerBounds(source.layer, source.dataset.arcs);
  } else if (opts.bbox) {
    bounds = new Bounds(opts.bbox);
  }
  if (!bounds || !bounds.hasBounds()) {
    stop('Missing shape extent');
  }
  if (opts.offset > 0) {
    bounds.padBounds(opts.offset, opts.offset, opts.offset, opts.offset);
  }
  var geojson = internal.convertBboxToGeoJSON(bounds.toArray(), opts);
  var dataset = internal.importGeoJSON(geojson, {});
  dataset.layers[0].name = opts.name || 'shape';
  return dataset;
};

internal.convertBboxToGeoJSON = function(bbox, opts) {
  var coords = [[bbox[0], bbox[1]], [bbox[0], bbox[3]], [bbox[2], bbox[3]],
      [bbox[2], bbox[1]], [bbox[0], bbox[1]]];
  return {
    type: 'Polygon',
    coordinates: [coords]
  };
};




// A minheap data structure used for computing Visvalingam simplification data.
//
function Heap() {
  var heapBuf = utils.expandoBuffer(Int32Array),
      indexBuf = utils.expandoBuffer(Int32Array),
      itemsInHeap = 0,
      dataArr,
      heapArr,
      indexArr;

  this.init = function(values) {
    var i;
    dataArr = values;
    itemsInHeap = values.length;
    heapArr = heapBuf(itemsInHeap);
    indexArr = indexBuf(itemsInHeap);
    for (i=0; i<itemsInHeap; i++) {
      insertValue(i, i);
    }
    // place non-leaf items
    for (i=(itemsInHeap-2) >> 1; i >= 0; i--) {
      downHeap(i);
    }
  };

  this.size = function() {
    return itemsInHeap;
  };

  // Update a single value and re-heap
  this.updateValue = function(valIdx, val) {
    var heapIdx = indexArr[valIdx];
    dataArr[valIdx] = val;
    if (!(heapIdx >= 0 && heapIdx < itemsInHeap)) {
      error("Out-of-range heap index.");
    }
    downHeap(upHeap(heapIdx));
  };

  this.popValue = function() {
    return dataArr[this.pop()];
  };

  // Return the idx of the lowest-value item in the heap
  this.pop = function() {
    var popIdx;
    if (itemsInHeap <= 0) {
      error("Tried to pop from an empty heap.");
    }
    popIdx = heapArr[0];
    insertValue(0, heapArr[--itemsInHeap]); // move last item in heap into root position
    downHeap(0);
    return popIdx;
  };

  function upHeap(idx) {
    var parentIdx;
    // Move item up in the heap until it's at the top or is not lighter than its parent
    while (idx > 0) {
      parentIdx = (idx - 1) >> 1;
      if (greaterThan(idx, parentIdx)) {
        break;
      }
      swapItems(idx, parentIdx);
      idx = parentIdx;
    }
    return idx;
  }

  // Swap item at @idx with any lighter children
  function downHeap(idx) {
    var minIdx = compareDown(idx);

    while (minIdx > idx) {
      swapItems(idx, minIdx);
      idx = minIdx; // descend in the heap
      minIdx = compareDown(idx);
    }
  }

  function swapItems(a, b) {
    var i = heapArr[a];
    insertValue(a, heapArr[b]);
    insertValue(b, i);
  }

  // Associate a heap idx with the index of a value in data arr
  function insertValue(heapIdx, valId) {
    indexArr[valId] = heapIdx;
    heapArr[heapIdx] = valId;
  }

  // @a, @b: Indexes in @heapArr
  function greaterThan(a, b) {
    var idx1 = heapArr[a],
        idx2 = heapArr[b],
        val1 = dataArr[idx1],
        val2 = dataArr[idx2];
    // If values are equal, compare array indexes.
    // This is not a requirement of the Visvalingam algorithm,
    // but it generates output that matches Mahes Visvalingam's
    // reference implementation.
    // See https://hydra.hull.ac.uk/assets/hull:10874/content
    return (val1 > val2 || val1 === val2 && idx1 > idx2);
  }

  function compareDown(idx) {
    var a = 2 * idx + 1,
        b = a + 1,
        n = itemsInHeap;
    if (a < n && greaterThan(idx, a)) {
      idx = a;
    }
    if (b < n && greaterThan(idx, b)) {
      idx = b;
    }
    return idx;
  }
}




var Visvalingam = {};

Visvalingam.getArcCalculator = function(metric, is3D) {
  var heap = new Heap(),
      prevBuf = utils.expandoBuffer(Int32Array),
      nextBuf = utils.expandoBuffer(Int32Array),
      calc = is3D ?
        function(b, c, d, xx, yy, zz) {
          return metric(xx[b], yy[b], zz[b], xx[c], yy[c], zz[c], xx[d], yy[d], zz[d]);
        } :
        function(b, c, d, xx, yy) {
          return metric(xx[b], yy[b], xx[c], yy[c], xx[d], yy[d]);
        };

  // Calculate Visvalingam simplification data for an arc
  // @kk (Float64Array|Array) Receives calculated simplification thresholds
  // @xx, @yy, (@zz) Buffers containing vertex coordinates
  return function calcVisvalingam(kk, xx, yy, zz) {
    var arcLen = kk.length,
        prevArr = prevBuf(arcLen),
        nextArr = nextBuf(arcLen),
        val, maxVal = -Infinity,
        b, c, d; // indexes of points along arc

    if (zz && !is3D) {
      error("[visvalingam] Received z-axis data for 2D simplification");
    } else if (!zz && is3D) {
      error("[visvalingam] Missing z-axis data for 3D simplification");
    } else if (kk.length > xx.length) {
      error("[visvalingam] Incompatible data arrays:", kk.length, xx.length);
    }

    // Initialize Visvalingam "effective area" values and references to
    //   prev/next points for each point in arc.
    for (c=0; c<arcLen; c++) {
      b = c-1;
      d = c+1;
      if (b < 0 || d >= arcLen) {
        val = Infinity; // endpoint maxVals
      } else {
        val = calc(b, c, d, xx, yy, zz);
      }
      kk[c] = val;
      nextArr[c] = d;
      prevArr[c] = b;
    }
    heap.init(kk);

    // Calculate removal thresholds for each internal point in the arc
    //
    while (heap.size() > 0) {
      c = heap.pop(); // Remove the point with the least effective area.
      val = kk[c];
      if (val === Infinity) {
        break;
      }
      if (val < maxVal) {
        // don't assign current point a lesser value than the last removed vertex
        kk[c] = maxVal;
      } else {
        maxVal = val;
      }

      // Recompute effective area of neighbors of the removed point.
      b = prevArr[c];
      d = nextArr[c];
      if (b > 0) {
        val = calc(prevArr[b], b, d, xx, yy, zz);
        heap.updateValue(b, val);
      }
      if (d < arcLen-1) {
        val = calc(b, d, nextArr[d], xx, yy, zz);
        heap.updateValue(d, val);
      }
      nextArr[b] = d;
      prevArr[d] = b;
    }
  };
};

Visvalingam.standardMetric = triangleArea;
Visvalingam.standardMetric3D = triangleArea3D;

Visvalingam.getWeightedMetric = function(opts) {
  var weight = Visvalingam.getWeightFunction(opts);
  return function(ax, ay, bx, by, cx, cy) {
    var area = triangleArea(ax, ay, bx, by, cx, cy),
        cos = cosine(ax, ay, bx, by, cx, cy);
    return weight(cos) * area;
  };
};

Visvalingam.getWeightedMetric3D = function(opts) {
  var weight = Visvalingam.getWeightFunction(opts);
  return function(ax, ay, az, bx, by, bz, cx, cy, cz) {
    var area = triangleArea3D(ax, ay, az, bx, by, bz, cx, cy, cz),
        cos = cosine3D(ax, ay, az, bx, by, bz, cx, cy, cz);
    return weight(cos) * area;
  };
};

Visvalingam.getWeightCoefficient = function(opts) {
  return opts && utils.isNumber(opts && opts.weighting) ? opts.weighting : 0.7;
};

// Get a parameterized version of Visvalingam.weight()
Visvalingam.getWeightFunction = function(opts) {
  var k = Visvalingam.getWeightCoefficient(opts);
  return function(cos) {
    return -cos * k + 1;
  };
};

// Weight triangle area by inverse cosine
// Standard weighting favors 90-deg angles; this curve peaks at 120 deg.
Visvalingam.weight = function(cos) {
  var k = 0.7;
  return -cos * k + 1;
};

Visvalingam.getEffectiveAreaSimplifier = function(use3D) {
  var metric = use3D ? Visvalingam.standardMetric3D : Visvalingam.standardMetric;
  return Visvalingam.getPathSimplifier(metric, use3D);
};

Visvalingam.getWeightedSimplifier = function(opts, use3D) {
  var metric = use3D ? Visvalingam.getWeightedMetric3D(opts) : Visvalingam.getWeightedMetric(opts);
  return Visvalingam.getPathSimplifier(metric, use3D);
};

Visvalingam.getPathSimplifier = function(metric, use3D) {
  return Visvalingam.scaledSimplify(Visvalingam.getArcCalculator(metric, use3D));
};


Visvalingam.scaledSimplify = function(f) {
  return function(kk, xx, yy, zz) {
    f(kk, xx, yy, zz);
    for (var i=1, n=kk.length - 1; i<n; i++) {
      // convert area metric to a linear equivalent
      kk[i] = Math.sqrt(kk[i]) * 0.65;
    }
  };
};




var DouglasPeucker = {};

DouglasPeucker.metricSq3D = geom.pointSegDistSq3D;
DouglasPeucker.metricSq = geom.pointSegDistSq;

// @dest array to contain point removal thresholds
// @xx, @yy arrays of x, y coords of a path
// @zz (optional) array of z coords for spherical simplification
//
DouglasPeucker.calcArcData = function(dest, xx, yy, zz) {
  var len = dest.length,
      useZ = !!zz;

  dest[0] = dest[len-1] = Infinity;
  if (len > 2) {
    procSegment(0, len-1, 1, Number.MAX_VALUE);
  }

  function procSegment(startIdx, endIdx, depth, distSqPrev) {
    // get endpoint coords
    var ax = xx[startIdx],
        ay = yy[startIdx],
        cx = xx[endIdx],
        cy = yy[endIdx],
        az, cz;
    if (useZ) {
      az = zz[startIdx];
      cz = zz[endIdx];
    }

    var maxDistSq = 0,
        maxIdx = 0,
        distSqLeft = 0,
        distSqRight = 0,
        distSq;

    for (var i=startIdx+1; i<endIdx; i++) {
      if (useZ) {
        distSq = DouglasPeucker.metricSq3D(xx[i], yy[i], zz[i], ax, ay, az, cx, cy, cz);
      } else {
        distSq = DouglasPeucker.metricSq(xx[i], yy[i], ax, ay, cx, cy);
      }

      if (distSq >= maxDistSq) {
        maxDistSq = distSq;
        maxIdx = i;
      }
    }

    // Case -- threshold of parent segment is less than threshold of curr segment
    // Curr max point is assigned parent's threshold, so parent is not removed
    // before child as simplification is increased.
    //
    if (distSqPrev < maxDistSq) {
      maxDistSq = distSqPrev;
    }

    if (maxIdx - startIdx > 1) {
      distSqLeft = procSegment(startIdx, maxIdx, depth+1, maxDistSq);
    }
    if (endIdx - maxIdx > 1) {
      distSqRight = procSegment(maxIdx, endIdx, depth+1, maxDistSq);
    }

    // Case -- max point of curr segment is highest-threshold point of an island polygon
    // Give point the same threshold as the next-highest point, to prevent
    // a 3-vertex degenerate ring.
    if (depth == 1 && ax == cx && ay == cy) {
      maxDistSq = Math.max(distSqLeft, distSqRight);
    }

    dest[maxIdx] =  Math.sqrt(maxDistSq);
    return maxDistSq;
  }
};




// Remove line-segment intersections introduced by simplification by rolling
// back simplification along intersecting segments.
//
// Limitation of this method: it can't remove intersections that are present
// in the original dataset.
// TODO: don't roll back simplification for unrepairable intersections.
//
internal.postSimplifyRepair = function(arcs) {
  var intersections = internal.findSegmentIntersections(arcs),
      unfixable = internal.repairIntersections(arcs, intersections),
      countPre = intersections.length,
      countPost = unfixable.length,
      countFixed = countPre > countPost ? countPre - countPost : 0,
      msg;
  if (countPre > 0) {
    msg = utils.format("Repaired %'i intersection%s", countFixed,
        utils.pluralSuffix(countFixed));
    if (countPost > 0) {
      msg += utils.format("; %'i intersection%s could not be repaired", countPost,
          utils.pluralSuffix(countPost));
    }
    message(msg);
  }
};

// @intersections (Array) Output from internal.findSegmentIntersections()
// Returns array of unresolved intersections, or empty array if none.
//
internal.repairIntersections = function(arcs, intersections) {
  while (internal.unwindIntersections(arcs, intersections) > 0) {
    intersections = internal.findSegmentIntersections(arcs);
  }
  return intersections;
};

internal.unwindIntersections = function(arcs, intersections) {
  var data = arcs.getVertexData(),
      zlim = arcs.getRetainedInterval(),
      changes = 0,
      loops = 0,
      replacements, queue, target, i;

  // create a queue of unwind targets
  queue = internal.getUnwindTargets(intersections, zlim, data.zz);
  utils.sortOn(queue, 'z', !!"ascending");

  while (queue.length > 0) {
    target = queue.pop();
    // redetect unwind target, in case a previous unwind operation has changed things
    // TODO: don't redetect if target couldn't have been affected
    replacements = internal.redetectIntersectionTarget(target, zlim, data.xx, data.yy, data.zz);
    if (replacements.length == 1) {
      replacements = internal.unwindIntersection(replacements[0], zlim, data.zz);
      changes++;
    } else  {
      // either 0 or multiple intersections detected
    }

    for (i=0; i<replacements.length; i++) {
      internal.insertUnwindTarget(queue, replacements[i]);
    }
  }
  if (++loops > 500000) {
    verbose("Caught an infinite loop at intersection:", target);
    return 0;
  }
  return changes;
};

internal.getUnwindTargets = function(intersections, zlim, zz) {
  return intersections.reduce(function(memo, o) {
    var target = internal.getUnwindTarget(o, zlim, zz);
    if (target !== null) {
      memo.push(target);
    }
    return memo;
  }, []);
};

// @o an intersection object
// returns null if no vertices can be added along both segments
// else returns an object with properties:
//   a: intersecting segment to be partitioned
//   b: intersecting segment to be retained
//   z: threshold value of one or more points along [a] to be re-added
internal.getUnwindTarget = function(o, zlim, zz) {
  var ai = internal.findNextRemovableVertex(zz, zlim, o.a[0], o.a[1]),
      bi = internal.findNextRemovableVertex(zz, zlim, o.b[0], o.b[1]),
      targ;
  if (ai == -1 && bi == -1) {
    targ = null;
  } else if (bi == -1 || ai != -1 && zz[ai] > zz[bi]) {
    targ = {
      a: o.a,
      b: o.b,
      z: zz[ai]
    };
  } else {
    targ = {
      a: o.b,
      b: o.a,
      z: zz[bi]
    };
  }
  return targ;
};

// Insert an intersection into sorted position
internal.insertUnwindTarget = function(arr, obj) {
  var ins = arr.length;
  while (ins > 0) {
    if (arr[ins-1].z <= obj.z) {
      break;
    }
    arr[ins] = arr[ins-1];
    ins--;
  }
  arr[ins] = obj;
};

// Partition one of two intersecting segments by setting the removal threshold
// of vertices indicated by @target equal to @zlim (the current simplification
// level of the ArcCollection)
internal.unwindIntersection = function(target, zlim, zz) {
  var replacements = [];
  var start = target.a[0],
      end = target.a[1],
      z = target.z;
  for (var i = start + 1; i <= end; i++) {
    if (zz[i] == z || i == end) {
      replacements.push({
        a: [start, i],
        b: target.b,
        z: z
      });
      if (i != end) zz[i] = zlim;
      start = i;
    }
  }
  if (replacements.length < 2) error("Error in unwindIntersection()");
  return replacements;
};

internal.redetectIntersectionTarget = function(targ, zlim, xx, yy, zz) {
  var segIds = internal.getIntersectionCandidates(targ, zlim, xx, yy, zz);
  var intersections = internal.intersectSegments(segIds, xx, yy);
  return internal.getUnwindTargets(intersections, zlim, zz);
};

internal.getIntersectionCandidates = function(o, zlim, xx, yy, zz) {
  var segIds = internal.getSegmentVertices(o.a, zlim, xx, yy, zz);
  segIds = segIds.concat(internal.getSegmentVertices(o.b, zlim, xx, yy, zz));
  return segIds;
};

// Get all segments defined by two endpoints and the vertices between
// them that are at or above the current simplification threshold.
// TODO: test intersections with identical start + end ids
internal.getSegmentVertices = function(seg, zlim, xx, yy, zz) {
  var start, end, prev, ids = [];
  if (seg[0] <= seg[1]) {
    start = seg[0];
    end = seg[1];
  } else {
    start = seg[1];
    end = seg[0];
  }
  prev = start;
  for (var i=start+1; i<=end; i++) {
    if (zz[i] >= zlim) {
      if (xx[prev] < xx[i]) {
        ids.push(prev, i);
      } else {
        ids.push(i, prev);
      }
      prev = i;
    }
  }
  return ids;
};




internal.calcSimplifyStats = function(arcs, use3D) {
  var distSq = use3D ? pointSegGeoDistSq : geom.pointSegDistSq,
      calcAngle = use3D ? geom.signedAngleSph : geom.signedAngle,
      removed = 0,
      retained = 0,
      collapsedRings = 0,
      max = 0,
      sum = 0,
      sumSq = 0,
      iprev = -1,
      jprev = -1,
      measures = [],
      angles = [],
      zz = arcs.getVertexData().zz,
      count, stats;

  arcs.forEachSegment(function(i, j, xx, yy) {
    var ax, ay, bx, by, d2, d, skipped, angle, tmp;
    ax = xx[i];
    ay = yy[i];
    bx = xx[j];
    by = yy[j];

    if (i == jprev) {
      angle = calcAngle(xx[iprev], yy[iprev], ax, ay, bx, by);
      if (angle > Math.PI) angle = 2 * Math.PI - angle;
      if (!isNaN(angle)) {
        angles.push(angle * 180 / Math.PI);
      }
    }
    iprev = i;
    jprev = j;

    if (zz[i] < Infinity) {
      retained++;
    }
    skipped = j - i - 1;
    if (skipped < 1) return;
    removed += skipped;

    if (ax == bx && ay == by) {
      collapsedRings++;
    } else {
      d2 = 0;
      while (++i < j) {
        tmp = distSq(xx[i], yy[i], ax, ay, bx, by);
        d2 = Math.max(d2, tmp);
      }
      sumSq += d2;
      d = Math.sqrt(d2);
      sum += d;
      measures.push(d);
      max = Math.max(max, d);
    }
  });

  function pointSegGeoDistSq(alng, alat, blng, blat, clng, clat) {
    var xx = [], yy = [], zz = [];
    geom.convLngLatToSph([alng, blng, clng], [alat, blat, clat], xx, yy, zz);
    return geom.pointSegDistSq3D(xx[0], yy[0], zz[0], xx[1], yy[1], zz[1],
          xx[2], yy[2], zz[2]);
  }

  stats = {
    angleMean: 0,
    displacementMean: 0,
    displacementMax: max,
    collapsedRings: collapsedRings,
    removed: removed,
    retained: retained,
    uniqueCount: internal.countUniqueVertices(arcs),
    removableCount: removed + retained
  };

  if (angles.length > 0) {
    // stats.medianAngle = utils.findMedian(angles);
    stats.angleMean = utils.sum(angles) / angles.length;
    // stats.lt30 = utils.findRankByValue(angles, 30) / angles.length * 100;
    // stats.lt45 = utils.findRankByValue(angles, 45) / angles.length * 100;
    // stats.lt60 = utils.findRankByValue(angles, 60) / angles.length * 100;
    // stats.lt90 = utils.findRankByValue(angles, 90) / angles.length * 100;
    // stats.lt120 = utils.findRankByValue(angles, 120) / angles.length * 100;
    // stats.lt135 = utils.findRankByValue(angles, 135) / angles.length * 100;
    stats.angleQuartiles = [
      utils.findValueByPct(angles, 0.75),
      utils.findValueByPct(angles, 0.5),
      utils.findValueByPct(angles, 0.25)
    ];
  }

  if (measures.length > 0) {
    stats.displacementMean = sum / measures.length;
    // stats.median = utils.findMedian(measures);
    // stats.stdDev = Math.sqrt(sumSq / measures.length);
    stats.displacementQuartiles = [
      utils.findValueByPct(measures, 0.75),
      utils.findValueByPct(measures, 0.5),
      utils.findValueByPct(measures, 0.25)
    ];
  }
  return stats;
};

internal.countUniqueVertices = function(arcs) {
  // TODO: exclude any zero-length arcs
  var endpoints = arcs.size() * 2;
  var nodes = new NodeCollection(arcs).size();
  return arcs.getPointCount() - endpoints + nodes;
};





internal.getSimplifyMethodLabel = function(slug) {
  return {
    dp: "Ramer-Douglas-Peucker",
    visvalingam: "Visvalingam",
    weighted_visvalingam: "Weighted Visvalingam"
  }[slug] || "Unknown";
};

internal.printSimplifyInfo = function(arcs, opts) {
  var method = internal.getSimplifyMethod(opts);
  var name = internal.getSimplifyMethodLabel(method);
  var spherical = internal.useSphericalSimplify(arcs, opts);
  var stats = internal.calcSimplifyStats(arcs, spherical);
  var pct1 = (stats.removed + stats.collapsedRings) / stats.uniqueCount || 0;
  var pct2 = stats.removed / stats.removableCount || 0;
  var aq = stats.angleQuartiles;
  var dq = stats.displacementQuartiles;
  var lines = ["Simplification statistics"];
  lines.push(utils.format("Method: %s (%s) %s", name, spherical ? 'spherical' : 'planar',
      method == 'weighted_visvalingam' ? '(weighting=' + Visvalingam.getWeightCoefficient(opts) + ')' : ''));
  lines.push(utils.format("Removed vertices: %,d", stats.removed + stats.collapsedRings));
  lines.push(utils.format("   %.1f% of %,d unique coordinate locations", pct1 * 100, stats.uniqueCount));
  lines.push(utils.format("   %.1f% of %,d filterable coordinate locations", pct2 * 100, stats.removableCount));
  lines.push(utils.format("Simplification threshold: %.4f %s", arcs.getRetainedInterval(),
      spherical ? 'meters' : ''));
  lines.push(utils.format("Collapsed rings: %,d", stats.collapsedRings));
  lines.push("Displacement statistics");
  lines.push(utils.format("   Mean displacement: %.4f", stats.displacementMean));
  lines.push(utils.format("   Max displacement: %.4f", stats.displacementMax));
  if (dq) {
    lines.push(utils.format("   Quartiles: %.2f, %.2f, %.2f", dq[0], dq[1], dq[2]));
  }
  lines.push("Vertex angle statistics");
  lines.push(utils.format("   Mean angle: %.2f degrees", stats.angleMean));
  // lines.push(utils.format("   Angles < 45: %.2f%", stats.lt45));
  if (aq) {
    lines.push(utils.format("   Quartiles: %.2f, %.2f, %.2f", aq[0], aq[1], aq[2]));
  }

  message(lines.join('\n   '));
};




api.simplify = function(dataset, opts) {
  var arcs = dataset.arcs;
  if (!arcs) stop("Missing path data");
  // standardize options
  opts = internal.getStandardSimplifyOpts(dataset, opts);
  // stash simplifcation options (used by gui settings dialog)
  dataset.info = utils.defaults({simplify: opts}, dataset.info);

  internal.simplifyPaths(arcs, opts);

  if (opts.percentage) {
    arcs.setRetainedPct(utils.parsePercent(opts.percentage));
  } else if (utils.isNumber(opts.interval)) {
    arcs.setRetainedInterval(opts.interval);
  } else if (opts.resolution) {
    arcs.setRetainedInterval(internal.calcSimplifyInterval(arcs, opts));
  }

  if (opts.keep_shapes) {
    api.keepEveryPolygon(arcs, dataset.layers);
  }

  if (!opts.no_repair && arcs.getRetainedInterval() > 0) {
    internal.postSimplifyRepair(arcs);
  }

  if (opts.stats) {
    internal.printSimplifyInfo(arcs, opts);
  }
};

internal.getStandardSimplifyOpts = function(dataset, opts) {
  opts = opts || {};
  return utils.defaults({
    method: internal.getSimplifyMethod(opts),
    spherical: internal.useSphericalSimplify(dataset.arcs, opts)
  }, opts);
};

internal.useSphericalSimplify = function(arcs, opts) {
  return !opts.planar && !arcs.isPlanar();
};

// Calculate simplification thresholds for each vertex of an arc collection
// (modifies @arcs ArcCollection in-place)
internal.simplifyPaths = function(arcs, opts) {
  var simplifyPath = internal.getSimplifyFunction(opts);
  arcs.setThresholds(new Float64Array(arcs.getPointCount())); // Create array to hold simplification data
  if (opts.spherical) {
    internal.simplifyPaths3D(arcs, simplifyPath);
    internal.protectWorldEdges(arcs);
  } else {
    internal.simplifyPaths2D(arcs, simplifyPath);
  }
  if (opts.lock_box) {
    internal.protectContentEdges(arcs);
  }
};

internal.simplifyPaths2D = function(arcs, simplify) {
  arcs.forEach3(function(xx, yy, kk, i) {
    simplify(kk, xx, yy);
  });
};

internal.simplifyPaths3D = function(arcs, simplify) {
  var xbuf = utils.expandoBuffer(Float64Array),
      ybuf = utils.expandoBuffer(Float64Array),
      zbuf = utils.expandoBuffer(Float64Array);
  arcs.forEach3(function(xx, yy, kk, i) {
    var n = xx.length,
        xx2 = xbuf(n),
        yy2 = ybuf(n),
        zz2 = zbuf(n);
    geom.convLngLatToSph(xx, yy, xx2, yy2, zz2);
    simplify(kk, xx2, yy2, zz2);
  });
};

internal.getSimplifyMethod = function(opts) {
  var m = opts.method;
  if (!m || m == 'weighted' || m == 'visvalingam' && opts.weighting) {
    m =  'weighted_visvalingam';
  }
  return m;
};

internal.getSimplifyFunction = function(opts) {
  var f;
  if (opts.method == 'dp') {
    f = DouglasPeucker.calcArcData;
  } else if (opts.method == 'visvalingam') {
    f = Visvalingam.getEffectiveAreaSimplifier(opts.spherical);
  } else if (opts.method == 'weighted_visvalingam') {
    f = Visvalingam.getWeightedSimplifier(opts, opts.spherical);
  } else {
    stop('Unsupported simplify method:', method);
  }
  return f;
};

internal.protectContentEdges = function(arcs) {
  var e = 1e-14;
  var bb = arcs.getBounds();
  bb.padBounds(-e, -e, -e, -e);
  internal.limitSimplificationExtent(arcs, bb.toArray(), true);
};

// @hardLimit
//    true: never remove edge vertices
//    false: never remove before other vertices
internal.limitSimplificationExtent = function(arcs, bb, hardLimit) {
  var arcBounds = arcs.getBounds().toArray();
  // return if content doesn't reach edges
  if (containsBounds(bb, arcBounds) === true) return;
  arcs.forEach3(function(xx, yy, zz) {
    var lockZ = hardLimit ? Infinity : 0,
    x, y;
    for (var i=0, n=zz.length; i<n; i++) {
      x = xx[i];
      y = yy[i];
      if (x >= bb[2] || x <= bb[0] || y <= bb[1] || y >= bb[3]) {
        if (lockZ === 0) {
          lockZ = internal.findMaxThreshold(zz);
        }
        if (zz[i] !== Infinity) { // don't override lock value
          zz[i] = lockZ;
        }
      }
    }
  });
};

// Protect polar coordinates and coordinates at the prime meridian from
// being removed before other points in a path.
// Assume: coordinates are in decimal degrees
//
internal.protectWorldEdges = function(arcs) {
  // Need to handle coords with rounding errors:
  // -179.99999999999994 in test/test_data/ne/ne_110m_admin_0_scale_rank.shp
  // 180.00000000000003 in ne/ne_50m_admin_0_countries.shp
  internal.limitSimplificationExtent(arcs, internal.getWorldBounds(1e-12), false);
};

// Return largest value in an array, ignoring Infinity (lock value)
//
internal.findMaxThreshold = function(zz) {
  var z, maxZ = 0;
  for (var i=0, n=zz.length; i<n; i++) {
    z = zz[i];
    if (z > maxZ && z < Infinity) {
      maxZ = z;
    }
  }
  return maxZ;
};

internal.parseSimplifyResolution = function(raw) {
  var parts, w, h;
  if (utils.isNumber(raw)) {
    w = raw;
    h = raw;
  }
  else if (utils.isString(raw)) {
    parts = raw.split('x');
    w = Number(parts[0]) || 0;
    h = parts.length == 2 ? Number(parts[1]) || 0 : w;
  }
  if (!(w >= 0 && h >= 0 && w + h > 0)) {
    stop("Invalid simplify resolution:", raw);
  }
  return [w, h]; // TODO: validate;
};

internal.calcPlanarInterval = function(xres, yres, width, height) {
  var fitWidth = xres !== 0 && width / height > xres / yres || yres === 0;
  return fitWidth ? width / xres : height / yres;
};

// Calculate a simplification interval for unprojected data, given an output resolution
// (This is approximate, since we don't know how the data will be projected for display)
internal.calcSphericalInterval = function(xres, yres, bounds) {
  // Using length of arc along parallel through center of bbox as content width
  // TODO: consider using great circle instead of parallel arc to calculate width
  //    (doesn't work if width of bbox is greater than 180deg)
  var width = geom.degreesToMeters(bounds.width()) * Math.cos(bounds.centerY() * geom.D2R);
  var height = geom.degreesToMeters(bounds.height());
  return internal.calcPlanarInterval(xres, yres, width, height);
};

internal.calcSimplifyInterval = function(arcs, opts) {
  var res, interval, bounds;
  if (opts.interval) {
    interval = opts.interval;
  } else if (opts.resolution) {
    res = internal.parseSimplifyResolution(opts.resolution);
    bounds = arcs.getBounds();
    if (internal.useSphericalSimplify(arcs, opts)) {
      interval = internal.calcSphericalInterval(res[0], res[1], bounds);
    } else {
      interval = internal.calcPlanarInterval(res[0], res[1], bounds.width(), bounds.height());
    }
    // scale interval to double the resolution (single-pixel resolution creates
    //  visible artefacts)
    interval *= 0.5;
  }
  return interval;
};




// Split the shapes in a layer according to a grid
// Return array of layers. Use -o bbox-index option to create index
//
api.splitLayerOnGrid = function(lyr, arcs, opts) {
  var shapes = lyr.shapes,
      type = lyr.geometry_type,
      setId = !!opts.id_field, // assign id but, don't split to layers
      fieldName = opts.id_field || "__split__",
      classify = getShapeClassifier(internal.getLayerBounds(lyr, arcs), opts.cols, opts.rows),
      properties, layers;

  if (!type) {
    stop("Layer has no geometry");
  }

  if (!lyr.data) {
    lyr.data = new DataTable(shapes.length);
  }
  properties = lyr.data.getRecords();

  lyr.shapes.forEach(function(shp, i) {
    var bounds = type == 'point' ? internal.getPointBounds([shp]) : arcs.getMultiShapeBounds(shp);
    var name = bounds.hasBounds() ? classify(bounds) : '';
    var rec = properties[i] = properties[i] || {};
    rec[fieldName] = name;
  });

  if (setId) return lyr; // don't split layer (instead assign cell ids)

  return api.splitLayer(lyr, fieldName).filter(function(lyr) {
    var name = lyr.data.getRecordAt(0)[fieldName];
    lyr.name = name;
    lyr.data.deleteField(fieldName);
    return !!name;
  });

  function getShapeClassifier(bounds, cols, rows) {
    var xmin = bounds.xmin,
        ymin = bounds.ymin,
        w = bounds.width(),
        h = bounds.height();

    if (rows > 0 === false || cols > 0 === false) {
      stop('Invalid grid parameters');
    }

    if (w > 0 === false || h > 0 === false) {
      cols = 1;
      rows = 1;
    }

    return function(bounds) {
      var c = Math.floor((bounds.centerX() - xmin) / w * cols),
          r = Math.floor((bounds.centerY() - ymin) / h * rows);
      c = utils.clamp(c, 0, cols-1) || 0;
      r = utils.clamp(r, 0, rows-1) || 0;
      return "r" + r + "c" + c;
    };
  }
};




// Recursively divide a layer into two layers until a (compiled) expression
// no longer returns true. The original layer is split along the long side of
// its bounding box, so that each split-off layer contains half of the original
// shapes (+/- 1).
//
api.subdivideLayer = function(lyr, arcs, exp) {
  return internal.subdivide(lyr, arcs, exp);
};

internal.subdivide = function(lyr, arcs, exp) {
  var divide = internal.evalCalcExpression(lyr, arcs, exp),
      subdividedLayers = [],
      tmp, bounds, lyr1, lyr2;

  if (!utils.isBoolean(divide)) {
    stop("Expression must evaluate to true or false");
  }
  if (divide) {
    bounds = internal.getLayerBounds(lyr, arcs);
    tmp = internal.divideLayer(lyr, arcs, bounds);
    lyr1 = tmp[0];
    if (lyr1.shapes.length > 1 && lyr1.shapes.length < lyr.shapes.length) {
      utils.merge(subdividedLayers, internal.subdivide(lyr1, arcs, exp));
    } else {
      subdividedLayers.push(lyr1);
    }

    lyr2 = tmp[1];
    if (lyr2.shapes.length > 1 && lyr2.shapes.length < lyr.shapes.length) {
      utils.merge(subdividedLayers, internal.subdivide(lyr2, arcs, exp));
    } else {
      subdividedLayers.push(lyr2);
    }
  } else {
    subdividedLayers.push(lyr);
  }

  subdividedLayers.forEach(function(lyr2, i) {
    lyr2.name = internal.getSplitLayerName(lyr.name || 'split', i + 1);
    utils.defaults(lyr2, lyr);
  });
  return subdividedLayers;
};

// split one layer into two layers containing the same number of shapes (+-1),
// either horizontally or vertically
//
internal.divideLayer = function(lyr, arcs, bounds) {
  var properties = lyr.data ? lyr.data.getRecords() : null,
      shapes = lyr.shapes,
      lyr1, lyr2;
  lyr1 = {
    geometry_type: lyr.geometry_type,
    shapes: [],
    data: properties ? [] : null
  };
  lyr2 = {
    geometry_type: lyr.geometry_type,
    shapes: [],
    data: properties ? [] : null
  };

  var useX = bounds && bounds.width() > bounds.height();
  // TODO: think about case where there are null shapes with NaN centers
  var centers = shapes.map(function(shp) {
    var bounds = arcs.getMultiShapeBounds(shp);
    return useX ? bounds.centerX() : bounds.centerY();
  });
  var ids = utils.range(centers.length);
  ids.sort(function(a, b) {
    return centers[a] - centers[b];
  });
  ids.forEach(function(shapeId, i) {
    var dest = i < shapes.length / 2 ? lyr1 : lyr2;
    dest.shapes.push(shapes[shapeId]);
    if (properties) {
      dest.data.push(properties[shapeId]);
    }
  });

  if (properties) {
    lyr1.data = new DataTable(lyr1.data);
    lyr2.data = new DataTable(lyr2.data);
  }
  return [lyr1, lyr2];
};




api.sortFeatures = function(lyr, arcs, opts) {
  var n = internal.getFeatureCount(lyr),
      ascending = !opts.descending,
      compiled = internal.compileValueExpression(opts.expression, lyr, arcs),
      values = [];

  utils.repeat(n, function(i) {
    values.push(compiled(i));
  });

  var ids = utils.getSortedIds(values, ascending);
  if (lyr.shapes) {
    utils.reorderArray(lyr.shapes, ids);
  }
  if (lyr.data) {
    utils.reorderArray(lyr.data.getRecords(), ids);
  }
};




internal.target = function(catalog, opts) {
  var type = (opts.type || '').toLowerCase().replace('linestring', 'polyline');
  var targets = catalog.findCommandTargets(opts.target || '*', type);
  var target = targets[0];
  if (type && 'polygon,polyline,point'.split(',').indexOf(type) == -1) {
    stop("Invalid layer type:", opts.type);
  }
  if (!target || target.layers.length === 0) {
    stop("Target not found (" + pattern + ")");
  } else if (targets.length > 1 || target.layers.length > 1) {
    stop("Matched more than one layer");
  }
  if (opts.name) {
    target.layers[0].name = opts.name;
  }
  catalog.setDefaultTarget(target.layers, target.dataset);
};




api.uniq = function(lyr, arcs, opts) {
  var n = internal.getFeatureCount(lyr),
      compiled = internal.compileValueExpression(opts.expression, lyr, arcs),
      index = {},
      flags = [],
      verbose = !!opts.verbose,
      records = lyr.data ? lyr.data.getRecords() : null,
      f = function(d, i) {return !flags[i];};

  utils.repeat(n, function(i) {
    var val = compiled(i);
    flags[i] = val in index;
    if (verbose && index[val]) {
      message(utils.format('Removing feature %i key: [%s]', i, val));
    }
    index[val] = true;
  });

  if (lyr.shapes) {
    lyr.shapes = lyr.shapes.filter(f);
  }
  if (records) {
    lyr.data = new DataTable(records.filter(f));
  }
  if (opts.verbose !== false) {
    message(utils.format('Retained %,d of %,d features', internal.getFeatureCount(lyr), n));
  }
};




// TODO: consider refactoring to allow modules
// @cmd  example: {name: "dissolve", options:{field: "STATE"}}
// @catalog: Catalog object
// @done callback: function(err, catalog)
//
api.runCommand = function(cmd, catalog, cb) {
  var name = cmd.name,
      opts = cmd.options,
      source,
      outputLayers,
      outputFiles,
      targets,
      targetDataset,
      targetLayers,
      arcs;
  internal.CURR_CMD = name;

  try { // catch errors from synchronous functions

    T.start();
    if (!catalog) catalog = new Catalog();

    if (name == 'rename-layers') {
      // default target is all layers
      targets = catalog.findCommandTargets(opts.target || '*');
      targetLayers = targets.reduce(function(memo, obj) {
        return memo.concat(obj.layers);
      }, []);

    } else if (name == 'o') {
      // when combining GeoJSON layers, default is all layers
      // TODO: check that combine_layers is only used w/ GeoJSON output
      targets = catalog.findCommandTargets(opts.target || opts.combine_layers && '*');
    } else if (name == 'proj') {
      // accepts multiple target datasets
      targets = catalog.findCommandTargets(opts.target);
    } else {
      targets = catalog.findCommandTargets(opts.target);
      if (targets.length == 1) {
        targetDataset = targets[0].dataset;
        arcs = targetDataset.arcs;
        targetLayers = targets[0].layers;
        // target= option sets default target
        catalog.setDefaultTarget(targetLayers, targetDataset);

      } else if (targets.length > 1) {
        stop("Targetting multiple datasets is not supported");
      }
    }

    if (targets.length === 0) {
      if (opts.target) {
        stop(utils.format('Missing target: %s\nAvailable layers: %s',
            opts.target, internal.getFormattedLayerList(catalog)));
      }
      if (!(name == 'help' || name == 'graticule' || name == 'i' || name == 'point-grid' || name == 'shape')) {
        throw new APIError("Missing a -i command");
      }
    }

    if (opts.source) {
      source = internal.findCommandSource(opts.source, catalog, opts);
    }

    if (name == 'affine') {
      api.affine(targetLayers, targetDataset, opts);

    } else if (name == 'data-fill') {
      internal.applyCommand(api.dataFill, targetLayers, arcs, opts);

    } else if (name == 'cluster') {
      internal.applyCommand(api.cluster, targetLayers, arcs, opts);

    } else if (name == 'calc') {
      internal.applyCommand(api.calc, targetLayers, arcs, opts);

    } else if (name == 'clean') {
      api.cleanLayers(targetLayers, targetDataset, opts);

    } else if (name == 'clean2') {
      outputLayers = api.clean2(targetLayers, targetDataset, opts);

    } else if (name == 'clip') {
      outputLayers = api.clipLayers(targetLayers, source, targetDataset, opts);

    } else if (name == 'colorizer') {
      outputLayers = api.colorizer(opts);

    } else if (name == 'dissolve') {
      outputLayers = internal.applyCommand(api.dissolve, targetLayers, arcs, opts);

    } else if (name == 'dissolve2') {
      outputLayers = api.dissolve2(targetLayers, targetDataset, opts);
      //outputLayers = internal.applyCommand(api.dissolve2, targetLayers, dataset, opts);

    } else if (name == 'each') {
      internal.applyCommand(api.evaluateEachFeature, targetLayers, arcs, opts.expression, opts);

    } else if (name == 'erase') {
      outputLayers = api.eraseLayers(targetLayers, source, targetDataset, opts);

    } else if (name == 'explode') {
      outputLayers = internal.applyCommand(api.explodeFeatures, targetLayers, arcs, opts);

    } else if (name == 'filter') {
      outputLayers = internal.applyCommand(api.filterFeatures, targetLayers, arcs, opts);

    } else if (name == 'filter-fields') {
      internal.applyCommand(api.filterFields, targetLayers, opts.fields);

    } else if (name == 'filter-islands') {
      internal.applyCommand(api.filterIslands, targetLayers, arcs, opts);

    } else if (name == 'filter-slivers') {
      internal.applyCommand(api.filterSlivers, targetLayers, arcs, opts);

    } else if (name == 'graticule') {
      catalog.addDataset(api.graticule(targetDataset, opts));

    } else if (name == 'help') {
      internal.getOptionParser().printHelp(opts.command);

    } else if (name == 'i') {
      if (opts.replace) catalog = new Catalog();
      targetDataset = api.importFiles(cmd.options);
      if (targetDataset) {
        catalog.addDataset(targetDataset);
        outputLayers = targetDataset.layers; // kludge to allow layer naming below
      }

    } else if (name == 'info') {
      internal.printInfo(catalog.getLayers());

    } else if (name == 'inspect') {
      internal.applyCommand(api.inspect, targetLayers, arcs, opts);

    } else if (name == 'innerlines') {
      outputLayers = internal.applyCommand(api.innerlines, targetLayers, arcs, opts);

    } else if (name == 'join') {
      internal.applyCommand(api.join, targetLayers, targetDataset, source, opts);

    } else if (name == 'lines') {
      outputLayers = internal.applyCommand(api.lines, targetLayers, arcs, opts);

    } else if (name == 'merge-layers') {
      // careful, returned layers are modified input layers
      if (!opts.target) {
        targetLayers = targetDataset.layers; // kludge
      }
      outputLayers = api.mergeLayers(targetLayers);

    } else if (name == 'o') {
      outputFiles = internal.exportTargetLayers(targets, opts);
      if (opts.final) {
        // don't propagate data if output is final
        catalog = null;
      }
      return internal.writeFiles(outputFiles, opts, done);

    } else if (name == 'point-grid') {
      outputLayers = [api.pointGrid(targetDataset, opts)];
      if (!targetDataset) {
        catalog.addDataset({layers: outputLayers});
      }
    } else if (name == 'points') {
      outputLayers = internal.applyCommand(api.createPointLayer, targetLayers, arcs, opts);

    } else if (name == 'proj') {
      targets.forEach(function(targ) {
        var srcInfo, destInfo;
        if (opts.from) {
          srcInfo = internal.getProjectionInfo(opts.from, catalog);
          if (!srcInfo.crs) stop("Unknown projection source:", opts.from);
          internal.setDatasetProjection(targ.dataset, srcInfo);
        }
        if (opts.match || opts.projection) {
          destInfo = internal.getProjectionInfo(opts.match || opts.projection, catalog);
          api.proj(targ.dataset, destInfo, opts);
        }
      });

    } else if (name == 'rename-fields') {
      internal.applyCommand(api.renameFields, targetLayers, opts.fields);

    } else if (name == 'rename-layers') {
      api.renameLayers(targetLayers, opts.names);

    } else if (name == 'shape') {
      catalog.addDataset(api.shape(source, opts));

    } else if (name == 'simplify') {
      api.simplify(targetDataset, opts);

    } else if (name == 'slice') {
      outputLayers = api.sliceLayers(targetLayers, source, targetDataset, opts);

    } else if (name == 'sort') {
      internal.applyCommand(api.sortFeatures, targetLayers, arcs, opts);

    } else if (name == 'split') {
      outputLayers = internal.applyCommand(api.splitLayer, targetLayers, opts.field, opts);

    } else if (name == 'split-on-grid') {
      outputLayers = internal.applyCommand(api.splitLayerOnGrid, targetLayers, arcs, opts);

    } else if (name == 'stitch') {
      api.stitch(targetDataset);

    } else if (name == 'subdivide') {
      outputLayers = internal.applyCommand(api.subdivideLayer, targetLayers, arcs, opts.expression);

    } else if (name == 'svg-style') {
      internal.applyCommand(api.svgStyle, targetLayers, targetDataset, opts);

    } else if (name == 'uniq') {
      internal.applyCommand(api.uniq, targetLayers, arcs, opts);

    } else if (name == 'target') {
      internal.target(catalog, opts);

    } else {
      error("Unhandled command: [" + name + "]");
    }

    // apply name parameter
    if (('name' in opts) && outputLayers) {
      // TODO: consider uniqifying multiple layers here
      outputLayers.forEach(function(lyr) {
        lyr.name = opts.name;
      });
    }

    // delete arcs if no longer needed (e.g. after -points command)
    if (targetDataset) {
      internal.cleanupArcs(targetDataset);
    }

    // integrate output layers into the target dataset
    if (outputLayers && targetDataset && outputLayers != targetDataset.layers) {
      if (opts.no_replace) {
        targetDataset.layers = targetDataset.layers.concat(outputLayers);
      } else {
        // TODO: consider replacing old layers as they are generated, for gc
        internal.replaceLayers(targetDataset, targetLayers, outputLayers);
      }
      // use command output as new default target
      catalog.setDefaultTarget(outputLayers, targetDataset);
    }
  } catch(e) {
    return done(e);
  }

  done(null);

  function done(err) {
    T.stop('-' + name);
    internal.CURR_CMD = null;
    cb(err, err ? null : catalog);
  }
};

// Apply a command to an array of target layers
internal.applyCommand = function(func, targetLayers) {
  var args = utils.toArray(arguments).slice(2);
  return targetLayers.reduce(function(memo, lyr) {
    var result = func.apply(null, [lyr].concat(args));
    if (utils.isArray(result)) { // some commands return an array of layers
      memo = memo.concat(result);
    } else if (result) { // assuming result is a layer
      memo.push(result);
    }
    return memo;
  }, []);
};

internal.findCommandSource = function(sourceName, catalog, opts) {
  var sources = catalog.findCommandTargets(sourceName);
  var sourceDataset, source;
  if (sources.length > 1 || sources.length == 1 && sources[0].layers.length > 1) {
    stop(utils.format('Source [%s] matched multiple layers', sourceName));
  } else if (sources.length == 1) {
    source = {dataset: sources[0].dataset, layer: sources[0].layers[0]};
  } else {
    // assuming opts.source is a filename
    // don't need to build topology, because:
    //    join -- don't need topology
    //    clip/erase -- topology is built later, when datasets are combined
    sourceDataset = api.importFile(sourceName, utils.defaults({no_topology: true}, opts));
    if (!sourceDataset) {
      stop(utils.format('Unable to find source [%s]', sourceName));
    } else if (sourceDataset.layers.length > 1) {
      stop('Multiple-layer sources are not supported');
    }
    // mark as disposable to indicate that data can be mutated
    source = {dataset: sourceDataset, layer: sourceDataset.layers[0], disposable: true};
  }
  return source;
};




internal.splitShellTokens = function(str) {
  return internal.splitTokens(str, '\\s');
};

internal.splitTokens = function(str, delimChars) {
  var BAREWORD = '([^' + delimChars + '\'"])+'; // TODO: make safer
  var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
  var DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';
  var rxp = new RegExp('(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')*', 'g');
  var matches = str.match(rxp) || [];
  var chunks = matches.filter(function(chunk) {
    // single backslashes may be present in multiline commands pasted from a makefile, e.g.
    return !!chunk && chunk != '\\';
  }).map(utils.trimQuotes);
  return chunks;
};

utils.trimQuotes = function(raw) {
  var len = raw.length, first, last;
  if (len >= 2) {
    first = raw.charAt(0);
    last = raw.charAt(len-1);
    if (first == '"' && last == '"' || first == "'" && last == "'") {
      return raw.substr(1, len-2);
    }
  }
  return raw;
};




function CommandParser() {
  var commandRxp = /^--?([a-z][\w-]*)$/i,
      assignmentRxp = /^([a-z0-9_+-]+)=(?!\=)(.*)$/i, // exclude ==
      _usage = "",
      _examples = [],
      _commands = [],
      _default = null,
      _note;

  if (this instanceof CommandParser === false) return new CommandParser();

  this.usage = function(str) {
    _usage = str;
    return this;
  };

  this.note = function(str) {
    _note = str;
    return this;
  };

  // set a default command; applies to command line args preceding the first
  // explicit command
  this.default = function(str) {
    _default = str;
  };

  this.example = function(str) {
    _examples.push(str);
  };

  this.command = function(name) {
    var opts = new CommandOptions(name);
    _commands.push(opts);
    return opts;
  };

  this.section = function(name) {
    return this.command("").title(name);
  };

  this.parseArgv = function(raw) {
    var commandDefs = getCommands(),
        commands = [], cmd,
        argv = internal.cleanArgv(raw),
        cmdName, cmdDef, opt;

    if (argv.length == 1 && tokenIsCommandName(argv[0])) {
      // show help if only a command name is given
      argv.unshift('-help'); // kludge (assumes -help <command> syntax)
    } else if (argv.length > 0 && !tokenLooksLikeCommand(argv[0]) && _default) {
      // if there are arguments before the first explicit command, use the default command
      argv.unshift('-' + _default);
    }

    while (argv.length > 0) {
      cmdName = readCommandName(argv);
      if (!cmdName) {
        stop("Invalid command:", argv[0]);
      }
      cmdDef = findCommandDefn(cmdName, commandDefs);
      if (!cmdDef) {
        stop("Unknown command:", cmdName);
      }
      cmd = {
        name: cmdDef.name,
        options: {},
        _: []
      };

      while (argv.length > 0 && !tokenLooksLikeCommand(argv[0])) {
        readOption(cmd, argv, cmdDef);
      }

      try {
        if (cmd._.length > 0 && cmdDef.no_arg) {
          error("Received one or more unexpected parameters:", cmd._.join(' '));
        }
        if (cmd._.length > 1 && !cmdDef.multi_arg) {
          error("Command expects a single value. Received:", cmd._.join(' '));
        }
        if (cmdDef.default && cmd._.length == 1) {
          // TODO: support multiple-token values, like -i filenames
          readDefaultOptionValue(cmd, cmdDef);
        }
        if (cmdDef.validate) {
          cmdDef.validate(cmd);
        }
      } catch(e) {
        stop("[" + cmdName + "] " + e.message);
      }
      commands.push(cmd);
    }
    return commands;

    function tokenIsCommandName(s) {
      return !!utils.find(getCommands(), function(cmd) {
        return s === cmd.name || s === cmd.alias;
      });
    }

    function tokenLooksLikeCommand(s) {
      return commandRxp.test(s);
    }

    // Try to parse an assignment @token for command @cmdDef
    function parseAssignment(cmd, token, cmdDef) {
      var match = assignmentRxp.exec(token),
          name = match[1],
          val = utils.trimQuotes(match[2]),
          optDef = findOptionDefn(name, cmdDef);

      if (!optDef) {
        // Assignment to an unrecognized identifier could be an expression
        // (e.g. -each 'id=$.id') -- save for later parsing
        cmd._.push(token);
      } else if (optDef.type == 'flag' || optDef.assign_to) {
        stop("-" + cmdDef.name + " " + name + " option doesn't take a value");
      } else {
        readOption(cmd, [name, val], cmdDef);
      }
    }

    // Try to read an option for command @cmdDef from @argv
    function readOption(cmd, argv, cmdDef) {
      var token = argv.shift(),
          optDef = findOptionDefn(token, cmdDef),
          optName;

      if (assignmentRxp.test(token)) {
        parseAssignment(cmd, token, cmdDef);
        return;
      }

      if (!optDef) {
        // not a defined option; add it to _ array for later processing
        cmd._.push(token);
        return;
      }

      optName = optDef.alias_to || optDef.name;
      optName = optName.replace(/-/g, '_');

      if (optDef.assign_to) {
        cmd.options[optDef.assign_to] = optDef.name;
      } else if (optDef.type == 'flag') {
        cmd.options[optName] = true;
      } else {
        cmd.options[optName] = readOptionValue(argv, optDef);
      }
    }

    // Read an option value for @optDef from @argv
    function readOptionValue(argv, optDef) {
      if (argv.length === 0 || tokenLooksLikeCommand(argv[0])) {
        stop("Missing value for " + optDef.name + " option");
      }
      return parseOptionValue(argv.shift(), optDef); // remove token from argv
    }

    function readDefaultOptionValue(cmd, cmdDef) {
      var optDef = findOptionDefn(cmdDef.default, cmdDef);
      cmd.options[cmdDef.default] = readOptionValue(cmd._, optDef);
    }

    function parseOptionValue(token, optDef) {
      var type = optDef.type;
      var val, err;
      if (type == 'number') {
        val = Number(token);
      } else if (type == 'integer') {
        val = Math.round(Number(token));
      } else if (type == 'colors') {
        val = internal.parseColorList(token);
      } else if (type == 'strings') {
        val = internal.parseStringList(token);
      } else if (type == 'bbox' || type == 'numbers') {
        val = token.split(',').map(parseFloat);
      } else if (type == 'percent') {
        val = utils.parsePercent(token);
      } else {
        val = token; // assume string type
      }

      if (val !== val) {
        err = "Invalid numeric value";
      }

      if (err) {
        stop(err + " for " + optDef.name + " option");
      }
      return val;
    }

    // Check first element of an array of tokens; remove and return if it looks
    // like a command name, else return null;
    function readCommandName(args) {
      var match = commandRxp.exec(args[0]);
      if (match) {
        args.shift();
        return match[1];
      }
      return null;
    }

    function findCommandDefn(name, arr) {
      return utils.find(arr, function(cmd) {
        return cmd.name === name || cmd.alias === name;
      });
    }

    function findOptionDefn(name, cmdDef) {
      return utils.find(cmdDef.options, function(o) {
        return o.name === name || o.alias === name;
      });
    }
  };

  this.getHelpMessage = function(commandName) {
    var helpStr = '',
        cmdPre = '  ',
        optPre = '  ',
        exPre = '  ',
        gutter = '  ',
        colWidth = 0,
        detailView = false,
        cmd, helpCommands;

    helpCommands = getCommands().filter(function(cmd) {
      // hide commands without a description, except section headers
      return !!cmd.describe || cmd.title;
    });

    if (commandName) {
      cmd = utils.find(helpCommands, function(cmd) {return cmd.name == commandName;});
      if (!cmd) {
        stop(commandName, "is not a known command");
      }
      detailView = true;
      helpCommands = [cmd];
    }

    if (!detailView) {
      if (_usage) {
        helpStr += _usage + "\n\n";
      }
    }

    // Format help strings, calc width of left column.
    colWidth = helpCommands.reduce(function(w, cmd) {
      var help = cmdPre + (cmd.name ? "-" + cmd.name : "");
      if (cmd.alias) help += ", -" + cmd.alias;
      cmd.help = help;
      if (detailView) {
        w = cmd.options.reduce(function(w, opt) {
          if (cmd.describe) {
            w = Math.max(formatOption(opt, cmd), w);
          }
          return w;
        }, w);
      }
      return Math.max(w, help.length);
    }, 0);

    // Layout help display
    helpCommands.forEach(function(cmd) {
      if (!detailView && cmd.title) {
        helpStr += cmd.title;
      }
      if (detailView) {
        helpStr += '\nCommand\n';
      }
      helpStr += formatHelpLine(cmd.help, cmd.describe);
      if (detailView && cmd.options.length > 0) {
        helpStr += '\nOptions\n';
        cmd.options.forEach(function(opt) {
          if (opt.help && opt.describe) {
            helpStr += formatHelpLine(opt.help, opt.describe);
          }
        });
      }
      if (detailView && cmd.examples) {
        helpStr += '\nExample' + (cmd.examples.length > 1 ? 's' : ''); //  + '\n';
        cmd.examples.forEach(function(ex) {
          ex.split('\n').forEach(function(line) {
            helpStr += '\n' + exPre + line;
          });
          helpStr += '\n';
        });
      }
    });

    // additional notes for non-detail view
    if (!detailView) {
      if (_examples.length > 0) {
        helpStr += "\nExamples\n";
        _examples.forEach(function(str) {
          helpStr += "\n" + str + "\n";
        });
      }
      if (_note) {
        helpStr += '\n' + _note;
      }
    }

    return helpStr;

    function formatHelpLine(help, desc) {
      return utils.rpad(help, colWidth, ' ') + gutter + (desc || '') + '\n';
    }

    function formatOption(o, cmd) {
      o.help = optPre;
      if (o.label) {
        o.help += o.label;
      } else if (o.name == cmd.default) {
        o.help += '<' + o.name + '>';
      } else {
        o.help += o.name;
        if (o.alias) o.help += ", " + o.alias;
        if (o.type != 'flag' && !o.assign_to) o.help += "=";
      }
      return o.help.length;
    }

  };

  this.printHelp = function(command) {
    message(this.getHelpMessage(command));
  };

  function getCommands() {
    return _commands.map(function(cmd) {
      return cmd.done();
    });
  }
}

function CommandOptions(name) {
  var _command = {
    name: name,
    options: []
  };

  // set default option (assign unnamed argument to option of this name)
  this.default = function(name) {
    _command.default = name;
    return this;
  };

  this.validate = function(f) {
    _command.validate = f;
    return this;
  };

  this.describe = function(str) {
    _command.describe = str;
    return this;
  };

  this.example = function(str) {
    if (!_command.examples) {
      _command.examples = [];
    }
    _command.examples.push(str);
    return this;
  };

  this.alias = function(name) {
    _command.alias = name;
    return this;
  };

  this.title = function(str) {
    _command.title = str;
    return this;
  };

  this.flag = function(name) {
    _command[name] = true;
    return this;
  };

  this.option = function(name, opts) {
    opts = opts || {}; // accept just a name -- some options don't need properties
    if (!utils.isString(name) || !name) error("Missing option name");
    if (!utils.isObject(opts)) error("Invalid option definition:", opts);
    opts.name = name;
    _command.options.push(opts);
    return this;
  };

  this.done = function() {
    return _command;
  };
}

// Split comma-delimited list, trim quotes from entire list and
// individual members
internal.parseStringList = function(token) {
  var delim = ',';
  var list = internal.splitTokens(token, delim);
  if (list.length == 1) {
    list = internal.splitTokens(list[0], delim);
  }
  return list;
};

// Accept spaces and/or commas as delimiters
internal.parseColorList = function(token) {
  var delim = ', ';
  var list = internal.splitTokens(token, delim);
  if (list.length == 1) {
    list = internal.splitTokens(list[0], delim);
  }
  return list;
};

internal.cleanArgv = function(argv) {
  argv = argv.map(function(s) {return s.trim();}); // trim whitespace
  argv = argv.filter(function(s) {return s !== '';}); // remove empty tokens
  argv = argv.map(utils.trimQuotes); // remove one level of single or dbl quotes
  return argv;
};




utils.replaceFileExtension = function(path, ext) {
  var info = utils.parseLocalPath(path);
  return info.pathbase + '.' + ext;
};

utils.getPathSep = function(path) {
  // TODO: improve
  return path.indexOf('/') == -1 && path.indexOf('\\') != -1 ? '\\' : '/';
};

// Parse the path to a file without using Node
// Assumes: not a directory path
utils.parseLocalPath = function(path) {
  var obj = {},
      sep = utils.getPathSep(path),
      parts = path.split(sep),
      i;

  if (parts.length == 1) {
    obj.filename = parts[0];
    obj.directory = "";
  } else {
    obj.filename = parts.pop();
    obj.directory = parts.join(sep);
  }
  i = obj.filename.lastIndexOf('.');
  if (i > -1) {
    obj.extension = obj.filename.substr(i + 1);
    obj.basename = obj.filename.substr(0, i);
    obj.pathbase = path.substr(0, path.lastIndexOf('.'));
  } else {
    obj.extension = "";
    obj.basename = obj.filename;
    obj.pathbase = path;
  }
  return obj;
};

utils.getFileBase = function(path) {
  return utils.parseLocalPath(path).basename;
};

utils.getFileExtension = function(path) {
  return utils.parseLocalPath(path).extension;
};

utils.getPathBase = function(path) {
  return utils.parseLocalPath(path).pathbase;
};

utils.getCommonFileBase = function(names) {
  return names.reduce(function(memo, name, i) {
    if (i === 0) {
      memo = utils.getFileBase(name);
    } else {
      memo = utils.mergeNames(memo, name);
    }
    return memo;
  }, "");
};

utils.getOutputFileBase = function(dataset) {
  var inputFiles = dataset.info && dataset.info.input_files;
  return inputFiles && utils.getCommonFileBase(inputFiles) || 'output';
};




// Guess the type of a data file from file extension, or return null if not sure
internal.guessInputFileType = function(file) {
  var ext = utils.getFileExtension(file || '').toLowerCase(),
      type = null;
  if (ext == 'dbf' || ext == 'shp' || ext == 'prj') {
    type = ext;
  } else if (/json$/.test(ext)) {
    type = 'json';
  }
  return type;
};

internal.guessInputContentType = function(content) {
  var type = null;
  if (utils.isString(content)) {
    type = internal.stringLooksLikeJSON(content) ? 'json' : 'text';
  } else if (utils.isObject(content) && content.type || utils.isArray(content)) {
    type = 'json';
  }
  return type;
};

internal.guessInputType = function(file, content) {
  return internal.guessInputFileType(file) || internal.guessInputContentType(content);
};

//
internal.stringLooksLikeJSON = function(str) {
  return /^\s*[{[]/.test(String(str));
};

internal.couldBeDsvFile = function(name) {
  var ext = utils.getFileExtension(name).toLowerCase();
  return /csv|tsv|txt$/.test(ext);
};

// Infer output format by considering file name and (optional) input format
internal.inferOutputFormat = function(file, inputFormat) {
  var ext = utils.getFileExtension(file).toLowerCase(),
      format = null;
  if (ext == 'shp') {
    format = 'shapefile';
  } else if (ext == 'dbf') {
    format = 'dbf';
  } else if (ext == 'svg') {
    format = 'svg';
  } else if (/json$/.test(ext)) {
    format = 'geojson';
    if (ext == 'topojson' || inputFormat == 'topojson' && ext != 'geojson') {
      format = 'topojson';
    } else if (ext == 'json' && inputFormat == 'json') {
      format = 'json'; // JSON table
    }
  } else if (internal.couldBeDsvFile(file)) {
    format = 'dsv';
  } else if (inputFormat) {
    format = inputFormat;
  }
  return format;
};

internal.isZipFile = function(file) {
  return /\.zip$/i.test(file);
};

internal.isSupportedOutputFormat = function(fmt) {
  var types = ['geojson', 'topojson', 'json', 'dsv', 'dbf', 'shapefile', 'svg'];
  return types.indexOf(fmt) > -1;
};

internal.getFormatName = function(fmt) {
  return {
    geojson: 'GeoJSON',
    topojson: 'TopoJSON',
    json: 'JSON records',
    dsv: 'CSV',
    dbf: 'DBF',
    shapefile: 'Shapefile',
    svg: 'SVG'
  }[fmt] || '';
};

// Assumes file at @path is one of Mapshaper's supported file types
internal.isBinaryFile = function(path) {
  var ext = utils.getFileExtension(path).toLowerCase();
  return ext == 'shp' || ext == 'dbf' || ext == 'zip'; // GUI accepts zip files
};

// Detect extensions of some unsupported file types, for cmd line validation
internal.filenameIsUnsupportedOutputType = function(file) {
  var rxp = /\.(shx|prj|xls|xlsx|gdb|sbn|sbx|xml|kml)$/i;
  return rxp.test(file);
};





function validateInputOpts(cmd) {
  var o = cmd.options,
      _ = cmd._;

  if (_[0] == '-' || _[0] == '/dev/stdin') {
    o.stdin = true;
  } else if (_.length > 0) {
    o.files = cli.expandInputFiles(_);
  }

  if ("precision" in o && o.precision > 0 === false) {
    error("precision= option should be a positive number");
  }

  if (o.encoding) {
    o.encoding = internal.validateEncoding(o.encoding);
  }
}

function validateSimplifyOpts(cmd) {
  var o = cmd.options,
      arg = cmd._[0];

  if (arg) {
    if (/^[0-9.]+%?$/.test(arg)) {
      o.percentage = utils.parsePercent(arg);
    } else {
      error("Unparsable option:", arg);
    }
  }

  var intervalStr = o.interval;
  if (intervalStr) {
    o.interval = Number(intervalStr);
    if (o.interval >= 0 === false) {
      error(utils.format("Out-of-range interval value: %s", intervalStr));
    }
  }

  if (isNaN(o.interval) && !utils.isNumber(o.percentage) && !o.resolution) {
    error("Command requires an interval, percentage or resolution parameter");
  }
}

function validateProjOpts(cmd) {
  var _ = cmd._,
      proj4 = [];

  // separate proj4 options
  _ = _.filter(function(arg) {
    if (/^\+[a-z]/i.test(arg)) {
      proj4.push(arg);
      return false;
    }
    return true;
  });

  if (proj4.length > 0) {
    cmd.options.projection = proj4.join(' ');
  } else if (_.length > 0) {
    cmd.options.projection = _.shift();
  }

  if (_.length > 0) {
    error("Received one or more unexpected parameters: " + _.join(', '));
  }

  if (!(cmd.options.projection  || cmd.options.match || cmd.options.from)) {
    stop("Missing projection data");
  }
}


function validateClipOpts(cmd) {
  var opts = cmd.options;
  // rename old option
  if (opts.cleanup) {
    delete opts.cleanup;
    opts.remove_slivers = true;
  }
  if (!opts.source && !opts.bbox) {
    error("Command requires a source file, layer id or bbox");
  }
}

function validateGridOpts(cmd) {
  var o = cmd.options;
  if (cmd._.length == 1) {
    var tmp = cmd._[0].split(',');
    o.cols = parseInt(tmp[0], 10);
    o.rows = parseInt(tmp[1], 10) || o.cols;
  }
}

function validateExpressionOpt(cmd) {
  if (!cmd.options.expression) {
    error("Command requires a JavaScript expression");
  }
}

function validateOutputOpts(cmd) {
  var _ = cmd._,
      o = cmd.options,
      arg = _[0] || "",
      pathInfo = utils.parseLocalPath(arg);

  if (_.length > 1) {
    error("Command takes one file or directory argument");
  }

  if (arg == '-' || arg == '/dev/stdout') {
    o.stdout = true;
  } else if (arg && !pathInfo.extension) {
    if (!cli.isDirectory(arg)) {
      error("Unknown output option:", arg);
    }
    o.directory = arg;
  } else if (arg) {
    if (pathInfo.directory) {
      o.directory = pathInfo.directory;
      cli.validateOutputDir(o.directory);
    }
    o.file = pathInfo.filename;
    if (internal.filenameIsUnsupportedOutputType(o.file)) {
      error("Output file looks like an unsupported file type:", o.file);
    }
  }

  if (o.format) {
    o.format = o.format.toLowerCase();
    if (o.format == 'csv') {
      o.format = 'dsv';
      o.delimiter = o.delimiter || ',';
    } else if (o.format == 'tsv') {
      o.format = 'dsv';
      o.delimiter = o.delimiter || '\t';
    }
    if (!internal.isSupportedOutputFormat(o.format)) {
      error("Unsupported output format:", o.format);
    }
  }

  if (o.delimiter) {
    // convert "\t" '\t' \t to tab
    o.delimiter = o.delimiter.replace(/^["']?\\t["']?$/, '\t');
    if (!internal.isSupportedDelimiter(o.delimiter)) {
      error("Unsupported delimiter:", o.delimiter);
    }
  }

  if (o.encoding) {
    o.encoding = internal.validateEncoding(o.encoding);
  }

  // topojson-specific
  if ("quantization" in o && o.quantization > 0 === false) {
    error("quantization= option should be a nonnegative integer");
  }

  if ("topojson_precision" in o && o.topojson_precision > 0 === false) {
    error("topojson-precision= option should be a positive number");
  }
}




internal.getOptionParser = function() {
  // definitions of options shared by more than one command
  var targetOpt = {
        describe: "layer(s) to target (comma-sep. list)"
      },
      nameOpt = {
        describe: "rename the edited layer(s)"
      },
      noReplaceOpt = {
        alias: "+",
        type: 'flag',
        describe: "retain the original layer(s) instead of replacing"
      },
      noSnapOpt = {
        // describe: "don't snap points before applying command"
        type: 'flag'
      },
      encodingOpt = {
        describe: "text encoding (applies to .dbf and delimited text files)"
      },
      autoSnapOpt = {
        alias: "snap",
        describe: "snap nearly identical points to fix minor topology errors",
        type: "flag"
      },
      snapIntervalOpt = {
        describe: "specify snapping distance in source units",
        type: "number"
      },
      sumFieldsOpt = {
        describe: "fields to sum when dissolving  (comma-sep. list)",
        type: "strings"
      },
      copyFieldsOpt = {
        describe: "fields to copy when dissolving (comma-sep. list)",
        type: "strings"
      },
      dissolveFieldOpt = {
        describe: "(optional) name of a data field to dissolve on"
      },
      fieldTypesOpt = {
        describe: "type hints for csv source files, e.g. FIPS:str,STATE_FIPS:str",
        type: "strings"
      },
      stringFieldsOpt = {
        describe: "csv field(s) to import as strings, e.g. FIPS,ZIPCODE",
        type: "strings"
      },
      bboxOpt = {
        type: "bbox",
        describe: "comma-sep. bounding box: xmin,ymin,xmax,ymax"
      };

  var parser = new CommandParser();
  parser.usage("Usage:  mapshaper -<command> [options] ...");

  /*
  parser.example("Fix minor topology errors, simplify to 10%, convert to GeoJSON\n" +
      "$ mapshaper states.shp auto-snap -simplify 10% -o format=geojson");

  parser.example("Aggregate census tracts to counties\n" +
      "$ mapshaper tracts.shp -each \"CTY_FIPS=FIPS.substr(0, 5)\" -dissolve CTY_FIPS");
  */

  parser.note("Enter mapshaper -help <command> to view options for a single command");

  parser.section("I/O commands");

  parser.default('i');

  parser.command('i')
    .describe("input one or more files")
    .validate(validateInputOpts)
    .flag("multi_arg")
    .option("files", {
      label: "<files>",
      describe: "files to import (separated by spaces), or - to use stdin"
    })
    .option("merge-files", {
      describe: "merge features from compatible files into the same layer",
      type: "flag"
    })
    .option("combine-files", {
      describe: "import files to separate layers with shared topology",
      type: "flag"
    })
    .option("no-topology", {
      describe: "treat each shape as topologically independent",
      type: "flag"
    })
    .option("precision", {
      describe: "coordinate precision in source units, e.g. 0.001",
      type: "number"
    })
    .option("auto-snap", autoSnapOpt)
    .option("snap-interval", snapIntervalOpt)
    .option("encoding", encodingOpt)
    /*
    .option("fields", {
      describe: "attribute fields to import (comma-sep.) (default is all fields)",
      type: "strings"
    }) */
    .option("id-field", {
      describe: "import Topo/GeoJSON id property to this field"
    })
    .option("string-fields", stringFieldsOpt)
    .option("field-types", fieldTypesOpt)
    .option("name", {
      describe: "Rename the imported layer(s)"
    });

  parser.command('o')
    .describe("output edited content")
    .validate(validateOutputOpts)
    .option('_', {
      label: "<file|directory|->",
      describe: "(optional) name of output file or directory, or - for stdout"
    })
    .option("format", {
      describe: "options: shapefile,geojson,topojson,json,dbf,csv,tsv,svg"
    })
    .option("target", targetOpt)
    .option("force", {
      // obsolete option, triggers warning
      type: "flag"
    })
    .option("dry-run", {
      // describe: "do not output any files"
      type: "flag"
    })
    .option("encoding", {
      describe: "text encoding of output dbf file"
    })
    .option("ldid", {
      // describe: "language driver id of dbf file",
      type: "number"
    })
    .option("bbox-index", {
      describe: "export a .json file with bbox of each layer",
      type: 'flag'
    })
    .option("cut-table", {
      describe: "detach data attributes from shapes and save as a JSON file",
      type: "flag"
    })
    .option("drop-table", {
      describe: "remove data attributes from output",
      type: "flag"
    })
    .option("precision", {
      describe: "coordinate precision in source units, e.g. 0.001",
      type: "number"
    })
    .option("id-field", {
      describe: "(Topo/GeoJSON/SVG) field to use for id property",
      type: "strings"
    })
    .option("bbox", {
      type: "flag",
      describe: "(Topo/GeoJSON) add bbox property"
    })
    .option("extension", {
      describe: "(Topo/GeoJSON) set file extension (default is \".json\")"
    })
    .option("prettify", {
      type: "flag",
      describe: "(Topo/GeoJSON) format output for readability"
    })
    .option("singles", {
      // describe: "(TopoJSON) save each layer as a single file",
      type: "flag"
    })
    .option("quantization", {
      describe: "(TopoJSON) specify quantization (auto-set by default)",
      type: "integer"
    })
    .option("no-quantization", {
      describe: "(TopoJSON) export coordinates without quantization",
      type: "flag"
    })
    .option("no-point-quantization", {
      // describe: "(TopoJSON) export point coordinates without quantization",
      type: "flag"
    })
    .option('presimplify', {
      describe: "(TopoJSON) add per-vertex data for dynamic simplification",
      type: "flag"
    })
    .option("topojson-precision", {
      // describe: "pct of avg segment length for rounding (0.02 is default)",
      type: "number"
    })
    .option("combine-layers", {
      describe: "(GeoJSON) output layers as a single file",
      type: "flag"
    })
    .option("width", {
      describe: "(SVG) width of the SVG viewport (default is 800)",
      type: "number"
    })
    .option("margin", {
      describe: "(SVG) margin between data and viewport bounds (default is 1)",
      type: "number"
    })
    .option("point-symbol", {
      describe: "(SVG) circle or square (default is circle)"
    })
    .option("svg-scale", {
      // describe: "(SVG) data units (e.g. meters) per pixel"
      type: "number"
    })
    .option("delimiter", {
      describe: "(CSV) field delimiter"
    })
    .option("final", {
      type: "flag" // for testing
    });

  parser.section("\nEditing commands");

  parser.command("clip")
    .describe("use a polygon layer to clip another layer")
    .example("$ mapshaper states.shp -clip land_area.shp -o clipped.shp")
    .validate(validateClipOpts)
    .default("source")
    .option("source", {
      describe: "file or layer containing clip polygons"
    })
    .option('remove-slivers', {
      describe: "remove sliver polygons created by clipping",
      type: 'flag'
    })
    .option("cleanup", {type: 'flag'}) // obsolete; renamed in validation func.
    .option("bbox", bboxOpt)
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("no-snap", noSnapOpt)
    .option("target", targetOpt);

  parser.command("dissolve")
    .describe("merge features within a layer")
    .example("Dissolve all polygons in a feature layer into a single polygon\n" +
      "$ mapshaper states.shp -dissolve -o country.shp")
    .example("Generate state-level polygons by dissolving a layer of counties\n" +
      "(STATE_FIPS, POPULATION and STATE_NAME are attribute field names)\n" +
      "$ mapshaper counties.shp -dissolve STATE_FIPS copy-fields=STATE_NAME sum-fields=POPULATION -o states.shp")
    .default("field")
    .option("field", dissolveFieldOpt)
    .option("calc", {
      describe: "use a JS expression to aggregate data values"
    })
    .option("sum-fields", sumFieldsOpt)
    .option("copy-fields", copyFieldsOpt)
    .option("weight", {
      describe: "[points] field or expression to use for weighting centroid"
    })
    .option("planar", {
      type: 'flag',
      describe: "[points] use 2D math to find centroids of latlong points"
    })
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);

  parser.command("dissolve2")
    .describe("merge adjacent and overlapping polygons")
    .default("field")
    .option("field", dissolveFieldOpt)
    .option("calc", {
      describe: "use a JS expression to aggregate data values"
    })
    .option("sum-fields", sumFieldsOpt)
    .option("copy-fields", copyFieldsOpt)
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("no-snap", noSnapOpt)
    .option("target", targetOpt);

  parser.command("each")
    .describe("create/update/delete data fields using a JS expression")
    .example("Add two calculated data fields to a layer of U.S. counties\n" +
        "$ mapshaper counties.shp -each 'STATE_FIPS=CNTY_FIPS.substr(0, 2), AREA=$.area'")
    .default("expression")
    .option("expression", {
      describe: "JS expression to apply to each target feature"
    })
    .option("where", {
      describe: "use a JS expression to select a subset of features"
    })
    .option("target", targetOpt);

  parser.command("erase")
    .describe("use a polygon layer to erase another layer")
    .example("$ mapshaper land_areas.shp -erase water_bodies.shp -o erased.shp")
    .validate(validateClipOpts)
    .default("source")
    .option("source", {
      describe: "file or layer containing erase polygons"
    })
    .option('remove-slivers', {
      describe: "remove sliver polygons created by erasing",
      type: 'flag'
    })
    .option("cleanup", {type: 'flag'})
    .option("bbox", bboxOpt)
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("no-snap", noSnapOpt)
    .option("target", targetOpt);

  parser.command("explode")
    .describe("divide multi-part features into single-part features")
    .option("naive", {type: "flag"}) // testing
    .option("target", targetOpt);

  parser.command("filter")
    .describe("delete features using a JS expression")
    .default("expression")
    .option("expression", {
      describe: "delete features that evaluate to false"
    })
    .option("remove-empty", {
      type: "flag",
      describe: "delete features with null geometry"
    })
    .option("keep-shapes", {
      type: "flag"
    })
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);

  parser.command("filter-fields")
    .describe('retain a subset of data fields')
    .default('fields')
    .option("fields", {
      type: "strings",
      describe: "fields to retain (comma-sep.), e.g. 'fips,name'"
    })
    .option("target", targetOpt);

  parser.command("filter-islands")
    .describe("remove small detached polygon rings (islands)")
    .option("min-area", {
      type: "number",
      describe: "remove small-area islands (sq meters or projected units)"
    })
    .option("min-vertices", {
      type: "integer",
      describe: "remove low-vertex-count islands"
    })
    .option("remove-empty", {
      type: "flag",
      describe: "delete features with null geometry"
    })
    .option("target", targetOpt);

  parser.command("filter-slivers")
    .describe("remove small polygon rings")
    .option("min-area", {
      type: "number",
      describe: "remove small-area rings (sq meters or projected units)"
    })
    /*
    .option("remove-empty", {
      type: "flag",
      describe: "delete features with null geometry"
    })
    */
    .option("target", targetOpt);

  parser.command("graticule")
    .describe("create a graticule layer");

  parser.command("innerlines")
    .describe("convert polygons to polylines along shared edges")
    .flag('no_arg')
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);

  parser.command("join")
    .describe("join data records from a file or layer to a layer")
    .example("Join a csv table to a Shapefile (don't auto-convert FIPS column to numbers)\n" +
      "$ mapshaper states.shp -join data.csv keys=STATE_FIPS,FIPS string-fields=FIPS -o joined.shp")
    .validate(function(cmd) {
      if (!cmd.options.source) {
        error("Command requires the name of a layer or file to join");
      }
    })
    .default("source")
    .option("source", {
      describe: "file or layer containing data records"
    })
    .option("keys", {
      describe: "join by matching target,source key fields; e.g. keys=FIPS,GEOID",
      type: "strings"
    })
    .option("calc", {
      describe: "use a JS expression to calculate values for many-to-one joins"
    })
    .option("where", {
      describe: "use a JS expression to filter source records"
    })
    .option("fields", {
      describe: "fields to join, e.g. fields=FIPS,POP (default is all fields)",
      type: "strings"
    })
    .option("string-fields", stringFieldsOpt)
    .option("field-types", fieldTypesOpt)
    .option("sum-fields", {
      describe: "fields to sum for many-to-one join (consider calc= option instead)",
      type: "strings"
    })
    .option("force", {
      describe: "replace values from same-named fields",
      type: "flag"
    })
    .option("unjoined", {
      describe: "copy unjoined records from source table to \"unjoined\" layer",
      type: "flag"
    })
    .option("unmatched", {
      describe: "copy unmatched records in target table to \"unmatched\" layer",
      type: "flag"
    })
    .option("encoding", encodingOpt)
    .option("target", targetOpt);

  parser.command("lines")
    .describe("convert polygons to polylines, classified by edge type")
    .default("fields")
    .option("fields", {
      describe: "optional comma-sep. list of fields to create a hierarchy",
      type: "strings"
    })
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);

  parser.command("merge-layers")
    .describe("merge multiple layers into as few layers as possible")
    .flag('no_arg')
    .option("name", nameOpt)
    .option("target", targetOpt);

  parser.command("point-grid")
    .describe("create a rectangular grid of points")
    .validate(validateGridOpts)
    .option("-", {
      label: "<cols,rows>",
      describe: "size of the grid, e.g. -point-grid 100,100"
    })
    .option('interval', {
      describe: 'distance between adjacent points, in source units',
      type: 'number'
    })
    .option("cols", {
      type: "integer"
    })
    .option("rows", {
      type: "integer"
    })
    .option('bbox', {
      type: "bbox",
      describe: "xmin,ymin,xmax,ymax (default is bbox of data)"
    })
    .option("name", nameOpt);

  parser.command("points")
    .describe("create a point layer from a different layer type")
    .flag("no_arg")
    .option("x", {
      describe: "field containing x coordinate"
    })
    .option("y", {
      describe: "field containing y coordinate"
    })
    .option("inner", {
      describe: "create an interior point for each polygon's largest ring",
      type: "flag"
    })
    .option("centroid", {
      describe: "create a centroid point for each polygon's largest ring",
      type: "flag"
    })
    .option("vertices", {
      describe: "capture unique vertices of polygons and polylines",
      type: "flag"
    })
    //.option("intersections", {
    //  describe: "capture line segment intersections of polygons and polylines",
    //  type: "flag"
    //})
    .option("interpolated", {
      describe: "interpolate points along polylines; requires interval=",
      type: "flag"
    })
    .option("interval", {
      describe: "distance between interpolated points (meters or projected units)",
      type: "number"
    })
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);

  parser.command("proj")
    .describe("project your data (using Proj.4)")
    .flag("multi_arg")
    .option("projection", {
      label: "<projection>",
      describe: "set destination CRS using a Proj.4 definition or alias"
    })
    .option("match", {
      describe: "set destination CRS using a .prj file or layer id"
    })
    .option("source", {
      // describe: "(deprecated) alias for match",
      alias_to: "match"
    })
    .option("from", {
      describe: "set source CRS (if unset) using a string, .prj or layer id"
    })
    .option("densify", {
      type: "flag",
      describe: "add points along straight segments to approximate curves"
    })
    .option("target", targetOpt)
    .validate(validateProjOpts);

  parser.command("rename-fields")
    .default('fields')
    .describe('rename data fields')
    .option("fields", {
      type: "strings",
      describe: "fields to rename (comma-sep.), e.g. 'fips=STATE_FIPS,st=state'"
    })
    .option("target", targetOpt);

  parser.command("rename-layers")
    .default('names')
    .describe("assign new names to layers")
    .option("names", {
      type: "strings",
      describe: "new layer name(s) (comma-sep. list)"
    })
    .option("target", targetOpt);

  parser.command('shape')
    // .describe("create a geometric shape")
    .option('type', {

    })
    .option("bbox", {
      describe: "bounding box of shape",
      type: "bounds"
    })
    .option("offset", {
      describe: "space around the bounding box or contents",
      type: "number"
    })
    .option("source", {
      describe: "name of layer to surround"
    })
    .option("name", nameOpt);

  parser.command('simplify')
    .default('percentage')
    .validate(validateSimplifyOpts)
    .example("Retain 10% of removable vertices\n$ mapshaper input.shp -simplify 10%")
    .describe("simplify the geometry of polygon and polyline features")
    .option('percentage', {
      alias: 'p',
      type: 'percent',
      describe: "percentage of removable points to retain, e.g. 10%"
    })
    .option("dp", {
      alias: "rdp",
      describe: "use Ramer-Douglas-Peucker simplification",
      assign_to: "method"
    })
    .option("visvalingam", {
      describe: "use Visvalingam simplification with \"effective area\" metric",
      assign_to: "method"
    })
    .option("weighted", {
      describe: "use weighted Visvalingam simplification (default)",
      assign_to: "method"
    })
    .option("method", {
      // hidden option
    })
    .option("weighting", {
      type: "number",
      describe: "weighted Visvalingam coefficient (default is 0.7)"
    })
    .option("resolution", {
      describe: "output resolution as a grid (e.g. 1000x500)"
    })
    .option("interval", {
      // alias: "i",
      describe: "output resolution as a distance (e.g. 100)",
      type: "number"
    })
    /*
    .option("value", {
      // for testing
      // describe: "raw value of simplification threshold",
      type: "number"
    })
    */
    .option("planar", {
      describe: "simplify decimal degree coords in 2D space (default is 3D)",
      type: "flag"
    })
    .option("cartesian", {
      // describe: "(deprecated) alias for planar",
      type: "flag",
      alias_to: "planar"
    })
    .option("keep-shapes", {
      describe: "prevent small polygon features from disappearing",
      type: "flag"
    })
    .option("lock-box", {
      // describe: "don't remove vertices along bbox edges"
      type: "flag"
    })
    .option("no-repair", {
      describe: "don't remove intersections introduced by simplification",
      type: "flag"
    })
    .option("stats", {
      describe: "display simplification statistics",
      type: "flag"
    });

  parser.command("slice")
    // .describe("slice a layer using polygons in another layer")
    .default("source")
    .option("source", {
      describe: "file or layer containing clip polygons"
    })
    /*
    .option('remove-slivers', {
      describe: "remove sliver polygons created by clipping",
      type: 'flag'
    }) */
    .option("id-field", {
      describe: "slice id field (from source layer)"
    })
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("no-snap", noSnapOpt)
    .option("target", targetOpt);

  parser.command("sort")
    .describe("sort features using a JS expression")
    .default("expression")
    .option("expression", {
      describe: "JS expression to generate a sort key for each feature"
    })
    .option("ascending", {
      describe: "sort in ascending order (default)",
      type: "flag"
    })
    .option("descending", {
      describe: "sort in descending order",
      type: "flag"
    })
    .option("target", targetOpt);

  parser.command("split")
    .describe("split features into separate layers using a data field")
    .default("field")
    .option("field", {
      describe: "name of an attribute field (omit to split all features)"
    })
    .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);

  parser.command("split-on-grid")
    .describe("split features into separate layers using a grid")
    .validate(validateGridOpts)
    .option("-", {
      label: "<cols,rows>",
      describe: "size of the grid, e.g. -split-on-grid 12,10"
    })
    .option("cols", {
      type: "integer"
    })
    .option("rows", {
      type: "integer"
    })
    .option("id-field", {
      describe: "assign each feature a cell id instead of splitting layer"
    })
    // .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);

  parser.command("svg-style")
    .describe("set SVG style using JS expressions or literal values")
    .option("class", {
      describe: 'name of CSS class or classes (space sep.)'
    })
    .option("fill", {
      describe: 'fill color, examples: #eee pink rgba(0, 0, 0, 0.2)'
    })
    .option("stroke", {
      describe: 'stroke color'
    })
    .option("stroke-width", {
      describe: 'stroke width'
    })
    .option("opacity", {
      describe: 'opacity, example: 0.5'
    })
    .option("r", {
      describe: 'radius of circle symbols',
    })
    /*
    .option("label", {
      describe: 'label text'
    })
    .option("text-anchor", {
      describe: 'start|middle|end (default is middle)'
    })
    .option("dx", {
      type: "number",
      describe: 'x offset'
    })
    .option("dy", {
      type: "number",
      describe: 'y offset'
    })
    */
    .option("target", targetOpt);

  parser.command("target")
    .describe("set active layer")
    .default('target')
    .option("target", {
      describe: "name or index of layer to target"
    })
    .option('type', {
      describe: "type of layer to target (polygon|polyline|point)"
    })
    .option("name", {
      describe: 'rename the target layer'
    });

  parser.command("uniq")
    .describe("delete features with the same id as a previous feature")
    .default("expression")
    .option("expression", {
      describe: "JS expression to obtain the id of a feature"
    })
    .option("verbose", {
      describe: "print each removed feature",
      type: "flag"
    })
    .option("target", targetOpt);


  // Experimental commands
  parser.section("\nExperimental commands (may give unexpected results)");

  parser.command("affine")
    .describe("transform coordinates by shifting, scaling and rotating")
    .flag("no_args")
    .option("shift", {
      type: 'numbers',
      describe: "x,y offsets in source units (e.g. 5000,-5000)"
    })
    .option("scale", {
      type: 'number',
      describe: "scale (default is 1)"
    })
    .option("rotate", {
      type: 'number',
      describe: "angle of rotation in degrees (default is 0)"
    })
    .option("anchor", {
      type: 'numbers',
      describe: "center of rotation/scaling (default is center of selected shapes)"
    })
    .option("where", {
      describe: "use a JS expression to select a subset of features"
    })
    .option("target", targetOpt);


  // Work-in-progress (no .describe(), so hidden from -h)
  parser.command("clean")
    .option("target", targetOpt);

  parser.command("clean2")
    .option("snap-interval", snapIntervalOpt)
    .option("no-snap", noSnapOpt)
    .option("target", targetOpt);


  parser.command("cluster")
    .describe("group polygons into compact clusters")
    .option("id-field", {
      describe: "field name of cluster id (default is \"cluster\")"
    })
    .option('pct', {
      alias: 'p',
      type: 'percent',
      describe: "percentage of shapes to retain, e.g. 50%"
    })
    .option("max-width", {
      describe: "max width of cluster bounding box",
      type: "number"
    })
    .option("max-height", {
      describe: "max height of cluster bounding box",
      type: "number"
    })
    .option("max-area", {
      describe: "max area of a cluster",
      type: "number"
    })
    .option("group-by", {
      describe: "field name; only same-value shapes will be grouped"
    })
    .option("target", targetOpt);

  parser.command("colorizer")
    .describe("define a function to convert data values to color classes")
    .flag("no_arg")
    .option("colors", {
      describe: "comma-separated list of CSS colors",
      type: "colors"
    })
    .option("breaks", {
      describe: "ascending-order list of breaks for sequential color scheme",
      type: "numbers"
    })
    .option("categories", {
      describe: "comma-sep. list of keys for categorical color scheme",
      type: "strings"
    })
    .option("other", {
      describe: "default color for categorical scheme (defaults to no-data color)"
    })
    .option("nodata", {
      describe: "color to use for invalid or missing data (default is white)"
    })
    .option("name", {
      describe: "function name to use in -each and -svg-style commands"
    })
    .option("precision", {
      describe: "rounding precision to apply before classification (e.g. 0.1)",
      type: "number"
    });

  parser.command("data-fill")
    // .describe("interpolate missing values by copying from neighbor polygons")
    .option("field", {
      describe: "name of field to fill out"
    })
    .option("postprocess", {
      describe: "remove data islands",
      type: "flag"
    });


  parser.command("subdivide")
    .describe("recursively split a layer using a JS expression")
    .validate(validateExpressionOpt)
    .default("expression")
    .option("expression", {
      describe: "boolean JS expression"
    })
    .option("target", targetOpt);


  parser.section("\nInformational commands");

  parser.command("calc")
    .describe("calculate statistics about the features in a layer")
    .example("Calculate the total area of a polygon layer\n" +
      "$ mapshaper polygons.shp -calc 'sum($.area)'")
    .example("Count census blocks in NY with zero population\n" +
      "$ mapshaper ny-census-blocks.shp -calc 'count()' where='POPULATION == 0'")
    .validate(validateExpressionOpt)
    .default("expression")
    .option("expression", {
      describe: "functions: sum() average() median() max() min() count()"
    })
    .option("where", {
      describe: "use a JS expression to select a subset of features"
    })
    .option("target", targetOpt);

  parser.command('encodings')
    .describe("print list of supported text encodings (for .dbf import)");

  parser.command('help')
    .alias('h')
    .describe("print help; takes optional command name")
    .default('command')
    .option("command", {
      describe: "view detailed information about a command"
    });

  parser.command('info')
    .describe("print information about data layers");

  parser.command('inspect')
    .describe("print information about a feature")
    .default("expression")
    .option("expression", {
      describe: "boolean JS expression for selecting a feature"
    })
    .option("target", targetOpt)
    .validate(validateExpressionOpt);

  parser.command('projections')
    .describe("print list of supported projections");

  parser.command('quiet')
    .describe("inhibit console messages");

  parser.command('verbose')
    .describe("print verbose processing messages");

  parser.command('version')
    .alias('v')
    .describe("print mapshaper version");

  parser.command('debug');

  /*
  parser.command("divide")
    .option("name", nameOpt)
    .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);

  parser.command("fill-holes")
    .option("no-replace", noReplaceOpt)
    .option("target", targetOpt);
  */

  return parser;
};




// Parse an array or a string of command line tokens into an array of
// command objects.
internal.parseCommands = function(tokens) {
  if (Array.isArray(tokens) && utils.isObject(tokens[0])) {
    // argv seems to contain parsed commands already... make a copy
    return tokens.map(function(cmd) {
      return {name: cmd.name, options: utils.extend({}, cmd.options)};
    });
  }
  if (utils.isString(tokens)) {
    tokens = internal.splitShellTokens(tokens);
  }
  return internal.getOptionParser().parseArgv(tokens);
};

// Parse a command line string for the browser console
internal.parseConsoleCommands = function(raw) {
  var str = raw.replace(/^mapshaper\b/, '').trim();
  var parsed;
  if (/^[a-z]/.test(str)) {
    // add hyphen prefix to bare command
    str = '-' + str;
  }
  if (utils.contains(internal.splitShellTokens(str), '-i')) {
    stop("The input command cannot be run in the browser");
  }
  parsed = internal.parseCommands(str);
  // block implicit initial -i command
  if (parsed.length > 0 && parsed[0].name == 'i') {
    stop(utils.format("Unable to run [%s]", raw));
  }
  return parsed;
};




internal.findCommandTargets = function(catalog, pattern, type) {
  var targets = [];
  var layers = utils.pluck(catalog.getLayers(), 'layer');
  var matches = internal.findMatchingLayers(layers, pattern);
  if (type) matches = matches.filter(function(lyr) {return lyr.geometry_type == type;});
  catalog.getDatasets().forEach(function(dataset) {
    var layers = dataset.layers.filter(function(lyr) {
      return matches.indexOf(lyr) > -1;
    });
    if (layers.length > 0) {
      targets.push({
        layers: layers,
        dataset: dataset
      });
    }
  });
  return targets;
};

// @pattern is a layer identifier or a comma-sep. list of identifiers.
// An identifier is a literal name, a pattern containing "*" wildcard or
// a 1-based index (1..n)
internal.findMatchingLayers = function(layers, pattern) {
  var matches = [];
  pattern.split(',').forEach(function(subpattern, i) {
    var test = internal.getLayerMatch(subpattern);
    layers.forEach(function(lyr, layerId) {
      if (matches.indexOf(lyr) > -1) return;
      if (test(lyr, layerId + 1)) {  // layers are 1-indexed
        lyr.match_id = matches.length;
        matches.push(lyr);
      } else {
        lyr.match_id = -1;
      }
    });
  });
  return matches;
};

internal.getLayerMatch = function(pattern) {
  var isIndex = utils.isInteger(Number(pattern));
  var nameRxp = isIndex ? null : utils.wildcardToRegExp(pattern);
  return function(lyr, i) {
    return isIndex ? String(i) == pattern : nameRxp.test(lyr.name || '');
  };
};




// Catalog contains zero or more multi-layer datasets
// One layer is always "active", corresponding to the currently selected
//   layer in the GUI or the current target in the CLI
function Catalog() {
  var datasets = [],
      target;

  this.forEachLayer = function(cb) {
    var i = 0;
    datasets.forEach(function(dataset) {
      dataset.layers.forEach(function(lyr) {
        cb(lyr, dataset, i++);
      });
    });
  };

  // remove a layer from a dataset
  this.deleteLayer = function(lyr, dataset) {
    var targ = this.getDefaultTarget(),
        other;

    // remove layer from its dataset
    dataset.layers.splice(dataset.layers.indexOf(lyr), 1);

    if (dataset.layers.length === 0) {
      this.removeDataset(dataset);
    }

    if (this.isEmpty()) {
      target = null;
    } else if (targ.layers[0] == lyr) {
      // deleting first target layer (selected in gui) -- switch to some other layer
      other = this.findAnotherLayer(lyr);
      this.setDefaultTarget([other.layer], other.dataset);
    } else if (targ.layers.indexOf(lyr) > -1) {
      // deleted layer is targeted -- update target
      targ.layers.splice(targ.layers.indexOf(lyr), 1);
      this.setDefaultTarget(targ.layers, targ.dataset);
    } else {
      // deleted layer is not a targeted layer, target not updated
    }
  };

  this.findLayer = function(target) {
    var found = null;
    this.forEachLayer(function(lyr, dataset) {
      if (lyr == target) {
        found = layerObject(lyr, dataset);
      }
    });
    return found;
  };

  this.findCommandTargets = function(pattern, type) {
    if (pattern) {
      return internal.findCommandTargets(this, pattern, type);
    }
    return target ? [target] : [];
  };

  this.removeDataset = function(dataset) {
    if (target && target.dataset == dataset) {
      target = null;
    }
    datasets = datasets.filter(function(d) {
      return d != dataset;
    });
  };

  this.getDatasets = function() {
    return datasets;
  };

  this.getLayers = function() {
    var layers = [];
    this.forEachLayer(function(lyr, dataset) {
      layers.push(layerObject(lyr, dataset));
    });
    return layers;
  };

  this.addDataset = function(dataset) {
    this.setDefaultTarget(dataset.layers, dataset);
    return this;
  };

  this.findNextLayer = function(lyr) {
    var layers = this.getLayers(),
        idx = indexOfLayer(lyr, layers);
    return idx > -1 ? layers[(idx + 1) % layers.length] : null;
  };

  this.findPrevLayer = function(lyr) {
    var layers = this.getLayers(),
        idx = indexOfLayer(lyr, layers);
    return idx > -1 ? layers[(idx - 1 + layers.length) % layers.length] : null;
  };

  this.findAnotherLayer = function(target) {
    var layers = this.getLayers(),
        found = null;
    if (layers.length > 0) {
      found = layers[0].layer == target ? layers[1] : layers[0];
    }
    return found;
  };

  this.isEmpty = function() {
    return datasets.length === 0;
  };

  this.getDefaultTarget = function() {return target || null;};

  this.setDefaultTarget = function(layers, dataset) {
    if (datasets.indexOf(dataset) == -1) {
      datasets.push(dataset);
    }
    target = {
      layers: layers,
      dataset: dataset
    };
  };

  // should be in mapshaper-gui-model.js, moved here for testing
  this.getActiveLayer = function() {
    var targ = this.getDefaultTarget();
    return targ ? {layer: targ.layers[0], dataset: targ.dataset} : null;
  };

  function layerObject(lyr, dataset) {
    return {
      layer: lyr,
      dataset: dataset
    };
  }

  function indexOfLayer(lyr, layers) {
    var idx = -1;
    layers.forEach(function(o, i) {
      if (o.layer == lyr) idx = i;
    });
    return idx;
  }
}

internal.getFormattedLayerList = function(catalog) {
  var lines = [];
  catalog.forEachLayer(function(lyr, dataset, i) {
    lines.push('  [' + (i+1) + ']  ' + (lyr.name || '[unnamed]'));
  });
  return lines.length > 0 ? lines.join('\n') : '[none]';
};




// Parse command line args into commands and run them
// @argv String or array of command line args, or array of parsed commands
api.runCommands = function(argv, done) {
  var commands;
  try {
    commands = internal.parseCommands(argv);
  } catch(e) {
    return done(e);
  }
  internal.runParsedCommands(commands, null, function(err, catalog) {
    done(err);
  });
};

// Similar to runCommands(), but receives input files from an object and
// returns output files to a callback, instead of using file I/O.
//
// @commands  String or array of command line args, or array of parsed commands
// @input  Object containing file contents indexed by filename
// @done  Callback: function(<error>, <output>), where output is an object
//           containing output from -o command(s) indexed by filename
//
api.applyCommands = function(commands, input, done) {
  var output = [],
      type = internal.guessInputContentType(input);

  try {
    commands = internal.parseCommands(commands);
  } catch(e) {
    return done(e);
  }
  if (type == 'text' || type == 'json') {
    // old api: input is the content of a CSV or JSON file
    // return done(new APIError('applyCommands() has changed, see v0.4 docs'));
    message("Warning: applyCommands() was called with deprecated input format");
    return internal.applyCommandsOld(commands, input, done);
  }
  // add options to -i -o -join commands to bypass file i/o
  commands = commands.map(function(cmd) {
    // copy options so passed-in commands are unchanged
    if ((cmd.name == 'i' || cmd.name == 'join') && input) {
      cmd.options.input = input;
    } else if (cmd.name == 'o') {
      cmd.options.output = output;
    }
    return cmd;
  });

  internal.runParsedCommands(commands, null, function(err) {
    var data = output.reduce(function(memo, o) {
        memo[o.filename] = o.content;
        return memo;
      }, {});
    done(err, err ? null : data);
  });
};

// TODO: rewrite applyCommands() tests and remove this function
// @commands array of parsed commands
// @content a JSON or CSV dataset
// @done callback: function(err, <data>) where <data> is the content of a
//     single output file or an array if multiple files are output
//
internal.applyCommandsOld = function(commands, content, done) {
  var output = [], lastCmd;
  commands = internal.runAndRemoveInfoCommands(commands);
  if (commands.length === 0 || commands[0].name != 'i') {
    commands.unshift({name: 'i', options: {}});
  }
  commands[0].options.input = {input: content};
  commands[0].options.files = ['input'];
  lastCmd = commands.pop();
  if (lastCmd.name != 'o') {
    commands.push(lastCmd);
    lastCmd = {name: 'o', options: {}};
  }
  commands.push(lastCmd);
  lastCmd.options.output = output;
  internal.runParsedCommands(commands, null, function(err) {
    var data = output.map(function(o) {return o.content;});
    if (data.length == 1) {
      data = data[0];
    }
    done(err, data);
  });
};

// TODO: rewrite tests and remove this function
internal.testCommands = function(argv, done) {
  internal.runParsedCommands(internal.parseCommands(argv), null, function(err, catalog) {
    var target = catalog && catalog.getDefaultTarget();
    var output;
    if (!err && target) {
      // returns dataset for compatibility with some older tests
      output = target.dataset;
    }
    done(err, output);
  });
};

// Execute a sequence of commands
// @commands Array of parsed commands
// @catalog: Optional Catalog object containing previously imported data
// @done: function(<error>, <catalog>)
//
internal.runParsedCommands = function(commands, catalog, done) {
  if (!catalog) {
    catalog = new Catalog();
  } else if (catalog instanceof Catalog === false) {
    error("Changed in v0.4: runParsedCommands() takes a Catalog object");
  }

  if (!utils.isFunction(done)) {
    error("Missing a callback function");
  }

  if (!utils.isArray(commands)) {
    error("Expected an array of parsed commands");
  }

  if (commands.length === 0) {
    return done(new APIError("No commands to run"));
  }
  commands = internal.runAndRemoveInfoCommands(commands);
  if (commands.length === 0) {
    return done(null);
  }
  commands = internal.divideImportCommand(commands);

  utils.reduceAsync(commands, catalog, function(catalog, cmd, nextCmd) {
    api.runCommand(cmd, catalog, nextCmd);
  }, done);
};

// If an initial import command indicates that several input files should be
//   processed separately, then duplicate the sequence of commands to run
//   once for each input file
// @commands Array of parsed commands
// Returns: either original command array or array of duplicated commands.
//
internal.divideImportCommand = function(commands) {
  var firstCmd = commands[0],
      lastCmd = commands[commands.length-1],
      opts = firstCmd.options;

  if (lastCmd.name == 'o') {
    // final output -- ok to modify dataset in-place during export, avoids
    //   having to copy entire dataset
    lastCmd.options.final = true;
  }

  if (firstCmd.name != 'i' || opts.stdin || opts.merge_files ||
    opts.combine_files || !opts.files || opts.files.length < 2) {
    return commands;
  }

  return (opts.files).reduce(function(memo, file) {
    var importCmd = {
      name: 'i',
      options: utils.defaults({
        files:[file],
        replace: true  // kludge to replace data catalog
      }, opts)
    };
    memo.push(importCmd);
    memo.push.apply(memo, commands.slice(1));
    return memo;
  }, []);
};

// Call @iter on each member of an array (similar to Array#reduce(iter))
//    iter: function(memo, item, callback)
// Call @done when all members have been processed or if an error occurs
//    done: function(err, memo)
// @memo: Initial value
//
utils.reduceAsync = function(arr, memo, iter, done) {
  var call = typeof setImmediate == 'undefined' ? setTimeout : setImmediate;
  var i=0;
  next(null, memo);

  function next(err, memo) {
    // Detach next operation from call stack to prevent overflow
    // Don't use setTimeout(, 0) if setImmediate is available
    // (setTimeout() can introduce a long delay if previous operation was slow,
    //    as of Node 0.10.32 -- a bug?)
    if (err) {
      return done(err, null);
    }
    call(function() {
      if (i < arr.length === false) {
        done(null, memo);
      } else {
        iter(memo, arr[i++], next);
      }
    }, 0);
  }
};

// Handle information commands and remove them from the list
internal.runAndRemoveInfoCommands = function(commands) {
  return commands.filter(function(cmd) {
    if (cmd.name == 'version') {
      message(internal.VERSION);
    } else if (cmd.name == 'encodings') {
      internal.printEncodings();
    } else if (cmd.name == 'projections') {
      internal.printProjections();
    } else if (cmd.name == 'verbose') {
      internal.VERBOSE = true;
    } else if (cmd.name == 'quiet') {
      internal.QUIET = true;
    } else if (cmd.name == 'debug') {
      internal.DEBUG = true;
    } else {
      return true;
    }
    return false;
  });
};




var cli = {};

cli.isFile = function(path, cache) {
  var ss = cli.statSync(path);
  return cache && (path in cache) || ss && ss.isFile() || false;
};

cli.fileSize = function(path) {
  var ss = cli.statSync(path);
  return ss && ss.size || 0;
};

cli.isDirectory = function(path) {
  var ss = cli.statSync(path);
  return ss && ss.isDirectory() || false;
};

// @encoding (optional) e.g. 'utf8'
cli.readFile = function(fname, encoding, cache) {
  var content;
  if (cache && (fname in cache)) {
    content = cache[fname];
    delete cache[fname];
  } else {
    content = require(fname == '/dev/stdin' ? 'rw' : 'fs').readFileSync(fname);
  }
  if (encoding && Buffer.isBuffer(content)) {
    content = internal.decodeString(content, encoding);
  }
  return content;
};

// @content Buffer or string
cli.writeFile = function(path, content, cb) {
  var fs = require('rw');
  if (cb) {
    fs.writeFile(path, content, cb);
  } else {
    fs.writeFileSync(path, content);
  }
};

// Returns Node Buffer
cli.convertArrayBuffer = function(buf) {
  var src = new Uint8Array(buf),
      dest = new Buffer(src.length);
  for (var i = 0, n=src.length; i < n; i++) {
    dest[i] = src[i];
  }
  return dest;
};

// Expand any "*" wild cards in file name
// (For the Windows command line; unix shells do this automatically)
cli.expandFileName = function(name) {
  var info = utils.parseLocalPath(name),
      rxp = utils.wildcardToRegExp(info.filename),
      dir = info.directory || '.',
      files = [];

  try {
    require('fs').readdirSync(dir).forEach(function(item) {
      var path = require('path').join(dir, item);
      if (rxp.test(item) && cli.isFile(path)) {
        files.push(path);
      }
    });
  } catch(e) {}

  if (files.length === 0) {
    stop('No files matched (' + name + ')');
  }
  return files;
};

// Expand any wildcards.
cli.expandInputFiles = function(files) {
  return files.reduce(function(memo, name) {
    if (name.indexOf('*') > -1) {
      memo = memo.concat(cli.expandFileName(name));
    } else {
      memo.push(name);
    }
    return memo;
  }, []);
};

cli.validateOutputDir = function(name) {
  if (!cli.isDirectory(name)) {
    error("Output directory not found:", name);
  }
};

// TODO: rename and improve
// Want to test if a path is something readable (e.g. file or stdin)
cli.checkFileExists = function(path, cache) {
  if (!cli.isFile(path, cache) && path != '/dev/stdin') {
    stop("File not found (" + path + ")");
  }
};

cli.statSync = function(fpath) {
  var obj = null;
  try {
    obj = require('fs').statSync(fpath);
  } catch(e) {}
  return obj;
};




api.cli = cli;
api.internal = internal;
api.utils = utils;
api.geom = geom;
this.mapshaper = api;

// Expose internal objects for testing
utils.extend(api.internal, {
  Catalog: Catalog,
  DataTable: DataTable,
  BinArray: BinArray,
  DouglasPeucker: DouglasPeucker,
  Visvalingam: Visvalingam,
  Heap: Heap,
  ShpReader: ShpReader,
  ShpType: ShpType,
  Dbf: Dbf,
  DbfReader: DbfReader,
  ShapefileTable: ShapefileTable,
  ArcCollection: ArcCollection,
  ArcIter: ArcIter,
  ShapeIter: ShapeIter,
  Bounds: Bounds,
  Transform: Transform,
  NodeCollection: NodeCollection,
  PolygonIndex: PolygonIndex,
  PathIndex: PathIndex,
  topojson: TopoJSON,
  geojson: GeoJSON,
  svg: SVG,
  APIError: APIError
});

if (typeof define === "function" && define.amd) {
  define("mapshaper", api);
} else if (typeof module === "object" && module.exports) {
  module.exports = api;
}

}());
