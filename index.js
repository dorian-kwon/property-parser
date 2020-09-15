'use strict';
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, '__esModule', { value: true });
function Iterator(text) {
    var pos = 0;
    var length = text.length;
    this.peek = function (num) {
        num = num || 0;
        if (pos + num >= length) {
            return null;
        }
        return text.charAt(pos + num);
    };
    this.next = function (inc) {
        inc = inc || 1;
        if (pos >= length) {
            return null;
        }
        return text.charAt((pos += inc) - inc);
    };
    this.pos = function () {
        return pos;
    };
}
var rWhitespace = /\s/;
function isWhitespace(chr) {
    return rWhitespace.test(chr);
}
function consumeWhiteSpace(iter) {
    var start = iter.pos();
    while (isWhitespace(iter.peek())) {
        iter.next();
    }
    return { type: 'whitespace', start: start, end: iter.pos() };
}
function startsComment(chr) {
    return chr === '!' || chr === '#';
}
function isEOL(chr) {
    return chr == null || chr === '\n' || chr === '\r';
}
function consumeComment(iter) {
    var start = iter.pos();
    while (!isEOL(iter.peek())) {
        iter.next();
    }
    return { type: 'comment', start: start, end: iter.pos() };
}
function startsKeyVal(chr) {
    return !isWhitespace(chr) && !startsComment(chr);
}
function startsSeparator(chr) {
    return chr === '=' || chr === ':' || isWhitespace(chr);
}
function startsEscapedVal(chr) {
    return chr === '\\';
}
function consumeEscapedVal(iter) {
    var start = iter.pos();
    iter.next(); // move past '\'
    var curChar = iter.next();
    if (curChar === 'u') {
        iter.next(4); // Read in the 4 hex values
    }
    return { type: 'escaped-value', start: start, end: iter.pos() };
}
function consumeKey(iter) {
    var start = iter.pos();
    var children = [];
    var curChar;
    while ((curChar = iter.peek()) !== null) {
        if (startsSeparator(curChar)) {
            break;
        }
        if (startsEscapedVal(curChar)) {
            children.push(consumeEscapedVal(iter));
            continue;
        }
        iter.next();
    }
    return { type: 'key', start: start, end: iter.pos(), children: children };
}
function consumeKeyValSeparator(iter) {
    var start = iter.pos();
    var seenHardSep = false;
    var curChar;
    while ((curChar = iter.peek()) !== null) {
        if (isEOL(curChar)) {
            break;
        }
        if (isWhitespace(curChar)) {
            iter.next();
            continue;
        }
        if (seenHardSep) {
            break;
        }
        seenHardSep = curChar === ':' || curChar === '=';
        if (seenHardSep) {
            iter.next();
            continue;
        }
        break; // curChar is a non-separtor char
    }
    return { type: 'key-value-separator', start: start, end: iter.pos() };
}
function startsLineBreak(iter) {
    return iter.peek() === '\\' && isEOL(iter.peek(1));
}
function consumeLineBreak(iter) {
    var start = iter.pos();
    iter.next(); // consume \
    if (iter.peek() === '\r') {
        iter.next();
    }
    iter.next(); // consume \n
    var curChar;
    while ((curChar = iter.peek()) !== null) {
        if (isEOL(curChar)) {
            break;
        }
        if (!isWhitespace(curChar)) {
            break;
        }
        iter.next();
    }
    return { type: 'line-break', start: start, end: iter.pos() };
}
function consumeVal(iter) {
    var start = iter.pos();
    var children = [];
    var curChar;
    while ((curChar = iter.peek()) !== null) {
        if (startsLineBreak(iter)) {
            children.push(consumeLineBreak(iter));
            continue;
        }
        if (startsEscapedVal(curChar)) {
            children.push(consumeEscapedVal(iter));
            continue;
        }
        if (isEOL(curChar)) {
            break;
        }
        iter.next();
    }
    return { type: 'value', start: start, end: iter.pos(), children: children };
}
function consumeKeyVal(iter) {
    return {
        type: 'key-value',
        start: iter.pos(),
        children: [consumeKey(iter), consumeKeyValSeparator(iter), consumeVal(iter)],
        end: iter.pos(),
    };
}
/* eslint-disable */
var renderChild = {
    'escaped-value': function (child, text) {
        var type = text.charAt(child.start + 1);
        if (type === 't') {
            return '\t';
        }
        if (type === 'r') {
            return '\r';
        }
        if (type === 'n') {
            return '\n';
        }
        if (type === 'f') {
            return '\f';
        }
        if (type !== 'u') {
            return type;
        }
        return String.fromCharCode(parseInt(text.substr(child.start + 2, 4), 16));
    },
    'line-break': function (child, text) {
        return '';
    }
};
function rangeToBuffer(range, text) {
    var start = range.start;
    var buffer = [];
    for (var i = 0; i < range.children.length; i++) {
        var child = range.children[i];
        buffer.push(text.substring(start, child.start));
        buffer.push(renderChild[child.type](child, text));
        start = child.end;
    }
    buffer.push(text.substring(start, range.end));
    return buffer;
}
function rangesToObject(ranges, text) {
    var obj = Object.create(null); // Creates to a true hash map
    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (range.type !== 'key-value') {
            continue;
        }
        var key = rangeToBuffer(range.children[0], text).join('');
        var val = rangeToBuffer(range.children[2], text).join('');
        obj[key] = val;
    }
    return obj;
}
function stringToRanges(text) {
    var iter = new Iterator(text), ranges = [];
    var curChar;
    while ((curChar = iter.peek()) !== null) {
        if (isWhitespace(curChar)) {
            ranges.push(consumeWhiteSpace(iter));
            continue;
        }
        if (startsComment(curChar)) {
            ranges.push(consumeComment(iter));
            continue;
        }
        if (startsKeyVal(curChar)) {
            ranges.push(consumeKeyVal(iter));
            continue;
        }
        throw Error('Something crazy happened. text: ' + text + '; curChar: ' + curChar + '');
    }
    return ranges;
}
function parse(text) {
    text = text.toString();
    var ranges = stringToRanges(text);
    return rangesToObject(ranges, text);
}
function enhancedParse(text) {
    var object = parse(text);
    Object.keys(object).forEach(function (k) {
        object[k] = parseExpression(object, k);
    });
    return object;
}
var functionMap = {
    lower: function (v) { return _d(v, '').toLowerCase(); },
    upper: function (v) { return _d(v, '').toUpperCase(); },
    capital: function (v) {
        var r = _d(v, '');
        return !r ? r : r[0].toUpperCase() + r.slice(1).toLowerCase();
    },
    empty: function (v) {
        return v;
    }
};
function _d(a, b) {
    return a ? a : b;
}
var hasExpression = /\${\s*([\\.|\w]*(\s*:\s*\w+)*)\s*}/;
var hasFunction = /\s*:\s*/;
function parseExpression(props, propsKey, keyStack) {
    if (keyStack === void 0) { keyStack = []; }
    var matches;
    var next = props[propsKey];
    if (!next)
        return;
    var mergedValue = '';
    var newKeyStack = __spreadArrays(keyStack, [propsKey]);
    var _loop_1 = function () {
        var key = matches[1];
        var func = functionMap['empty'];
        var matchedKey = matches[1];
        if (hasFunction.test(matchedKey)) {
            var splitKey = String.prototype.split.apply(matchedKey, [hasFunction]);
            key = splitKey[0];
            func = _d(functionMap[splitKey[1]], func);
        }
        if (newKeyStack.some(function (v) { return v === key; }))
            return { value: void 0 };
        mergedValue += next.substring(0, matches.index);
        var parsedValue = func(parseExpression(props, key, newKeyStack));
        if (parsedValue)
            mergedValue += parsedValue;
        else {
            if (keyStack.length > 0)
                return { value: void 0 };
            else
                mergedValue += matches[0];
        }
        next = next.slice(matches.index + matches[0].length);
    };
    while ((matches = next.match(hasExpression))) {
        var state_1 = _loop_1();
        if (typeof state_1 === "object")
            return state_1.value;
    }
    return mergedValue + next;
}
function convertProperties(props) {
    var flatProps = enhancedParse(props);
    var inflated = {};
    Object.keys(flatProps).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(flatProps, key)) {
            var item = inflated;
            var splitKey = key.split('.');
            for (var i = 0; i < splitKey.length - 1; i++) {
                var part = splitKey[i];
                if (!item[part]) {
                    item[part] = {};
                }
                item = item[part];
            }
            var last = splitKey[splitKey.length - 1];
            if (typeof item[last] !== 'undefined') {
                throw new Error('Failed to convert .properties to JSON. ' +
                    'Property ' +
                    splitKey.join('.') +
                    ' is already assigned or contains nested properties.');
            }
            item[last] = flatProps[key];
        }
    });
    return inflated;
}
module.exports = {
    parse: parse,
    enhancedParse: enhancedParse,
    convertProperties: convertProperties,
};
