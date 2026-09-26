import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t2) => t2.tag === tagName);
        const tagObj = match.find((t2) => !t2.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t2) => t2.identify?.(value) && !t2.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str2) => str2.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str2, indent, comment) => str2.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str2.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str2) => /^(%|---|\.\.\.)/m.test(str2);
    function lineLengthOverLimit(str2, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str2.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str2[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str2 = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str2 += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str2 += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str2 += "\\0";
                    break;
                  case "0007":
                    str2 += "\\a";
                    break;
                  case "000b":
                    str2 += "\\v";
                    break;
                  case "001b":
                    str2 += "\\e";
                    break;
                  case "0085":
                    str2 += "\\N";
                    break;
                  case "00a0":
                    str2 += "\\_";
                    break;
                  case "2028":
                    str2 += "\\L";
                    break;
                  case "2029":
                    str2 += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str2 += "\\x" + code.substr(2);
                    else
                      str2 += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str2 += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str2 += "\n";
                  i += 2;
                }
                str2 += indent;
                if (json[i + 2] === " ")
                  str2 += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str2 = start ? str2 + json.slice(start) : json;
      return implicitKey ? str2 : foldFlowLines.foldFlowLines(str2, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str2 = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str2);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str2 : foldFlowLines.foldFlowLines(str2, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t2 = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t2);
        if (res === null)
          throw new Error(`Unsupported default string type ${t2}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t2) => t2.tag === item.tag);
        if (match.length > 0)
          return match.find((t2) => t2.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t2) => t2.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t2) => t2.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t2) => t2.format === item.format) ?? match.find((t2) => !t2.format);
      } else {
        obj = item;
        tagObj = tags.find((t2) => t2.nodeClass && obj instanceof t2.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str2 = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str2;
      return identity.isScalar(node) || str2[0] === "{" || str2[0] === "[" ? `${props} ${str2}` : `${props}
${ctx.indent}${str2}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str2 = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str2.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str2 === "" ? "?" : explicitKey ? `? ${str2}` : str2;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str2 = `? ${str2}`;
        if (keyComment && !keyCommentDone) {
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str2;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
        str2 = `? ${str2}
${indent}:`;
      } else {
        str2 = `${str2}:`;
        if (keyComment)
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str2.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str2 += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str2;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str3 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str3 += stringifyComment.lineComment(str3, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str3);
      }
      let str2;
      if (lines.length === 0) {
        str2 = flowChars.start + flowChars.end;
      } else {
        str2 = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str2 += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str2 += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str2;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str2 = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str2.includes("\n"));
        if (i < items.length - 1) {
          str2 += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str2.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str2 += ",";
          }
        }
        if (comment)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment));
        lines.push(str2);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str2 = start;
          for (const line of lines)
            str2 += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str2}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str2) => str2,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str2) => new Scalar.Scalar(str2[0] === "t" || str2[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str2) => str2.slice(-3).toLowerCase() === "nan" ? NaN : str2[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str2) => parseFloat(str2),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str2) {
        const node = new Scalar.Scalar(parseFloat(str2));
        const dot = str2.indexOf(".");
        if (dot !== -1 && str2[str2.length - 1] === "0")
          node.minFractionDigits = str2.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str2, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str2) : parseInt(str2.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool2 = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool2.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str2) => str2,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str2) => str2 === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str2, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str2) : parseInt(str2, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str2) => parseFloat(str2),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str2, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str2)}`);
        return str2;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str2 = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str2.length);
          for (let i = 0; i < str2.length; ++i)
            buffer[i] = str2.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str2;
        if (typeof node_buffer.Buffer === "function") {
          str2 = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str2 = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str2.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str2.substr(o, lineWidth);
          }
          str2 = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str2 }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str2) => str2.slice(-3).toLowerCase() === "nan" ? NaN : str2[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str2) => parseFloat(str2.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str2) {
        const node = new Scalar.Scalar(parseFloat(str2.replace(/_/g, "")));
        const dot = str2.indexOf(".");
        if (dot !== -1) {
          const f = str2.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str2, offset, radix, { intAsBigInt }) {
      const sign = str2[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str2 = str2.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str2 = `0b${str2}`;
            break;
          case 8:
            str2 = `0o${str2}`;
            break;
          case 16:
            str2 = `0x${str2}`;
            break;
        }
        const n2 = BigInt(str2);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str2, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str2 = value.toString(radix);
        return value < 0 ? "-" + prefix + str2.substr(1) : prefix + str2;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str2, asBigInt) {
      const sign = str2[0];
      const parts = sign === "-" || sign === "+" ? str2.substring(1) : str2;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str2, _onError, { intAsBigInt }) => parseSexagesimal(str2, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str2) => parseSexagesimal(str2, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str2) {
        const match = str2.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool2 = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool2.trueTag,
      bool2.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool2 = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool2.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep2, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep2) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep2 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep2, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep2 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep2 + cb;
              sep2 = "";
              break;
            }
            case "newline":
              if (comment)
                sep2 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep2, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep2 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep2 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep2, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep2 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep2)
                for (const st of sep2) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep2, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t2) => t2.tag === tagName && t2.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep2 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep2 === " ")
            sep2 = "\n";
          else if (!prevMoreIndented && sep2 === "\n")
            sep2 = "\n\n";
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep2 === "\n")
            value += "\n";
          else
            sep2 = "\n";
        } else {
          value += sep2 + content;
          sep2 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep2 = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep2 === "\n")
            res += sep2;
          else
            sep2 = "\n";
        } else {
          res += sep2 + lm;
          sep2 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep2 + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep2, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep2)
        for (const st of sep2)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field2, index] of path) {
        const tok = item?.[field2];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field2 = path[path.length - 1][0];
      const coll = parent?.[field2];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field2 of ["key", "value"]) {
        const token = item[field2];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field2, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field2 === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep2;
          if (scalar.end) {
            sep2 = scalar.end;
            sep2.push(this.sourceToken);
            delete scalar.end;
          } else
            sep2 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep2 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep2 = it.sep;
                  sep2.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep2 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep2 = fc.end.splice(1, fc.end.length);
            sep2.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep2 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// packages/apertrail/scripts/interchange/export.ts
import { join as join3 } from "node:path";

// packages/core/dist/dates/day.js
function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}
function formatDayTitle(date = /* @__PURE__ */ new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// packages/core/dist/text/case-fold.js
function caseFold(value) {
  if (!value)
    return "";
  return value.normalize("NFC").trim().toLowerCase();
}

// packages/core/dist/crm/tags.js
function readTags(value) {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => typeof entry === "string" ? entry.split(",") : []).map((entry) => entry.trim().replace(/^#/, "").trim()).filter((entry) => entry !== "");
}

// packages/core/dist/frontmatter/read.js
function readString(value) {
  if (typeof value !== "string")
    return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
function readNumberLike(value) {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "")
      return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function readBooleanLike(value) {
  if (typeof value === "boolean")
    return value;
  if (typeof value === "string") {
    const normalized = caseFold(value);
    if (["true", "yes", "y", "1"].includes(normalized))
      return true;
    if (["false", "no", "n", "0"].includes(normalized))
      return false;
  }
  return null;
}
function readStringList(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((entry) => typeof entry === "string" ? entry.split(",") : []).map((entry) => entry.trim()).filter((entry) => entry !== "");
}
function readTextLines(value) {
  return wholeEntries(value);
}
function wholeEntries(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => typeof entry === "string" ? entry.trim() : "").filter((entry) => entry !== "");
}
function findValue(frontmatter, ...names) {
  if (!frontmatter)
    return void 0;
  const byLowerName = /* @__PURE__ */ new Map();
  for (const key of Object.keys(frontmatter)) {
    const lower = caseFold(key);
    if (!byLowerName.has(lower))
      byLowerName.set(lower, key);
  }
  for (const name of names) {
    if (!name)
      continue;
    const key = byLowerName.get(caseFold(name));
    if (key === void 0)
      continue;
    const value = frontmatter[key];
    if (value !== void 0 && value !== null && value !== "")
      return value;
  }
  return void 0;
}

// packages/core/dist/crm/note.js
function crmTypeValue(properties, kind) {
  return kind === "person" ? properties.personTypeValue : properties.companyTypeValue;
}
function crmTagProperty(properties, kind) {
  return kind === "person" ? properties.personTagProperty : properties.companyTagProperty;
}
function crmRolesProperty(properties, kind) {
  return kind === "person" ? properties.personRolesProperty : properties.companyRolesProperty;
}
function rolesFor(frontmatter, properties, kind) {
  const name = crmRolesProperty(properties, kind);
  return name ? readStringList(frontmatter[name]) : [];
}
function field(frontmatter, name) {
  if (!name || name.trim() === "")
    return null;
  return readString(frontmatter[name]);
}
function parseCrmNote(frontmatter, properties, kind) {
  return {
    tags: readTags(frontmatter[crmTagProperty(properties, kind)]),
    // Through `readStringList`, so a YAML list, a bare value and one
    // comma-separated string all read alike. That is how a hand-edited note
    // spells a short list, and all three occur in a real vault.
    roles: rolesFor(frontmatter, properties, kind),
    description: field(frontmatter, properties.descriptionProperty),
    address: field(frontmatter, properties.addressProperty),
    website: field(frontmatter, properties.websiteProperty),
    email: field(frontmatter, properties.emailProperty),
    phone: field(frontmatter, properties.phoneProperty),
    mobile: field(frontmatter, properties.mobileProperty)
  };
}

// packages/core/dist/dates/stamps.js
function formatDateTimeStamp(date = /* @__PURE__ */ new Date()) {
  return `${formatDayTitle(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// packages/core/dist/dates/read.js
function readDateLike(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "")
      return null;
    const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
    return dateOnly ? dateOnly[1] ?? trimmed : trimmed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDayTitle(value);
  }
  return null;
}
function readDateTimeLike(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDateTimeStamp(value);
  }
  return null;
}

// packages/core/dist/links/wikilink.js
var WIKILINK = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/;
function withoutSubpath(target) {
  return target.split("#")[0]?.split("^")[0]?.trim() ?? "";
}
function stripWikilink(value) {
  const match = WIKILINK.exec(value.trim());
  return match ? withoutSubpath(match[1] ?? "") : value.trim();
}
function wikilinkTarget(raw) {
  if (typeof raw !== "string")
    return null;
  const match = WIKILINK.exec(raw.trim());
  if (!match)
    return null;
  const target = withoutSubpath(match[1] ?? "");
  return target === "" ? null : target;
}
function wikilinkTargets(raw) {
  const values = Array.isArray(raw) ? raw : [raw];
  const targets = [];
  for (const value of values) {
    const target = wikilinkTarget(value);
    if (target)
      targets.push(target);
  }
  return targets;
}

// packages/core/dist/money/format.js
function normalizeCurrency(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

// packages/core/dist/frontmatter/block.js
function splitFrontmatterBlock(text) {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---")
    return { header: "", body: text };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      return {
        header: `${lines.slice(0, i + 1).join("\n")}
`,
        body: lines.slice(i + 1).join("\n")
      };
    }
  }
  return { header: "", body: text };
}

// packages/core/dist/geo/points.js
var RAD = Math.PI / 180;

// packages/core/dist/interchange/types.js
var INTERCHANGE_FORMAT = "trail-interchange";
var INTERCHANGE_VERSION = 1;

// packages/core/dist/interchange/to-record.js
function noteBacked(value) {
  const file = value.file;
  return typeof file === "object" && file !== null && typeof file.path === "string";
}
function plain(value, depth) {
  if (value === null || value === void 0)
    return null;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : null;
  if (typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "bigint")
    return value.toString();
  if (typeof value === "function" || typeof value === "symbol")
    return void 0;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value))
    return value.map((item) => plain(item, depth + 1) ?? null);
  if (value instanceof Map)
    return plain(Object.fromEntries(value), depth);
  if (value instanceof Set)
    return plain([...value], depth);
  const object = value;
  if (depth > 0 && noteBacked(object))
    return { ref: object.file.path };
  const out = {};
  for (const [key, field2] of Object.entries(object)) {
    if (depth === 0 && key === "file")
      continue;
    const converted = plain(field2, depth + 1);
    if (converted !== void 0)
      out[key] = converted;
  }
  return out;
}
function toInterchangeRecord(record) {
  return plain(record, 0);
}

// packages/core/dist/interchange/section.js
function familyEntries(records) {
  return records.map((record) => ({ path: record.file.path, record: toInterchangeRecord(record) })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function sectionFile(source, meta, families, lines) {
  return {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    source,
    sourceVersion: meta.sourceVersion,
    generatedAt: meta.generatedAt,
    families,
    ...lines && Object.keys(lines).length > 0 ? { lines } : {}
  };
}

// packages/core/dist/paths/folders.js
function normalizePath(path) {
  return path.replace(/\\/g, "/").split("/").filter((segment) => segment !== "" && segment !== ".").join("/");
}
function joinFolder(parent, child) {
  const left = normalizePath(parent);
  const right = normalizePath(child);
  if (!left)
    return right;
  if (!right)
    return left;
  return `${left}/${right}`;
}
function isUnderFolder(filePath, folderPath) {
  const folder = normalizePath(folderPath);
  if (!folder)
    return true;
  const file = normalizePath(filePath);
  return file === folder || file.startsWith(`${folder}/`);
}
function isUnderAnyFolder(filePath, folderPaths) {
  const folders = folderPaths.map(normalizePath).filter((folder) => folder !== "");
  return folders.some((folder) => isUnderFolder(filePath, folder));
}

// packages/core/dist/period/levels.js
function detectPeriodLevel(title) {
  const text = title.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text))
    return "day";
  if (/^\d{4}-W\d{2}$/i.test(text))
    return "week";
  if (/^\d{4}-Q[1-4]$/i.test(text))
    return "quarter";
  if (/^\d{4}-\d{2}$/.test(text))
    return "month";
  if (/^\d{4}$/.test(text))
    return "year";
  return null;
}

// packages/core/dist/priority/priority.js
var NUMBERS = Object.freeze({
  critical: 1,
  high: 2,
  medium: 3,
  low: 4
});
var TASK = Object.freeze({
  critical: "highest",
  high: "high",
  medium: "medium",
  low: "low"
});

// packages/core/dist/plan/line.js
var LEFTOVERS_TAG = "leftovers";
var LEFTOVERS = new RegExp(`#${LEFTOVERS_TAG}(?![\\w/-])`, "i");
var LEFTOVERS_ALL = new RegExp(`\\s*#${LEFTOVERS_TAG}(?![\\w/-])`, "gi");

// packages/core/dist/meal/nutrients.js
var MACRONUTRIENT_IDS = [
  "fat",
  "saturatedFat",
  "carbs",
  "sugar",
  "fibre",
  "protein"
];
var MICRONUTRIENT_IDS = [
  "salt",
  "sodium",
  "potassium",
  "chloride",
  "calcium",
  "phosphorus",
  "magnesium",
  "iron",
  "zinc",
  "copper",
  "manganese",
  "fluoride",
  "selenium",
  "chromium",
  "molybdenum",
  "iodine",
  "vitaminA",
  "vitaminD",
  "vitaminE",
  "vitaminK",
  "vitaminC",
  "thiamin",
  "riboflavin",
  "niacin",
  "vitaminB6",
  "folicAcid",
  "vitaminB12",
  "biotin",
  "pantothenicAcid"
];
var KNOWN_NUTRIENTS = {
  // Macronutrients. All in grams, which is the only unit a declaration uses for
  // them, so no note should ever need to disagree.
  fat: { labelEn: "Fat", labelDe: "Fett", unit: "g", aliases: ["Fat (g)", "Fett (g)"] },
  saturatedFat: {
    labelEn: "Saturated Fat",
    labelDe: "Ges\xE4ttigte Fetts\xE4uren",
    unit: "g",
    aliases: [
      "Saturates",
      "Saturated Fatty Acids",
      "of which saturates",
      "of which saturated fat",
      "davon ges\xE4ttigte Fetts\xE4uren",
      "Gesaettigte Fettsaeuren"
    ]
  },
  carbs: {
    labelEn: "Carbohydrates",
    labelDe: "Kohlenhydrate",
    unit: "g",
    aliases: ["Carbohydrates (g)", "Carbs", "Carbohydrate", "Kohlenhydrate (g)"]
  },
  sugar: {
    labelEn: "Sugar",
    labelDe: "Zucker",
    unit: "g",
    aliases: ["Sugars", "of which sugars", "davon Zucker"]
  },
  fibre: {
    labelEn: "Fibre",
    labelDe: "Ballaststoffe",
    unit: "g",
    aliases: ["Fiber", "Dietary Fibre", "Dietary Fiber"]
  },
  protein: {
    labelEn: "Protein",
    labelDe: "Eiweiss",
    unit: "g",
    aliases: ["Protein (g)", "Eiwei\xDF", "Eiweiss (g)", "Proteine"]
  },
  // Micronutrients.
  salt: { labelEn: "Salt", labelDe: "Salz", unit: "g", aliases: ["Salt equivalent", "Kochsalz"] },
  sodium: { labelEn: "Sodium", labelDe: "Natrium", unit: "mg" },
  potassium: { labelEn: "Potassium", labelDe: "Kalium", unit: "mg" },
  chloride: { labelEn: "Chloride", labelDe: "Chlorid", unit: "mg" },
  calcium: { labelEn: "Calcium", labelDe: "Calcium", unit: "mg", aliases: ["Kalzium"] },
  phosphorus: { labelEn: "Phosphorus", labelDe: "Phosphor", unit: "mg" },
  magnesium: { labelEn: "Magnesium", labelDe: "Magnesium", unit: "mg" },
  iron: { labelEn: "Iron", labelDe: "Eisen", unit: "mg" },
  zinc: { labelEn: "Zinc", labelDe: "Zink", unit: "mg" },
  copper: { labelEn: "Copper", labelDe: "Kupfer", unit: "mg" },
  manganese: { labelEn: "Manganese", labelDe: "Mangan", unit: "mg" },
  fluoride: { labelEn: "Fluoride", labelDe: "Fluorid", unit: "mg" },
  selenium: { labelEn: "Selenium", labelDe: "Selen", unit: "\xB5g" },
  chromium: { labelEn: "Chromium", labelDe: "Chrom", unit: "\xB5g" },
  molybdenum: { labelEn: "Molybdenum", labelDe: "Molybd\xE4n", unit: "\xB5g" },
  iodine: { labelEn: "Iodine", labelDe: "Jod", unit: "\xB5g", aliases: ["Iod"] },
  vitaminA: { labelEn: "Vitamin A", labelDe: "Vitamin A", unit: "\xB5g", aliases: ["Retinol"] },
  vitaminD: { labelEn: "Vitamin D", labelDe: "Vitamin D", unit: "\xB5g" },
  vitaminE: { labelEn: "Vitamin E", labelDe: "Vitamin E", unit: "mg" },
  vitaminK: { labelEn: "Vitamin K", labelDe: "Vitamin K", unit: "\xB5g" },
  vitaminC: {
    labelEn: "Vitamin C",
    labelDe: "Vitamin C",
    unit: "mg",
    aliases: ["Ascorbic Acid", "Ascorbins\xE4ure"]
  },
  thiamin: {
    labelEn: "Thiamin",
    labelDe: "Thiamin",
    unit: "mg",
    aliases: ["Vitamin B1", "Thiamine"]
  },
  riboflavin: { labelEn: "Riboflavin", labelDe: "Riboflavin", unit: "mg", aliases: ["Vitamin B2"] },
  niacin: { labelEn: "Niacin", labelDe: "Niacin", unit: "mg", aliases: ["Vitamin B3"] },
  vitaminB6: { labelEn: "Vitamin B6", labelDe: "Vitamin B6", unit: "mg", aliases: ["Pyridoxin"] },
  folicAcid: {
    labelEn: "Folic Acid",
    labelDe: "Fols\xE4ure",
    unit: "\xB5g",
    aliases: ["Folate", "Folat", "Vitamin B9", "Folsaeure"]
  },
  vitaminB12: {
    labelEn: "Vitamin B12",
    labelDe: "Vitamin B12",
    unit: "\xB5g",
    aliases: ["Cobalamin"]
  },
  biotin: { labelEn: "Biotin", labelDe: "Biotin", unit: "\xB5g", aliases: ["Vitamin B7"] },
  pantothenicAcid: {
    labelEn: "Pantothenic Acid",
    labelDe: "Pantothens\xE4ure",
    unit: "mg",
    aliases: ["Vitamin B5", "Pantothensaeure"]
  }
};
var NUTRIENT_ORDER = [
  ...MACRONUTRIENT_IDS,
  ...MICRONUTRIENT_IDS
];
function normalize(value) {
  return caseFold(value.trim().replace(/\s+/g, " ").replace(/:$/, ""));
}
var BY_NAME = (() => {
  const map = /* @__PURE__ */ new Map();
  for (const id of NUTRIENT_ORDER) {
    const known = KNOWN_NUTRIENTS[id];
    const names = [id, known.labelEn, known.labelDe, ...known.aliases ?? []];
    for (const name of names) {
      const key = normalize(name);
      if (key !== "" && !map.has(key))
        map.set(key, id);
    }
  }
  return map;
})();

// packages/core/dist/reheating/appliances.js
var DEFAULT_APPLIANCE_IDS = ["microwave", "oven", "steamer", "skillet"];
var APPLIANCE_LABELS_EN = {
  microwave: "Microwave",
  oven: "Oven",
  steamer: "Steamer",
  skillet: "Skillet"
};
var DEFAULT_APPLIANCES = DEFAULT_APPLIANCE_IDS.map((id) => ({
  id,
  label: APPLIANCE_LABELS_EN[id]
}));

// packages/core/dist/travel/entity-types.js
var TRAVEL_PLACE_TYPES = [
  "accommodation",
  "fnb",
  "landmark",
  "location",
  "photospot"
];

// packages/core/dist/travel/relative-days.js
var CLOCK = /^(\d{1,2}):(\d{2})/;
function clockTime(value) {
  if (!value)
    return null;
  const match = CLOCK.exec(value.trim());
  if (match)
    return `${(match[1] ?? "").padStart(2, "0")}:${match[2]}`;
  const inDateTime = /T(\d{2}:\d{2})/.exec(value);
  return inDateTime ? inDateTime[1] ?? null : null;
}

// packages/core/dist/settings/crm-contract.js
var CRM_CONTRACT = Object.freeze({
  typePropertyName: "type",
  personsFolder: "CRM/People",
  companiesFolder: "CRM/Companies",
  personTypeValue: "person",
  companyTypeValue: "company",
  personTagProperty: "tags",
  companyTagProperty: "tags",
  personRolesProperty: "roles",
  companyRolesProperty: "roles"
});

// packages/core/dist/settings/display-contract.js
var DISPLAY_CONTRACT = Object.freeze({
  displayLocale: ""
});

// packages/core/dist/settings/sheet-contract.js
var SHEET_CONTRACT = Object.freeze({
  exportAuthor: "",
  exportsSubfolder: "_exports"
});

// packages/core/dist/settings/order-contract.js
var ORDER_CONTRACT = Object.freeze({
  ordersFolder: "Eating/Orders",
  orderTypeValue: "order",
  orderCompanyProperty: "company",
  orderDateProperty: "orderDate",
  orderPriceProperty: "price",
  orderPriceCurrencyProperty: "priceCurrency"
});

// packages/core/dist/settings/trip-contract.js
var TRIP_CONTRACT = Object.freeze({
  typePropertyName: "type",
  tripsFolder: "Trips",
  travelStatusProperty: "travelStatus",
  departureProperty: "departure",
  returnProperty: "return",
  personsProperty: "persons",
  stopsProperty: "stops",
  stopPlaceField: "place",
  stopDayField: "day",
  stopFromField: "from",
  stopToField: "to",
  stopExcursionField: "excursion",
  stopPersonsField: "persons",
  stopOptionalField: "optional",
  stopChosenField: "chosen"
});

// packages/core/dist/solar/sun.js
var RAD2 = Math.PI / 180;
var DELTA_T_DAYS = 69 / 86400;
var OBLIQUITY = 23.4397 * RAD2;
var PERIHELION = 102.9372 * RAD2;

// packages/core/dist/tasks/types.js
var PRIORITY_MARKERS = Object.freeze({
  highest: "\u{1F53A}",
  high: "\u23EB",
  medium: "\u{1F53C}",
  low: "\u{1F53D}",
  lowest: "\u23EC"
});
var DATE_MARKERS = Object.freeze({
  created: "\u2795",
  start: "\u{1F6EB}",
  scheduled: "\u23F3",
  due: "\u{1F4C5}",
  done: "\u2705",
  cancelled: "\u274C"
});

// packages/core/dist/tasks/fields.js
var TRAILING_DUE = new RegExp(`\\s+${DATE_MARKERS.due}\\s+(\\d{4}-\\d{2}-\\d{2})$`, "u");
var NAMES_A_DAY = new RegExp(`[${DATE_MARKERS.due}${DATE_MARKERS.scheduled}${DATE_MARKERS.start}]\\s*\\d{4}-\\d{2}-\\d{2}`, "u");

// packages/core/dist/vault/read-notes.js
function matchesType(frontmatter, typePropertyName, expected) {
  if (!expected)
    return false;
  const raw = frontmatter[typePropertyName || "type"];
  const candidates = Array.isArray(raw) ? raw : [raw];
  return candidates.some((candidate) => {
    const text = readString(candidate);
    return text !== null && stripWikilink(text) === expected;
  });
}
function readNotesOfType(host, query) {
  const folders = query.folders.map((folder) => folder.trim()).filter((folder) => folder !== "");
  if (folders.length === 0)
    return [];
  if (!query.typeValue)
    return [];
  return host.vault.markdownFiles().filter((file) => isUnderAnyFolder(file.path, folders)).map((file) => ({
    file,
    title: file.basename,
    frontmatter: host.metadata.frontmatterOf(file) ?? {}
  })).filter((note) => matchesType(note.frontmatter, query.typePropertyName, query.typeValue)).sort((a, b) => a.title.localeCompare(b.title));
}

// packages/apertrail/src/shared/clock.ts
var CLOCK_FORMATS = ["auto", "24h", "12h"];

// packages/apertrail/src/shared/units.ts
var UNIT_SYSTEMS = ["metric", "imperial"];

// packages/apertrail/tests/obsidian-stub.ts
function unmocked(name) {
  throw new Error(`obsidian.${name}() called without vi.mock('obsidian') in the suite.`);
}
var getLanguage = () => unmocked("getLanguage");

// packages/apertrail/src/lang/translations/en.ts
var enTranslations = {
  commands: {
    openDashboard: "Open Trips, countries & places",
    openCrmDashboard: "Open CRM dashboard",
    openGallery: "Browse trips, countries & places",
    newTrip: "New trip",
    newCountry: "New country",
    newState: "New state",
    newCity: "New city",
    newAccommodation: "New accommodation",
    newFnb: "New food & beverage",
    newLandmark: "New landmark",
    newLocation: "New location",
    newVehicle: "New ship or train",
    newExcursion: "New excursion",
    editVehicleCabins: "Cabins and details of this ship or train",
    newPhotoSpot: "New photo spot",
    exportPhotoSpotSheet: "Export this photo spot as a field sheet",
    editNoteCover: "Edit this travel note",
    exportProspect: "Export this note as a prospect",
    exportTripDocument: "Export this trip as a document",
    exportBookingSheet: "Export a booking sheet for this trip",
    newBooking: "New booking",
    newPerson: "New person",
    newCompany: "New company",
    createSampleVault: "Create the sample notes"
  },
  booking: {
    category: {
      transport: "Transport",
      accommodation: "Accommodation",
      activity: "Activities",
      food: "Food & drink",
      fees: "Fees",
      other: "Other"
    },
    status: {
      estimate: "Estimated",
      booked: "Booked",
      paid: "Paid",
      cancelled: "Cancelled",
      refunded: "Refunded"
    }
  },
  costs: {
    heading: "Costs",
    documentLabel: "Trip costs",
    notATrip: "This note is not a trip, or it does not sit in the configured Trips folder.",
    noBookings: "No bookings yet. Add one, or point a booking note at this trip.",
    saveFailed: "Could not save the trip.",
    switchedOff: "Trip costs are switched off in the plugin settings.",
    addBooking: "Booking",
    editBudget: "Budget",
    editRates: "Rates",
    planned: "Planned",
    optional: "Optional on top",
    optionalAll: "All of them together",
    committed: "Committed",
    paid: "Paid",
    left: "Left",
    over: "Over",
    budget: "Budget",
    nothingYet: "not yet",
    dates: "Dates",
    reference: "Reference",
    exportSheet: "Cost sheet",
    sheetTitle: "Costs: {trip}",
    sheetFileSuffix: "cost sheet",
    sheetWritten: "Cost sheet written to {path}.",
    sheetFailed: "Could not write the cost sheet.",
    sheetCaveat: "Figures as the notes state them. Converted amounts use the rates this trip carries, which are your own. The settlement splits every booking equally between the people it names.",
    sheetFooter: "Cost sheet generated by {author} on {date} with APERtrail",
    sheetFooterAnonymous: "Cost sheet generated on {date} with APERtrail",
    document: "Document",
    estimateChip: "Estimated, nothing booked yet",
    bookThis: "Book this",
    currencyFromTrip: "The trip's currency",
    currencyFromHome: "Home currency ({currency})",
    unit: {
      total: "in total",
      person: "per person",
      night: "per night",
      personNight: "per person per night"
    },
    nightsUnknown: "no dates on this stay, counted once",
    working: "{unit} \xD7 {multiplier}",
    stillEstimated: "Still estimates",
    settlement: "Settling up",
    balances: "Who paid what",
    transfers: "To square it",
    alreadySquare: "Nobody owes anybody.",
    balanceLine: "{person}: paid {paid}, used {owed}, balance {balance}",
    transferLine: "{from} pays {to} {amount}",
    onePayer: "{person} paid for everything. The others owe {amount} between them.",
    unbudgeted: "not budgeted",
    ofPlanned: "of {planned} planned",
    underBy: "{amount} left",
    overBy: "{amount} over",
    excludesUnconverted: "excludes what could not be converted",
    noRate: "No rate for {currency}",
    currencyAtRate: "{amount} at {rate} = {converted}",
    currencyNoRate: "{amount}, no rate on this trip, so it is not in the total",
    settlementIncomplete: "Bookings in {currencies} are left out of the settlement: this trip states no rate for them.",
    invoice: {
      booking: "Booking",
      category: "Category",
      status: "Status",
      amount: "Amount"
    }
  },
  trip: {
    duplicateTitle: "Duplicate trip",
    duplicateNameField: "Name of the copy",
    duplicateButton: "Duplicate",
    duplicateWhat: "The route comes across whole: the days, the stops, the stays, the transport, the budget, the highlights and the overview. The dates, the status, the rating and the bookings do not, because a copy is a trip you are about to plan rather than one you have taken.",
    duplicated: 'Copied to "{title}", with {pictures} pictures.',
    duplicateExists: 'A trip called "{title}" already exists.',
    duplicateFailed: "The trip could not be duplicated."
  },
  /**
   * What a property is called when it is SHOWN rather than configured.
   *
   * The settings page names each one "<thing> property", which is right there
   * and wrong everywhere else: a printed brochure that says "Rating property"
   * is a page nobody would send. These are the same fields as plain nouns.
   */
  fieldNames: {
    duration: "Duration",
    bookingCode: "Booking code",
    operator: "Operated by",
    built: "Built",
    refurbished: "Refurbished",
    capacity: "Capacity",
    length: "Length",
    tonnage: "Tonnage",
    website: "Website",
    deckPlan: "Deck plan",
    address: "Address",
    rating: "Rating",
    geoLocation: "Coordinates",
    lastVisit: "Last visit",
    country: "Country",
    capital: "Capital"
  },
  prospect: {
    highlights: "Highlights",
    overview: "In short",
    facts: "The details",
    trips: "Your trips here",
    fileSuffix: "prospect",
    kind: "Kind",
    status: "Status",
    where: "Where",
    yes: "Yes",
    notYet: "Not yet",
    caveat: "Everything on this page comes from this note. It is a printout."
  },
  vehicleBrochure: {
    exportButton: "Brochure",
    overview: "About her",
    cabins: "The cabins",
    facts: "The ship in numbers",
    gallery: "Pictures",
    trips: "Your trips aboard",
    fileSuffix: "brochure",
    written: "Brochure written to {path}.",
    failed: "Could not write the brochure.",
    caveat: "Everything on this page comes from this note. The cabins are the categories she is sold in; what one costs belongs to the sailing that books it. The notes are the record.",
    footer: "Brochure generated by {author} on {date} with APERtrail",
    footerAnonymous: "Brochure generated on {date} with APERtrail"
  },
  tripDocument: {
    exportButton: "Trip document",
    highlights: "Highlights",
    overview: "The trip in brief",
    transport: "Getting there and back",
    stays: "Where you stay",
    beforeStart: "Day 0 is the day before the trip starts.",
    afterEnd: "A day past the last one is the day after the trip ends.",
    itinerary: "Day by day",
    extensions: "Afterwards",
    extensionsHint: "Each of these is a trip of its own, booked and priced separately. Their figures are not in the total above.",
    costs: "What it costs",
    gallery: "Pictures",
    day: "Day {number}",
    days: { one: "1 day", other: "{count} days" },
    variants: "Prices",
    variantChosen: "chosen",
    arrivals: "Arrives today: {legs}",
    departures: "Departs today: {legs}",
    flights: "Flies today: {legs}",
    optional: "Optional",
    optionalTaken: "Optional, taken",
    optionalTotal: "Optional on top",
    travellers: "Travellers: {names}",
    onlyFor: "Only {names}",
    perPerson: "Per person",
    perPersonHint: "Worked out from the lines of the itinerary: a shared room is split between the people in it, an excursion is charged to whoever takes it. A budget set for a whole category is not split, so these totals need not add up to the planned total above.",
    perPersonPartial: "Planned, in the trip currency only",
    shareOf: "(1/{count} of {amount})",
    fileSuffix: "document",
    written: "Trip document written to {path}.",
    failed: "Could not write the trip document.",
    caveat: "This page is a printout of the current trip notes. The notes are the record.",
    footer: "Trip document generated by {author} on {date} with APERtrail",
    footerAnonymous: "Trip document generated on {date} with APERtrail"
  },
  bookingSheet: {
    exportButton: "Booking sheet",
    title: "Booking sheet: {trip}",
    travellers: "Travellers",
    name: "Name",
    birthDate: "Date of birth",
    passportName: "Name as in passport",
    flights: "Flights",
    hotels: "Accommodation",
    transport: "Transport",
    excursions: "Excursions",
    date: "Date",
    flight: "Flight",
    operator: "Operator",
    route: "Route",
    departs: "Dep.",
    arrives: "Arr.",
    class: "Class",
    cabin: "Cabin / class",
    reference: "Reference",
    price: "Price",
    checkIn: "Check-in",
    checkOut: "Check-out",
    nights: "Nights",
    accommodation: "Accommodation",
    room: "Room",
    time: "Time",
    excursion: "Excursion",
    place: "Place",
    variant: "Option",
    open: "open",
    booked: "booked",
    until: "until {date}",
    optionalChosen: "Extra, chosen",
    section: {
      flight: "Flight",
      hotel: "Accommodation",
      transport: "Transport",
      excursion: "Excursion"
    },
    total: "Total as planned",
    totalNote: "Without open choices and without extras nobody has decided on yet.",
    openHeading: "Still open",
    openVariant: "{subject}: no choice yet between {options}.",
    openUndecided: "{subject}, {when}: optional, not decided yet.",
    openUndecidedPriced: "{subject}, {when}: optional, not decided yet ({price}).",
    openUndecidedUndated: "{subject}: optional, not decided yet.",
    openNoDeparture: "The trip has no departure date yet. The lines above show their day of the trip instead of a date.",
    openUndated: "{subject}: no date and no day of the trip.",
    openNoFlightTime: "{subject}: the departure time is missing.",
    openNoTime: "{subject}: the departure time is missing.",
    fileSuffix: "Booking sheet",
    written: "Booking sheet written to {path}.",
    failed: "The booking sheet could not be written.",
    caveat: "This page is a printout of the current trip notes, to prepare a booking. Prices are the plan, not offers. The notes are what counts.",
    footer: "Booking sheet, created by {author} on {date} with APERtrail",
    footerAnonymous: "Booking sheet, created on {date} with APERtrail"
  },
  photoSpot: {
    notAPhotoSpot: "This note is not a photo spot, or it does not sit in the configured Photo Spots folder.",
    addMotif: "Motif",
    addSample: "Sample",
    editMotif: "Edit motif",
    deleteMotif: "Delete motif",
    moveUp: "Move up",
    moveDown: "Move down",
    editSample: "Edit sample",
    deleteSample: "Delete sample",
    saveFailed: "Could not save the photo spot.",
    lightOn: "Light on {date}",
    export: {
      button: "Field sheet",
      light: "Light",
      fileSuffix: "field sheet",
      footer: "Field sheet generated by {author} on {date} with APERtrail",
      footerAnonymous: "Field sheet generated on {date} with APERtrail",
      written: "Field sheet written to {path}.",
      failed: "Could not write the field sheet."
    },
    nextLightToday: "Today: {light} at {motif}, {time}",
    nextLightTomorrow: "Tomorrow: {light} at {motif}, {time}",
    lightFrom: "from {time}",
    sunWhere: "{zone} \xB7 {lat}, {lon}",
    deviceTimeZone: "{zone}, this device",
    unknownTimeZone: "unknown zone",
    band: {
      night: "Night",
      blue: "Blue hour",
      golden: "Golden hour",
      day: "Daylight"
    },
    today: "today",
    solarNoon: "Solar noon",
    polarDay: "The sun does not set here on this date.",
    polarNight: "The sun does not rise here on this date.",
    sunCaveat: "Geometry, not weather, and a flat horizon: in a valley the golden hour goes behind the ridge, and no formula knows that.",
    relation: {
      back: "Back lit",
      side: "Side lit",
      front: "Front lit"
    },
    motifs: "Motifs",
    noMotifs: "No motifs yet. Add them to this note's `motifs:` property.",
    unnamedMotif: "(unnamed motif)",
    otherSamples: "Other samples",
    onSite: "On site",
    role: {
      main: "Main motif",
      secondary: "Secondary motif"
    },
    light: {
      "blue-hour-morning": "Blue hour, morning",
      sunrise: "Sunrise",
      "golden-hour-morning": "Golden hour, morning",
      day: "Daylight",
      overcast: "Overcast",
      "golden-hour-evening": "Golden hour, evening",
      sunset: "Sunset",
      "blue-hour-evening": "Blue hour, evening",
      night: "Night"
    },
    // The sixteen points as whole tokens rather than four letters composed
    // at the call site. Composition works in German, where only E changes,
    // and is wrong wherever the words are not letter-shaped or run in a
    // different order: Chinese writes southwest as 西南, west first.
    compass: {
      N: "N",
      NNE: "NNE",
      NE: "NE",
      ENE: "ENE",
      E: "E",
      ESE: "ESE",
      SE: "SE",
      SSE: "SSE",
      S: "S",
      SSW: "SSW",
      SW: "SW",
      WSW: "WSW",
      W: "W",
      WNW: "WNW",
      NW: "NW",
      NNW: "NNW"
    },
    directionValue: "Shoots {degrees}\xB0 ({compass})",
    seasonValue: "Best {months}",
    capturedCount: "{captured} of {total} captured",
    captured: "Captured",
    capturedOn: "Captured {date}",
    notCaptured: "Not captured yet",
    offsetFromAnchor: "{distance} {compass} of the anchor",
    gear: {
      tripod: "Tripod",
      polarizer: "Polarizer",
      filter: "Filter",
      remote: "Remote release",
      flash: "Flash",
      drone: "Drone"
    },
    transit: {
      rail: "Rail",
      bus: "Bus",
      tram: "Tram",
      boat: "Boat",
      cablecar: "Cable car",
      foot: "On foot",
      car: "Car"
    },
    transitLabel: "Getting there",
    address: "Address",
    parking: "Parking",
    openingHours: "Opening hours",
    entryFee: "Entry fee",
    noEntryFee: "No entry fee",
    accessibility: "Accessibility",
    accessibilityValue: {
      full: "Step-free throughout",
      partial: "Partly step-free",
      none: "Not step-free",
      unknown: "Not recorded"
    },
    website: "Website"
  },
  relatedTrips: {
    empty: "No trips have stopped here yet.",
    emptyVehicle: "No trips on this one yet.",
    emptyExcursion: "No trip has taken this excursion yet.",
    emptyPerson: "No trips name this person yet.",
    notASubject: "This note is not a city, place, person or vehicle, or it does not sit in a configured APERtrail folder.",
    noDate: "(no date)"
  },
  itinerary: {
    deckPlan: "Deck plan",
    addStop: "Add stop",
    addNight: "Add stay",
    addLeg: "Add leg",
    editStop: "Edit stop",
    editNight: "Edit stay",
    editLeg: "Edit leg",
    editDay: "Name this day",
    insertDay: "Insert a day before this one",
    removeDay: "Remove this day, moving the rest up",
    dayNumber: "Day {number}",
    undatedDay: "No date yet",
    fromTime: "from {time}",
    untilTime: "until {time}",
    nights: "Nights",
    conflictTooFar: 'Cannot be reached from "{other}" in time: {distance} apart, about {walk} on foot, and the itinerary leaves {gap}. Straight line at walking pace, not a route.',
    conflictOverlap: 'Overlaps with "{other}", {distance} away. Two places at once is not a plan.',
    conflictPreviousStop: "the stop before",
    minutes: "{minutes} min",
    hours: "{hours} h",
    hoursMinutes: "{hours} h {minutes} min",
    shotList: "Shot list ({open} of {total} open)",
    markCaptured: 'Mark "{motif}" as captured',
    transport: "Transport",
    legJoiner: "to",
    via: "via {places}",
    unnamedLeg: "Transport leg",
    unnamedNight: "Accommodation",
    unnamedStop: "Stop",
    travellers: { one: "1 traveller", other: "{count} travellers" },
    legNights: { one: "1 night", other: "{count} nights" },
    legArrival: "Arrives: {leg}",
    legDeparture: "Departs: {leg}",
    legFlight: "Flies: {leg}",
    variants: "Prices",
    variantUnnamed: "Price {number}",
    variantChosen: "Chosen",
    variantChoose: "Count this one",
    variantClear: "Leave the choice open",
    variantAssumed: "Nothing chosen yet, so the first one is what the budget counts.",
    optional: "Optional",
    optionalTake: "Count this in the plan",
    optionalDrop: "Take this back out of the plan",
    optionalTaken: "Optional, taken",
    outbound: "Outward journey",
    inbound: "Return journey",
    unknownPlace: "(unresolved link)",
    empty: "No stops recorded yet. Use Edit trip to add the itinerary.",
    notATrip: "This note is not a trip, or it does not sit in the configured Trips folder.",
    edit: "Edit trip"
  },
  crm: {
    create: {
      folderMissing: "Set the People or Companies folder in APERtrail settings before creating a CRM note.",
      typeValueMissing: "Set the person or company type value in APERtrail settings before creating a CRM note."
    }
  },
  sampleVault: {
    title: "Create the sample notes",
    subtitle: "A small set of trips, places and people, to look at rather than to type",
    intro: "This writes new notes into your vault, in the folders configured for APERtrail. Nothing already there is overwritten, and nothing is deleted.",
    createHeading: {
      one: "Would create one note",
      other: "Would create {count} notes"
    },
    skipHeading: {
      one: "Already there, left alone: one note",
      other: "Already there, left alone: {count} notes"
    },
    augmentHeading: {
      one: "Already there, would gain a related trips block: one note",
      other: "Already there, would gain a related trips block: {count} notes"
    },
    augmentExplain: "The one edit made to a note APERtrail did not write. A person note another plugin created has no reason to carry this block, and appending it is what makes the same note answer to both.",
    sharedHeading: "Written beside what is already there",
    sharedExplain: "The CRM folders are shared with the other TRAILsuite plugins by agreement, so notes in them that these samples do not name are left exactly as they are and nothing is refused over them. Here is what you would be writing beside.",
    sharedOthers: {
      one: "already holds one other note: {titles}",
      other: "already holds {count} other notes: {titles}"
    },
    blockedHeading: "Nothing would be written",
    occupiedExplain: "The sample notes are only written into folders they can account for. Empty the folders below, or point the folder settings somewhere else, and run this again.",
    strangers: "holds notes this sample does not know about: {titles}",
    unconfigured: "These notes have no folder or no type value configured, so they could not be found again once written: {titles}",
    nothingToDo: "Every sample note is already in your vault.",
    createButton: "Create the notes",
    createdNotice: {
      one: "Created one note.",
      other: "Created {count} notes."
    },
    augmentedNotice: {
      one: "Added the related trips block to one existing note.",
      other: "Added the related trips block to {count} existing notes."
    },
    failedNotice: "These could not be written: {titles}"
  },
  ribbon: {
    dashboardTooltip: "Travel dashboard"
  },
  modals: {
    shell: {
      cancelButton: "Cancel"
    },
    stopEditor: {
      motifField: "Motif",
      excursionField: "Excursion",
      excursionDesc: "The outing this stop is, as against the place it happens at. What it costs stays on this line: the same tour is priced differently on every trip that offers it.",
      excursionPlaceholder: "Name of the tour",
      motifAny: "No particular motif",
      prefilledName: "Times suggested",
      prefilled: "Filled in from this motif's {light} on the day of the stop. Change them freely; nothing writes them back.",
      title: "Itinerary stop",
      placeField: "Place",
      placeOrNoteRequired: "Give the stop a place, a note, or both.",
      clearPlace: "This happens nowhere in particular"
    },
    dayEditor: {
      title: "Day {number}",
      titleField: "Name",
      titleDesc: 'What this day is called, shown beside its number: "Day 1: Pretoria".',
      titlePlaceholder: "Pretoria",
      noteField: "About this day",
      noteDesc: "A paragraph for the printed document. Leave both empty and the day says nothing, which is where every day starts."
    },
    nightEditor: {
      title: "Accommodation stay",
      accommodationRequired: "Pick an accommodation first."
    },
    legEditor: {
      title: "Transport leg",
      directionField: "Direction"
    },
    tripEditor: {
      presentationHeading: "What the trip says about itself",
      galleryAdd: "Add a picture",
      galleryCaption: "Caption",
      galleryEmpty: "No pictures yet. Upload some, or pick them from the vault.",
      galleryRemove: "Remove this picture",
      itineraryMovedHint: "Stops, stays and transport are edited directly in the trip note, from the itinerary block -- each on its own, so this dialog stays the same size however long the trip gets.",
      createTitle: "New trip",
      editTitle: "Edit trip: {title}",
      citiesField: "Cities",
      noCitiesYet: "No City notes exist yet. Create one first to link it here.",
      extendsField: "Follows on from",
      extendsHint: "The trip this one continues -- three days somewhere after the main one ends. Written here, on the trip that comes second.",
      travelTypeField: "Travel type",
      travelStatusField: "Travel status",
      travelStatusDesc: "Leave on Automatic to let the trip's own dates decide: a trip whose return date has passed counts as Over, anything else as Planned.",
      statusAutoOption: "Automatic (from dates)",
      reviewStatusField: "Review status",
      ratingField: "Rating",
      personsHeading: "Who came along",
      noPersonsYet: "No Person notes were found. Point APERtrail at your Persons folder on the settings tab.",
      itineraryHeading: "Itinerary",
      pickPlace: "Pick a place",
      stopDay: "Day of the trip",
      dayDesc: "Leave empty to give this a date of its own.",
      stopFrom: "From",
      stopTo: "Until",
      stopPastMidnight: "An until time before the from time means the next day. A ship in at 23:45 and out at 01:30 shows as 23:45 - 01:30 +1.",
      stopNote: "Note",
      stopRating: "Rating",
      removeStop: "Remove stop",
      moveUp: "Move up",
      moveDown: "Move down",
      pickAccommodation: "Pick an accommodation",
      checkInDay: "Arrives on day",
      checkOutDay: "Leaves on day",
      checkIn: "Check-in",
      checkOut: "Check-out",
      removeNight: "Remove stay",
      outbound: "Outward journey",
      inbound: "Return journey",
      legMode: "Mode",
      legDay: "Departs on day",
      legToDay: "Arrives on day",
      variants: "Prices to choose between",
      variantsDesc: "The prices this same thing can be bought at: a cabin category, a room category, a longer version of the same excursion. Only the chosen one is ever counted, and the first one counts until you choose.",
      addVariant: "Add a price",
      removeVariant: "Remove this price",
      variantNumber: "Price {number}",
      variantName: "Called",
      variantNamePlaceholder: "Polar outside cabin",
      variantDescription: "What it includes",
      variantChosen: "This is the one",
      optional: "Optional",
      optionalDesc: "Something that may or may not happen: an excursion offered, a transfer you might not take. Its price is shown but stays out of the planned total until you decide to do it.",
      optionalChosen: "Doing it",
      optionalChosenDesc: "Counts it in the plan, while the note goes on saying it was an extra.",
      legFrom: "Departs",
      legTo: "Arrives",
      legOrigin: "From",
      legOriginPlaceholder: "Z\xFCrich",
      legDestination: "To",
      legDestinationPlaceholder: "Pretoria, South Africa",
      legPlaceDesc: "Where the leg starts and ends. Plain text or a wikilink; most airports will never be a note.",
      travellers: "Who is on this",
      travellersDesc: "Everybody on the trip, unless you say otherwise. Two people on a flight is two fares; two on a stay is the room they share.",
      stopCost: "Estimated cost",
      legReferenceDesc: "The booking reference. A booking note carrying the same one is read as this leg being paid for.",
      legCost: "Estimated cost",
      nightCost: "Estimated cost",
      costDesc: "What you expect this to cost while you are still planning. A booking with the same reference replaces it once you book.",
      costPlaceholder: "890",
      legVehicle: "Ship or train",
      legVehicleDesc: "Which ship or named train this leg is taken on, as against who runs it. Link it to a vehicle note and its cabin descriptions appear under the prices below.",
      legVehiclePlaceholder: "MS Trollfjord",
      legCarrier: "Operated by",
      legCarrierDesc: "The airline, railway or named train. Free text, or a wikilink if the vault has a note for it.",
      legCarrierPlaceholder: "Swiss",
      legNumber: "Flight or train number",
      legNumberDesc: "The number this leg runs or flies under. Not the booking reference below, which is what a booking note finds this leg by.",
      legNumberPlaceholder: "LX288",
      segments: "Change of plane",
      segmentsDesc: "One ticket, several flights: the price, class and reference stay on the leg, and each flight gets its number, route and times. The route so far becomes the first flight.",
      addSegment: "Another flight",
      segmentNumber: "Flight {number}",
      removeSegment: "Remove this flight",
      segmentCarrier: "Operated by",
      segmentCarrierDesc: "Only where another airline flies it than the one above (codeshare). Empty means the same.",
      legReference: "Reference",
      removeLeg: "Remove leg",
      remove: "Remove {item}",
      cancel: "Cancel",
      save: "Save",
      saved: 'Trip "{title}" saved.',
      mode: {
        train: "Train",
        plane: "Plane",
        car: "Car",
        bus: "Bus",
        boat: "Boat",
        other: "Other"
      }
    },
    placePicker: {
      title: "Pick a place",
      searchPlaceholder: "Search cities, accommodation, restaurants, landmarks...",
      noMatches: "Nothing matches that search."
    },
    common: {
      titleField: "Title",
      countryField: "Country",
      stateField: "State",
      /** Hamburg, Berlin, Bremen: the town IS the division, so it names itself here. */
      cityStateOption: "{title} itself (city-state)",
      cityField: "City",
      noneOption: "(None)",
      create: "Create",
      titleRequired: "Title is required.",
      createFailed: "Could not create the note.",
      imageFieldHint: "A vault path, a wikilink, or a URL.",
      imageUploadButton: "Upload a picture",
      imageUploadFailed: "Could not add {names}.",
      imagePickerButton: "Pick a picture from the vault",
      imagePickerHint: "Search the vault\u2019s images",
      documentPickerButton: "Pick a document from the vault",
      documentPickerHint: "Search the vault\u2019s documents",
      documentUploadButton: "Add a document",
      documentUploadFailed: "Could not add {names}.",
      save: "Save",
      edit: "Edit",
      createNewOption: "Create a new one...",
      capitalField: "Capital",
      editTitle: "Edit {title}",
      saved: 'Saved "{title}".',
      saveFailed: "Could not save the note.",
      geoLocation: "Coordinates",
      geoLocationInvalid: "Coordinates should read like 46.9895, 6.9243.",
      tags: "Tags",
      tagsPlaceholder: "Comma-separated, e.g. quiet, breakfast"
    },
    placeEditor: {
      address: "Address",
      website: "Website",
      rating: "Rating",
      accommodationType: "Kind of accommodation",
      accommodationStatus: "Booking status",
      fnbType: "Kind of place"
    },
    newTripModal: {
      title: "New trip",
      departureField: "Departure",
      returnField: "Return",
      created: 'Created trip "{title}".'
    },
    crm: {
      tagsField: "Tags",
      tagsPlaceholder: "Comma-separated, e.g. Friends, Photography",
      emailField: "Email",
      mobileField: "Mobile",
      phoneField: "Phone",
      websiteField: "Website",
      addressField: "Address"
    },
    newPersonModal: {
      title: "New person",
      created: 'Created person "{title}".'
    },
    newCompanyModal: {
      title: "New company",
      created: 'Created company "{title}".'
    },
    newCountryModal: {
      title: "New country",
      created: 'Created country "{title}".'
    },
    newStateModal: {
      title: "New state",
      created: 'Created state "{title}".'
    },
    newCityModal: {
      title: "New city",
      created: 'Created city "{title}".'
    },
    newAccommodationModal: {
      title: "New accommodation",
      created: 'Created accommodation "{title}".'
    },
    newFnbModal: {
      title: "New food & beverage",
      created: 'Created food & beverage "{title}".'
    },
    newLandmarkModal: {
      title: "New landmark",
      created: 'Created landmark "{title}".'
    },
    newLocationModal: {
      title: "New location",
      created: 'Created location "{title}".'
    },
    motifEditor: {
      seasonPreset: {
        spring: "Spring",
        summer: "Summer",
        autumn: "Autumn",
        winter: "Winter",
        allYear: "All year"
      },
      title: "Motif",
      name: "Name",
      nameRequired: "A motif needs a name.",
      role: "Role",
      roleDesc: "The main motif is the one the spot is named for. There is at most one.",
      geoLocation: "Coordinates",
      geoLocationDesc: 'Only if this motif is somewhere else than the spot itself. Paste as "latitude, longitude".',
      direction: "Shooting direction",
      directionDesc: "The bearing you shoot toward, in degrees. A compass point works too and is stored as degrees.",
      light: "Light",
      season: "Season",
      lens: "Lens",
      gear: "Gear",
      gearDesc: "Comma separated, e.g. tripod, nd1000.",
      note: "Note",
      noteDesc: "Where to stand and how to get there.",
      technique: "Technique",
      techniqueDesc: "The how-to for this motif specifically."
    },
    sampleEditor: {
      title: "Sample frame",
      image: "Image",
      imageDesc: "A vault path, a wikilink, or a URL.",
      imageRequired: "A sample needs an image.",
      motif: "Motif",
      light: "Light",
      exposure: "Exposure",
      exposureDesc: 'Written out as you would say it, e.g. "30s, f/11, ISO 100, ND1000".',
      credit: "Credit"
    },
    newBookingModal: {
      title: "New booking",
      tripField: "Trip",
      categoryField: "Category",
      statusField: "Status",
      amountField: "Amount",
      currencyField: "Currency",
      amountInvalid: "That amount is not a number.",
      forField: "For",
      replacesEstimate: 'This booking takes over the estimate on "{item}".',
      created: 'Created booking "{title}".'
    },
    budgetEditor: {
      title: "Trip budget",
      intro: "A ceiling per category, in the trip currency. Leave a category empty to leave it unbudgeted, which is not the same as budgeting it at zero.",
      currency: "Trip currency",
      currencyDesc: "What the budget is in. Bookings that name no currency of their own are read as this one.",
      noCeiling: "no ceiling",
      invalid: "The {category} figure is not a number."
    },
    rateEditor: {
      title: "Conversion rates",
      intro: "How many units of the trip currency one unit of a foreign currency costs, as you decide it. Nothing is fetched, and every converted figure is shown with the rate it used.",
      row: "Rate {index}",
      currencyPlaceholder: "Pick a currency",
      ratePlaceholder: "0.94",
      invalid: "A rate needs a currency and a number above zero."
    },
    newVehicleModal: {
      title: "New ship or train",
      operatorField: "Operated by",
      created: 'Created "{title}".'
    },
    newExcursionModal: {
      title: "New excursion",
      durationPlaceholder: "About 4 hours",
      codePlaceholder: "HR-TOS5A",
      created: 'Created "{title}".'
    },
    noteCover: {
      description: "Subtitle",
      descriptionHint: "One line, in the words a brochure would use. It is what goes under the title on the printed page. The long version is the summary below.",
      image: "Picture",
      highlights: "Highlights",
      highlightsHint: "One per line, in the order they should read.",
      gallery: "Gallery",
      galleryHint: "The pictures, in the order they should be shown.",
      galleryEmpty: "No pictures yet.",
      saved: "Saved.",
      saveFailed: "Could not save this note."
    },
    noteSummary: {
      field: "Summary",
      hint: "What the note says about itself, at length. This is what the prospect prints, lists and links and all. Anything written below it in the note is your own notes and stays off the page.",
      extraCallouts: "This note holds more than one summary callout. The first was edited; nothing reads the others."
    },
    vehicleCabins: {
      cabins: "Cabin categories",
      cabinsDesc: "The categories this one is sold in, and what each includes. A catalogue, not prices: what a cabin costs belongs to the trip that books it, and is typed on the leg.",
      descriptionDesc: "One or two lines, the way a brochure introduces her. The long version belongs in the note itself.",
      cabinNumber: "Cabin {number}",
      cabinPlaceholder: "Polar outside cabin",
      addCabin: "Add cabin",
      removeCabin: "Remove cabin",
      cabinImage: "Picture",
      cabinImageDesc: "A vault path, a wikilink or a URL. Printed beside the cabin on the brochure.",
      deckPlanDesc: "A vault path or a wikilink to the document itself, usually a PDF. Linked from the leg, the card and the brochure; a path the vault cannot find shows nowhere.",
      deckPlanPlaceholder: "Places/Vehicles/_documents/deck-plan.pdf",
      saved: "Saved.",
      saveFailed: "Could not save this note."
    },
    newPhotoSpotModal: {
      title: "New photo spot",
      created: 'Created photo spot "{title}".'
    }
  },
  dashboard: {
    greeting: {
      evening: "Good evening",
      morning: "Good morning",
      afternoon: "Good afternoon"
    },
    entityActions: "Entity actions",
    archive: "Archive",
    personCount: { one: "{count} person", other: "{count} people" },
    stopCount: { one: "{count} stop", other: "{count} stops" },
    refresh: "Refresh",
    visited: "Visited",
    notVisited: "Not yet visited",
    vehicleRefurbished: "refurbished {year}",
    stateCount: { one: "{count} state", other: "{count} states" },
    cityCount: { one: "{count} city", other: "{count} cities" },
    newTrip: "New trip",
    newCountry: "New country",
    newCity: "New city",
    newState: "New state",
    newAccommodation: "New accommodation",
    newFnb: "New food & beverage",
    newLandmark: "New landmark",
    newLocation: "New location",
    newPhotoSpot: "New photo spot",
    newVehicle: "New transport",
    newExcursion: "New excursion",
    stats: {
      tripsByStatus: "Trips by status",
      statusPlanned: "Planned",
      statusBooked: "Booked",
      statusOver: "Over",
      statusCancelled: "Cancelled",
      countriesVisited: "Countries visited",
      landmarksVisited: "Landmarks visited",
      photoSpotsCaptured: "Photo spots captured",
      vehicles: "Ships and trains",
      nextTripBudget: "Next trip budget",
      nextTrip: "Next trip",
      noUpcomingTrip: "No upcoming trip planned.",
      departsToday: "Departs today",
      daysUntil: "In {days} days"
    }
  },
  galleryView: {
    facets: {
      anyCountry: "Any country",
      anyVisited: "Visited or not",
      visited: "Visited",
      unvisited: "Not visited",
      anyRating: "Any rating",
      minRating: "{stars} and up",
      anyTag: "Any tag",
      anyLight: "Any light",
      anySeason: "Any season",
      anyCapture: "Any progress",
      capture: {
        full: "All motifs captured",
        partial: "Partly captured",
        none: "Nothing captured yet"
      },
      anyAccessibility: "Any accessibility",
      anySamples: "Samples: any",
      withSamples: "Has samples",
      sortDefault: "Sort: default",
      sortTitle: "Sort: name",
      sortRating: "Sort: rating",
      sortLastVisit: "Sort: last visit",
      anyStatus: "Any status",
      anyReviewStatus: "Any review status",
      anyPerson: "Anyone",
      archive: {
        live: "Active trips",
        archived: "Archived trips",
        all: "Active and archived"
      }
    },
    displayName: "Trips, countries & places",
    searchPlaceholder: "Search trips, countries & places\u2026",
    empty: "Nothing matches the current search/filter.",
    filters: {
      all: "All",
      trip: "Trips",
      country: "Countries",
      state: "States",
      city: "Cities",
      accommodation: "Accommodation",
      fnb: "Food & Beverages",
      landmark: "Landmarks",
      location: "Locations",
      photospot: "Photo spots",
      vehicle: "Transport",
      excursion: "Excursions",
      person: "People",
      company: "Companies"
    }
  },
  settings: {
    nav: {
      back: "Back"
    },
    header: {
      whatsNew: {
        name: "What's new in APERtrail {version}",
        desc: "See recent updates and improvements.",
        button: "View recent updates"
      },
      support: {
        name: "Support development",
        desc: "If APERtrail has earned its place in your vault, this is how you keep it developing.",
        sponsor: "Sponsor",
        coffee: "Buy me a coffee"
      },
      help: {
        name: "Help and contact",
        desc: "The documentation, the issue tracker, and a way to reach a person.",
        docs: "Documentation",
        issues: "Report an issue",
        contact: "Contact support"
      }
    },
    whatsNew: {
      title: "What's new in APERtrail {version}",
      empty: "This build ships no release notes.",
      close: "Close",
      allReleases: "Every release on GitHub"
    },
    vault: {
      title: "Vault setup",
      intro: "Where your notes live, and what the fields inside them are called. Both are set once when a vault is adopted and then left alone.",
      folders: {
        name: "Folders",
        desc: "The Trips, Places and CRM folders, and one sub-folder per entity type under them.",
        value: "{count} folders"
      },
      properties: {
        name: "Property keys",
        desc: "Every frontmatter property name APERtrail reads and writes, grouped by the note type that carries it.",
        valueLocked: "{count} keys, locked",
        valueUnlocked: "{count} keys, editable"
      }
    },
    folders: {
      intro: "APERtrail works in three modules -- Trips, Places and CRM -- and each of them moves as a unit: set a module folder and its sub-folders follow, or repoint any single sub-folder on its own.",
      defaults: {
        rootFolderPath: "",
        tripsFolderName: "Trips",
        bookingsFolderName: "Bookings",
        placesFolderName: "Places",
        countriesFolderName: "Countries",
        statesFolderName: "States",
        citiesFolderName: "Cities",
        accommodationFolderName: "Accommodation",
        fnbFolderName: "Food & Beverages",
        landmarksFolderName: "Landmarks",
        locationsFolderName: "Locations",
        photoSpotsFolderName: "Photo Spots",
        vehiclesFolderName: "Vehicles",
        excursionsFolderName: "Excursions",
        archiveFolderName: "6 Archive",
        crmFolderName: "CRM",
        personsFolderName: "People",
        companiesFolderName: "Companies"
      },
      root: {
        name: "Common parent folder",
        desc: "Optional folder above Trips, Places and CRM. Leave empty to keep all three at the vault root.",
        placeholder: "Leave empty for the vault root"
      },
      tripsHeading: "Trips",
      tripsIntro: "The journeys themselves: one note per trip, with its people, stops, nights and transport.",
      trips: {
        name: "Trips folder",
        desc: "One note per trip.",
        placeholder: "Trips"
      },
      placesHeading: "Places",
      placesIntro: "Everything a trip can point at, from the country down to the single vantage point you drove out for.",
      places: {
        name: "Places folder",
        desc: "The root folder for every Places sub-folder below.",
        placeholder: "Places"
      },
      countries: {
        name: "Countries",
        desc: "One note per country.",
        placeholder: "Places/Countries"
      },
      states: {
        name: "States",
        desc: "One note per state/province, where your countries use that level.",
        placeholder: "Places/States"
      },
      cities: {
        name: "Cities",
        desc: "One note per city.",
        placeholder: "Places/Cities"
      },
      accommodation: {
        name: "Accommodation",
        desc: "Hotels, apartments, and other places you stayed.",
        placeholder: "Places/Accommodation"
      },
      fnb: {
        name: "Food & Beverages",
        desc: "Restaurants, cafes, bars, and similar.",
        placeholder: "Places/Food & Beverages"
      },
      landmarks: {
        name: "Landmarks",
        desc: "Sights and points of interest.",
        placeholder: "Places/Landmarks"
      },
      locations: {
        name: "Locations",
        desc: "Anything else worth remembering the location of.",
        placeholder: "Places/Locations"
      },
      bookings: {
        name: "Bookings",
        desc: "Where a booking goes when its trip has no folder of its own. Bookings are read from here and from every trip folder alike, so an older flat one is never lost.",
        placeholder: "Trips/Bookings"
      },
      tripBookingsSubfolder: {
        name: "Bookings inside a trip",
        desc: "The folder a trip keeps its bookings in, inside the trip\u2019s own folder, so everything about one trip is in one place. Leave blank to put every booking in the Bookings folder above instead.",
        placeholder: "Bookings"
      },
      exportsSubfolder: {
        name: "Exports",
        desc: "The subfolder a note keeps its exported sheets in, beside the note itself, the same way attachments sit in a folder of their own. Everything in it can be deleted and made again from the note, which is why it is kept apart from them. Notes in the same folder share one. Leave blank to write sheets beside the note instead.",
        placeholder: "_exports"
      },
      photoSpots: {
        name: "Photo spots",
        desc: "Places you go to in order to make a specific picture.",
        placeholder: "Places/Photo Spots"
      },
      vehicles: {
        name: "Vehicles",
        desc: "The ships and named trains you travel on, as against the places you travel to. Filed here because every folder hangs off one of the three module roots.",
        placeholder: "Places/Vehicles"
      },
      excursions: {
        name: "Excursions folder",
        desc: "The outings you are sold a day of. Filed under Places for the reason the vehicles are: every folder hangs off one of the three module roots.",
        placeholder: "Places/Excursions"
      },
      crmHeading: "CRM",
      crmIntro: "The people and companies behind a trip. APERtrail reads them from your own notes rather than keeping a contact list of its own.",
      crm: {
        name: "CRM folder",
        desc: "The root folder for People and Companies below.",
        placeholder: "CRM"
      },
      persons: {
        name: "People folder",
        desc: "Where your Person notes live.",
        placeholder: "CRM/People"
      },
      companies: {
        name: "Companies folder",
        desc: "Where your Company notes live. Reserved for the CRM work in progress; nothing is read from here yet.",
        placeholder: "CRM/Companies"
      },
      archiveHeading: "Archive",
      archiveIntro: "Where a trip goes when it is over and you want it out of the way without losing it. An archived trip is still read: it keeps its place in a city\u2019s related trips and it still counts as a visit. NODAtrail files its retired notes under the same folder, so a vault running both ends up with one archive rather than two.",
      archive: {
        name: "Archive folder",
        desc: "The root of the archive, beside Trips, Places and CRM rather than inside one of them.",
        placeholder: "6 Archive"
      },
      tripsArchive: {
        name: "Archived trips sub-folder",
        desc: "The folder inside the archive that retired trips go into. A name, not a path: moving the archive takes it along.",
        placeholder: "Trips"
      },
      archiveYearFolders: {
        name: "Split the archive by year",
        desc: "File each archived trip under the year it was archived. Off by default: a handful of trips a year does not need the split."
      }
    },
    properties: {
      intro: "The frontmatter names APERtrail reads and writes. Change one only to match a name your notes already use: nothing on disk is renamed with it.",
      unlock: {
        name: "Allow editing property names",
        desc: "Off, because renaming a property here does not rename it in your notes. APERtrail would look for a property none of them carries, and trips, places and contacts would come up missing that field with nothing to say why. Turn this on only to match names a vault already uses, and turn it off again afterwards. Folder settings are not covered: repointing a folder is reversible in a way renaming a property is not.",
        locked: 'Locked. Turn on "Allow editing property names" at the top of this page to change it.'
      },
      entityTypesInfo: "APERtrail recognizes these values under the type property out of the box: {types}.",
      subKeysNote: "The sub-keys inside a list entry -- a stop's place, a night's check-in, a motif's light -- are settings too, but they get no row here. See docs/design/data-model.md for what a note carries.",
      groups: {
        identification: "Note identification",
        identificationIntro: "What tells APERtrail which kind of note it is looking at. Every travel type is matched by a fixed value; the two CRM types are matched by a value you choose, because those notes are usually older than this plugin.",
        places: "Places and shared fields",
        placesIntro: "The geographic hierarchy, and the fields every place-like note carries whether it is a hotel, a restaurant or a viewpoint.",
        trips: "Trips",
        tripsIntro: "The dates, the status, and the lists a trip note carries.",
        bookings: "Bookings",
        bookingsIntro: "What a booking note holds. Every one of these is a plain property, which is why a booking needs no editor of its own: Obsidian's own property editor is already the right one. The last three sit on the Trip rather than on a booking.",
        photoSpots: "Photo spots",
        photoSpotsIntro: "The access details a printed location guide prints in its grey box, plus the motifs and sample frames.",
        vehicles: "Vehicles",
        vehiclesIntro: "What a ship or a named train note carries. Its cabins are a catalogue rather than prices: what a cabin costs belongs to the sailing that books it, and lives on the trip.",
        excursions: "Excursions",
        excursionsIntro: "What an excursion note carries. There is deliberately no price among them: the same tour costs one thing in December and another in May, so the figure lives on the trip that books it.",
        crm: "People and companies",
        crmIntro: "The contact fields APERtrail and CULItrail read from the same notes, so both plugins have to agree on them."
      },
      fields: {
        type: {
          name: "Type property",
          desc: `The property APERtrail reads and writes to identify each note's entity type -- for example "type: trip" or "type: country".`
        },
        personType: {
          name: "Person type value",
          desc: 'The type property value that marks a note as a person, e.g. "person".'
        },
        companyType: {
          name: "Company type value",
          desc: 'The type property value that marks a note as a company, e.g. "company".'
        },
        country: {
          name: "Country property",
          desc: "Links a State/City/place/Trip to its Country."
        },
        state: { name: "State property", desc: "Links a City to its State." },
        city: { name: "City property", desc: "Links a place to its City." },
        capital: {
          name: "Capital property",
          desc: "Links a Country or State to its capital City."
        },
        states: { name: "States property", desc: "Links a Country to its list of States." },
        cities: { name: "Cities property", desc: "Links a State to its list of Cities." },
        geoLocation: {
          name: "Geo location property",
          desc: "The [latitude, longitude] pair copied from a map view."
        },
        address: {
          name: "Address property",
          desc: 'Street address shown on a place card. The reference vault uses "ortAdresse".'
        },
        website: {
          name: "Website property",
          desc: 'Website shown on a place card. The reference vault uses "webSeite".'
        },
        rating: { name: "Rating property", desc: "The 1-5 rating field." },
        visited: {
          name: "Visited property",
          desc: "Whether this City or place has been visited."
        },
        lastVisit: { name: "Last visit property", desc: "The date of the most recent visit." },
        tags: {
          name: "Tags property",
          desc: 'The tag list on a City or place. Obsidian reads its own tags from "tags", so a vault that points this somewhere else keeps those notes out of the tag pane.'
        },
        accommodationType: {
          name: "Accommodation type property",
          desc: "What kind of accommodation it is (Hotel, Apartment, and so on). Accommodation only."
        },
        accommodationStatus: {
          name: "Accommodation status property",
          desc: "Where the booking stands (Booked, Enquired, and so on). Accommodation only."
        },
        fnbType: {
          name: "Food & Beverages type property",
          desc: "What kind of place it is (Cafe, Restaurant, and so on). Food & Beverages only."
        },
        created: { name: "Created property", desc: "The note-created timestamp." },
        modified: { name: "Modified property", desc: "The note-modified timestamp." },
        archived: {
          name: "Archived property",
          desc: "The day a trip was archived. Leave empty to move without stamping."
        },
        departure: { name: "Departure property", desc: "A Trip's departure date." },
        return: { name: "Return property", desc: "A Trip's return date." },
        travelType: {
          name: "Travel type property",
          desc: "A Trip's travel type (e.g. Business, Private)."
        },
        travelStatus: {
          name: "Travel status property",
          desc: "A Trip's status (Planned, Booked, Over, or Cancelled)."
        },
        reviewStatus: { name: "Review status property", desc: "A Trip's review status." },
        tripSubtitle: {
          name: "Trip subtitle property",
          desc: "What the trip is, under what it is called."
        },
        image: {
          name: "Trip picture property",
          desc: "The one picture that stands for the trip, in the gallery and on a printed sheet. A vault path, a wikilink or a URL."
        },
        tripHighlights: {
          name: "Highlights property",
          desc: "A list of lines, in the order they should read. Every note may carry one, not only a trip."
        },
        tripDays: {
          name: "Trip days property",
          desc: "What each day of the trip is called, and the paragraph it carries. Only the days that say something have an entry; a day with only stops on it needs none."
        },
        tripGallery: {
          name: "Trip gallery property",
          desc: "A list of pictures, each with an optional caption."
        },
        tripCities: {
          name: "Trip cities property",
          desc: "The Cities a trip touches. Deliberately not the Cities property above, which belongs to a State."
        },
        persons: {
          name: "Participants property",
          desc: "The People a trip is shared with."
        },
        tripExtends: {
          name: "Follows-on-from property",
          desc: "The trip this one continues, written on the trip that comes second. The list of what follows a trip is derived when the vault is read, so adding an extension never edits the trip it extends."
        },
        stops: {
          name: "Stops property",
          desc: "The trip's timed itinerary: one entry per stop, each with a place and a time."
        },
        nights: {
          name: "Nights property",
          desc: "The accommodation a trip books, one entry per stay."
        },
        transport: {
          name: "Transport property",
          desc: "The legs a trip travels, outbound and back."
        },
        bookingTrip: { name: "Trip property", desc: "Which trip a booking belongs to." },
        bookingCategory: {
          name: "Category property",
          desc: "Transport, accommodation, activity, food, fees or other. A fixed vocabulary; only the name is configurable."
        },
        bookingStatus: {
          name: "Status property",
          desc: "Estimate, booked, paid, cancelled or refunded. Decides which total a figure counts in."
        },
        bookingSupplier: { name: "Supplier property", desc: "The Company note behind a booking." },
        bookingPlace: {
          name: "Place property",
          desc: "Which place or city a booking is for, and how a cost reaches its itinerary row."
        },
        bookingDate: {
          name: "Date property",
          desc: "The day the cost belongs to, rather than the day it was paid."
        },
        bookingAmount: { name: "Amount property", desc: "What the booking costs." },
        bookingCurrency: {
          name: "Currency property",
          desc: "ISO code. Absent means the trip currency, and then the home currency setting."
        },
        bookingReference: {
          name: "Reference property",
          desc: "The booking reference. Also what matches a booking to a transport leg."
        },
        bookingPayer: { name: "Payer property", desc: "Which participant actually paid." },
        bookingFor: {
          name: "For property",
          desc: "Who the cost is for. Absent means every participant of the trip."
        },
        bookingDocument: {
          name: "Document property",
          desc: "The confirmation or invoice file in your vault."
        },
        tripCurrency: { name: "Trip currency property", desc: "What a trip plans its budget in." },
        budget: { name: "Budget property", desc: "The trip's ceiling per category." },
        rates: {
          name: "Rates property",
          desc: "Conversion rates as you typed them. Nothing is ever fetched."
        },
        timezone: {
          name: "Timezone property",
          desc: "A photo spot's timezone, used to resolve its light windows to clock times."
        },
        openingHours: {
          name: "Opening hours property",
          desc: "When a photo spot can be entered at all."
        },
        entryFee: { name: "Entry fee property", desc: "What entry costs, if anything." },
        accessibility: {
          name: "Accessibility property",
          desc: "How accessible the spot is: full, partial, none or unknown."
        },
        parking: { name: "Parking property", desc: "Where to leave the car." },
        transit: {
          name: "Transit property",
          desc: "How to reach the spot without one, one entry per connection."
        },
        motifs: {
          name: "Motifs property",
          desc: "The pictures the spot is for: bearing, light, lens and gear per motif."
        },
        samples: {
          name: "Samples property",
          desc: "Example frames shot at the spot, each tied to a motif."
        },
        vehicleMode: {
          name: "Vehicle mode property",
          desc: "What kind of thing it is: boat, train, bus. The same words a leg uses."
        },
        vehicleOperator: {
          name: "Operator property",
          desc: "Who runs it, as a link to a Company note. A fact about the ship; nothing joins a trip to a company through it."
        },
        vehicleBuilt: { name: "Built property", desc: "The year it entered service." },
        vehicleRefurbished: {
          name: "Refurbished property",
          desc: "The year it was last rebuilt, where that is worth saying."
        },
        vehicleCapacity: { name: "Capacity property", desc: "How many passengers it carries." },
        vehicleLength: { name: "Length property", desc: 'As written: "135 m", "20 coaches".' },
        vehicleTonnage: {
          name: "Tonnage property",
          desc: "Gross tonnage, for a ship that states one."
        },
        vehicleDeckPlan: {
          name: "Deck plan property",
          desc: "A deck plan, or a train layout: one document, as a vault path or a wikilink. Linked rather than shown, because it is usually a PDF."
        },
        vehicleCabins: {
          name: "Cabins property",
          desc: "The cabin categories it is sold in, each with what it includes. A catalogue, not prices: what a cabin costs belongs to the sailing and is written on the trip."
        },
        excursionOperator: {
          name: "Excursion operator property",
          desc: "Who runs the tour, as a link to a Company note. A fact about the excursion, not about any trip that takes it."
        },
        excursionDuration: {
          name: "Excursion duration property",
          desc: 'How long it takes, in the operator\u2019s own words. Free text rather than a number of hours: "half day" and "ca. 4 Stunden" mean the same kind of thing, and nothing here computes with it.'
        },
        excursionCode: {
          name: "Excursion booking code property",
          desc: "The operator's own code for this excursion, HR-TOS5A. It tells two similarly named tours in one port apart, and the booking sheet prints it."
        },
        personTag: {
          name: "Person tag property",
          desc: "The property holding a person's tags, used by the eligible-people filter."
        },
        companyTag: {
          name: "Company tag property",
          desc: "The property holding a company's tags."
        },
        description: {
          name: "Description property",
          desc: "One-line description shown on a person or company card."
        },
        email: { name: "Email property", desc: "Email address on a person or company note." },
        phone: { name: "Phone property", desc: "A company's phone number." },
        mobile: { name: "Mobile property", desc: "A person's mobile number." }
      }
    },
    display: {
      title: "Display",
      exportAuthor: {
        name: "Name on printed sheets",
        desc: 'Who a trip document, brochure, field sheet or cost sheet says made it: "generated by Thomas on ...". Leave empty to leave the name out. NODAtrail has the same setting.'
      },
      language: {
        name: "Language",
        desc: "Follows Obsidian unless you pick one here. Folder names for a new vault are created in this language.",
        auto: "Follow Obsidian",
        applied: "Language changed. Reopen the plugin views, or restart Obsidian, to see it everywhere."
      },
      clockFormat: {
        name: "Clock",
        desc: "How times are written. Sun times are always in the spot own zone, whichever you pick.",
        auto: "Follow the language",
        h24: "24-hour (17:42)",
        h12: "12-hour (5:42 PM)"
      },
      units: {
        name: "Distance",
        desc: "How far apart two places are, on a motif card and in a light conflict.",
        metric: "Kilometres",
        imperial: "Miles"
      }
    },
    dashboard: {
      title: "Dashboard",
      showRibbonIcon: {
        name: "Show ribbon icon",
        desc: "Toggle the Travel dashboard icon in the left ribbon."
      },
      openDashboard: {
        name: "Open dashboard",
        desc: "Trips, countries, and places at a glance, with quick actions to create new ones.",
        button: "Open"
      }
    },
    money: {
      title: "Money",
      budget: {
        name: "Trip costs",
        desc: "The costs block in a trip note, the budget tile on the dashboard and the cost chips on the itinerary. Off leaves booking notes as ordinary notes."
      },
      displayLocale: {
        name: "Number and date format",
        desc: "A locale tag such as `de-CH` or `en-GB`, deciding how figures are grouped and dates ordered. Separate from the interface language: German writes 100.120,20 and Swiss German 100'120.20. Leave empty to follow this computer."
      },
      homeCurrency: {
        name: "Home currency",
        desc: "What a trip is assumed to plan in when neither the booking nor the trip says. ISO code."
      },
      currencyOptions: {
        name: "Currencies offered",
        desc: "The codes the money dropdowns offer, comma separated. Your home currency and anything a note already holds are always offered as well."
      }
    },
    photoSpots: {
      title: "Photo spots",
      sunTimes: {
        name: "Sun times on photo spots",
        desc: "Resolve a motif's light windows to clock times, show the day's light panel, and mark front, side and back light. Off leaves photo spots as plain place notes."
      }
    },
    people: {
      title: "People",
      intro: "Which of your Person notes a trip will offer you.",
      eligiblePersonTags: {
        name: "Eligible person tags",
        desc: "Comma-separated tags. Only people carrying one of these can be added to a trip. Leave empty to offer everyone. Case does not matter, a leading # is ignored, and a parent tag admits its nested children."
      }
    },
    about: {
      title: "About APERtrail",
      description: "The first dedicated travel planner for photography. Map journeys that rotate around vantage points, light, and perspective.",
      origins: {
        text: "APERtrail keeps no data of its own. Every trip, place and contact is one of your own Markdown notes, and every view here is derived from the vault each time it is drawn, so nothing can drift out of step with what is on disk."
      },
      links: {
        github: "APERtrail on GitHub",
        vendor: "Technosoftware GmbH",
        licensing: "Commercial licence"
      },
      pluginInfo: {
        version: "Version: {version}",
        author: "Author: {author}",
        licence: "Licence: {licence}",
        usage: "Free for personal use. Any use in or for a business needs a commercial licence."
      }
    }
  },
  city: {
    /** Hamburg, Berlin, Bremen, Vienna, Washington DC: a town that is its own first-level division. */
    cityState: "City-state",
    /** Named among its country's divisions, where it is one alongside the real State notes. */
    cityStateNamed: "{title} (city-state)"
  },
  archive: {
    archiveTrip: "Archive trip",
    unarchiveTrip: "Restore trip from archive",
    archivedMarker: "Archived",
    archivedNotice: "{title} moved to the archive.",
    unarchivedNotice: "{title} restored from the archive.",
    notConfigured: "No archive folder is set. Settings \u2192 Folders \u2192 Archive.",
    destinationExists: "Something is already at {path}. Nothing was moved."
  },
  health: {
    entityTypeCheck: {
      command: "Check entity types",
      settingName: "Entity type check",
      settingDesc: "Scan the folders above for notes whose type property is missing or disagrees with the folder they sit in.",
      settingButton: "Run check",
      title: "Entity type check",
      allTypesOk: "Every note in your configured folders already has a recognized type.",
      summary: {
        one: "One note needs attention, and it has a suggested type.",
        other: "{count} notes need attention. Each one has a suggested type."
      },
      rescan: "Rescan",
      confirmBulkApply: {
        one: "Click again to apply one change",
        other: "Click again to apply {count} changes"
      },
      applyAllSuggested: "Apply all suggested ({count})",
      close: "Close",
      missingLabel: "(none)",
      issueDesc: "{location} \xB7 current: {current} \xB7 suggested: {suggested}",
      open: "Open",
      setButton: 'Set "{type}"',
      setTypeNotice: 'Set type to "{type}" on {basename}.',
      appliedNotice: {
        one: "Applied one suggested type.",
        other: "Applied {count} suggested types."
      },
      locationLabels: {
        trips: "Trips",
        archivedTrips: "Archived trips",
        bookings: "Bookings",
        countries: "Countries",
        states: "States",
        cities: "Cities",
        accommodation: "Accommodation",
        fnb: "Food & Beverages",
        landmarks: "Landmarks",
        locations: "Locations",
        photoSpots: "Photo spots",
        vehicles: "Vehicles",
        excursions: "Excursions",
        persons: "People",
        companies: "Companies"
      }
    },
    bookingCheck: {
      heading: "Booking warnings ({count})",
      explain: "Warnings, not errors, and none of them is applied for you: which trip a booking belongs to, and which of two notes sharing a reference is the duplicate, are answers only you have.",
      unattached: "This booking names a trip that does not exist, so its money is in no total.",
      noCurrency: "This booking has an amount and no currency, and neither its trip nor the settings supply one.",
      strangerOnTheSplit: "The split names {person}, who is not a participant of this booking's trip.",
      duplicateReference: 'Reference {reference} is also on "{other}". Usually a note created twice, occasionally a payment split across two cards.'
    },
    missingFileCheck: {
      heading: "References to missing files ({count})",
      explain: "A picture, a gallery entry, a cabin photograph or a deck plan naming a file this vault does not have. Every reader treats one it cannot find exactly like none at all, so the only symptom is something that quietly does not appear. Usually a renamed folder or a moved attachment; what the path was meant to say is an answer only you have.",
      plain: '{property} points at "{value}", which this vault does not have.',
      inList: '{property}, under "{detail}", points at "{value}", which this vault does not have.'
    },
    childListCheck: {
      heading: "Child lists naming somebody else ({count})",
      explain: "The states: list on a Country and the cities: list on a State are no longer read. What sits under a note is derived from the link on the child note itself, so neither list has to be kept by hand any more. Most entries in an existing list only repeat what the child already says and cost nothing. These do not: they name a note this vault does not have, or one that points somewhere else, so they used to show up in the list and now they do not.",
      unknown: '{property} lists "{child}", which is not a note in this vault.',
      pointsElsewhere: '{property} lists "{child}", but that note names "{actual}" instead.',
      namesNobody: '{property} lists "{child}", but that note names no parent of its own.'
    },
    legNumberCheck: {
      heading: "Flight numbers in the booking reference ({count})",
      explain: `A leg has a field of its own for the flight or train number. On these flights the reference holds something that looks like a flight number, and the number is empty. The reference is the booking code a booking note finds its leg by: put the flight number into the leg's "Flight or train number" and the reference in once you have it. Nothing is moved for you, because only you know whether it really is a flight number.`,
      inReference: '"{reference}" on the {leg} leg looks like a flight number but is in the reference.'
    },
    variantCabinCheck: {
      heading: "Variants naming an unknown cabin ({count})",
      explain: "A variant borrows its description from the cabin of the same name on the ship. These name a cabin their ship does not list and carry no description of their own, so nothing is shown where one would be. Variants that describe themselves are not listed: they lose nothing by not matching.",
      unknownCabin: '"{variant}" on the {leg} leg is not a cabin {vehicle} lists, and has no description of its own.'
    },
    photoSpotCheck: {
      heading: "Photo spot warnings ({count})",
      explain: "Warnings, not errors. Nothing here is applied for you: which motif is the main one, and what a sample was meant to point at, are answers only the note has.",
      multipleMain: "More than one motif is marked as the main one: {names}.",
      orphanSample: "The sample {image} names a motif this note does not have: {motif}.",
      missingTimeZone: "No timezone, and these coordinates are a long way from this device: the light here is being computed in {device}. The longitude suggests {implied}.",
      noImage: "(no image)"
    }
  }
};

// packages/apertrail/src/lang/translations/de.ts
var deTranslations = {
  commands: {
    openDashboard: "Trips, L\xE4nder & Orte \xF6ffnen",
    openCrmDashboard: "CRM-Dashboard \xF6ffnen",
    openGallery: "Trips, L\xE4nder & Orte durchsuchen",
    newTrip: "Neuer Trip",
    newCountry: "Neues Land",
    newState: "Neues Bundesland",
    newCity: "Neue Stadt",
    newAccommodation: "Neue Unterkunft",
    newFnb: "Neu: Essen & Trinken",
    newLandmark: "Neue Sehensw\xFCrdigkeit",
    newLocation: "Neuer Ort",
    newVehicle: "Neues Schiff oder neuer Zug",
    newExcursion: "Neuer Ausflug",
    editVehicleCabins: "Kabinen und Angaben zu diesem Schiff oder Zug",
    newPhotoSpot: "Neuer Fotospot",
    exportPhotoSpotSheet: "Diesen Fotospot als Spickzettel exportieren",
    editNoteCover: "Diese Reisenotiz bearbeiten",
    exportProspect: "Diese Notiz als Prospekt exportieren",
    exportTripDocument: "Diese Reise als Dokument exportieren",
    exportBookingSheet: "Buchungsblatt f\xFCr diese Reise exportieren",
    newBooking: "Neue Buchung",
    newPerson: "Neue Person",
    newCompany: "Neue Firma",
    createSampleVault: "Beispielnotizen anlegen"
  },
  booking: {
    category: {
      transport: "Transport",
      accommodation: "Unterkunft",
      activity: "Aktivit\xE4ten",
      food: "Essen & Trinken",
      fees: "Geb\xFChren",
      other: "Sonstiges"
    },
    status: {
      estimate: "Gesch\xE4tzt",
      booked: "Gebucht",
      paid: "Bezahlt",
      cancelled: "Storniert",
      refunded: "Erstattet"
    }
  },
  costs: {
    heading: "Kosten",
    documentLabel: "Reisekosten",
    notATrip: "Diese Notiz ist keine Reise oder liegt nicht im konfigurierten Trips-Ordner.",
    noBookings: "Noch keine Buchungen. Lege eine an oder verweise eine Buchungsnotiz auf diese Reise.",
    saveFailed: "Die Reise konnte nicht gespeichert werden.",
    switchedOff: "Reisekosten sind in den Plugin-Einstellungen ausgeschaltet.",
    addBooking: "Buchung",
    editBudget: "Budget",
    editRates: "Kurse",
    planned: "Geplant",
    optional: "Optional zus\xE4tzlich",
    optionalAll: "Alles zusammen",
    committed: "Verbindlich",
    paid: "Bezahlt",
    left: "\xDCbrig",
    over: "Dar\xFCber",
    budget: "Budget",
    nothingYet: "noch nichts",
    dates: "Zeitraum",
    reference: "Referenz",
    estimateChip: "Gesch\xE4tzt, noch nichts gebucht",
    bookThis: "Jetzt buchen",
    currencyFromTrip: "W\xE4hrung der Reise",
    currencyFromHome: "Eigene W\xE4hrung ({currency})",
    unit: {
      total: "insgesamt",
      person: "pro Person",
      night: "pro Nacht",
      personNight: "pro Person und Nacht"
    },
    nightsUnknown: "ohne Daten, einmal gez\xE4hlt",
    working: "{unit} \xD7 {multiplier}",
    exportSheet: "Kostenblatt",
    sheetTitle: "Kosten: {trip}",
    sheetFileSuffix: "Kostenblatt",
    sheetWritten: "Kostenblatt geschrieben nach {path}.",
    sheetFailed: "Das Kostenblatt konnte nicht geschrieben werden.",
    sheetCaveat: "Betr\xE4ge so, wie die Notizen sie nennen. Umgerechnete Betr\xE4ge nutzen die Kurse dieser Reise, also deine eigenen. Die Abrechnung teilt jede Buchung gleichm\xE4ssig auf die genannten Personen auf.",
    sheetFooter: "Kostenblatt, erstellt von {author} am {date} mit APERtrail",
    sheetFooterAnonymous: "Kostenblatt, erstellt am {date} mit APERtrail",
    document: "Beleg",
    stillEstimated: "Noch Sch\xE4tzungen",
    settlement: "Abrechnung",
    balances: "Wer was bezahlt hat",
    transfers: "Zum Ausgleich",
    alreadySquare: "Niemand schuldet jemandem etwas.",
    balanceLine: "{person}: bezahlt {paid}, verbraucht {owed}, Saldo {balance}",
    transferLine: "{from} zahlt {to} {amount}",
    onePayer: "{person} hat alles bezahlt. Die anderen schulden zusammen {amount}.",
    unbudgeted: "nicht budgetiert",
    ofPlanned: "von {planned} geplant",
    underBy: "{amount} \xFCbrig",
    overBy: "{amount} dar\xFCber",
    excludesUnconverted: "ohne die nicht umgerechneten Betr\xE4ge",
    noRate: "Kein Kurs f\xFCr {currency}",
    currencyAtRate: "{amount} zu {rate} = {converted}",
    currencyNoRate: "{amount}, ohne Kurs auf dieser Reise und damit nicht im Total",
    settlementIncomplete: "Buchungen in {currencies} bleiben aussen vor: diese Reise nennt keinen Kurs daf\xFCr.",
    invoice: {
      booking: "Buchung",
      category: "Kategorie",
      status: "Status",
      amount: "Betrag"
    }
  },
  trip: {
    duplicateTitle: "Reise duplizieren",
    duplicateNameField: "Name der Kopie",
    duplicateButton: "Duplizieren",
    duplicateWhat: "Der Ablauf wird vollst\xE4ndig \xFCbernommen: Tage, Stationen, \xDCbernachtungen, Transport, Budget, H\xF6hepunkte und \xDCberblick. Daten, Status, Bewertung und Buchungen nicht, denn eine Kopie ist eine Reise, die du planen willst, und keine, die du gemacht hast.",
    duplicated: "Kopiert nach \u201E{title}\u201C, mit {pictures} Bildern.",
    duplicateExists: "Eine Reise namens \u201E{title}\u201C existiert bereits.",
    duplicateFailed: "Die Reise konnte nicht dupliziert werden."
  },
  fieldNames: {
    duration: "Dauer",
    bookingCode: "Buchungsnummer",
    operator: "Betrieben von",
    built: "Baujahr",
    refurbished: "Umbau",
    capacity: "Kapazit\xE4t",
    length: "L\xE4nge",
    tonnage: "Tonnage",
    website: "Webseite",
    deckPlan: "Deckplan",
    address: "Adresse",
    rating: "Bewertung",
    geoLocation: "Koordinaten",
    lastVisit: "Letzter Besuch",
    country: "Land",
    capital: "Hauptstadt"
  },
  prospect: {
    highlights: "H\xF6hepunkte",
    overview: "Kurz gesagt",
    facts: "Die Angaben",
    trips: "Deine Reisen hierher",
    fileSuffix: "Prospekt",
    kind: "Art",
    status: "Status",
    where: "Wo",
    yes: "Ja",
    notYet: "Noch nicht",
    caveat: "Diese Seite ist ein Ausdruck der aktuellen Reisenotizen. Massgeblich sind die Notizen."
  },
  vehicleBrochure: {
    exportButton: "Prospekt",
    overview: "\xDCber sie",
    cabins: "Die Kabinen",
    facts: "Das Schiff in Zahlen",
    gallery: "Bilder",
    trips: "Deine Reisen an Bord",
    fileSuffix: "Prospekt",
    written: "Prospekt geschrieben nach {path}.",
    failed: "Das Prospekt konnte nicht geschrieben werden.",
    caveat: "Reisenotizen, die Kabinen sind die Kategorien, in denen sie verkauft wird; was eine kostet, geh\xF6rt zur Reise, die sie bucht. Massgeblich sind die Notizen.",
    footer: "Prospekt, erstellt von {author} am {date} mit APERtrail",
    footerAnonymous: "Prospekt, erstellt am {date} mit APERtrail"
  },
  tripDocument: {
    exportButton: "Reisedokument",
    highlights: "H\xF6hepunkte",
    overview: "Die Reise im \xDCberblick",
    transport: "Anreise & R\xFCckreise",
    stays: "\xDCbernachtungen",
    beforeStart: "Tag 0 ist der Tag vor Reisebeginn.",
    afterEnd: "Ein Tag nach dem letzten ist der Tag nach Reiseende.",
    itinerary: "Reiseverlauf",
    extensions: "Nachprogramm",
    extensionsHint: "Jedes davon ist eine eigene Reise, getrennt gebucht und getrennt bepreist. Ihre Betr\xE4ge stecken nicht in der Summe dar\xFCber.",
    costs: "Was sie kostet",
    gallery: "Bilder",
    day: "Tag {number}",
    days: { one: "1 Tag", other: "{count} Tage" },
    variants: "Varianten",
    variantChosen: "gew\xE4hlt",
    arrivals: "Ankunft heute: {legs}",
    departures: "Abfahrt heute: {legs}",
    flights: "Abflug heute: {legs}",
    optional: "Optional",
    optionalTaken: "Optional, gebucht",
    optionalTotal: "Optional zus\xE4tzlich",
    travellers: "Reisende: {names}",
    onlyFor: "Nur {names}",
    perPerson: "Pro Person",
    perPersonHint: "Aus den Zeilen des Reiseverlaufs gerechnet: ein geteiltes Zimmer wird auf die Personen darin aufgeteilt, ein Ausflug der Person zugerechnet, die ihn macht. Ein Budget f\xFCr eine ganze Kategorie wird nicht aufgeteilt, darum m\xFCssen diese Summen nicht die geplante Summe dar\xFCber ergeben.",
    perPersonPartial: "Geplant, nur in der Reisew\xE4hrung",
    shareOf: "(1/{count} von {amount})",
    fileSuffix: "Reisedokument",
    written: "Reisedokument geschrieben nach {path}.",
    failed: "Das Reisedokument konnte nicht geschrieben werden.",
    caveat: "Diese Seite ist ein Ausdruck der aktuellen Reisenotizen. Massgeblich sind die Notizen.",
    footer: "Reisedokument, erstellt von {author} am {date} mit APERtrail",
    footerAnonymous: "Reisedokument, erstellt am {date} mit APERtrail"
  },
  bookingSheet: {
    exportButton: "Buchungsblatt",
    title: "Buchungsblatt: {trip}",
    travellers: "Reisende",
    name: "Name",
    birthDate: "Geburtsdatum",
    passportName: "Name wie im Pass",
    flights: "Fl\xFCge",
    hotels: "Unterk\xFCnfte",
    transport: "Transporte",
    excursions: "Ausfl\xFCge",
    date: "Datum",
    flight: "Flug",
    operator: "Anbieter",
    route: "Strecke",
    departs: "Ab",
    arrives: "An",
    class: "Klasse",
    cabin: "Kabine / Klasse",
    reference: "Referenz",
    price: "Preis",
    checkIn: "Anreise",
    checkOut: "Abreise",
    nights: "N\xE4chte",
    accommodation: "Unterkunft",
    room: "Zimmer",
    time: "Zeit",
    excursion: "Ausflug",
    place: "Ort",
    variant: "Variante",
    open: "offen",
    booked: "gebucht",
    until: "bis {date}",
    optionalChosen: "Zusatz, gew\xE4hlt",
    section: {
      flight: "Flug",
      hotel: "Unterkunft",
      transport: "Transport",
      excursion: "Ausflug"
    },
    total: "Summe laut Planung",
    totalNote: "Ohne offene Wahlen und ohne Zus\xE4tze, die noch nicht entschieden sind.",
    openHeading: "Noch offen",
    openVariant: "{subject}: noch keine Wahl zwischen {options}.",
    openUndecided: "{subject}, {when}: optional, noch nicht entschieden.",
    openUndecidedPriced: "{subject}, {when}: optional, noch nicht entschieden ({price}).",
    openUndecidedUndated: "{subject}: optional, noch nicht entschieden.",
    openNoDeparture: "Die Reise hat noch kein Abreisedatum. Die Zeilen oben stehen mit ihrem Reisetag statt mit einem Datum.",
    openUndated: "{subject}: ohne Datum und ohne Reisetag.",
    openNoFlightTime: "{subject}: die Abflugzeit fehlt.",
    openNoTime: "{subject}: die Abfahrtszeit fehlt.",
    fileSuffix: "Buchungsblatt",
    written: "Buchungsblatt geschrieben nach {path}.",
    failed: "Das Buchungsblatt konnte nicht geschrieben werden.",
    caveat: "Diese Seite ist ein Ausdruck der aktuellen Reisenotizen zur Vorbereitung einer Buchung. Die Preise sind Planwerte, keine Angebote. Massgeblich sind die Notizen.",
    footer: "Buchungsblatt, erstellt von {author} am {date} mit APERtrail",
    footerAnonymous: "Buchungsblatt, erstellt am {date} mit APERtrail"
  },
  photoSpot: {
    notAPhotoSpot: "Diese Notiz ist kein Fotospot, oder sie liegt nicht im eingestellten Fotospot-Ordner.",
    addMotif: "Motiv",
    addSample: "Beispielbild",
    editMotif: "Motiv bearbeiten",
    deleteMotif: "Motiv l\xF6schen",
    moveUp: "Nach oben",
    moveDown: "Nach unten",
    editSample: "Beispielbild bearbeiten",
    deleteSample: "Beispielbild l\xF6schen",
    saveFailed: "Der Fotospot konnte nicht gespeichert werden.",
    lightOn: "Licht am {date}",
    export: {
      button: "Spickzettel",
      light: "Licht",
      fileSuffix: "Spickzettel",
      footer: "Spickzettel, erstellt von {author} am {date} mit APERtrail",
      footerAnonymous: "Spickzettel, erstellt am {date} mit APERtrail",
      written: "Spickzettel geschrieben nach {path}.",
      failed: "Der Spickzettel konnte nicht geschrieben werden."
    },
    nextLightToday: "Heute: {light} am Motiv {motif}, {time}",
    nextLightTomorrow: "Morgen: {light} am Motiv {motif}, {time}",
    lightFrom: "ab {time}",
    sunWhere: "{zone} \xB7 {lat}, {lon}",
    deviceTimeZone: "{zone}, dieses Ger\xE4t",
    unknownTimeZone: "unbekannte Zone",
    band: {
      night: "Nacht",
      blue: "Blaue Stunde",
      golden: "Goldene Stunde",
      day: "Tag"
    },
    today: "heute",
    solarNoon: "Sonnenh\xF6chststand",
    polarDay: "Die Sonne geht an diesem Datum hier nicht unter.",
    polarNight: "Die Sonne geht an diesem Datum hier nicht auf.",
    sunCaveat: "Geometrie, kein Wetter, und ein flacher Horizont: im Tal verschwindet die goldene Stunde hinter dem Grat, und das weiss keine Formel.",
    relation: {
      back: "Gegenlicht",
      side: "Seitenlicht",
      front: "Auflicht"
    },
    motifs: "Motive",
    noMotifs: "Noch keine Motive. Trage sie in die Eigenschaft `motifs:` dieser Notiz ein.",
    unnamedMotif: "(Motiv ohne Namen)",
    otherSamples: "Weitere Beispielbilder",
    onSite: "Vor Ort",
    role: {
      main: "Hauptmotiv",
      secondary: "Nebenmotiv"
    },
    light: {
      "blue-hour-morning": "Blaue Stunde, morgens",
      sunrise: "Sonnenaufgang",
      "golden-hour-morning": "Goldene Stunde, morgens",
      day: "Tageslicht",
      overcast: "Bedeckt",
      "golden-hour-evening": "Goldene Stunde, abends",
      sunset: "Sonnenuntergang",
      "blue-hour-evening": "Blaue Stunde, abends",
      night: "Nacht"
    },
    compass: {
      N: "N",
      NNE: "NNO",
      NE: "NO",
      ENE: "ONO",
      E: "O",
      ESE: "OSO",
      SE: "SO",
      SSE: "SSO",
      S: "S",
      SSW: "SSW",
      SW: "SW",
      WSW: "WSW",
      W: "W",
      WNW: "WNW",
      NW: "NW",
      NNW: "NNW"
    },
    directionValue: "Blickrichtung {degrees}\xB0 ({compass})",
    seasonValue: "Beste Zeit {months}",
    capturedCount: "{captured} von {total} fotografiert",
    captured: "Fotografiert",
    capturedOn: "Fotografiert am {date}",
    notCaptured: "Noch nicht fotografiert",
    offsetFromAnchor: "{distance} {compass} vom Ankerpunkt",
    gear: {
      tripod: "Stativ",
      polarizer: "Polfilter",
      filter: "Filter",
      remote: "Fernausl\xF6ser",
      flash: "Blitz",
      drone: "Drohne"
    },
    transit: {
      rail: "Bahn",
      bus: "Bus",
      tram: "Tram",
      boat: "Schiff",
      cablecar: "Seilbahn",
      foot: "Zu Fuss",
      car: "Auto"
    },
    transitLabel: "Anreise",
    address: "Adresse",
    parking: "Parken",
    openingHours: "\xD6ffnungszeiten",
    entryFee: "Eintritt",
    noEntryFee: "Kein Eintrittspreis",
    accessibility: "Barrierefreiheit",
    accessibilityValue: {
      full: "Vollst\xE4ndig gegeben",
      partial: "Teilweise gegeben",
      none: "Nicht gegeben",
      unknown: "Nicht erfasst"
    },
    website: "Website"
  },
  relatedTrips: {
    empty: "Hier hat bisher kein Trip Halt gemacht.",
    emptyVehicle: "Noch keine Reisen damit.",
    emptyExcursion: "Diesen Ausflug hat bisher keine Reise gemacht.",
    emptyPerson: "Bisher nennt kein Trip diese Person.",
    notASubject: "Diese Notiz ist keine Stadt, kein Ort, keine Person und kein Verkehrsmittel, oder sie liegt nicht in einem eingestellten APERtrail-Ordner.",
    noDate: "(ohne Datum)"
  },
  itinerary: {
    deckPlan: "Deckplan",
    addStop: "Station",
    addNight: "Aufenthalt",
    addLeg: "Abschnitt",
    editStop: "Station bearbeiten",
    editNight: "Aufenthalt bearbeiten",
    editLeg: "Abschnitt bearbeiten",
    editDay: "Diesen Tag benennen",
    insertDay: "Einen Tag davor einf\xFCgen",
    removeDay: "Diesen Tag entfernen, Rest r\xFCckt auf",
    dayNumber: "Tag {number}",
    undatedDay: "Noch ohne Datum",
    fromTime: "ab {time}",
    untilTime: "bis {time}",
    nights: "\xDCbernachtungen",
    conflictTooFar: 'Von "{other}" aus nicht rechtzeitig erreichbar: {distance} entfernt, zu Fuss rund {walk}, und der Plan l\xE4sst {gap}. Luftlinie im Gehtempo, keine Route.',
    conflictOverlap: '\xDCberschneidet sich mit "{other}", {distance} entfernt. Zwei Orte gleichzeitig ist kein Plan.',
    conflictPreviousStop: "dem Stopp davor",
    minutes: "{minutes} Min.",
    hours: "{hours} Std.",
    hoursMinutes: "{hours} Std. {minutes} Min.",
    shotList: "Shot list ({open} von {total} offen)",
    markCaptured: "\u201E{motif}\u201C als fotografiert markieren",
    transport: "Anreise & R\xFCckreise",
    legJoiner: "nach",
    via: "\xFCber {places}",
    unnamedLeg: "Reiseabschnitt",
    unnamedNight: "Unterkunft",
    unnamedStop: "Station",
    travellers: { one: "1 Person", other: "{count} Personen" },
    legNights: { one: "1 Nacht", other: "{count} N\xE4chte" },
    legArrival: "Ankunft: {leg}",
    legDeparture: "Abfahrt: {leg}",
    legFlight: "Abflug: {leg}",
    variants: "Varianten",
    variantUnnamed: "Variante {number}",
    variantChosen: "Gew\xE4hlt",
    variantClear: "Wahl offenlassen",
    variantChoose: "Diese Variante rechnen",
    variantAssumed: "Noch nichts gew\xE4hlt, deshalb rechnet das Budget mit der ersten Variante.",
    optional: "Optional",
    optionalTake: "In die Planung \xFCbernehmen",
    optionalDrop: "Wieder aus der Planung nehmen",
    optionalTaken: "Optional, gebucht",
    outbound: "Hinweg",
    inbound: "R\xFCckweg",
    unknownPlace: "(nicht aufgel\xF6ster Link)",
    empty: "Noch keine Stationen erfasst. \xDCber Trip bearbeiten den Ablauf erg\xE4nzen.",
    notATrip: "Diese Notiz ist kein Trip oder liegt nicht im eingestellten Trips-Ordner.",
    edit: "Trip bearbeiten"
  },
  crm: {
    create: {
      folderMissing: "Lege in den APERtrail-Einstellungen zuerst den Personen- oder Firmen-Ordner fest.",
      typeValueMissing: "Lege in den APERtrail-Einstellungen zuerst den Typ-Wert f\xFCr Personen oder Firmen fest."
    }
  },
  sampleVault: {
    title: "Beispielnotizen anlegen",
    subtitle: "Ein kleiner Satz Trips, Orte und Personen, zum Anschauen statt zum Tippen",
    intro: "Dies schreibt neue Notizen in deinen Vault, in die f\xFCr APERtrail eingestellten Ordner. Vorhandenes wird weder \xFCberschrieben noch gel\xF6scht.",
    createHeading: {
      one: "W\xFCrde eine Notiz anlegen",
      other: "W\xFCrde {count} Notizen anlegen"
    },
    skipHeading: {
      one: "Schon vorhanden, bleibt unber\xFChrt: eine Notiz",
      other: "Schon vorhanden, bleibt unber\xFChrt: {count} Notizen"
    },
    augmentHeading: {
      one: "Schon vorhanden, bek\xE4me einen Block f\xFCr zugeh\xF6rige Trips: eine Notiz",
      other: "Schon vorhanden, bek\xE4men einen Block f\xFCr zugeh\xF6rige Trips: {count} Notizen"
    },
    augmentExplain: "Die einzige \xC4nderung an einer Notiz, die APERtrail nicht selbst geschrieben hat. Eine von einem anderen Plugin angelegte Personennotiz hat keinen Grund, diesen Block zu tragen; ihn anzuh\xE4ngen ist genau das, was dieselbe Notiz f\xFCr beide nutzbar macht.",
    sharedHeading: "Wird neben Vorhandenes geschrieben",
    sharedExplain: "Die CRM-Ordner werden nach Absprache von mehreren TRAILsuite-Plugins geschrieben. Notizen darin, die diese Beispiele nicht benennen, bleiben unangetastet, und es wird deswegen nichts abgelehnt. Daneben w\xFCrde geschrieben:",
    sharedOthers: {
      one: "enth\xE4lt bereits eine weitere Notiz: {titles}",
      other: "enth\xE4lt bereits {count} weitere Notizen: {titles}"
    },
    blockedHeading: "Es w\xFCrde nichts geschrieben",
    occupiedExplain: "Die Beispielnotizen werden nur in Ordner geschrieben, deren Inhalt sie erkl\xE4ren k\xF6nnen. Leere die unten genannten Ordner oder stelle die Ordner-Einstellungen um, und starte danach erneut.",
    strangers: "enth\xE4lt Notizen, die dieses Beispiel nicht kennt: {titles}",
    unconfigured: "F\xFCr diese Notizen ist kein Ordner oder kein Typ-Wert eingestellt, sie w\xE4ren nach dem Schreiben nicht wiederzufinden: {titles}",
    nothingToDo: "Alle Beispielnotizen liegen bereits in deinem Vault.",
    createButton: "Notizen anlegen",
    createdNotice: {
      one: "Eine Notiz angelegt.",
      other: "{count} Notizen angelegt."
    },
    augmentedNotice: {
      one: "Bei einer vorhandenen Notiz den Block f\xFCr zugeh\xF6rige Trips erg\xE4nzt.",
      other: "Bei {count} vorhandenen Notizen den Block f\xFCr zugeh\xF6rige Trips erg\xE4nzt."
    },
    failedNotice: "Diese konnten nicht geschrieben werden: {titles}"
  },
  ribbon: {
    dashboardTooltip: "Reise-Dashboard"
  },
  modals: {
    shell: {
      cancelButton: "Abbrechen"
    },
    stopEditor: {
      motifField: "Motiv",
      excursionField: "Ausflug",
      excursionDesc: "Der Ausflug, der dieser Halt ist -- im Unterschied zum Ort, an dem er stattfindet. Was er kostet, bleibt auf dieser Zeile: derselbe Ausflug ist auf jeder Reise anders bepreist.",
      excursionPlaceholder: "Name des Ausflugs",
      motifAny: "Kein bestimmtes Motiv",
      prefilledName: "Zeiten vorgeschlagen",
      prefilled: "\xDCbernommen aus {light} dieses Motivs am Tag des Stopps. Jederzeit \xFCberschreibbar; nichts wird zur\xFCckgeschrieben.",
      title: "Station",
      placeField: "Ort",
      placeOrNoteRequired: "Bitte einen Ort, einen Text oder beides angeben.",
      clearPlace: "Findet an keinem bestimmten Ort statt"
    },
    dayEditor: {
      title: "Tag {number}",
      titleField: "Name",
      titleDesc: "Wie dieser Tag hei\xDFt, neben seiner Nummer gezeigt: \u201E1. Tag: Pretoria\u201C.",
      titlePlaceholder: "Pretoria",
      noteField: "\xDCber diesen Tag",
      noteDesc: "Ein Absatz f\xFCr das gedruckte Dokument. Beide leer lassen, und der Tag sagt nichts -- so beginnt jeder Tag."
    },
    nightEditor: {
      title: "Aufenthalt",
      accommodationRequired: "Bitte zuerst eine Unterkunft ausw\xE4hlen."
    },
    legEditor: {
      title: "Reiseabschnitt",
      directionField: "Richtung"
    },
    tripEditor: {
      presentationHeading: "Was die Reise \xFCber sich sagt",
      galleryAdd: "Bild hinzuf\xFCgen",
      galleryCaption: "Bildunterschrift",
      galleryEmpty: "Noch keine Bilder. Lade welche hoch oder w\xE4hle sie aus dem Vault.",
      galleryRemove: "Dieses Bild entfernen",
      itineraryMovedHint: "Stationen, Aufenthalte und Reiseabschnitte werden direkt in der Trip-Notiz im Ablauf-Block bearbeitet -- jeweils einzeln, damit dieser Dialog unabh\xE4ngig von der L\xE4nge des Trips gleich gross bleibt.",
      createTitle: "Neuer Trip",
      editTitle: "Trip bearbeiten: {title}",
      citiesField: "St\xE4dte",
      noCitiesYet: "Es gibt noch keine Stadt-Notizen. Lege zuerst eine an, um sie hier zu verkn\xFCpfen.",
      extendsField: "Verl\xE4ngerung von",
      extendsHint: "Die Reise, die diese fortsetzt -- drei Tage irgendwo, nachdem die Hauptreise endet. Hier eingetragen, auf der Reise, die als zweite kommt.",
      travelTypeField: "Reiseart",
      travelStatusField: "Reisestatus",
      travelStatusDesc: "Auf Automatisch lassen, damit die Daten des Trips entscheiden: Ein Trip, dessen R\xFCckkehr vorbei ist, gilt als Beendet, alles andere als Geplant.",
      statusAutoOption: "Automatisch (aus den Daten)",
      reviewStatusField: "Status der Nachbereitung",
      ratingField: "Bewertung",
      personsHeading: "Wer war dabei",
      noPersonsYet: "Es wurden keine Personen-Notizen gefunden. Zeige APERtrail im Einstellungstab auf deinen Personen-Ordner.",
      itineraryHeading: "Ablauf",
      pickPlace: "Ort ausw\xE4hlen",
      stopDay: "Tag der Reise",
      dayDesc: "Leer lassen, um ein eigenes Datum zu vergeben.",
      stopFrom: "Von",
      stopTo: "Bis",
      stopPastMidnight: "Eine Bis-Zeit vor der Von-Zeit heisst: am n\xE4chsten Tag. Ein Schiff, das um 23:45 anlegt und um 01:30 ablegt, erscheint als 23:45 - 01:30 +1.",
      stopNote: "Notiz",
      stopRating: "Bewertung",
      removeStop: "Station entfernen",
      moveUp: "Nach oben",
      moveDown: "Nach unten",
      pickAccommodation: "Unterkunft ausw\xE4hlen",
      checkInDay: "Anreise an Tag",
      checkOutDay: "Abreise an Tag",
      checkIn: "Anreise",
      checkOut: "Abreise",
      removeNight: "Aufenthalt entfernen",
      outbound: "Hinweg",
      inbound: "R\xFCckweg",
      legMode: "Verkehrsmittel",
      legDay: "Abfahrt an Tag",
      legToDay: "Ankunft an Tag",
      variants: "Varianten zur Auswahl",
      variantsDesc: "Die Preise, zu denen dasselbe gebucht werden kann: eine Kabinenkategorie, eine Zimmerkategorie, eine l\xE4ngere Fassung desselben Ausflugs. Gerechnet wird immer nur die gew\xE4hlte, und bis zur Wahl die erste.",
      addVariant: "Variante hinzuf\xFCgen",
      removeVariant: "Variante entfernen",
      variantNumber: "Variante {number}",
      variantName: "Bezeichnung",
      variantNamePlaceholder: "Polar Aussenkabine",
      variantDescription: "Was enthalten ist",
      variantChosen: "Diese ist es",
      optional: "Optional",
      optionalDesc: "Etwas, das stattfinden kann oder auch nicht: ein angebotener Ausflug, ein Transfer, den Sie vielleicht nicht nehmen. Der Preis wird gezeigt, bleibt aber ausserhalb der Planung, bis Sie sich daf\xFCr entscheiden.",
      optionalChosen: "Wird gemacht",
      optionalChosenDesc: "Rechnet es in die Planung ein, w\xE4hrend die Notiz weiterhin sagt, dass es ein Zusatz war.",
      legFrom: "Abfahrt",
      legTo: "Ankunft",
      legOrigin: "Von",
      legOriginPlaceholder: "Z\xFCrich",
      legDestination: "Nach",
      legDestinationPlaceholder: "Pretoria, S\xFCdafrika",
      legPlaceDesc: "Wo der Abschnitt beginnt und endet. Freitext oder Wikilink; die wenigsten Flugh\xE4fen werden je eine Notiz sein.",
      travellers: "Wer mitkommt",
      travellersDesc: "Alle auf der Reise, sofern nichts anderes gew\xE4hlt ist. Zwei Personen auf einem Flug sind zwei Tickets; zwei in einer Unterkunft teilen sich das Zimmer.",
      stopCost: "Gesch\xE4tzte Kosten",
      legReferenceDesc: "Die Buchungsreferenz. Eine Buchungsnotiz mit derselben Referenz gilt als Bezahlung dieses Abschnitts.",
      legCost: "Gesch\xE4tzte Kosten",
      nightCost: "Gesch\xE4tzte Kosten",
      costDesc: "Was du in der Planung erwartest. Eine Buchung mit derselben Referenz ersetzt den Wert, sobald du buchst.",
      costPlaceholder: "890",
      legVehicle: "Schiff oder Zug",
      legVehicleDesc: "Auf welchem Schiff oder benannten Zug dieser Abschnitt gefahren wird -- im Unterschied dazu, wer ihn betreibt. Verlinkt auf eine Verkehrsmittel-Notiz erscheinen deren Kabinenbeschreibungen unter den Preisen.",
      legVehiclePlaceholder: "MS Trollfjord",
      legCarrier: "Durchgef\xFChrt von",
      legCarrierDesc: "Die Fluggesellschaft, die Bahn oder der Name des Zuges. Freitext, oder ein Wikilink, wenn der Vault eine Notiz daf\xFCr hat.",
      legCarrierPlaceholder: "Swiss",
      legNumber: "Flug- oder Zugnummer",
      legNumberDesc: "Die Nummer, unter der dieser Abschnitt f\xE4hrt oder fliegt. Nicht die Buchungsreferenz darunter: nach der sucht eine Buchungsnotiz ihren Abschnitt.",
      legNumberPlaceholder: "LX288",
      segments: "Umsteigen",
      segmentsDesc: "Ein Ticket, mehrere Fl\xFCge: Preis, Klasse und Referenz bleiben beim Abschnitt, jeder Flug bekommt Nummer, Strecke und Zeiten. Die bisherige Strecke wird zum ersten Flug.",
      addSegment: "Weiterer Flug",
      segmentNumber: "Flug {number}",
      removeSegment: "Diesen Flug entfernen",
      segmentCarrier: "Durchgef\xFChrt von",
      segmentCarrierDesc: "Nur wenn eine andere Gesellschaft fliegt als oben (Codeshare). Leer heisst: dieselbe.",
      legReference: "Referenz",
      removeLeg: "Abschnitt entfernen",
      remove: "{item} entfernen",
      cancel: "Abbrechen",
      save: "Speichern",
      saved: 'Trip "{title}" gespeichert.',
      mode: {
        train: "Zug",
        plane: "Flugzeug",
        car: "Auto",
        bus: "Bus",
        boat: "Schiff",
        other: "Sonstiges"
      }
    },
    placePicker: {
      title: "Ort ausw\xE4hlen",
      searchPlaceholder: "St\xE4dte, Unterk\xFCnfte, Restaurants, Sehensw\xFCrdigkeiten suchen...",
      noMatches: "Dazu passt nichts."
    },
    common: {
      titleField: "Titel",
      countryField: "Land",
      stateField: "Bundesland",
      cityStateOption: "{title} selbst (Stadtstaat)",
      cityField: "Stadt",
      noneOption: "(Keine)",
      create: "Erstellen",
      titleRequired: "Titel ist erforderlich.",
      createFailed: "Die Notiz konnte nicht erstellt werden.",
      imageFieldHint: "Ein Tresorpfad, ein Wikilink oder eine URL.",
      imageUploadButton: "Bild hochladen",
      imageUploadFailed: "{names} konnte nicht hinzugef\xFCgt werden.",
      imagePickerButton: "Bild aus dem Tresor w\xE4hlen",
      imagePickerHint: "Bilder im Tresor suchen",
      documentPickerButton: "Dokument aus dem Tresor w\xE4hlen",
      documentPickerHint: "Dokumente im Tresor suchen",
      documentUploadButton: "Dokument hinzuf\xFCgen",
      documentUploadFailed: "{names} konnte nicht hinzugef\xFCgt werden.",
      save: "Speichern",
      edit: "Bearbeiten",
      createNewOption: "Neu anlegen ...",
      capitalField: "Hauptstadt",
      editTitle: "{title} bearbeiten",
      saved: '"{title}" gespeichert.',
      saveFailed: "Die Notiz konnte nicht gespeichert werden.",
      geoLocation: "Koordinaten",
      geoLocationInvalid: "Koordinaten sollten wie 46.9895, 6.9243 aussehen.",
      tags: "Tags",
      tagsPlaceholder: "Kommagetrennt, z. B. ruhig, Fr\xFChst\xFCck"
    },
    placeEditor: {
      address: "Adresse",
      website: "Webseite",
      rating: "Bewertung",
      accommodationType: "Art der Unterkunft",
      accommodationStatus: "Buchungsstatus",
      fnbType: "Art des Lokals"
    },
    newTripModal: {
      title: "Neuer Trip",
      departureField: "Abreise",
      returnField: "R\xFCckkehr",
      created: 'Trip "{title}" erstellt.'
    },
    crm: {
      tagsField: "Tags",
      tagsPlaceholder: "Kommagetrennt, z. B. Freunde, Fotografie",
      emailField: "E-Mail",
      mobileField: "Mobil",
      phoneField: "Telefon",
      websiteField: "Webseite",
      addressField: "Adresse"
    },
    newPersonModal: {
      title: "Neue Person",
      created: "Person \u201E{title}\u201C erstellt."
    },
    newCompanyModal: {
      title: "Neue Firma",
      created: "Firma \u201E{title}\u201C erstellt."
    },
    newCountryModal: {
      title: "Neues Land",
      created: 'Land "{title}" erstellt.'
    },
    newStateModal: {
      title: "Neues Bundesland",
      created: 'Bundesland "{title}" erstellt.'
    },
    newCityModal: {
      title: "Neue Stadt",
      created: 'Stadt "{title}" erstellt.'
    },
    newAccommodationModal: {
      title: "Neue Unterkunft",
      created: 'Unterkunft "{title}" erstellt.'
    },
    newFnbModal: {
      title: "Neu: Essen & Trinken",
      created: 'Eintrag "{title}" erstellt.'
    },
    newLandmarkModal: {
      title: "Neue Sehensw\xFCrdigkeit",
      created: 'Sehensw\xFCrdigkeit "{title}" erstellt.'
    },
    newLocationModal: {
      title: "Neuer Ort",
      created: 'Ort "{title}" erstellt.'
    },
    motifEditor: {
      seasonPreset: {
        spring: "Fr\xFChling",
        summer: "Sommer",
        autumn: "Herbst",
        winter: "Winter",
        allYear: "Ganzj\xE4hrig"
      },
      title: "Motiv",
      name: "Name",
      nameRequired: "Ein Motiv braucht einen Namen.",
      role: "Rolle",
      roleDesc: "Das Hauptmotiv ist das, wonach der Spot benannt ist. Es gibt h\xF6chstens eines.",
      geoLocation: "Koordinaten",
      geoLocationDesc: 'Nur wenn dieses Motiv woanders liegt als der Spot selbst. Als "Breite, L\xE4nge" einf\xFCgen.',
      direction: "Blickrichtung",
      directionDesc: "Die Richtung, in die du fotografierst, in Grad. Eine Himmelsrichtung geht auch und wird als Grad gespeichert.",
      light: "Licht",
      season: "Saison",
      lens: "Objektiv",
      gear: "Ausr\xFCstung",
      gearDesc: "Mit Komma getrennt, z. B. tripod, nd1000.",
      note: "Notiz",
      noteDesc: "Wo man steht und wie man hinkommt.",
      technique: "Technik",
      techniqueDesc: "Der Kniff f\xFCr genau dieses Motiv."
    },
    sampleEditor: {
      title: "Beispielbild",
      image: "Bild",
      imageDesc: "Ein Vault-Pfad, ein Wikilink oder eine URL.",
      imageRequired: "Ein Beispielbild braucht ein Bild.",
      motif: "Motiv",
      light: "Licht",
      exposure: "Belichtung",
      exposureDesc: 'So notiert, wie man es sagt, z. B. "30s, f/11, ISO 100, ND1000".',
      credit: "Bildnachweis"
    },
    newBookingModal: {
      title: "Neue Buchung",
      tripField: "Reise",
      categoryField: "Kategorie",
      statusField: "Status",
      amountField: "Betrag",
      currencyField: "W\xE4hrung",
      amountInvalid: "Dieser Betrag ist keine Zahl.",
      forField: "F\xFCr",
      replacesEstimate: "Diese Buchung \xFCbernimmt die Sch\xE4tzung von \u201E{item}\u201C.",
      created: "Buchung \u201E{title}\u201C angelegt."
    },
    budgetEditor: {
      title: "Reisebudget",
      intro: "Eine Obergrenze je Kategorie, in der W\xE4hrung der Reise. Eine leere Kategorie bleibt unbudgetiert, was nicht dasselbe ist wie ein Budget von null.",
      currency: "W\xE4hrung der Reise",
      currencyDesc: "Worin das Budget gerechnet wird. Buchungen ohne eigene W\xE4hrung werden als diese gelesen.",
      noCeiling: "keine Obergrenze",
      invalid: "Der Betrag f\xFCr {category} ist keine Zahl."
    },
    rateEditor: {
      title: "Umrechnungskurse",
      intro: "Wie viele Einheiten der Reisew\xE4hrung eine Einheit einer Fremdw\xE4hrung kostet, so wie du es festlegst. Nichts wird abgerufen, und jeder umgerechnete Betrag steht mit seinem Kurs da.",
      row: "Kurs {index}",
      currencyPlaceholder: "W\xE4hrung w\xE4hlen",
      ratePlaceholder: "0.94",
      invalid: "Ein Kurs braucht eine W\xE4hrung und eine Zahl \xFCber null."
    },
    newVehicleModal: {
      title: "Neues Schiff oder neuer Zug",
      operatorField: "Betrieben von",
      created: '"{title}" angelegt.'
    },
    newExcursionModal: {
      title: "Neuer Ausflug",
      durationPlaceholder: "ca. 4 Stunden",
      codePlaceholder: "HR-TOS5A",
      created: '"{title}" angelegt.'
    },
    noteCover: {
      description: "Untertitel",
      descriptionHint: "Eine Zeile, so wie ein Prospekt es formulieren w\xFCrde. Sie steht auf der gedruckten Seite unter dem Titel. Die ausf\xFChrliche Fassung steht im Feld darunter.",
      image: "Bild",
      highlights: "H\xF6hepunkte",
      highlightsHint: "Einer pro Zeile, in der Reihenfolge, in der sie stehen sollen.",
      gallery: "Galerie",
      galleryHint: "Die Bilder, in der Reihenfolge, in der sie gezeigt werden sollen.",
      galleryEmpty: "Noch keine Bilder.",
      saved: "Gespeichert.",
      saveFailed: "Diese Notiz konnte nicht gespeichert werden."
    },
    noteSummary: {
      field: "Zusammenfassung",
      hint: "Was die Notiz ausf\xFChrlich \xFCber sich sagt. Genau das steht im Prospekt, mit Listen und Verweisen. Alles, was in der Notiz darunter steht, sind eigene Notizen und bleibt draussen.",
      extraCallouts: "Diese Notiz enth\xE4lt mehr als einen Zusammenfassungs-Callout. Bearbeitet wurde der erste; die \xFCbrigen liest nichts."
    },
    vehicleCabins: {
      cabins: "Kabinenkategorien",
      cabinsDesc: "Die Kategorien, in denen es verkauft wird, und was jeweils enthalten ist. Ein Katalog, keine Preise: was eine Kabine kostet, geh\xF6rt zur Reise, die sie bucht, und wird dort eingetragen.",
      descriptionDesc: "Ein bis zwei Zeilen, so wie ein Prospekt sie vorstellt. Die ausf\xFChrliche Fassung geh\xF6rt in die Notiz selbst.",
      cabinNumber: "Kabine {number}",
      cabinPlaceholder: "Polar Aussenkabine",
      addCabin: "Kabine hinzuf\xFCgen",
      removeCabin: "Kabine entfernen",
      cabinImage: "Bild",
      cabinImageDesc: "Ein Vault-Pfad, ein Wikilink oder eine URL. Wird im Prospekt neben der Kabine gedruckt.",
      deckPlanDesc: "Ein Vault-Pfad oder ein Wikilink auf das Dokument selbst, meist ein PDF. Wird von der Etappe, der Karte und dem Prospekt verlinkt; ein Pfad, den der Vault nicht findet, erscheint nirgends.",
      deckPlanPlaceholder: "Pl\xE4tze/Verkehrsmittel/_documents/Deckplan.pdf",
      saved: "Gespeichert.",
      saveFailed: "Diese Notiz konnte nicht gespeichert werden."
    },
    newPhotoSpotModal: {
      title: "Neuer Fotospot",
      created: 'Fotospot "{title}" erstellt.'
    }
  },
  dashboard: {
    greeting: {
      evening: "Guten Abend",
      morning: "Guten Morgen",
      afternoon: "Guten Tag"
    },
    entityActions: "Aktionen",
    archive: "Archivieren",
    personCount: { one: "{count} Person", other: "{count} Personen" },
    stopCount: { one: "{count} Station", other: "{count} Stationen" },
    refresh: "Aktualisieren",
    visited: "Besucht",
    notVisited: "Noch nicht besucht",
    vehicleRefurbished: "Umbau {year}",
    stateCount: { one: "{count} Bundesland", other: "{count} Bundesl\xE4nder" },
    cityCount: { one: "{count} Stadt", other: "{count} St\xE4dte" },
    newTrip: "Neuer Trip",
    newCountry: "Neues Land",
    newCity: "Neue Stadt",
    newState: "Neues Bundesland",
    newAccommodation: "Neue Unterkunft",
    newFnb: "Neu: Essen & Trinken",
    newLandmark: "Neue Sehensw\xFCrdigkeit",
    newLocation: "Neuer Ort",
    newPhotoSpot: "Neuer Fotospot",
    newVehicle: "Neues Verkehrsmittel",
    newExcursion: "Neuer Ausflug",
    stats: {
      tripsByStatus: "Trips nach Status",
      statusPlanned: "Geplant",
      statusBooked: "Gebucht",
      statusOver: "Vorbei",
      statusCancelled: "Storniert",
      countriesVisited: "Besuchte L\xE4nder",
      landmarksVisited: "Besuchte Sehensw\xFCrdigkeiten",
      photoSpotsCaptured: "Fotografierte Fotospots",
      vehicles: "Schiffe und Z\xFCge",
      nextTripBudget: "Budget der n\xE4chsten Reise",
      nextTrip: "N\xE4chster Trip",
      noUpcomingTrip: "Kein bevorstehender Trip geplant.",
      departsToday: "Heute Abreise",
      daysUntil: "In {days} Tagen"
    }
  },
  galleryView: {
    facets: {
      anyCountry: "Beliebiges Land",
      anyVisited: "Besucht oder nicht",
      visited: "Besucht",
      unvisited: "Nicht besucht",
      anyRating: "Beliebige Bewertung",
      minRating: "{stars} und besser",
      anyTag: "Beliebiger Tag",
      anyLight: "Licht: alle",
      anySeason: "Saison: alle",
      anyCapture: "Fortschritt: alle",
      capture: {
        full: "Alle Motive fotografiert",
        partial: "Teilweise fotografiert",
        none: "Noch nichts fotografiert"
      },
      anyAccessibility: "Barrierefreiheit: alle",
      anySamples: "Beispielbilder: alle",
      withSamples: "Mit Beispielbildern",
      sortDefault: "Sortierung: Standard",
      sortTitle: "Sortierung: Name",
      sortRating: "Sortierung: Bewertung",
      sortLastVisit: "Sortierung: letzter Besuch",
      anyStatus: "Beliebiger Status",
      anyReviewStatus: "Beliebige Nachbereitung",
      anyPerson: "Alle Personen",
      archive: {
        live: "Aktive Reisen",
        archived: "Archivierte Reisen",
        all: "Aktive und archivierte"
      }
    },
    displayName: "Trips, L\xE4nder & Orte",
    searchPlaceholder: "Trips, L\xE4nder & Orte durchsuchen\u2026",
    empty: "Nichts entspricht der aktuellen Suche/dem Filter.",
    filters: {
      all: "Alle",
      trip: "Trips",
      country: "L\xE4nder",
      state: "Bundesl\xE4nder",
      city: "St\xE4dte",
      accommodation: "Unterk\xFCnfte",
      fnb: "Essen & Trinken",
      landmark: "Sehensw\xFCrdigkeiten",
      location: "Orte",
      photospot: "Fotospots",
      vehicle: "Verkehrsmittel",
      excursion: "Ausfl\xFCge",
      person: "Personen",
      company: "Firmen"
    }
  },
  settings: {
    nav: {
      back: "Zur\xFCck"
    },
    header: {
      whatsNew: {
        name: "Neu in APERtrail {version}",
        desc: "Aktuelle Neuerungen und Verbesserungen ansehen.",
        button: "Neuerungen ansehen"
      },
      support: {
        name: "Entwicklung unterst\xFCtzen",
        desc: "Wenn sich APERtrail seinen Platz in deinem Vault verdient hat, h\xE4ltst du damit die Entwicklung am Laufen.",
        sponsor: "Sponsor werden",
        coffee: "Einen Kaffee spendieren"
      },
      help: {
        name: "Hilfe und Kontakt",
        desc: "Die Dokumentation, der Issue-Tracker und ein Weg zu einem Menschen.",
        docs: "Dokumentation",
        issues: "Problem melden",
        contact: "Support kontaktieren"
      }
    },
    whatsNew: {
      title: "Neu in APERtrail {version}",
      empty: "Dieser Build enth\xE4lt keine Versionshinweise.",
      close: "Schliessen",
      allReleases: "Alle Releases auf GitHub"
    },
    vault: {
      title: "Vault einrichten",
      intro: "Wo deine Notizen liegen und wie die Felder darin heissen. Beides wird einmal beim Einrichten gesetzt und danach in Ruhe gelassen.",
      folders: {
        name: "Ordner",
        desc: "Die Ordner f\xFCr Reisen, Orte und CRM, und je ein Unterordner pro Entit\xE4tstyp darunter.",
        value: "{count} Ordner"
      },
      properties: {
        name: "Eigenschaftsnamen",
        desc: "Alle Frontmatter-Eigenschaften, die APERtrail liest und schreibt, gruppiert nach dem Notiztyp, der sie tr\xE4gt.",
        valueLocked: "{count} Namen, gesperrt",
        valueUnlocked: "{count} Namen, \xE4nderbar"
      }
    },
    folders: {
      intro: "APERtrail arbeitet in drei Modulen -- Reisen, Orte und CRM -- und jedes davon l\xE4sst sich als Einheit verschieben: setze den Modulordner und die Unterordner folgen, oder passe einzelne Unterordner separat an.",
      defaults: {
        rootFolderPath: "",
        tripsFolderName: "Reisen",
        bookingsFolderName: "Buchungen",
        placesFolderName: "Orte",
        countriesFolderName: "L\xE4nder",
        statesFolderName: "Bundesl\xE4nder",
        citiesFolderName: "St\xE4dte",
        accommodationFolderName: "Unterk\xFCnfte",
        fnbFolderName: "Essen & Trinken",
        landmarksFolderName: "Sehensw\xFCrdigkeiten",
        locationsFolderName: "Sonstige Orte",
        photoSpotsFolderName: "Fotospots",
        vehiclesFolderName: "Verkehrsmittel",
        excursionsFolderName: "Ausfl\xFCge",
        archiveFolderName: "6 Archiv",
        crmFolderName: "CRM",
        personsFolderName: "Personen",
        companiesFolderName: "Firmen"
      },
      root: {
        name: "Gemeinsamer \xDCberordner",
        desc: "Optionaler Ordner \xFCber Reisen, Orte und CRM. Leer lassen, um alle drei im Vault-Wurzelverzeichnis zu behalten.",
        placeholder: "Leer lassen f\xFCr das Vault-Wurzelverzeichnis"
      },
      tripsHeading: "Reisen",
      tripsIntro: "Die Reisen selbst: eine Notiz pro Reise, mit Personen, Stationen, \xDCbernachtungen und Anreise.",
      trips: {
        name: "Reisen-Ordner",
        desc: "Eine Notiz pro Reise.",
        placeholder: "Reisen"
      },
      placesHeading: "Orte",
      placesIntro: "Alles, worauf eine Reise zeigen kann -- vom Land bis zum einzelnen Aussichtspunkt, f\xFCr den du hingefahren bist.",
      places: {
        name: "Orte-Ordner",
        desc: "Der Wurzelordner f\xFCr alle Orte-Unterordner unten.",
        placeholder: "Orte"
      },
      countries: {
        name: "L\xE4nder",
        desc: "Eine Notiz pro Land.",
        placeholder: "Orte/L\xE4nder"
      },
      states: {
        name: "Bundesl\xE4nder",
        desc: "Eine Notiz pro Bundesland/Kanton, sofern deine L\xE4nder diese Ebene nutzen.",
        placeholder: "Orte/Bundesl\xE4nder"
      },
      cities: {
        name: "St\xE4dte",
        desc: "Eine Notiz pro Stadt.",
        placeholder: "Orte/St\xE4dte"
      },
      accommodation: {
        name: "Unterk\xFCnfte",
        desc: "Hotels, Wohnungen und andere Orte, an denen du \xFCbernachtet hast.",
        placeholder: "Orte/Unterk\xFCnfte"
      },
      fnb: {
        name: "Essen & Trinken",
        desc: "Restaurants, Caf\xE9s, Bars und \xC4hnliches.",
        placeholder: "Orte/Essen & Trinken"
      },
      landmarks: {
        name: "Sehensw\xFCrdigkeiten",
        desc: "Sehensw\xFCrdigkeiten und interessante Orte.",
        placeholder: "Orte/Sehensw\xFCrdigkeiten"
      },
      locations: {
        name: "Sonstige Orte",
        desc: "Alles andere, dessen Standort sich zu merken lohnt.",
        placeholder: "Orte/Sonstige Orte"
      },
      bookings: {
        name: "Buchungen",
        desc: "Wohin eine Buchung geht, wenn ihre Reise keinen eigenen Ordner hat. Buchungen werden von hier und aus jedem Reiseordner gelesen, damit eine \xE4ltere flach abgelegte nie verloren geht.",
        placeholder: "Reisen/Buchungen"
      },
      tripBookingsSubfolder: {
        name: "Buchungen innerhalb einer Reise",
        desc: "Der Ordner, in dem eine Reise ihre Buchungen f\xFChrt, innerhalb des eigenen Ordners der Reise, damit alles zu einer Reise an einem Ort liegt. Leer lassen, um jede Buchung im Buchungsordner oben abzulegen.",
        placeholder: "Buchungen"
      },
      exportsSubfolder: {
        name: "Exporte",
        desc: "Der Unterordner, in dem eine Notiz ihre exportierten Bl\xE4tter f\xFChrt, neben der Notiz selbst, so wie Anh\xE4nge in einem eigenen Ordner liegen. Alles darin l\xE4sst sich l\xF6schen und aus der Notiz neu erzeugen, deshalb liegt es getrennt von ihnen. Notizen im selben Ordner teilen sich einen. Leer lassen, um die Bl\xE4tter neben die Notiz zu schreiben.",
        placeholder: "_exports"
      },
      photoSpots: {
        name: "Fotospots",
        desc: "Orte, zu denen du f\xE4hrst, um ein bestimmtes Bild zu machen.",
        placeholder: "Orte/Fotospots"
      },
      vehicles: {
        name: "Verkehrsmittel",
        desc: "Die Schiffe und benannten Z\xFCge, mit denen du reist -- im Unterschied zu den Orten, zu denen du reist. Hier abgelegt, weil jeder Ordner an einer der drei Modulwurzeln h\xE4ngt.",
        placeholder: "Orte/Verkehrsmittel"
      },
      excursions: {
        name: "Ausfl\xFCge-Ordner",
        desc: "Die Ausfl\xFCge, die tageweise verkauft werden. Unter den Orten abgelegt, aus demselben Grund wie die Verkehrsmittel: jeder Ordner h\xE4ngt an einer der drei Modulwurzeln.",
        placeholder: "Orte/Ausfl\xFCge"
      },
      crmHeading: "CRM",
      crmIntro: "Die Personen und Firmen hinter einer Reise. APERtrail liest sie aus deinen eigenen Notizen, statt eine eigene Kontaktliste zu f\xFChren.",
      crm: {
        name: "CRM-Ordner",
        desc: "Der Wurzelordner f\xFCr Personen und Firmen unten.",
        placeholder: "CRM"
      },
      persons: {
        name: "Personen-Ordner",
        desc: "Wo deine Personen-Notizen liegen.",
        placeholder: "CRM/Personen"
      },
      companies: {
        name: "Firmen-Ordner",
        desc: "Wo deine Firmen-Notizen liegen. Vorgesehen f\xFCr das laufende CRM-Modul; aktuell wird von hier noch nichts gelesen.",
        placeholder: "CRM/Firmen"
      },
      archiveHeading: "Archiv",
      archiveIntro: "Wohin ein Trip wandert, wenn er vorbei ist und aus dem Weg soll, ohne verloren zu gehen. Ein archivierter Trip wird weiterhin gelesen: er bleibt in den zugeh\xF6rigen Reisen einer Stadt stehen und z\xE4hlt weiterhin als Besuch. NODAtrail legt seine erledigten Notizen im selben Ordner ab, ein Vault mit beiden Plugins hat also ein Archiv statt zwei.",
      archive: {
        name: "Archiv-Ordner",
        desc: "Die Wurzel des Archivs, neben Trips, Pl\xE4tzen und CRM statt in einem davon.",
        placeholder: "6 Archiv"
      },
      tripsArchive: {
        name: "Unterordner f\xFCr archivierte Trips",
        desc: "Der Ordner im Archiv, in den erledigte Trips wandern. Ein Name, kein Pfad: wer das Archiv verschiebt, nimmt ihn mit.",
        placeholder: "Trips"
      },
      archiveYearFolders: {
        name: "Archiv nach Jahren aufteilen",
        desc: "Jeden archivierten Trip unter dem Jahr der Archivierung ablegen. Standardm\xE4ssig aus: f\xFCr eine Handvoll Trips im Jahr lohnt die Aufteilung nicht."
      }
    },
    properties: {
      intro: "Die Frontmatter-Namen, die APERtrail liest und schreibt. \xC4ndere einen nur, um einen Namen zu treffen, den deine Notizen bereits verwenden: auf der Festplatte wird nichts mitumbenannt.",
      unlock: {
        name: "\xC4ndern von Eigenschaftsnamen erlauben",
        desc: "Aus, denn ein hier ge\xE4nderter Name wird in den Notizen nicht mitge\xE4ndert. APERtrail sucht dann eine Eigenschaft, die keine Notiz tr\xE4gt, und Reisen, Orten und Kontakten fehlt dieses Feld, ohne dass etwas sagt warum. Nur einschalten, um Namen zu treffen, die eine Vault bereits verwendet, und danach wieder ausschalten. Ordner sind ausgenommen: Ein Ordner l\xE4sst sich zur\xFCckzeigen, ein Eigenschaftsname nicht.",
        locked: "Gesperrt. Oben auf dieser Seite \u201E\xC4ndern von Eigenschaftsnamen erlauben\u201C einschalten."
      },
      entityTypesInfo: "APERtrail erkennt diese Werte unter der Typ-Eigenschaft von Haus aus: {types}.",
      subKeysNote: "Die Unterschl\xFCssel innerhalb eines Listeneintrags -- der Ort einer Station, das Check-in einer \xDCbernachtung, das Licht eines Motivs -- sind ebenfalls Einstellungen, bekommen hier aber keine Zeile. Was eine Notiz tr\xE4gt, steht in docs/design/data-model.md.",
      groups: {
        identification: "Notizerkennung",
        identificationIntro: "Woran APERtrail erkennt, welche Art von Notiz vor ihm liegt. Jeder Reisetyp wird \xFCber einen festen Wert erkannt; die beiden CRM-Typen \xFCber einen Wert, den du w\xE4hlst, weil diese Notizen meist \xE4lter sind als dieses Plugin.",
        places: "Orte und gemeinsame Felder",
        placesIntro: "Die geografische Hierarchie und die Felder, die jede ortsartige Notiz tr\xE4gt -- ob Hotel, Restaurant oder Aussichtspunkt.",
        trips: "Reisen",
        tripsIntro: "Die Daten, der Status und die Listen, die eine Reisenotiz tr\xE4gt.",
        bookings: "Buchungen",
        bookingsIntro: "Was eine Buchungsnotiz tr\xE4gt. Jede davon ist eine einfache Eigenschaft, weshalb eine Buchung keinen eigenen Editor braucht: Obsidians eigener Eigenschaften-Editor ist bereits der richtige. Die letzten drei stehen auf der Reise statt auf einer Buchung.",
        photoSpots: "Fotospots",
        photoSpotsIntro: "Die Zugangsangaben, die ein gedruckter Location-Guide in seinen grauen Kasten setzt, dazu die Motive und Beispielbilder.",
        vehicles: "Verkehrsmittel",
        vehiclesIntro: "Was eine Notiz zu einem Schiff oder einem benannten Zug tr\xE4gt. Die Kabinen sind ein Katalog, keine Preise: was eine Kabine kostet, geh\xF6rt zur Reise, die sie bucht, und steht dort.",
        excursions: "Ausfl\xFCge",
        excursionsIntro: "Was eine Ausflugs-Notiz tr\xE4gt. Ein Preis ist bewusst nicht dabei: derselbe Ausflug kostet im Dezember etwas anderes als im Mai, also steht der Betrag auf der Reise, die ihn bucht.",
        crm: "Personen und Firmen",
        crmIntro: "Die Kontaktfelder, die APERtrail und CULItrail aus denselben Notizen lesen -- beide Plugins m\xFCssen sich darauf einigen."
      },
      fields: {
        type: {
          name: "Typ-Eigenschaft",
          desc: 'Die Eigenschaft, die APERtrail liest und schreibt, um den Entit\xE4tstyp jeder Notiz zu erkennen -- zum Beispiel "type: trip" oder "type: country".'
        },
        personType: {
          name: "Typ-Wert f\xFCr Personen",
          desc: "Der Wert der Typ-Eigenschaft, der eine Notiz als Person kennzeichnet, z. B. \u201Eperson\u201C."
        },
        companyType: {
          name: "Typ-Wert f\xFCr Firmen",
          desc: "Der Wert der Typ-Eigenschaft, der eine Notiz als Firma kennzeichnet, z. B. \u201Ecompany\u201C."
        },
        country: {
          name: 'Eigenschaft "Land"',
          desc: "Verkn\xFCpft ein Bundesland, eine Stadt, einen Ort oder einen Trip mit seinem Land."
        },
        state: {
          name: 'Eigenschaft "Bundesland"',
          desc: "Verkn\xFCpft eine Stadt mit ihrem Bundesland."
        },
        city: { name: 'Eigenschaft "Stadt"', desc: "Verkn\xFCpft einen Ort mit seiner Stadt." },
        capital: {
          name: 'Eigenschaft "Hauptstadt"',
          desc: "Verkn\xFCpft ein Land oder Bundesland mit seiner Hauptstadt."
        },
        states: {
          name: 'Eigenschaft "Bundesl\xE4nder"',
          desc: "Verkn\xFCpft ein Land mit seiner Liste von Bundesl\xE4ndern."
        },
        cities: {
          name: 'Eigenschaft "St\xE4dte"',
          desc: "Verkn\xFCpft ein Bundesland mit seiner Liste von St\xE4dten."
        },
        geoLocation: {
          name: 'Eigenschaft "Geoposition"',
          desc: "Das [Breitengrad, L\xE4ngengrad]-Paar, kopiert aus einer Kartenansicht."
        },
        address: {
          name: "Eigenschaft Adresse",
          desc: 'Adresse, die auf einer Ort-Karte erscheint. Im Referenz-Vault heisst sie "ortAdresse".'
        },
        website: {
          name: "Eigenschaft Webseite",
          desc: 'Webseite, die auf einer Ort-Karte erscheint. Im Referenz-Vault heisst sie "webSeite".'
        },
        rating: { name: 'Eigenschaft "Bewertung"', desc: "Das Bewertungsfeld von 1-5." },
        visited: {
          name: 'Eigenschaft "Besucht"',
          desc: "Ob diese Stadt oder dieser Ort bereits besucht wurde."
        },
        lastVisit: {
          name: 'Eigenschaft "Letzter Besuch"',
          desc: "Das Datum des letzten Besuchs."
        },
        tags: {
          name: 'Eigenschaft "Tags"',
          desc: 'Die Tag-Liste einer Stadt oder eines Orts. Obsidian liest seine eigenen Tags aus "tags"; ein Vault, der hier etwas anderes eintraegt, nimmt diese Notizen aus dem Tag-Bereich heraus.'
        },
        accommodationType: {
          name: 'Eigenschaft "Unterkunftsart"',
          desc: "Um welche Art Unterkunft es sich handelt (Hotel, Apartment und so weiter). Nur Unterkuenfte."
        },
        accommodationStatus: {
          name: 'Eigenschaft "Unterkunftsstatus"',
          desc: "Wie weit die Buchung ist (Gebucht, Angefragt und so weiter). Nur Unterkuenfte."
        },
        fnbType: {
          name: 'Eigenschaft "Gastronomieart"',
          desc: "Um welche Art Lokal es sich handelt (Cafe, Restaurant und so weiter). Nur Gastronomie."
        },
        created: {
          name: 'Eigenschaft "Erstellt"',
          desc: "Der Erstellungszeitstempel der Notiz."
        },
        modified: { name: 'Eigenschaft "Ge\xE4ndert"', desc: "Der \xC4nderungszeitstempel der Notiz." },
        archived: {
          name: 'Eigenschaft "Archiviert"',
          desc: "Der Tag, an dem ein Trip archiviert wurde. Leer lassen, um ohne Stempel zu verschieben."
        },
        departure: { name: 'Eigenschaft "Abreise"', desc: "Das Abreisedatum eines Trips." },
        return: { name: 'Eigenschaft "R\xFCckkehr"', desc: "Das R\xFCckkehrdatum eines Trips." },
        travelType: {
          name: 'Eigenschaft "Reiseart"',
          desc: "Die Reiseart eines Trips (z. B. gesch\xE4ftlich, privat)."
        },
        travelStatus: {
          name: 'Eigenschaft "Reisestatus"',
          desc: "Der Status eines Trips (Geplant, Gebucht, Vorbei oder Storniert)."
        },
        reviewStatus: {
          name: 'Eigenschaft "Review-Status"',
          desc: "Der Review-Status eines Trips."
        },
        tripSubtitle: {
          name: "Untertitel-Eigenschaft",
          desc: "Was die Reise ist, unter dem, wie sie hei\xDFt."
        },
        image: {
          name: "Bild-Eigenschaft der Reise",
          desc: "Das eine Bild, das f\xFCr die Reise steht, in der Galerie und auf einem gedruckten Blatt. Ein Tresorpfad, ein Wikilink oder eine URL."
        },
        tripHighlights: {
          name: "H\xF6hepunkte-Eigenschaft",
          desc: "Eine Liste von Zeilen, in der Reihenfolge, in der sie stehen sollen. Jede Notiz kann sie tragen, nicht nur eine Reise."
        },
        tripDays: {
          name: "Eigenschaft Reisetage",
          desc: "Wie jeder Tag der Reise hei\xDFt und was er selbst sagt. Nur Tage mit einer Aussage haben einen Eintrag; ein Tag mit blo\xDF Stationen braucht keinen."
        },
        tripGallery: {
          name: "Galerie-Eigenschaft",
          desc: "Eine Liste von Bildern, jedes mit optionaler Bildunterschrift."
        },
        tripCities: {
          name: 'Eigenschaft "Reise-St\xE4dte"',
          desc: 'Die St\xE4dte, die eine Reise ber\xFChrt. Bewusst nicht die Eigenschaft "St\xE4dte" oben, die zu einem Bundesland geh\xF6rt.'
        },
        persons: {
          name: 'Eigenschaft "Teilnehmer"',
          desc: "Die Personen, mit denen eine Reise geteilt ist."
        },
        tripExtends: {
          name: 'Eigenschaft "Verl\xE4ngerung von"',
          desc: "Die Reise, die diese fortsetzt -- eingetragen auf der Reise, die als zweite kommt. Was einer Reise folgt, wird beim Lesen des Tresors abgeleitet, sodass eine Verl\xE4ngerung die verl\xE4ngerte Reise nie ver\xE4ndert."
        },
        stops: {
          name: 'Eigenschaft "Stationen"',
          desc: "Der zeitliche Ablauf einer Reise: ein Eintrag pro Station, jeweils mit Ort und Zeit."
        },
        nights: {
          name: 'Eigenschaft "\xDCbernachtungen"',
          desc: "Die Unterk\xFCnfte einer Reise, ein Eintrag pro Aufenthalt."
        },
        transport: {
          name: 'Eigenschaft "Anreise"',
          desc: "Die Reiseabschnitte, hin und zur\xFCck."
        },
        bookingTrip: { name: "Eigenschaft Reise", desc: "Zu welcher Reise eine Buchung geh\xF6rt." },
        bookingCategory: {
          name: "Eigenschaft Kategorie",
          desc: "Transport, Unterkunft, Aktivit\xE4t, Essen, Geb\xFChren oder Sonstiges. Festes Vokabular; nur der Name ist konfigurierbar."
        },
        bookingStatus: {
          name: "Eigenschaft Status",
          desc: "Gesch\xE4tzt, gebucht, bezahlt, storniert oder erstattet. Entscheidet, in welches Total ein Betrag z\xE4hlt."
        },
        bookingSupplier: {
          name: "Eigenschaft Anbieter",
          desc: "Die Firmennotiz hinter einer Buchung."
        },
        bookingPlace: {
          name: "Eigenschaft Ort",
          desc: "F\xFCr welchen Ort oder welche Stadt eine Buchung gilt, und wie Kosten ihre Reisezeile finden."
        },
        bookingDate: {
          name: "Eigenschaft Datum",
          desc: "Der Tag, zu dem die Kosten geh\xF6ren, nicht der Tag der Zahlung."
        },
        bookingAmount: { name: "Eigenschaft Betrag", desc: "Was die Buchung kostet." },
        bookingCurrency: {
          name: "Eigenschaft W\xE4hrung",
          desc: "ISO-Code. Fehlt sie, gilt die Reisew\xE4hrung und danach die Standardw\xE4hrung."
        },
        bookingReference: {
          name: "Eigenschaft Referenz",
          desc: "Die Buchungsreferenz. Verbindet eine Buchung auch mit einem Transportabschnitt."
        },
        bookingPayer: {
          name: "Eigenschaft Zahler",
          desc: "Wer von den Teilnehmenden tats\xE4chlich bezahlt hat."
        },
        bookingFor: {
          name: "Eigenschaft F\xFCr",
          desc: "F\xFCr wen die Kosten sind. Fehlt sie, gilt sie f\xFCr alle Teilnehmenden."
        },
        bookingDocument: {
          name: "Eigenschaft Beleg",
          desc: "Die Best\xE4tigungs- oder Rechnungsdatei im Vault."
        },
        tripCurrency: {
          name: "Eigenschaft Reisew\xE4hrung",
          desc: "Worin eine Reise ihr Budget plant."
        },
        budget: { name: "Eigenschaft Budget", desc: "Die Obergrenze der Reise je Kategorie." },
        rates: {
          name: "Eigenschaft Kurse",
          desc: "Umrechnungskurse, so wie du sie eintr\xE4gst. Nichts wird abgerufen."
        },
        timezone: {
          name: 'Eigenschaft "Zeitzone"',
          desc: "Die Zeitzone eines Fotospots, mit der seine Lichtfenster zu Uhrzeiten aufgel\xF6st werden."
        },
        openingHours: {
          name: 'Eigenschaft "\xD6ffnungszeiten"',
          desc: "Wann ein Fotospot \xFCberhaupt betreten werden kann."
        },
        entryFee: {
          name: 'Eigenschaft "Eintritt"',
          desc: "Was der Eintritt kostet, falls \xFCberhaupt."
        },
        accessibility: {
          name: 'Eigenschaft "Barrierefreiheit"',
          desc: "Wie zug\xE4nglich der Spot ist: vollst\xE4ndig, teilweise, gar nicht oder unbekannt."
        },
        parking: { name: 'Eigenschaft "Parken"', desc: "Wo das Auto stehen bleibt." },
        transit: {
          name: 'Eigenschaft "Anfahrt"',
          desc: "Wie der Spot ohne Auto erreichbar ist, ein Eintrag pro Verbindung."
        },
        motifs: {
          name: 'Eigenschaft "Motive"',
          desc: "Die Bilder, f\xFCr die der Spot da ist: Blickrichtung, Licht, Objektiv und Ausr\xFCstung pro Motiv."
        },
        samples: {
          name: 'Eigenschaft "Beispielbilder"',
          desc: "Beispielaufnahmen vom Spot, jeweils einem Motiv zugeordnet."
        },
        vehicleMode: {
          name: "Verkehrsmittel-Art",
          desc: "Um was es sich handelt: Schiff, Zug, Bus. Dieselben W\xF6rter, die ein Reiseabschnitt verwendet."
        },
        vehicleOperator: {
          name: "Betreiber-Eigenschaft",
          desc: "Wer es betreibt, als Link auf eine Firmennotiz. Eine Angabe zum Schiff; eine Reise wird dadurch nicht mit einer Firma verkn\xFCpft."
        },
        vehicleBuilt: { name: "Baujahr-Eigenschaft", desc: "Das Jahr der Indienststellung." },
        vehicleRefurbished: {
          name: "Umbau-Eigenschaft",
          desc: "Das Jahr des letzten Umbaus, sofern erw\xE4hnenswert."
        },
        vehicleCapacity: {
          name: "Kapazit\xE4ts-Eigenschaft",
          desc: "Wie viele Passagiere es fasst."
        },
        vehicleLength: {
          name: "L\xE4ngen-Eigenschaft",
          desc: 'Wie geschrieben: "135 m", "20 Wagen".'
        },
        vehicleTonnage: {
          name: "Tonnage-Eigenschaft",
          desc: "Bruttoraumzahl, bei Schiffen die eine angeben."
        },
        vehicleDeckPlan: {
          name: "Deckplan-Eigenschaft",
          desc: "Ein Deckplan oder ein Wagenplan: ein Dokument, als Vault-Pfad oder Wikilink. Wird verlinkt statt angezeigt, weil es meist ein PDF ist."
        },
        vehicleCabins: {
          name: "Kabinen-Eigenschaft",
          desc: "Die Kabinenkategorien, in denen es verkauft wird, je mit dem, was enthalten ist. Ein Katalog, keine Preise: was eine Kabine kostet, geh\xF6rt zur Reise und steht dort."
        },
        excursionOperator: {
          name: 'Eigenschaft "Veranstalter"',
          desc: "Wer den Ausflug durchf\xFChrt, als Link auf eine Firmen-Notiz. Eine Tatsache \xFCber den Ausflug, nicht \xFCber die Reise, die ihn bucht."
        },
        excursionDuration: {
          name: 'Eigenschaft "Dauer"',
          desc: 'Wie lange er dauert, in den Worten des Veranstalters. Freier Text statt einer Stundenzahl: "halber Tag" und "ca. 4 Stunden" meinen dasselbe, und hier rechnet nichts damit.'
        },
        excursionCode: {
          name: 'Eigenschaft "Buchungsnummer"',
          desc: "Die Buchungsnummer des Veranstalters f\xFCr diesen Ausflug, HR-TOS5A. Sie unterscheidet zwei \xE4hnlich benannte Ausfl\xFCge im selben Hafen und steht im Buchungsblatt."
        },
        personTag: {
          name: "Tag-Eigenschaft f\xFCr Personen",
          desc: "Die Eigenschaft mit den Tags einer Person, genutzt vom Filter f\xFCr zugelassene Personen."
        },
        companyTag: {
          name: "Tag-Eigenschaft f\xFCr Firmen",
          desc: "Die Eigenschaft mit den Tags einer Firma."
        },
        description: {
          name: "Eigenschaft Beschreibung",
          desc: "Einzeilige Beschreibung auf einer Personen- oder Firmenkarte."
        },
        email: {
          name: "Eigenschaft E-Mail",
          desc: "E-Mail-Adresse auf einer Personen- oder Firmennotiz."
        },
        phone: { name: "Eigenschaft Telefon", desc: "Die Telefonnummer einer Firma." },
        mobile: { name: "Eigenschaft Mobil", desc: "Die Mobilnummer einer Person." }
      }
    },
    display: {
      title: "Darstellung",
      exportAuthor: {
        name: "Name auf gedruckten Bl\xE4ttern",
        desc: 'Wen Reisedokument, Prospekt, Spickzettel und Kostenblatt als Ersteller nennen: "erstellt von Thomas am ...". Leer lassen l\xE4sst den Namen weg. NODAtrail hat dieselbe Einstellung.'
      },
      language: {
        name: "Sprache",
        desc: "Folgt Obsidian, sofern hier nichts gew\xE4hlt ist. Ordnernamen eines neuen Vaults entstehen in dieser Sprache.",
        auto: "Obsidian folgen",
        applied: "Sprache ge\xE4ndert. \xD6ffne die Ansichten des Plugins neu oder starte Obsidian neu, damit sie \xFCberall greift."
      },
      clockFormat: {
        name: "Uhrzeit",
        desc: "Wie Zeiten geschrieben werden. Sonnenzeiten stehen immer in der Zone des Spots, unabh\xE4ngig davon.",
        auto: "Der Sprache folgen",
        h24: "24 Stunden (17:42)",
        h12: "12 Stunden (5:42 PM)"
      },
      units: {
        name: "Entfernung",
        desc: "Wie weit zwei Orte auseinanderliegen, auf einer Motivkarte und im Lichtkonflikt.",
        metric: "Kilometer",
        imperial: "Meilen"
      }
    },
    dashboard: {
      title: "Dashboard",
      showRibbonIcon: {
        name: "Ribbon-Symbol anzeigen",
        desc: "Das Reise-Dashboard-Symbol im linken Ribbon ein-/ausblenden."
      },
      openDashboard: {
        name: "Dashboard \xF6ffnen",
        desc: "Trips, L\xE4nder und Orte auf einen Blick, mit Schnellaktionen zum Erstellen neuer Eintr\xE4ge.",
        button: "\xD6ffnen"
      }
    },
    money: {
      title: "Geld",
      budget: {
        name: "Reisekosten",
        desc: "Der Kostenblock in einer Reisenotiz, die Budgetkachel im Dashboard und die Kosten-Chips im Reiseverlauf. Aus l\xE4sst Buchungsnotizen gew\xF6hnliche Notizen bleiben."
      },
      displayLocale: {
        name: "Zahlen- und Datumsformat",
        desc: "Ein Locale-K\xFCrzel wie `de-CH` oder `de-DE`, das bestimmt, wie Betr\xE4ge gruppiert und Daten geordnet werden. Unabh\xE4ngig von der Oberfl\xE4chensprache: Deutschland schreibt 100.120,20, die Schweiz 100'120.20. Leer lassen, um diesem Computer zu folgen."
      },
      homeCurrency: {
        name: "Standardw\xE4hrung",
        desc: "Worin eine Reise plant, wenn weder die Buchung noch die Reise etwas sagt. ISO-Code."
      },
      currencyOptions: {
        name: "Angebotene W\xE4hrungen",
        desc: "Die Codes, die in den Auswahlfeldern erscheinen, mit Komma getrennt. Die eigene W\xE4hrung und alles, was bereits in einer Notiz steht, werden immer zus\xE4tzlich angeboten."
      }
    },
    photoSpots: {
      title: "Fotospots",
      sunTimes: {
        name: "Sonnenzeiten bei Fotospots",
        desc: "L\xF6st die Lichtfenster eines Motivs zu Uhrzeiten auf, zeigt das Lichtpanel des Tages und markiert Gegen-, Seiten- und Auflicht. Aus bleiben Fotospots einfache Ortsnotizen."
      }
    },
    people: {
      title: "Personen",
      intro: "Welche deiner Personen-Notizen eine Reise \xFCberhaupt anbietet.",
      eligiblePersonTags: {
        name: "Zugelassene Personen-Tags",
        desc: "Kommagetrennte Tags. Nur Personen mit einem dieser Tags k\xF6nnen einer Reise hinzugef\xFCgt werden. Leer lassen, um alle anzubieten. Gro\xDF- und Kleinschreibung spielt keine Rolle, ein f\xFChrendes # wird ignoriert, und ein \xFCbergeordneter Tag schlie\xDFt seine untergeordneten ein."
      }
    },
    about: {
      title: "\xDCber APERtrail",
      description: "Der erste Reiseplaner speziell f\xFCr Fotografie. Plane Reisen rund um Aussichtspunkte, Licht und Perspektive.",
      origins: {
        text: "APERtrail speichert keine eigenen Daten. Jede Reise, jeder Ort und jeder Kontakt ist eine deiner eigenen Markdown-Notizen, und jede Ansicht wird bei jedem Zeichnen neu aus dem Vault abgeleitet -- so kann nichts von dem abweichen, was auf der Festplatte steht."
      },
      links: {
        github: "APERtrail auf GitHub",
        vendor: "Technosoftware GmbH",
        licensing: "Kommerzielle Lizenz"
      },
      pluginInfo: {
        version: "Version: {version}",
        author: "Autor: {author}",
        licence: "Lizenz: {licence}",
        usage: "F\xFCr die private Nutzung kostenlos. Jede gesch\xE4ftliche Nutzung erfordert eine kommerzielle Lizenz."
      }
    }
  },
  city: {
    cityState: "Stadtstaat",
    cityStateNamed: "{title} (Stadtstaat)"
  },
  archive: {
    archiveTrip: "Trip archivieren",
    unarchiveTrip: "Trip aus dem Archiv holen",
    archivedMarker: "Archiviert",
    archivedNotice: "{title} ins Archiv verschoben.",
    unarchivedNotice: "{title} aus dem Archiv geholt.",
    notConfigured: "Es ist kein Archiv-Ordner gesetzt. Einstellungen \u2192 Ordner \u2192 Archiv.",
    destinationExists: "Unter {path} liegt bereits etwas. Es wurde nichts verschoben."
  },
  health: {
    entityTypeCheck: {
      command: "Entit\xE4tstypen pr\xFCfen",
      settingName: "Entit\xE4tstyp-Pr\xFCfung",
      settingDesc: "Durchsucht die Ordner oben nach Notizen, deren Typ-Eigenschaft fehlt oder nicht zum Ordner passt.",
      settingButton: "Pr\xFCfung starten",
      title: "Entit\xE4tstyp-Pr\xFCfung",
      allTypesOk: "Jede Notiz in deinen konfigurierten Ordnern hat bereits einen erkannten Typ.",
      summary: {
        one: "Eine Notiz ben\xF6tigt Aufmerksamkeit, und f\xFCr sie gibt es einen Typ-Vorschlag.",
        other: "{count} Notizen ben\xF6tigen Aufmerksamkeit. F\xFCr jede gibt es einen Typ-Vorschlag."
      },
      rescan: "Erneut scannen",
      confirmBulkApply: {
        one: "Erneut klicken, um eine \xC4nderung anzuwenden",
        other: "Erneut klicken, um {count} \xC4nderungen anzuwenden"
      },
      applyAllSuggested: "Alle vorgeschlagenen anwenden ({count})",
      close: "Schlie\xDFen",
      missingLabel: "(keiner)",
      issueDesc: "{location} \xB7 aktuell: {current} \xB7 Vorschlag: {suggested}",
      open: "\xD6ffnen",
      setButton: "\u201E{type}\u201C setzen",
      setTypeNotice: "Typ von {basename} auf \u201E{type}\u201C gesetzt.",
      appliedNotice: {
        one: "Einen vorgeschlagenen Typ angewendet.",
        other: "{count} vorgeschlagene Typen angewendet."
      },
      locationLabels: {
        trips: "Trips",
        archivedTrips: "Archivierte Trips",
        bookings: "Buchungen",
        countries: "L\xE4nder",
        states: "Bundesl\xE4nder",
        cities: "St\xE4dte",
        accommodation: "Unterk\xFCnfte",
        fnb: "Essen & Trinken",
        landmarks: "Sehensw\xFCrdigkeiten",
        locations: "Orte",
        photoSpots: "Fotospots",
        vehicles: "Verkehrsmittel",
        excursions: "Ausfl\xFCge",
        persons: "Personen",
        companies: "Firmen"
      }
    },
    bookingCheck: {
      heading: "Buchungswarnungen ({count})",
      explain: "Warnungen, keine Fehler, und keine davon wird automatisch angewendet: zu welcher Reise eine Buchung geh\xF6rt und welche von zwei Notizen mit gleicher Referenz die doppelte ist, weisst nur du.",
      unattached: "Diese Buchung nennt eine Reise, die es nicht gibt; ihr Betrag steht damit in keinem Total.",
      noCurrency: "Diese Buchung hat einen Betrag und keine W\xE4hrung, und weder ihre Reise noch die Einstellungen liefern eine.",
      strangerOnTheSplit: "Die Aufteilung nennt {person}, wer nicht an der Reise dieser Buchung teilnimmt.",
      duplicateReference: "Die Referenz {reference} steht auch auf \u201E{other}\u201C. Meist eine doppelt angelegte Notiz, gelegentlich eine auf zwei Karten aufgeteilte Zahlung."
    },
    missingFileCheck: {
      heading: "Verweise auf fehlende Dateien ({count})",
      explain: "Ein Bild, ein Galerieeintrag, ein Kabinenfoto oder ein Deckplan nennt eine Datei, die es in diesem Vault nicht gibt. Jeder Leser behandelt einen Verweis, den er nicht findet, genau wie gar keinen, deshalb ist das einzige Symptom etwas, das stillschweigend nicht erscheint. Meist ein umbenannter Ordner oder ein verschobener Anhang; was der Pfad sagen sollte, weisst nur du.",
      plain: "{property} zeigt auf \u201E{value}\u201C, das es in diesem Vault nicht gibt.",
      inList: "{property} zeigt unter \u201E{detail}\u201C auf \u201E{value}\u201C, das es in diesem Vault nicht gibt."
    },
    childListCheck: {
      heading: "Untergeordnete Listen mit fremdem Eintrag ({count})",
      explain: "Die Liste states: auf einem Land und die Liste cities: auf einem Bundesland werden nicht mehr gelesen. Was unter einer Notiz steht, ergibt sich aus der Verkn\xFCpfung in der untergeordneten Notiz selbst, keine der beiden Listen muss also noch von Hand gepflegt werden. Die meisten Eintr\xE4ge einer bestehenden Liste wiederholen nur, was die untergeordnete Notiz ohnehin sagt, und kosten nichts. Diese nicht: sie nennen eine Notiz, die es in diesem Vault nicht gibt, oder eine, die woanders hinzeigt. Sie standen bisher trotzdem in der Liste und stehen jetzt nicht mehr darin.",
      unknown: "{property} f\xFChrt \u201E{child}\u201C auf, was keine Notiz in diesem Vault ist.",
      pointsElsewhere: "{property} f\xFChrt \u201E{child}\u201C auf, diese Notiz nennt aber \u201E{actual}\u201C.",
      namesNobody: "{property} f\xFChrt \u201E{child}\u201C auf, diese Notiz nennt aber keine \xFCbergeordnete Notiz."
    },
    legNumberCheck: {
      heading: "Flugnummern in der Buchungsreferenz ({count})",
      explain: "Ein Abschnitt hat ein eigenes Feld f\xFCr die Flug- oder Zugnummer. Bei diesen Fl\xFCgen steht in der Referenz etwas, das wie eine Flugnummer aussieht, und die Nummer ist leer. Die Referenz ist die Buchungsreferenz, \xFCber die eine Buchungsnotiz ihren Abschnitt findet: trag die Flugnummer im Abschnitt unter \u201EFlug- oder Zugnummer\u201C ein und die Referenz, sobald du sie hast. Hier wird nichts automatisch verschoben, weil nur du weisst, ob es wirklich eine Flugnummer ist.",
      inReference: "\u201E{reference}\u201C auf der Etappe {leg} sieht wie eine Flugnummer aus, steht aber in der Referenz."
    },
    variantCabinCheck: {
      heading: "Varianten mit unbekannter Kabine ({count})",
      explain: "Eine Variante \xFCbernimmt ihre Beschreibung von der gleichnamigen Kabine des Schiffs. Diese nennen eine Kabine, die ihr Schiff nicht f\xFChrt, und haben keine eigene Beschreibung, also steht dort nichts. Varianten mit eigener Beschreibung stehen nicht in dieser Liste: ihnen fehlt nichts.",
      unknownCabin: "\u201E{variant}\u201C auf der Etappe {leg} ist keine Kabine, die {vehicle} f\xFChrt, und hat keine eigene Beschreibung."
    },
    photoSpotCheck: {
      heading: "Fotospot-Warnungen ({count})",
      explain: "Warnungen, keine Fehler. Hier wird nichts automatisch angewendet: welches Motiv das Hauptmotiv ist und worauf ein Beispielbild zeigen sollte, wei\xDF nur die Notiz selbst.",
      multipleMain: "Mehr als ein Motiv ist als Hauptmotiv markiert: {names}.",
      orphanSample: "Das Beispielbild {image} nennt ein Motiv, das diese Notiz nicht hat: {motif}.",
      missingTimeZone: "Keine Zeitzone, und diese Koordinaten liegen weit von diesem Ger\xE4t entfernt: das Licht wird hier in {device} berechnet. Der L\xE4ngengrad deutet auf {implied} hin.",
      noImage: "(kein Bild)"
    }
  }
};

// packages/apertrail/src/lang/translations/index.ts
var FALLBACK_LOCALE = "en";
var LOCALES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    direction: "ltr",
    table: enTranslations
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    direction: "ltr",
    table: deTranslations
  }
];
function localeEntry(code) {
  const wanted = code.trim();
  if (!wanted) return void 0;
  const lower = wanted.toLowerCase();
  return LOCALES.find((locale) => locale.code === wanted) ?? LOCALES.find((locale) => locale.code.toLowerCase() === lower) ?? LOCALES.find((locale) => locale.code.toLowerCase().split("-")[0] === lower.split("-")[0]);
}

// packages/apertrail/src/lang/plural.ts
var CATEGORIES = ["zero", "one", "two", "few", "many", "other"];
function isPluralForms(value) {
  if (value === null || typeof value !== "object") return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => CATEGORIES.includes(key));
}
function selectPluralForm(forms, count, locale) {
  let category;
  try {
    category = new Intl.PluralRules(locale).select(count);
  } catch {
    category = "other";
  }
  return forms[category] ?? forms.other;
}

// packages/apertrail/src/lang/I18nManager.ts
var I18nManager = class _I18nManager {
  static {
    this.instance = null;
  }
  constructor(plugin) {
    this.app = plugin.app;
    this.fallback = localeEntry(FALLBACK_LOCALE) ?? LOCALES[0];
    this.current = this.fallback;
  }
  static init(plugin) {
    if (!this.instance) this.instance = new _I18nManager(plugin);
    return this.instance;
  }
  static unload() {
    this.instance = null;
  }
  static getInstance() {
    if (!this.instance) {
      throw new Error("I18nManager not initialized. Call I18nManager.init(plugin) first.");
    }
    return this.instance;
  }
  /**
   * Kept async because the plugin awaits it on load and a future table read
   * from disk would need it.
   *
   * `preferred` is the saved language setting, read before the settings
   * store proper because the store's own folder defaults are localized and
   * therefore need the catalogue already in place. Anything but a
   * registered code (including the literal `auto`) means "follow Obsidian".
   */
  async initialize(preferred) {
    const wanted = preferred && preferred !== "auto" ? preferred : this.detectedLocale();
    await this.setLocale(wanted);
  }
  /** What following Obsidian resolves to right now. Public so the settings page can switch back to it without a reload. */
  detectedLocale() {
    return this.detectUserLocale();
  }
  /**
   * Reads Obsidian's own language, then the document's, then the browser's.
   *
   * Every one of those is a global that may simply not be there (no moment,
   * an Obsidian build that moved its locale setting, a test environment
   * with no document), which is why the whole thing sits in one try and any
   * failure means "detected nothing" rather than an error.
   */
  detectUserLocale() {
    try {
      const candidates = [
        this.getObsidianLanguage(),
        this.getMomentLocale(),
        activeDocument?.documentElement?.lang,
        this.app.vault?.config?.userInterfaceMode,
        this.app.locale,
        navigator?.language,
        navigator?.languages?.[0]
      ];
      for (const candidate of candidates) {
        const entry = candidate ? localeEntry(candidate) : void 0;
        if (entry) return entry.code;
      }
    } catch {
    }
    return FALLBACK_LOCALE;
  }
  /**
   * Obsidian's own language first, then the ambient signals.
   *
   * `getLanguage()` is the only one of these that reports what the vault
   * owner told **Obsidian** they read. Everything below it reports what they
   * told their operating system, and the two disagree constantly: a Swiss Mac
   * running Obsidian in English answers `de-CH` to moment and to
   * `navigator.language`, and this file's own header promises to follow
   * Obsidian rather than a setting of its own.
   *
   * That mattered more than a mistranslated label. The folder defaults are
   * localized, so a vault set up in English on a German-configured machine had
   * German folders invented for it, beside the English ones it already had,
   * and `preferExisting` then kept both. Folder names are written into
   * somebody's vault and nothing renames them afterwards.
   *
   * Available since Obsidian 1.8.7 and the manifest floor is 1.12.0, so it is
   * always there. Called through a guard anyway, because the cost is one
   * `typeof` and the failure it prevents is a crash on load.
   */
  getObsidianLanguage() {
    try {
      return typeof getLanguage === "function" ? getLanguage() : null;
    } catch {
      return null;
    }
  }
  getMomentLocale() {
    try {
      const instance = window?.moment;
      if (typeof instance?.locale === "function") return instance.locale();
      return null;
    } catch {
      return null;
    }
  }
  /** Unknown or unregistered codes resolve to English rather than to a table that would make every key render as itself. */
  async setLocale(locale) {
    this.current = localeEntry(locale) ?? this.fallback;
    return Promise.resolve();
  }
  t(key, interpolations) {
    try {
      const value = this.lookup(key);
      const resolved = isPluralForms(value) && typeof interpolations?.count === "number" ? selectPluralForm(value, interpolations.count, this.current.code) : value;
      if (typeof resolved !== "string") return key;
      return interpolations ? interpolate(resolved, interpolations) : resolved;
    } catch {
      return key;
    }
  }
  /** The current locale, then English. Per key rather than per table, so a partial translation is a usable one. */
  lookup(key) {
    const own = nestedValue(this.current.table, key);
    if (own !== void 0) return own;
    if (this.current.code === this.fallback.code) return void 0;
    return nestedValue(this.fallback.table, key);
  }
  /** Every registered locale. There is no second list of "supported" ones: a locale without a table cannot be registered. */
  getLocales() {
    return LOCALES.map(({ table: _table, ...locale }) => locale);
  }
  getCurrentLocale() {
    return this.current.code;
  }
  getCurrentLocaleInfo() {
    const { table: _table, ...locale } = this.current;
    return locale;
  }
  isRTL() {
    return this.current.direction === "rtl";
  }
};
function nestedValue(table, path) {
  return path.split(".").reduce((node, part) => {
    if (node && typeof node === "object" && part in node) return node[part];
    return void 0;
  }, table);
}
function interpolate(template, variables) {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key) => variables[key]?.toString() ?? match
  );
}
function t(key, interpolations) {
  try {
    return I18nManager.getInstance().t(key, interpolations);
  } catch {
    return key;
  }
}

// packages/apertrail/src/settings/defaults.ts
var DEFAULT_SETTINGS = {
  rootFolder: "",
  tripsFolder: "Trips",
  archiveFolder: "6 Archive",
  tripsArchiveFolder: "Trips",
  archiveYearFolders: false,
  bookingsFolder: "Trips/Bookings",
  tripBookingsSubfolder: "Bookings",
  exportsSubfolder: SHEET_CONTRACT.exportsSubfolder,
  placesFolder: "Places",
  countriesFolder: "Places/Countries",
  statesFolder: "Places/States",
  citiesFolder: "Places/Cities",
  accommodationFolder: "Places/Accommodation",
  fnbFolder: "Places/Food & Beverages",
  landmarksFolder: "Places/Landmarks",
  locationsFolder: "Places/Locations",
  photoSpotsFolder: "Places/Photo Spots",
  crmFolder: "CRM",
  // The seven values below come from trail-core's CRM_CONTRACT rather than
  // being spelled here, because CULItrail has to ship the identical ones for
  // both plugins to find each other's Person and Company notes in a fresh
  // vault. They were prose in each plugin's CLAUDE.md until one side drifted.
  // tests/crm-contract.test.ts fails if this stops matching.
  personsFolder: CRM_CONTRACT.personsFolder,
  companiesFolder: CRM_CONTRACT.companiesFolder,
  typePropertyName: CRM_CONTRACT.typePropertyName,
  showRibbonIcon: true,
  // Locked, on a fresh install as much as on an old one: every property name
  // below is what existing notes are read by, and a vault that needs different
  // ones turns this on once and off again.
  unlockPropertyNames: false,
  personTypeValue: CRM_CONTRACT.personTypeValue,
  personTagProperty: CRM_CONTRACT.personTagProperty,
  eligiblePersonTags: "",
  companyTypeValue: CRM_CONTRACT.companyTypeValue,
  companyTagProperty: CRM_CONTRACT.companyTagProperty,
  personRolesProperty: CRM_CONTRACT.personRolesProperty,
  companyRolesProperty: CRM_CONTRACT.companyRolesProperty,
  descriptionProperty: "description",
  emailProperty: "email",
  phoneProperty: "phone",
  mobileProperty: "mobile",
  countryProperty: "country",
  stateProperty: "state",
  cityProperty: "city",
  capitalProperty: "capital",
  statesProperty: "states",
  citiesProperty: "cities",
  geoLocationProperty: "geoLocation",
  addressProperty: "address",
  websiteProperty: "website",
  ratingProperty: "rating",
  visitedProperty: "visited",
  lastVisitProperty: "lastVisit",
  tagsProperty: "tags",
  accommodationTypeProperty: "accommodationType",
  accommodationStatusProperty: "accommodationStatus",
  fnbTypeProperty: "fnbType",
  createdProperty: "created",
  modifiedProperty: "modified",
  archivedProperty: "archived",
  departureProperty: "departure",
  returnProperty: "return",
  travelTypeProperty: "travelType",
  travelStatusProperty: "travelStatus",
  reviewStatusProperty: "reviewStatus",
  tripSubtitleProperty: "subtitle",
  imageProperty: "image",
  tripHighlightsProperty: "highlights",
  tripGalleryProperty: "gallery",
  galleryImageField: "image",
  galleryCaptionField: "caption",
  tripCitiesProperty: "cities",
  personsProperty: "persons",
  tripExtendsProperty: "extends",
  stopsProperty: "stops",
  tripDaysProperty: "days",
  dayNumberField: "day",
  dayTitleField: "title",
  dayNoteField: "note",
  stopDayField: "day",
  stopPlaceField: "place",
  stopFromField: "from",
  stopToField: "to",
  stopNoteField: "note",
  stopMotifField: "motif",
  stopExcursionField: "excursion",
  stopRatingField: "rating",
  stopCostField: "cost",
  stopCurrencyField: "currency",
  stopCostUnitField: "costUnit",
  stopPersonsField: "persons",
  nightsProperty: "nights",
  nightCheckInDayField: "checkInDay",
  nightCheckOutDayField: "checkOutDay",
  nightAccommodationField: "accommodation",
  nightCheckInField: "checkIn",
  nightCheckOutField: "checkOut",
  nightCostField: "cost",
  nightCurrencyField: "currency",
  nightCostUnitField: "costUnit",
  nightPersonsField: "persons",
  vehiclesFolder: "Places/Vehicles",
  vehicleModeProperty: "mode",
  vehicleOperatorProperty: "operator",
  vehicleBuiltProperty: "built",
  vehicleRefurbishedProperty: "refurbished",
  vehicleCapacityProperty: "capacity",
  vehicleLengthProperty: "length",
  vehicleTonnageProperty: "tonnage",
  vehicleDeckPlanProperty: "deckPlan",
  vehicleCabinsProperty: "cabins",
  excursionsFolder: "Places/Excursions",
  excursionOperatorProperty: "operator",
  excursionDurationProperty: "duration",
  excursionCodeProperty: "code",
  cabinNameField: "name",
  cabinDescriptionField: "description",
  cabinImageField: "image",
  transportProperty: "transport",
  legDirectionField: "direction",
  legDayField: "day",
  legToDayField: "toDay",
  legCarrierField: "carrier",
  legNumberField: "number",
  legModeField: "mode",
  legFromField: "from",
  legToField: "to",
  legReferenceField: "reference",
  legOriginField: "origin",
  legDestinationField: "destination",
  legCostField: "cost",
  legCurrencyField: "currency",
  legCostUnitField: "costUnit",
  legPersonsField: "persons",
  legVehicleField: "vehicle",
  stopVariantsField: "variants",
  nightVariantsField: "variants",
  legVariantsField: "variants",
  variantNameField: "name",
  variantDescriptionField: "description",
  variantCostField: "cost",
  variantCurrencyField: "currency",
  variantCostUnitField: "costUnit",
  variantChosenField: "chosen",
  legSegmentsField: "segments",
  segmentCarrierField: "carrier",
  segmentNumberField: "number",
  segmentOriginField: "origin",
  segmentDestinationField: "destination",
  segmentFromField: "from",
  segmentToField: "to",
  segmentDayField: "day",
  segmentToDayField: "toDay",
  stopOptionalField: "optional",
  nightOptionalField: "optional",
  legOptionalField: "optional",
  stopChosenField: "chosen",
  nightChosenField: "chosen",
  legChosenField: "chosen",
  timezoneProperty: "timezone",
  openingHoursProperty: "openingHours",
  entryFeeProperty: "entryFee",
  accessibilityProperty: "accessibility",
  parkingProperty: "parking",
  transitProperty: "transit",
  transitModeField: "mode",
  transitDetailField: "detail",
  motifsProperty: "motifs",
  motifNameField: "name",
  motifRoleField: "role",
  motifGeoField: "geoLocation",
  motifDirectionField: "direction",
  motifLightField: "light",
  motifSeasonField: "season",
  motifLensField: "lens",
  motifGearField: "gear",
  motifTechniqueField: "technique",
  motifNoteField: "note",
  motifCapturedField: "captured",
  motifCapturedOnField: "capturedOn",
  sunTimesEnabled: true,
  // Follow Obsidian, render times the way the locale does, and measure in
  // kilometres until somebody says otherwise. Only the last of the three is
  // a guess rather than a deferral, and it is the one a single row changes.
  bookingTripProperty: "trip",
  bookingCategoryProperty: "category",
  bookingStatusProperty: "status",
  bookingSupplierProperty: "supplier",
  bookingPlaceProperty: "place",
  bookingDateProperty: "date",
  bookingAmountProperty: "amount",
  bookingCurrencyProperty: "currency",
  bookingReferenceProperty: "reference",
  bookingPayerProperty: "payer",
  bookingForProperty: "for",
  bookingDocumentProperty: "document",
  tripCurrencyProperty: "currency",
  budgetProperty: "budget",
  budgetCategoryField: "category",
  budgetAmountField: "amount",
  ratesProperty: "rates",
  rateCurrencyField: "currency",
  rateValueField: "rate",
  displayLocale: DISPLAY_CONTRACT.displayLocale,
  exportAuthor: SHEET_CONTRACT.exportAuthor,
  homeCurrency: "CHF",
  currencyOptions: "CHF, EUR, USD",
  budgetEnabled: true,
  language: "auto",
  clockFormat: "auto",
  units: "metric",
  samplesProperty: "samples",
  sampleImageField: "image",
  sampleMotifField: "motif",
  sampleLightField: "light",
  sampleExposureField: "exposure",
  sampleCreditField: "credit"
};
function getLocalizedFolderDefaults(saved = {}) {
  const fallback = {
    rootFolder: DEFAULT_SETTINGS.rootFolder,
    tripsFolder: DEFAULT_SETTINGS.tripsFolder,
    archiveFolder: DEFAULT_SETTINGS.archiveFolder,
    bookingsFolder: DEFAULT_SETTINGS.bookingsFolder,
    placesFolder: DEFAULT_SETTINGS.placesFolder,
    countriesFolder: DEFAULT_SETTINGS.countriesFolder,
    statesFolder: DEFAULT_SETTINGS.statesFolder,
    citiesFolder: DEFAULT_SETTINGS.citiesFolder,
    accommodationFolder: DEFAULT_SETTINGS.accommodationFolder,
    fnbFolder: DEFAULT_SETTINGS.fnbFolder,
    landmarksFolder: DEFAULT_SETTINGS.landmarksFolder,
    locationsFolder: DEFAULT_SETTINGS.locationsFolder,
    photoSpotsFolder: DEFAULT_SETTINGS.photoSpotsFolder,
    vehiclesFolder: DEFAULT_SETTINGS.vehiclesFolder,
    excursionsFolder: DEFAULT_SETTINGS.excursionsFolder,
    crmFolder: DEFAULT_SETTINGS.crmFolder,
    personsFolder: DEFAULT_SETTINGS.personsFolder,
    companiesFolder: DEFAULT_SETTINGS.companiesFolder
  };
  let localized;
  try {
    I18nManager.getInstance();
    const rootFolder = (saved.rootFolder ?? t("settings.folders.defaults.rootFolderPath")).trim();
    const tripsFolder = saved.tripsFolder?.trim() || joinFolder(rootFolder, t("settings.folders.defaults.tripsFolderName"));
    const placesFolder = saved.placesFolder?.trim() || joinFolder(rootFolder, t("settings.folders.defaults.placesFolderName"));
    const crmFolder = saved.crmFolder?.trim() || joinFolder(rootFolder, t("settings.folders.defaults.crmFolderName"));
    localized = {
      rootFolder,
      tripsFolder,
      // At the vault root beside the three module roots rather than under one
      // of them: an archive is not part of the module whose notes it holds,
      // and NODAtrail puts its own at the same level under the same name.
      archiveFolder: saved.archiveFolder?.trim() || joinFolder(rootFolder, t("settings.folders.defaults.archiveFolderName")),
      // Under the Trips folder, so relocating the Trips module takes its
      // bookings with it. The same derivation the place sub-folders use.
      bookingsFolder: joinFolder(tripsFolder, t("settings.folders.defaults.bookingsFolderName")),
      placesFolder,
      countriesFolder: joinFolder(placesFolder, t("settings.folders.defaults.countriesFolderName")),
      statesFolder: joinFolder(placesFolder, t("settings.folders.defaults.statesFolderName")),
      citiesFolder: joinFolder(placesFolder, t("settings.folders.defaults.citiesFolderName")),
      accommodationFolder: joinFolder(
        placesFolder,
        t("settings.folders.defaults.accommodationFolderName")
      ),
      fnbFolder: joinFolder(placesFolder, t("settings.folders.defaults.fnbFolderName")),
      landmarksFolder: joinFolder(placesFolder, t("settings.folders.defaults.landmarksFolderName")),
      locationsFolder: joinFolder(placesFolder, t("settings.folders.defaults.locationsFolderName")),
      vehiclesFolder: joinFolder(placesFolder, t("settings.folders.defaults.vehiclesFolderName")),
      excursionsFolder: joinFolder(
        placesFolder,
        t("settings.folders.defaults.excursionsFolderName")
      ),
      photoSpotsFolder: joinFolder(
        placesFolder,
        t("settings.folders.defaults.photoSpotsFolderName")
      ),
      crmFolder,
      personsFolder: joinFolder(crmFolder, t("settings.folders.defaults.personsFolderName")),
      companiesFolder: joinFolder(crmFolder, t("settings.folders.defaults.companiesFolderName"))
    };
  } catch {
    return resolveFallback(fallback, saved);
  }
  return localized;
}
function resolveFallback(fallback, saved) {
  const rootFolder = (saved.rootFolder ?? "").trim();
  const tripsFolder = saved.tripsFolder?.trim() || joinFolder(rootFolder, "Trips");
  const archiveFolder = saved.archiveFolder?.trim() || joinFolder(rootFolder, "6 Archive");
  const placesFolder = saved.placesFolder?.trim() || joinFolder(rootFolder, "Places");
  const crmFolder = saved.crmFolder?.trim() || joinFolder(rootFolder, "CRM");
  return {
    ...fallback,
    rootFolder,
    tripsFolder,
    archiveFolder,
    placesFolder,
    countriesFolder: joinFolder(placesFolder, "Countries"),
    statesFolder: joinFolder(placesFolder, "States"),
    citiesFolder: joinFolder(placesFolder, "Cities"),
    accommodationFolder: joinFolder(placesFolder, "Accommodation"),
    fnbFolder: joinFolder(placesFolder, "Food & Beverages"),
    landmarksFolder: joinFolder(placesFolder, "Landmarks"),
    locationsFolder: joinFolder(placesFolder, "Locations"),
    photoSpotsFolder: joinFolder(placesFolder, "Photo Spots"),
    vehiclesFolder: joinFolder(placesFolder, "Vehicles"),
    excursionsFolder: joinFolder(placesFolder, "Excursions"),
    crmFolder,
    personsFolder: joinFolder(crmFolder, "People"),
    companiesFolder: joinFolder(crmFolder, "Companies")
  };
}

// packages/apertrail/src/settings/validate.ts
function isPlainObject(val) {
  return !!val && typeof val === "object" && !Array.isArray(val);
}
function str(val, fallback) {
  return typeof val === "string" ? val : fallback;
}
function bool(val, fallback) {
  return typeof val === "boolean" ? val : fallback;
}
function oneOf(val, allowed, fallback) {
  return typeof val === "string" && allowed.includes(val) ? val : fallback;
}
function exportsSubfolder(r, fallback) {
  if (typeof r.exportsSubfolder === "string") return r.exportsSubfolder;
  const old = r.tripExportsSubfolder;
  if (typeof old === "string" && old !== RETIRED_TRIP_EXPORTS_DEFAULT) return old;
  return fallback;
}
var RETIRED_TRIP_EXPORTS_DEFAULT = "Exports";
function mergeSettings(raw) {
  const r = isPlainObject(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const f = getLocalizedFolderDefaults({
    rootFolder: typeof r.rootFolder === "string" ? r.rootFolder : void 0,
    tripsFolder: typeof r.tripsFolder === "string" ? r.tripsFolder : void 0,
    archiveFolder: typeof r.archiveFolder === "string" ? r.archiveFolder : void 0,
    placesFolder: typeof r.placesFolder === "string" ? r.placesFolder : void 0,
    crmFolder: typeof r.crmFolder === "string" ? r.crmFolder : void 0
  });
  return {
    rootFolder: str(r.rootFolder, f.rootFolder),
    tripsFolder: str(r.tripsFolder, f.tripsFolder),
    archiveFolder: str(r.archiveFolder, f.archiveFolder),
    tripsArchiveFolder: str(r.tripsArchiveFolder, d.tripsArchiveFolder),
    archiveYearFolders: bool(r.archiveYearFolders, d.archiveYearFolders),
    bookingsFolder: str(r.bookingsFolder, f.bookingsFolder),
    tripBookingsSubfolder: str(r.tripBookingsSubfolder, d.tripBookingsSubfolder),
    exportsSubfolder: exportsSubfolder(r, d.exportsSubfolder),
    placesFolder: str(r.placesFolder, f.placesFolder),
    countriesFolder: str(r.countriesFolder, f.countriesFolder),
    statesFolder: str(r.statesFolder, f.statesFolder),
    citiesFolder: str(r.citiesFolder, f.citiesFolder),
    accommodationFolder: str(r.accommodationFolder, f.accommodationFolder),
    fnbFolder: str(r.fnbFolder, f.fnbFolder),
    landmarksFolder: str(r.landmarksFolder, f.landmarksFolder),
    locationsFolder: str(r.locationsFolder, f.locationsFolder),
    photoSpotsFolder: str(r.photoSpotsFolder, f.photoSpotsFolder),
    crmFolder: str(r.crmFolder, f.crmFolder),
    typePropertyName: str(r.typePropertyName, d.typePropertyName),
    showRibbonIcon: bool(r.showRibbonIcon, d.showRibbonIcon),
    // Read back like any other toggle rather than forced off on load: a
    // settings page left open across a reload should not re-lock under the
    // cursor half way through a rename.
    unlockPropertyNames: bool(r.unlockPropertyNames, d.unlockPropertyNames),
    personsFolder: str(r.personsFolder, f.personsFolder),
    personTypeValue: str(r.personTypeValue, d.personTypeValue),
    personTagProperty: str(r.personTagProperty, d.personTagProperty),
    eligiblePersonTags: str(r.eligiblePersonTags, d.eligiblePersonTags),
    companiesFolder: str(r.companiesFolder, f.companiesFolder),
    companyTypeValue: str(r.companyTypeValue, d.companyTypeValue),
    companyTagProperty: str(r.companyTagProperty, d.companyTagProperty),
    personRolesProperty: str(r.personRolesProperty, d.personRolesProperty),
    companyRolesProperty: str(r.companyRolesProperty, d.companyRolesProperty),
    descriptionProperty: str(r.descriptionProperty, d.descriptionProperty),
    emailProperty: str(r.emailProperty, d.emailProperty),
    phoneProperty: str(r.phoneProperty, d.phoneProperty),
    mobileProperty: str(r.mobileProperty, d.mobileProperty),
    countryProperty: str(r.countryProperty, d.countryProperty),
    stateProperty: str(r.stateProperty, d.stateProperty),
    cityProperty: str(r.cityProperty, d.cityProperty),
    capitalProperty: str(r.capitalProperty, d.capitalProperty),
    statesProperty: str(r.statesProperty, d.statesProperty),
    citiesProperty: str(r.citiesProperty, d.citiesProperty),
    geoLocationProperty: str(r.geoLocationProperty, d.geoLocationProperty),
    addressProperty: str(r.addressProperty, d.addressProperty),
    websiteProperty: str(r.websiteProperty, d.websiteProperty),
    ratingProperty: str(r.ratingProperty, d.ratingProperty),
    visitedProperty: str(r.visitedProperty, d.visitedProperty),
    lastVisitProperty: str(r.lastVisitProperty, d.lastVisitProperty),
    tagsProperty: str(r.tagsProperty, d.tagsProperty),
    accommodationTypeProperty: str(r.accommodationTypeProperty, d.accommodationTypeProperty),
    accommodationStatusProperty: str(r.accommodationStatusProperty, d.accommodationStatusProperty),
    fnbTypeProperty: str(r.fnbTypeProperty, d.fnbTypeProperty),
    createdProperty: str(r.createdProperty, d.createdProperty),
    modifiedProperty: str(r.modifiedProperty, d.modifiedProperty),
    archivedProperty: str(r.archivedProperty, d.archivedProperty),
    departureProperty: str(r.departureProperty, d.departureProperty),
    returnProperty: str(r.returnProperty, d.returnProperty),
    travelTypeProperty: str(r.travelTypeProperty, d.travelTypeProperty),
    travelStatusProperty: str(r.travelStatusProperty, d.travelStatusProperty),
    reviewStatusProperty: str(r.reviewStatusProperty, d.reviewStatusProperty),
    tripSubtitleProperty: str(r.tripSubtitleProperty, d.tripSubtitleProperty),
    imageProperty: str(r.imageProperty, d.imageProperty),
    tripHighlightsProperty: str(r.tripHighlightsProperty, d.tripHighlightsProperty),
    tripGalleryProperty: str(r.tripGalleryProperty, d.tripGalleryProperty),
    galleryImageField: str(r.galleryImageField, d.galleryImageField),
    galleryCaptionField: str(r.galleryCaptionField, d.galleryCaptionField),
    tripCitiesProperty: str(r.tripCitiesProperty, d.tripCitiesProperty),
    personsProperty: str(r.personsProperty, d.personsProperty),
    tripExtendsProperty: str(r.tripExtendsProperty, d.tripExtendsProperty),
    stopsProperty: str(r.stopsProperty, d.stopsProperty),
    tripDaysProperty: str(r.tripDaysProperty, d.tripDaysProperty),
    dayNumberField: str(r.dayNumberField, d.dayNumberField),
    dayTitleField: str(r.dayTitleField, d.dayTitleField),
    dayNoteField: str(r.dayNoteField, d.dayNoteField),
    stopDayField: str(r.stopDayField, d.stopDayField),
    stopPlaceField: str(r.stopPlaceField, d.stopPlaceField),
    stopFromField: str(r.stopFromField, d.stopFromField),
    stopToField: str(r.stopToField, d.stopToField),
    stopNoteField: str(r.stopNoteField, d.stopNoteField),
    stopMotifField: str(r.stopMotifField, d.stopMotifField),
    stopExcursionField: str(r.stopExcursionField, d.stopExcursionField),
    stopRatingField: str(r.stopRatingField, d.stopRatingField),
    stopCostField: str(r.stopCostField, d.stopCostField),
    stopCurrencyField: str(r.stopCurrencyField, d.stopCurrencyField),
    stopCostUnitField: str(r.stopCostUnitField, d.stopCostUnitField),
    stopPersonsField: str(r.stopPersonsField, d.stopPersonsField),
    nightsProperty: str(r.nightsProperty, d.nightsProperty),
    nightCheckInDayField: str(r.nightCheckInDayField, d.nightCheckInDayField),
    nightCheckOutDayField: str(r.nightCheckOutDayField, d.nightCheckOutDayField),
    nightAccommodationField: str(r.nightAccommodationField, d.nightAccommodationField),
    nightCheckInField: str(r.nightCheckInField, d.nightCheckInField),
    nightCheckOutField: str(r.nightCheckOutField, d.nightCheckOutField),
    nightCostField: str(r.nightCostField, d.nightCostField),
    nightCurrencyField: str(r.nightCurrencyField, d.nightCurrencyField),
    nightCostUnitField: str(r.nightCostUnitField, d.nightCostUnitField),
    nightPersonsField: str(r.nightPersonsField, d.nightPersonsField),
    // `f` and not `d`, like every other folder: a vault that renamed its
    // Places root gets a folder ADDED later under that root rather than under
    // the pristine English default. Written as `d` first, which would have put
    // "Places/Vehicles" beside an existing "Plätze".
    vehiclesFolder: str(r.vehiclesFolder, f.vehiclesFolder),
    vehicleModeProperty: str(r.vehicleModeProperty, d.vehicleModeProperty),
    vehicleOperatorProperty: str(r.vehicleOperatorProperty, d.vehicleOperatorProperty),
    vehicleBuiltProperty: str(r.vehicleBuiltProperty, d.vehicleBuiltProperty),
    vehicleRefurbishedProperty: str(r.vehicleRefurbishedProperty, d.vehicleRefurbishedProperty),
    vehicleCapacityProperty: str(r.vehicleCapacityProperty, d.vehicleCapacityProperty),
    vehicleLengthProperty: str(r.vehicleLengthProperty, d.vehicleLengthProperty),
    vehicleTonnageProperty: str(r.vehicleTonnageProperty, d.vehicleTonnageProperty),
    vehicleDeckPlanProperty: str(r.vehicleDeckPlanProperty, d.vehicleDeckPlanProperty),
    vehicleCabinsProperty: str(r.vehicleCabinsProperty, d.vehicleCabinsProperty),
    // `f` and not `d`, for the reason written above the vehicles folder: a
    // vault that renamed its Places root gets a folder ADDED later under
    // that root rather than under the pristine English default.
    excursionsFolder: str(r.excursionsFolder, f.excursionsFolder),
    excursionOperatorProperty: str(r.excursionOperatorProperty, d.excursionOperatorProperty),
    excursionDurationProperty: str(r.excursionDurationProperty, d.excursionDurationProperty),
    excursionCodeProperty: str(r.excursionCodeProperty, d.excursionCodeProperty),
    cabinNameField: str(r.cabinNameField, d.cabinNameField),
    cabinDescriptionField: str(r.cabinDescriptionField, d.cabinDescriptionField),
    cabinImageField: str(r.cabinImageField, d.cabinImageField),
    transportProperty: str(r.transportProperty, d.transportProperty),
    legDirectionField: str(r.legDirectionField, d.legDirectionField),
    legDayField: str(r.legDayField, d.legDayField),
    legToDayField: str(r.legToDayField, d.legToDayField),
    legCarrierField: str(r.legCarrierField, d.legCarrierField),
    legNumberField: str(r.legNumberField, d.legNumberField),
    legModeField: str(r.legModeField, d.legModeField),
    legFromField: str(r.legFromField, d.legFromField),
    legToField: str(r.legToField, d.legToField),
    legReferenceField: str(r.legReferenceField, d.legReferenceField),
    legOriginField: str(r.legOriginField, d.legOriginField),
    legDestinationField: str(r.legDestinationField, d.legDestinationField),
    legCostField: str(r.legCostField, d.legCostField),
    legCurrencyField: str(r.legCurrencyField, d.legCurrencyField),
    legCostUnitField: str(r.legCostUnitField, d.legCostUnitField),
    legPersonsField: str(r.legPersonsField, d.legPersonsField),
    legVehicleField: str(r.legVehicleField, d.legVehicleField),
    stopVariantsField: str(r.stopVariantsField, d.stopVariantsField),
    nightVariantsField: str(r.nightVariantsField, d.nightVariantsField),
    legVariantsField: str(r.legVariantsField, d.legVariantsField),
    variantNameField: str(r.variantNameField, d.variantNameField),
    variantDescriptionField: str(r.variantDescriptionField, d.variantDescriptionField),
    variantCostField: str(r.variantCostField, d.variantCostField),
    variantCurrencyField: str(r.variantCurrencyField, d.variantCurrencyField),
    variantCostUnitField: str(r.variantCostUnitField, d.variantCostUnitField),
    variantChosenField: str(r.variantChosenField, d.variantChosenField),
    legSegmentsField: str(r.legSegmentsField, d.legSegmentsField),
    segmentCarrierField: str(r.segmentCarrierField, d.segmentCarrierField),
    segmentNumberField: str(r.segmentNumberField, d.segmentNumberField),
    segmentOriginField: str(r.segmentOriginField, d.segmentOriginField),
    segmentDestinationField: str(r.segmentDestinationField, d.segmentDestinationField),
    segmentFromField: str(r.segmentFromField, d.segmentFromField),
    segmentToField: str(r.segmentToField, d.segmentToField),
    segmentDayField: str(r.segmentDayField, d.segmentDayField),
    segmentToDayField: str(r.segmentToDayField, d.segmentToDayField),
    stopOptionalField: str(r.stopOptionalField, d.stopOptionalField),
    nightOptionalField: str(r.nightOptionalField, d.nightOptionalField),
    legOptionalField: str(r.legOptionalField, d.legOptionalField),
    stopChosenField: str(r.stopChosenField, d.stopChosenField),
    nightChosenField: str(r.nightChosenField, d.nightChosenField),
    legChosenField: str(r.legChosenField, d.legChosenField),
    timezoneProperty: str(r.timezoneProperty, d.timezoneProperty),
    openingHoursProperty: str(r.openingHoursProperty, d.openingHoursProperty),
    entryFeeProperty: str(r.entryFeeProperty, d.entryFeeProperty),
    accessibilityProperty: str(r.accessibilityProperty, d.accessibilityProperty),
    parkingProperty: str(r.parkingProperty, d.parkingProperty),
    transitProperty: str(r.transitProperty, d.transitProperty),
    transitModeField: str(r.transitModeField, d.transitModeField),
    transitDetailField: str(r.transitDetailField, d.transitDetailField),
    motifsProperty: str(r.motifsProperty, d.motifsProperty),
    motifNameField: str(r.motifNameField, d.motifNameField),
    motifRoleField: str(r.motifRoleField, d.motifRoleField),
    motifGeoField: str(r.motifGeoField, d.motifGeoField),
    motifDirectionField: str(r.motifDirectionField, d.motifDirectionField),
    motifLightField: str(r.motifLightField, d.motifLightField),
    motifSeasonField: str(r.motifSeasonField, d.motifSeasonField),
    motifLensField: str(r.motifLensField, d.motifLensField),
    motifGearField: str(r.motifGearField, d.motifGearField),
    motifTechniqueField: str(r.motifTechniqueField, d.motifTechniqueField),
    motifNoteField: str(r.motifNoteField, d.motifNoteField),
    motifCapturedField: str(r.motifCapturedField, d.motifCapturedField),
    motifCapturedOnField: str(r.motifCapturedOnField, d.motifCapturedOnField),
    sunTimesEnabled: bool(r.sunTimesEnabled, d.sunTimesEnabled),
    // The language is NOT checked against the registry here: an unknown
    // code resolves to English at lookup time, and clearing the saved value
    // would lose a preference the moment a locale is temporarily absent.
    bookingTripProperty: str(r.bookingTripProperty, d.bookingTripProperty),
    bookingCategoryProperty: str(r.bookingCategoryProperty, d.bookingCategoryProperty),
    bookingStatusProperty: str(r.bookingStatusProperty, d.bookingStatusProperty),
    bookingSupplierProperty: str(r.bookingSupplierProperty, d.bookingSupplierProperty),
    bookingPlaceProperty: str(r.bookingPlaceProperty, d.bookingPlaceProperty),
    bookingDateProperty: str(r.bookingDateProperty, d.bookingDateProperty),
    bookingAmountProperty: str(r.bookingAmountProperty, d.bookingAmountProperty),
    bookingCurrencyProperty: str(r.bookingCurrencyProperty, d.bookingCurrencyProperty),
    bookingReferenceProperty: str(r.bookingReferenceProperty, d.bookingReferenceProperty),
    bookingPayerProperty: str(r.bookingPayerProperty, d.bookingPayerProperty),
    bookingForProperty: str(r.bookingForProperty, d.bookingForProperty),
    bookingDocumentProperty: str(r.bookingDocumentProperty, d.bookingDocumentProperty),
    tripCurrencyProperty: str(r.tripCurrencyProperty, d.tripCurrencyProperty),
    budgetProperty: str(r.budgetProperty, d.budgetProperty),
    budgetCategoryField: str(r.budgetCategoryField, d.budgetCategoryField),
    budgetAmountField: str(r.budgetAmountField, d.budgetAmountField),
    ratesProperty: str(r.ratesProperty, d.ratesProperty),
    rateCurrencyField: str(r.rateCurrencyField, d.rateCurrencyField),
    rateValueField: str(r.rateValueField, d.rateValueField),
    // Not validated against a list of tags: Intl accepts more than any list
    // here could carry, and a tag it rejects falls back rather than throwing, so
    // a typo costs a convention and never costs a figure.
    displayLocale: str(r.displayLocale, d.displayLocale),
    exportAuthor: str(r.exportAuthor, d.exportAuthor),
    homeCurrency: str(r.homeCurrency, d.homeCurrency),
    currencyOptions: str(r.currencyOptions, d.currencyOptions),
    budgetEnabled: bool(r.budgetEnabled, d.budgetEnabled),
    language: str(r.language, d.language),
    clockFormat: oneOf(r.clockFormat, CLOCK_FORMATS, d.clockFormat),
    units: oneOf(r.units, UNIT_SYSTEMS, d.units),
    samplesProperty: str(r.samplesProperty, d.samplesProperty),
    sampleImageField: str(r.sampleImageField, d.sampleImageField),
    sampleMotifField: str(r.sampleMotifField, d.sampleMotifField),
    sampleLightField: str(r.sampleLightField, d.sampleLightField),
    sampleExposureField: str(r.sampleExposureField, d.sampleExposureField),
    sampleCreditField: str(r.sampleCreditField, d.sampleCreditField)
  };
}

// packages/apertrail/src/trips/costs/booking-note.ts
var BOOKING_CATEGORIES = [
  "transport",
  "accommodation",
  "activity",
  "food",
  "fees",
  "other"
];
var BOOKING_STATUSES = ["estimate", "booked", "paid", "cancelled", "refunded"];
function isBookingCategory(value) {
  return typeof value === "string" && BOOKING_CATEGORIES.includes(value.trim());
}
function isBookingStatus(value) {
  return typeof value === "string" && BOOKING_STATUSES.includes(value.trim());
}
function parseBooking(frontmatter, properties) {
  const p = properties;
  const rawCategory = readString(frontmatter[p.categoryProperty]);
  const rawStatus = readString(frontmatter[p.statusProperty]);
  return {
    tripTitle: wikilinkTarget(frontmatter[p.tripProperty]),
    category: isBookingCategory(rawCategory) ? rawCategory.trim() : "other",
    status: isBookingStatus(rawStatus) ? rawStatus.trim() : "booked",
    supplierTitle: wikilinkTarget(frontmatter[p.supplierProperty]),
    placeTitle: wikilinkTarget(frontmatter[p.placeProperty]),
    date: readString(frontmatter[p.dateProperty])?.slice(0, 10) ?? null,
    amount: readNumberLike(frontmatter[p.amountProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    reference: readString(frontmatter[p.referenceProperty]),
    payerTitle: wikilinkTarget(frontmatter[p.payerProperty]),
    forTitles: wikilinkTargets(frontmatter[p.forProperty]),
    documentPath: readString(frontmatter[p.documentProperty])
  };
}

// packages/apertrail/src/vault/read-cover.ts
function readNoteCover(fm, settings) {
  const description = findValue(fm, settings.descriptionProperty);
  const raw = findValue(fm, settings.imageProperty);
  const entries = findValue(fm, settings.tripGalleryProperty);
  return {
    highlights: readTextLines(findValue(fm, settings.tripHighlightsProperty)),
    description: typeof description === "string" && description.trim() !== "" ? description.trim() : null,
    image: typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null,
    gallery: Array.isArray(entries) ? entries.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const row = entry;
      const image = row[settings.galleryImageField];
      if (typeof image !== "string" || image.trim() === "") return [];
      const caption = row[settings.galleryCaptionField];
      return [
        {
          image: image.trim(),
          caption: typeof caption === "string" && caption.trim() !== "" ? caption.trim() : null
        }
      ];
    }) : []
  };
}

// packages/apertrail/src/vault/entity-types.ts
var TRAVEL_PLACE_FOLDER_SETTING = {
  accommodation: "accommodationFolder",
  fnb: "fnbFolder",
  landmark: "landmarksFolder",
  location: "locationsFolder",
  photospot: "photoSpotsFolder"
};

// packages/apertrail/src/vault/visit-derivation.ts
function stopDate(trip, stopFrom) {
  const raw = stopFrom ?? trip.return ?? trip.departure;
  return raw ? raw.slice(0, 10) : null;
}
function buildVisitIndex(trips) {
  const byTitle2 = /* @__PURE__ */ new Map();
  for (const trip of trips) {
    if (trip.effectiveStatus !== "Over") continue;
    for (const stop of trip.stops) {
      if (!stop.placeTitle) continue;
      const dates = byTitle2.get(stop.placeTitle) ?? [];
      const date = stopDate(trip, stop.from);
      dates.push(date ?? "");
      byTitle2.set(stop.placeTitle, dates);
    }
  }
  return byTitle2;
}
function deriveVisit(title, explicitVisited, explicitLastVisit, index, dayDates = []) {
  const tripDates = index.get(title) ?? [];
  const fromTrips = tripDates.length > 0;
  const candidates = [explicitLastVisit, ...tripDates, ...dayDates].filter(
    (d) => typeof d === "string" && d !== ""
  );
  const lastVisit = candidates.length > 0 ? candidates.reduce((a, b) => a > b ? a : b) : null;
  return {
    // **A day note is evidence on its own**, not only a date for a visit a trip
    // already established. That is the whole point: the places it adds are the
    // ones no trip will ever mention.
    visited: explicitVisited || fromTrips || dayDates.length > 0,
    lastVisit,
    fromTrips
  };
}
function applyDerivedVisits(cities, places, trips, dayVisits = /* @__PURE__ */ new Map()) {
  const index = buildVisitIndex(trips);
  const daysOf = (path) => dayVisits.get(path) ?? [];
  for (const city of cities) {
    const derived = deriveVisit(
      city.title,
      city.visited,
      city.lastVisit,
      index,
      daysOf(city.file.path)
    );
    city.visited = derived.visited;
    city.lastVisit = derived.lastVisit;
    city.visitedFromTrips = derived.fromTrips;
  }
  for (const place of places) {
    const derived = deriveVisit(
      place.title,
      place.visited,
      place.lastVisit,
      index,
      daysOf(place.file.path)
    );
    place.visited = derived.visited;
    place.lastVisit = derived.lastVisit;
    place.visitedFromTrips = derived.fromTrips;
  }
}

// packages/apertrail/src/trips/trip-folder.ts
function bookingReadFolders(settings) {
  const folders = [
    settings.tripsFolder.trim(),
    settings.bookingsFolder.trim(),
    tripArchiveFolder(settings) ?? ""
  ];
  return [...new Set(folders.filter((folder) => folder !== ""))];
}
function tripArchiveFolder(settings) {
  const root = settings.archiveFolder.trim();
  const category = settings.tripsArchiveFolder.trim();
  if (!root || !category) return null;
  return `${root}/${category}`;
}
function tripReadFolders(settings) {
  const folders = [settings.tripsFolder.trim(), tripArchiveFolder(settings) ?? ""];
  return [...new Set(folders.filter((folder) => folder !== ""))];
}
function isArchivedTripPath(path, settings) {
  const archive = tripArchiveFolder(settings);
  if (!archive) return false;
  return path === archive || path.startsWith(`${archive}/`);
}

// packages/apertrail/src/trips/costs/line-cost.ts
var COST_UNITS = ["total", "person", "night", "personNight"];
var FALLBACK_COST_UNIT = "total";
function parseCostUnit(value) {
  const found = COST_UNITS.find((unit) => unit === value?.trim());
  return found ?? FALLBACK_COST_UNIT;
}

// packages/apertrail/src/trips/trip-note.ts
var TRAVEL_STATUS_VALUES = ["Planned", "Booked", "Over", "Cancelled"];
function readCode(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return readString(value);
}
function isTravelStatusValue(value) {
  return typeof value === "string" && TRAVEL_STATUS_VALUES.includes(value.trim());
}
function placeLabel(value) {
  return wikilinkTarget(value) ?? readString(value);
}
function keptSegments(segments) {
  return (segments ?? []).filter(
    (segment) => cleanString(segment.number) !== null || cleanString(segment.carrier) !== null || cleanString(segment.origin) !== null || cleanString(segment.destination) !== null || cleanString(segment.from) !== null || cleanString(segment.to) !== null || cleanDay(segment.day) !== null || cleanDay(segment.toDay) !== null
  );
}
function cleanDay(value) {
  return value === null || value === void 0 ? null : value;
}
function cleanString(value) {
  if (value === null || value === void 0) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
function readLines(raw) {
  if (typeof raw === "string") return readString(raw) ? [raw.trim()] : [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => readString(entry)).filter((line) => line !== null);
}
function readLineChoice(entry, fields2, p) {
  const optional = readBooleanLike(entry[fields2.optional]) === true;
  return {
    variants: objectEntries(entry[fields2.variants]).flatMap((variant) => {
      const name = readString(variant[p.variantNameField]);
      const cost = readNumberLike(variant[p.variantCostField]);
      if (name === null && cost === null) return [];
      return [
        {
          name,
          description: readString(variant[p.variantDescriptionField]),
          cost,
          currency: normalizeCurrency(readString(variant[p.variantCurrencyField])),
          costUnit: parseCostUnit(readString(variant[p.variantCostUnitField])),
          // Null reads as false: a variant nobody has marked is one nobody
          // has chosen, which is the ordinary state of a choice still being
          // made.
          chosen: readBooleanLike(variant[p.variantChosenField]) === true
        }
      ];
    }),
    optional,
    chosen: optional && readBooleanLike(entry[fields2.chosen]) === true
  };
}
function objectEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry) => typeof entry === "object" && entry !== null
  );
}
function parseTripRecord(input) {
  const p = input.properties;
  const fm = input.frontmatter;
  const rawStatus = readString(fm[p.travelStatusProperty]);
  return {
    subtitle: readString(fm[p.subtitleProperty]),
    image: readString(fm[p.imageProperty]),
    highlights: readLines(fm[p.highlightsProperty]),
    gallery: objectEntries(fm[p.galleryProperty]).flatMap((entry) => {
      const image = readString(entry[p.galleryImageField]);
      return image ? [{ image, caption: readString(entry[p.galleryCaptionField]) }] : [];
    }),
    countryTitle: wikilinkTarget(fm[p.countryProperty]),
    cityTitles: wikilinkTargets(fm[p.citiesProperty]),
    departure: readDateTimeLike(fm[p.departureProperty]),
    return: readDateTimeLike(fm[p.returnProperty]),
    travelType: readString(fm[p.travelTypeProperty]),
    travelStatus: isTravelStatusValue(rawStatus) ? rawStatus.trim() : null,
    reviewStatus: readString(fm[p.reviewStatusProperty]),
    rating: readNumberLike(fm[p.ratingProperty]),
    personTitles: wikilinkTargets(fm[p.personsProperty]),
    extendsTitle: wikilinkTarget(fm[p.extendsProperty]),
    // An entry with no day number annotates nothing, so it is dropped rather
    // than kept as a day nobody could find.
    days: objectEntries(fm[p.daysProperty]).flatMap((entry) => {
      const day = readNumberLike(entry[p.dayNumberField]);
      return day === null ? [] : [
        {
          day,
          title: readString(entry[p.dayTitleField]),
          note: readString(entry[p.dayNoteField])
        }
      ];
    }),
    stops: objectEntries(fm[p.stopsProperty]).map((entry) => {
      const day = readNumberLike(entry[p.stopDayField]);
      const place = entry[p.stopPlaceField];
      return {
        day,
        placeTitle: wikilinkTarget(place),
        // A stop that names no place and a stop whose link is a typo both
        // read as a null title, and they are not the same thing: the first
        // is a line of a brochure day, the second is a note that needs
        // fixing. Without the difference every placeless line would render
        // as "unresolved link", which is the noise version of the warning it
        // was meant to be.
        placeUnresolved: wikilinkTarget(place) === null && readString(place) !== null,
        from: day === null ? readDateTimeLike(entry[p.stopFromField]) : clockTime(readString(entry[p.stopFromField])),
        to: day === null ? readDateTimeLike(entry[p.stopToField]) : clockTime(readString(entry[p.stopToField])),
        note: readString(entry[p.stopNoteField]),
        rating: readNumberLike(entry[p.stopRatingField]),
        motifName: readString(entry[p.stopMotifField]),
        excursionTitle: wikilinkTarget(entry[p.stopExcursionField]),
        cost: readNumberLike(entry[p.stopCostField]),
        currency: normalizeCurrency(readString(entry[p.stopCurrencyField])),
        costUnit: parseCostUnit(readString(entry[p.stopCostUnitField])),
        persons: wikilinkTargets(entry[p.stopPersonsField]),
        ...readLineChoice(
          entry,
          {
            variants: p.stopVariantsField,
            optional: p.stopOptionalField,
            chosen: p.stopChosenField
          },
          p
        )
      };
    }),
    nights: objectEntries(fm[p.nightsProperty]).map((entry) => ({
      accommodationTitle: wikilinkTarget(entry[p.nightAccommodationField]),
      checkInDay: readNumberLike(entry[p.nightCheckInDayField]),
      checkOutDay: readNumberLike(entry[p.nightCheckOutDayField]),
      checkIn: readDateLike(entry[p.nightCheckInField]),
      checkOut: readDateLike(entry[p.nightCheckOutField]),
      cost: readNumberLike(entry[p.nightCostField]),
      currency: normalizeCurrency(readString(entry[p.nightCurrencyField])),
      costUnit: parseCostUnit(readString(entry[p.nightCostUnitField])),
      persons: wikilinkTargets(entry[p.nightPersonsField]),
      ...readLineChoice(
        entry,
        {
          variants: p.nightVariantsField,
          optional: p.nightOptionalField,
          chosen: p.nightChosenField
        },
        p
      )
    })),
    currency: normalizeCurrency(readString(fm[p.tripCurrencyProperty])),
    budget: objectEntries(fm[p.budgetProperty]).map((entry) => ({
      category: readString(entry[p.budgetCategoryField]) ?? "",
      amount: readNumberLike(entry[p.budgetAmountField])
    })),
    rates: objectEntries(fm[p.ratesProperty]).map((entry) => ({
      currency: normalizeCurrency(readString(entry[p.rateCurrencyField])) ?? "",
      rate: readNumberLike(entry[p.rateValueField])
    })),
    transport: objectEntries(fm[p.transportProperty]).map(
      (entry) => withSegmentEnds(readLeg(entry, p), entry, p)
    )
  };
}
function readLeg(entry, p) {
  const day = readNumberLike(entry[p.legDayField]);
  const toDay = readNumberLike(entry[p.legToDayField]);
  const relative3 = day !== null || toDay !== null;
  return {
    day,
    toDay,
    // Anything that isn't explicitly "inbound" is treated as outbound.
    // A leg has to have some direction to render under, and outbound is
    // the one a partially-filled note most likely means.
    direction: readString(entry[p.legDirectionField]) === "inbound" ? "inbound" : "outbound",
    mode: readString(entry[p.legModeField]),
    // A wikilink reads down to its target, like a leg's own origin:
    // `[[Swiss]]` and `Swiss` arrive the same, and neither needs a note.
    carrier: placeLabel(entry[p.legCarrierField]),
    // A train number is often only digits, and YAML reads a bare 812 as a
    // number rather than the text it is.
    number: readCode(entry[p.legNumberField]),
    from: relative3 ? clockTime(readString(entry[p.legFromField])) : readDateTimeLike(entry[p.legFromField]),
    to: relative3 ? clockTime(readString(entry[p.legToField])) : readDateTimeLike(entry[p.legToField]),
    reference: readString(entry[p.legReferenceField]),
    // A wikilink reads down to its target so `[[Zürich]]` and `Zürich`
    // arrive the same, and the renderer links whichever the vault has a
    // note for. Most airports never will.
    // A wikilink read down to its target, like the carrier beside it. A
    // vehicle that has no note reads as its plain text rather than as
    // nothing, so a ship somebody only typed the name of still prints.
    vehicleTitle: placeLabel(entry[p.legVehicleField]),
    origin: placeLabel(entry[p.legOriginField]),
    destination: placeLabel(entry[p.legDestinationField]),
    cost: readNumberLike(entry[p.legCostField]),
    currency: normalizeCurrency(readString(entry[p.legCurrencyField])),
    costUnit: parseCostUnit(readString(entry[p.legCostUnitField])),
    persons: wikilinkTargets(entry[p.legPersonsField]),
    ...readLineChoice(
      entry,
      { variants: p.legVariantsField, optional: p.legOptionalField, chosen: p.legChosenField },
      p
    ),
    segments: []
  };
}
function withSegmentEnds(leg, entry, p) {
  const segments = keptSegments(
    objectEntries(entry[p.legSegmentsField]).map((raw) => readSegment(raw, p))
  );
  const [first] = segments;
  const last = segments[segments.length - 1];
  if (!first || !last) return leg;
  if (segments.length === 1) {
    return {
      ...leg,
      carrier: leg.carrier ?? first.carrier,
      number: leg.number ?? first.number,
      origin: leg.origin ?? first.origin,
      destination: leg.destination ?? first.destination,
      day: leg.day ?? first.day,
      toDay: leg.toDay ?? first.toDay,
      from: leg.from ?? first.from,
      to: leg.to ?? first.to
    };
  }
  return {
    ...leg,
    origin: first.origin,
    destination: last.destination,
    day: first.day,
    toDay: last.toDay ?? last.day,
    from: first.from,
    to: last.to,
    // The numbers are the segments'. A leg-level one left over from before
    // the leg was split would name one flight as if it were the ticket.
    number: null,
    segments
  };
}
function readSegment(entry, p) {
  const day = readNumberLike(entry[p.segmentDayField]);
  const toDay = readNumberLike(entry[p.segmentToDayField]);
  const relative3 = day !== null || toDay !== null;
  const time = (raw) => relative3 ? clockTime(readString(raw)) : readDateTimeLike(raw);
  return {
    carrier: placeLabel(entry[p.segmentCarrierField]),
    number: readCode(entry[p.segmentNumberField]),
    origin: placeLabel(entry[p.segmentOriginField]),
    destination: placeLabel(entry[p.segmentDestinationField]),
    day,
    toDay,
    from: time(entry[p.segmentFromField]),
    to: time(entry[p.segmentToField])
  };
}
function effectiveTravelStatus(record, today) {
  if (record.travelStatus) return record.travelStatus;
  const end = record.return ?? record.departure;
  if (end && end.slice(0, 10) < today) return "Over";
  return "Planned";
}

// packages/apertrail/src/places/photo-spot-note.ts
var PHOTO_SPOT_LIGHT_WINDOWS = [
  "blue-hour-morning",
  "sunrise",
  "golden-hour-morning",
  "day",
  "overcast",
  "golden-hour-evening",
  "sunset",
  "blue-hour-evening",
  "night"
];
function isPhotoSpotLightWindow(value) {
  return typeof value === "string" && PHOTO_SPOT_LIGHT_WINDOWS.includes(value.trim());
}
var PHOTO_SPOT_ACCESSIBILITY_VALUES = ["full", "partial", "none", "unknown"];
var COMPASS_POINTS = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5
};
function parsePhotoSpotDirection(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? normalizeBearing(raw) : null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return normalizeBearing(asNumber);
  const point = trimmed.toUpperCase().replace(/\s+/g, "").replace(/O/g, "E");
  return point in COMPASS_POINTS ? COMPASS_POINTS[point] : null;
}
function normalizeBearing(value) {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
function photoSpotPropertyNames(settings) {
  return {
    timezoneProperty: settings.timezoneProperty,
    openingHoursProperty: settings.openingHoursProperty,
    entryFeeProperty: settings.entryFeeProperty,
    accessibilityProperty: settings.accessibilityProperty,
    parkingProperty: settings.parkingProperty,
    modifiedProperty: settings.modifiedProperty,
    transitProperty: settings.transitProperty,
    transitModeField: settings.transitModeField,
    transitDetailField: settings.transitDetailField,
    motifsProperty: settings.motifsProperty,
    motifNameField: settings.motifNameField,
    motifRoleField: settings.motifRoleField,
    motifGeoField: settings.motifGeoField,
    motifDirectionField: settings.motifDirectionField,
    motifLightField: settings.motifLightField,
    motifSeasonField: settings.motifSeasonField,
    motifLensField: settings.motifLensField,
    motifGearField: settings.motifGearField,
    motifTechniqueField: settings.motifTechniqueField,
    motifNoteField: settings.motifNoteField,
    motifCapturedField: settings.motifCapturedField,
    motifCapturedOnField: settings.motifCapturedOnField,
    samplesProperty: settings.samplesProperty,
    sampleImageField: settings.sampleImageField,
    sampleMotifField: settings.sampleMotifField,
    sampleLightField: settings.sampleLightField,
    sampleExposureField: settings.sampleExposureField,
    sampleCreditField: settings.sampleCreditField
  };
}
function readBool(raw) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return caseFold(raw) === "true";
  return false;
}
function readGeoPair(raw) {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const [lat, lng] = raw;
  if (typeof lat !== "string" && typeof lat !== "number" || typeof lng !== "string" && typeof lng !== "number")
    return null;
  return [String(lat), String(lng)];
}
function readStringList2(raw) {
  const values = Array.isArray(raw) ? raw : [raw];
  return values.map(readString).filter((v) => v !== null);
}
function readMonthList(raw) {
  const values = Array.isArray(raw) ? raw : [raw];
  return values.map((v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") return Number(v.trim());
    return NaN;
  }).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
}
function readLightList(raw) {
  return readStringList2(raw).filter(isPhotoSpotLightWindow);
}
function objectEntries2(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry) => typeof entry === "object" && entry !== null
  );
}
function parsePhotoSpotRecord(input) {
  const p = input.properties;
  const fm = input.frontmatter;
  const rawAccessibility = readString(fm[p.accessibilityProperty]);
  const accessibility = PHOTO_SPOT_ACCESSIBILITY_VALUES.includes(
    rawAccessibility ?? ""
  ) ? rawAccessibility : "unknown";
  return {
    timezone: readString(fm[p.timezoneProperty]),
    openingHours: readString(fm[p.openingHoursProperty]),
    entryFee: readString(fm[p.entryFeeProperty]),
    // An absent or unrecognized value reads as `unknown`, never as `none`.
    // "Nobody has said" and "there is no step-free access" are different
    // claims, and only one of them is safe to make on a user's behalf.
    accessibility,
    parking: readString(fm[p.parkingProperty]),
    transit: objectEntries2(fm[p.transitProperty]).map((entry) => ({
      mode: readString(entry[p.transitModeField]),
      detail: readString(entry[p.transitDetailField])
    })),
    motifs: objectEntries2(fm[p.motifsProperty]).map((entry) => ({
      name: readString(entry[p.motifNameField]),
      // Anything that isn't explicitly "main" is secondary. A motif has to
      // render under some role, and a note that names one motif without
      // marking it is far more likely to have meant a plain entry than a
      // second headline act.
      role: readString(entry[p.motifRoleField]) === "main" ? "main" : "secondary",
      geoLocation: readGeoPair(entry[p.motifGeoField]),
      direction: parsePhotoSpotDirection(entry[p.motifDirectionField]),
      light: readLightList(entry[p.motifLightField]),
      season: readMonthList(entry[p.motifSeasonField]),
      lens: readString(entry[p.motifLensField]),
      gear: readStringList2(entry[p.motifGearField]),
      technique: readString(entry[p.motifTechniqueField]),
      note: readString(entry[p.motifNoteField]),
      captured: readBool(entry[p.motifCapturedField]),
      capturedOn: readString(entry[p.motifCapturedOnField])
    })),
    samples: objectEntries2(fm[p.samplesProperty]).map((entry) => {
      const light = readString(entry[p.sampleLightField]);
      return {
        image: readString(entry[p.sampleImageField]),
        motifName: readString(entry[p.sampleMotifField]),
        light: isPhotoSpotLightWindow(light) ? light : null,
        exposure: readString(entry[p.sampleExposureField]),
        credit: readString(entry[p.sampleCreditField])
      };
    })
  };
}

// packages/apertrail/src/places/vehicle-note.ts
function parseVehicle(frontmatter, p) {
  const fm = frontmatter;
  return {
    description: readString(fm[p.descriptionProperty]),
    mode: readString(fm[p.modeProperty]),
    operatorTitle: wikilinkTarget(fm[p.operatorProperty]) ?? readString(fm[p.operatorProperty]),
    built: readString(fm[p.builtProperty]),
    refurbished: readString(fm[p.refurbishedProperty]),
    capacity: readNumberLike(fm[p.capacityProperty]),
    length: readString(fm[p.lengthProperty]),
    tonnage: readString(fm[p.tonnageProperty]),
    website: readString(fm[p.websiteProperty]),
    deckPlan: readString(fm[p.deckPlanProperty]),
    image: readString(fm[p.imageProperty]),
    gallery: objectEntries3(fm[p.galleryProperty]).flatMap((entry) => {
      const image = readString(entry[p.galleryImageField]);
      return image ? [{ image, caption: readString(entry[p.galleryCaptionField]) }] : [];
    }),
    // Not `readStringList`: a highlight is a sentence, commas and all.
    highlights: readTextLines(fm[p.highlightsProperty]),
    cabins: objectEntries3(fm[p.cabinsProperty]).flatMap((entry) => {
      const name = readString(entry[p.cabinNameField]);
      return name === null ? [] : [
        {
          name,
          description: readString(entry[p.cabinDescriptionField]),
          image: readString(entry[p.cabinImageField])
        }
      ];
    })
  };
}
function objectEntries3(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry) => typeof entry === "object" && entry !== null
  );
}

// packages/apertrail/src/places/excursion-note.ts
function parseExcursion(frontmatter, p) {
  const fm = frontmatter;
  return {
    description: readString(fm[p.descriptionProperty]),
    operatorTitle: wikilinkTarget(fm[p.operatorProperty]) ?? readString(fm[p.operatorProperty]),
    duration: readString(fm[p.durationProperty]),
    code: readString(fm[p.codeProperty]),
    countryTitle: wikilinkTarget(fm[p.countryProperty]),
    cityTitle: wikilinkTarget(fm[p.cityProperty]),
    website: readString(fm[p.websiteProperty]),
    image: readString(fm[p.imageProperty]),
    gallery: objectEntries4(fm[p.galleryProperty]).flatMap((entry) => {
      const image = readString(entry[p.galleryImageField]);
      return image ? [{ image, caption: readString(entry[p.galleryCaptionField]) }] : [];
    }),
    // Not `readStringList`: a highlight is a sentence, and "Oslo - die
    // schoene, historische Hauptstadt" is one of them rather than two.
    highlights: readTextLines(fm[p.highlightsProperty])
  };
}
function objectEntries4(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry) => typeof entry === "object" && entry !== null
  );
}

// packages/apertrail/src/vault/board-reader.ts
function travelNotesOfType(host, settings, folder, expectedType) {
  return travelNotesInFolders(host, settings, [folder], expectedType);
}
function travelNotesInFolders(host, settings, folders, expectedType) {
  return readNotesOfType(host, {
    folders,
    typePropertyName: settings.typePropertyName.trim() || "type",
    typeValue: expectedType
  });
}
function readBool2(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return caseFold(value) === "true";
  return false;
}
function readGeoLocation(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lat, lng] = value;
  if (typeof lat !== "string" && typeof lat !== "number" || typeof lng !== "string" && typeof lng !== "number")
    return null;
  return [String(lat), String(lng)];
}
function readTravelCountriesUnresolved(host, settings) {
  return travelNotesOfType(host, settings, settings.countriesFolder, "country").map(
    ({ file, title, frontmatter: fm }) => ({
      file,
      title,
      capitalTitle: wikilinkTarget(findValue(fm, settings.capitalProperty)),
      ...readNoteCover(fm, settings)
    })
  );
}
function readTravelStatesUnresolved(host, settings) {
  return travelNotesOfType(host, settings, settings.statesFolder, "state").map(
    ({ file, title, frontmatter: fm }) => ({
      file,
      title,
      countryTitle: wikilinkTarget(findValue(fm, settings.countryProperty)),
      capitalTitle: wikilinkTarget(findValue(fm, settings.capitalProperty)),
      ...readNoteCover(fm, settings)
    })
  );
}
function readTravelBookings(host, settings) {
  return travelNotesInFolders(host, settings, bookingReadFolders(settings), "booking").map(({ file, title, frontmatter: fm }) => ({
    file,
    title,
    ...parseBooking(fm, bookingProperties(settings))
  })).sort((a, b) => a.title.localeCompare(b.title));
}
function readTravelVehicles(host, settings) {
  const properties = vehicleProperties(settings);
  return travelNotesOfType(host, settings, settings.vehiclesFolder, "vehicle").map(({ file, title, frontmatter: fm }) => ({ file, title, ...parseVehicle(fm, properties) })).sort((a, b) => a.title.localeCompare(b.title));
}
function vehicleProperties(settings) {
  return {
    descriptionProperty: settings.descriptionProperty,
    modeProperty: settings.vehicleModeProperty,
    operatorProperty: settings.vehicleOperatorProperty,
    builtProperty: settings.vehicleBuiltProperty,
    refurbishedProperty: settings.vehicleRefurbishedProperty,
    capacityProperty: settings.vehicleCapacityProperty,
    lengthProperty: settings.vehicleLengthProperty,
    tonnageProperty: settings.vehicleTonnageProperty,
    websiteProperty: settings.websiteProperty,
    deckPlanProperty: settings.vehicleDeckPlanProperty,
    imageProperty: settings.imageProperty,
    galleryProperty: settings.tripGalleryProperty,
    highlightsProperty: settings.tripHighlightsProperty,
    galleryImageField: settings.galleryImageField,
    galleryCaptionField: settings.galleryCaptionField,
    cabinsProperty: settings.vehicleCabinsProperty,
    cabinNameField: settings.cabinNameField,
    cabinDescriptionField: settings.cabinDescriptionField,
    cabinImageField: settings.cabinImageField
  };
}
function readTravelExcursionsUnresolved(host, settings) {
  const properties = excursionProperties(settings);
  return travelNotesOfType(host, settings, settings.excursionsFolder, "excursion").map(
    ({ file, title, frontmatter: fm }) => ({ file, title, ...parseExcursion(fm, properties) })
  );
}
function excursionProperties(settings) {
  return {
    descriptionProperty: settings.descriptionProperty,
    operatorProperty: settings.excursionOperatorProperty,
    durationProperty: settings.excursionDurationProperty,
    codeProperty: settings.excursionCodeProperty,
    countryProperty: settings.countryProperty,
    cityProperty: settings.cityProperty,
    websiteProperty: settings.websiteProperty,
    imageProperty: settings.imageProperty,
    galleryProperty: settings.tripGalleryProperty,
    highlightsProperty: settings.tripHighlightsProperty,
    galleryImageField: settings.galleryImageField,
    galleryCaptionField: settings.galleryCaptionField
  };
}
function bookingProperties(settings) {
  return {
    tripProperty: settings.bookingTripProperty,
    categoryProperty: settings.bookingCategoryProperty,
    statusProperty: settings.bookingStatusProperty,
    supplierProperty: settings.bookingSupplierProperty,
    placeProperty: settings.bookingPlaceProperty,
    dateProperty: settings.bookingDateProperty,
    amountProperty: settings.bookingAmountProperty,
    currencyProperty: settings.bookingCurrencyProperty,
    referenceProperty: settings.bookingReferenceProperty,
    payerProperty: settings.bookingPayerProperty,
    forProperty: settings.bookingForProperty,
    documentProperty: settings.bookingDocumentProperty
  };
}
function readTravelCitiesUnresolved(host, settings) {
  return travelNotesOfType(host, settings, settings.citiesFolder, "city").map(
    ({ file, title, frontmatter: fm }) => ({
      file,
      title,
      countryTitle: wikilinkTarget(findValue(fm, settings.countryProperty)),
      stateTitle: wikilinkTarget(findValue(fm, settings.stateProperty)),
      // A city whose `state:` names itself is its own first-level division.
      // See TravelCity.cityState for why that spelling rather than a property
      // or a second note.
      cityState: caseFold(wikilinkTarget(findValue(fm, settings.stateProperty))) === caseFold(title),
      geoLocation: readGeoLocation(findValue(fm, settings.geoLocationProperty)),
      visited: readBool2(findValue(fm, settings.visitedProperty)),
      lastVisit: readDateLike(findValue(fm, settings.lastVisitProperty)),
      // Both overwritten by applyDerivedVisits() once trips are read --
      // these are the note's own claim, before any trip evidence is folded in.
      visitedFromTrips: false,
      tags: readStringList(findValue(fm, settings.tagsProperty)),
      ...readNoteCover(fm, settings)
    })
  );
}
function readTravelPlacesOfKindUnresolved(host, settings, kind) {
  const folder = settings[TRAVEL_PLACE_FOLDER_SETTING[kind]];
  return travelNotesOfType(host, settings, folder, kind).map(
    ({ file, title, frontmatter: fm }) => ({
      file,
      kind,
      title,
      countryTitle: wikilinkTarget(findValue(fm, settings.countryProperty)),
      cityTitle: wikilinkTarget(findValue(fm, settings.cityProperty)),
      geoLocation: readGeoLocation(findValue(fm, settings.geoLocationProperty)),
      visited: readBool2(findValue(fm, settings.visitedProperty)),
      lastVisit: readDateLike(findValue(fm, settings.lastVisitProperty)),
      visitedFromTrips: false,
      tags: readStringList(findValue(fm, settings.tagsProperty)),
      address: readString(findValue(fm, settings.addressProperty)),
      website: readString(findValue(fm, settings.websiteProperty)),
      rating: readNumberLike(findValue(fm, settings.ratingProperty)),
      accommodationType: kind === "accommodation" ? readString(findValue(fm, settings.accommodationTypeProperty)) : null,
      accommodationStatus: kind === "accommodation" ? readString(findValue(fm, settings.accommodationStatusProperty)) : null,
      fnbType: kind === "fnb" ? readString(findValue(fm, settings.fnbTypeProperty)) : null,
      photoSpot: kind === "photospot" ? parsePhotoSpotRecord({
        properties: photoSpotPropertyNames(settings),
        frontmatter: fm
      }) : null,
      ...readNoteCover(fm, settings)
    })
  );
}
function readTravelPlacesUnresolved(host, settings) {
  return TRAVEL_PLACE_TYPES.flatMap(
    (kind) => readTravelPlacesOfKindUnresolved(host, settings, kind)
  );
}
function tripPropertyNames(settings) {
  return {
    typePropertyName: settings.typePropertyName.trim() || "type",
    subtitleProperty: settings.tripSubtitleProperty,
    imageProperty: settings.imageProperty,
    highlightsProperty: settings.tripHighlightsProperty,
    galleryProperty: settings.tripGalleryProperty,
    galleryImageField: settings.galleryImageField,
    galleryCaptionField: settings.galleryCaptionField,
    countryProperty: settings.countryProperty,
    citiesProperty: settings.tripCitiesProperty,
    departureProperty: settings.departureProperty,
    returnProperty: settings.returnProperty,
    travelTypeProperty: settings.travelTypeProperty,
    travelStatusProperty: settings.travelStatusProperty,
    reviewStatusProperty: settings.reviewStatusProperty,
    ratingProperty: settings.ratingProperty,
    createdProperty: settings.createdProperty,
    modifiedProperty: settings.modifiedProperty,
    personsProperty: settings.personsProperty,
    extendsProperty: settings.tripExtendsProperty,
    stopsProperty: settings.stopsProperty,
    daysProperty: settings.tripDaysProperty,
    dayNumberField: settings.dayNumberField,
    dayTitleField: settings.dayTitleField,
    dayNoteField: settings.dayNoteField,
    stopDayField: settings.stopDayField,
    stopPlaceField: settings.stopPlaceField,
    stopFromField: settings.stopFromField,
    stopToField: settings.stopToField,
    stopNoteField: settings.stopNoteField,
    stopMotifField: settings.stopMotifField,
    stopExcursionField: settings.stopExcursionField,
    stopRatingField: settings.stopRatingField,
    stopCostField: settings.stopCostField,
    stopCurrencyField: settings.stopCurrencyField,
    stopCostUnitField: settings.stopCostUnitField,
    stopPersonsField: settings.stopPersonsField,
    nightsProperty: settings.nightsProperty,
    nightCheckInDayField: settings.nightCheckInDayField,
    nightCheckOutDayField: settings.nightCheckOutDayField,
    nightAccommodationField: settings.nightAccommodationField,
    nightCheckInField: settings.nightCheckInField,
    nightCheckOutField: settings.nightCheckOutField,
    nightCostField: settings.nightCostField,
    nightCurrencyField: settings.nightCurrencyField,
    nightCostUnitField: settings.nightCostUnitField,
    nightPersonsField: settings.nightPersonsField,
    transportProperty: settings.transportProperty,
    legDirectionField: settings.legDirectionField,
    legDayField: settings.legDayField,
    legToDayField: settings.legToDayField,
    legCarrierField: settings.legCarrierField,
    legNumberField: settings.legNumberField,
    legModeField: settings.legModeField,
    legFromField: settings.legFromField,
    legToField: settings.legToField,
    legReferenceField: settings.legReferenceField,
    legOriginField: settings.legOriginField,
    legDestinationField: settings.legDestinationField,
    legCostField: settings.legCostField,
    legCurrencyField: settings.legCurrencyField,
    legCostUnitField: settings.legCostUnitField,
    legPersonsField: settings.legPersonsField,
    legVehicleField: settings.legVehicleField,
    stopVariantsField: settings.stopVariantsField,
    nightVariantsField: settings.nightVariantsField,
    legVariantsField: settings.legVariantsField,
    variantNameField: settings.variantNameField,
    variantDescriptionField: settings.variantDescriptionField,
    variantCostField: settings.variantCostField,
    variantCurrencyField: settings.variantCurrencyField,
    variantCostUnitField: settings.variantCostUnitField,
    variantChosenField: settings.variantChosenField,
    legSegmentsField: settings.legSegmentsField,
    segmentCarrierField: settings.segmentCarrierField,
    segmentNumberField: settings.segmentNumberField,
    segmentOriginField: settings.segmentOriginField,
    segmentDestinationField: settings.segmentDestinationField,
    segmentFromField: settings.segmentFromField,
    segmentToField: settings.segmentToField,
    segmentDayField: settings.segmentDayField,
    segmentToDayField: settings.segmentToDayField,
    stopOptionalField: settings.stopOptionalField,
    nightOptionalField: settings.nightOptionalField,
    legOptionalField: settings.legOptionalField,
    stopChosenField: settings.stopChosenField,
    nightChosenField: settings.nightChosenField,
    legChosenField: settings.legChosenField,
    tripCurrencyProperty: settings.tripCurrencyProperty,
    budgetProperty: settings.budgetProperty,
    budgetCategoryField: settings.budgetCategoryField,
    budgetAmountField: settings.budgetAmountField,
    ratesProperty: settings.ratesProperty,
    rateCurrencyField: settings.rateCurrencyField,
    rateValueField: settings.rateValueField
  };
}
function readTravelTripsUnresolved(host, settings, today) {
  const properties = tripPropertyNames(settings);
  return travelNotesInFolders(host, settings, tripReadFolders(settings), "trip").map(
    ({ file, title, frontmatter }) => {
      const record = parseTripRecord({ properties, frontmatter });
      return {
        file,
        title,
        record,
        effectiveStatus: effectiveTravelStatus(record, today),
        archived: isArchivedTripPath(file.path, settings),
        archivedOn: readString(findValue(frontmatter, settings.archivedProperty))
      };
    }
  );
}
function resolveStop(stop, cityByTitle, placeByTitle, excursionByTitle) {
  const city = stop.placeTitle ? cityByTitle.get(caseFold(stop.placeTitle)) : void 0;
  const place = stop.placeTitle ? placeByTitle.get(caseFold(stop.placeTitle)) : void 0;
  const target = city ?? place ?? null;
  const targetKind = city ? "city" : place?.kind ?? null;
  const excursion = stop.excursionTitle ? excursionByTitle.get(caseFold(stop.excursionTitle)) ?? null : null;
  return { ...stop, target, targetKind, excursion };
}
function resolveNight(night, placeByTitle) {
  const place = night.accommodationTitle ? placeByTitle.get(caseFold(night.accommodationTitle)) : void 0;
  return { ...night, accommodation: place ?? null };
}
function indexByTitle(entities) {
  return new Map(entities.map((entity) => [caseFold(entity.title), entity]));
}
function byTitle(a, b) {
  return a.title.localeCompare(b.title);
}
function readTravelBoardFrom(host, settings, dayVisits, today = formatDayTitle(/* @__PURE__ */ new Date())) {
  const countries = readTravelCountriesUnresolved(host, settings).map((c) => ({
    ...c,
    capital: null,
    states: [],
    cities: []
  }));
  const states = readTravelStatesUnresolved(host, settings).map((s) => ({
    ...s,
    country: null,
    capital: null,
    cities: []
  }));
  const cities = readTravelCitiesUnresolved(host, settings).map((c) => ({
    ...c,
    country: null,
    state: null
  }));
  const countryByTitle = indexByTitle(countries);
  const stateByTitle = indexByTitle(states);
  const cityByTitle = indexByTitle(cities);
  for (const country of countries) {
    country.capital = country.capitalTitle ? cityByTitle.get(caseFold(country.capitalTitle)) ?? null : null;
  }
  for (const state of states) {
    state.country = state.countryTitle ? countryByTitle.get(caseFold(state.countryTitle)) ?? null : null;
    state.capital = state.capitalTitle ? cityByTitle.get(caseFold(state.capitalTitle)) ?? null : null;
  }
  for (const city of cities) {
    city.country = city.countryTitle ? countryByTitle.get(caseFold(city.countryTitle)) ?? null : null;
    city.state = city.stateTitle && !city.cityState ? stateByTitle.get(caseFold(city.stateTitle)) ?? null : null;
  }
  for (const state of states) {
    state.country?.states.push(state);
  }
  for (const city of cities) {
    city.state?.cities.push(city);
    city.country?.cities.push(city);
  }
  for (const country of countries) {
    country.states.sort(byTitle);
    country.cities.sort(byTitle);
  }
  for (const state of states) state.cities.sort(byTitle);
  const places = readTravelPlacesUnresolved(host, settings).map((p) => ({
    ...p,
    country: p.countryTitle ? countryByTitle.get(caseFold(p.countryTitle)) ?? null : null,
    city: p.cityTitle ? cityByTitle.get(caseFold(p.cityTitle)) ?? null : null
  }));
  const placeByTitle = indexByTitle(places);
  const excursions = readTravelExcursionsUnresolved(host, settings).map((e) => ({
    ...e,
    country: e.countryTitle ? countryByTitle.get(caseFold(e.countryTitle)) ?? null : null,
    city: e.cityTitle ? cityByTitle.get(caseFold(e.cityTitle)) ?? null : null
  })).sort((a, b) => a.title.localeCompare(b.title));
  const excursionByTitle = indexByTitle(excursions);
  const vehicles = readTravelVehicles(host, settings);
  const vehicleByTitle = indexByTitle(vehicles);
  const trips = readTravelTripsUnresolved(host, settings, today).map((t2) => ({
    file: t2.file,
    title: t2.title,
    subtitle: t2.record.subtitle,
    image: t2.record.image,
    highlights: t2.record.highlights,
    gallery: t2.record.gallery,
    countryTitle: t2.record.countryTitle,
    country: t2.record.countryTitle ? countryByTitle.get(caseFold(t2.record.countryTitle)) ?? null : null,
    cityTitles: t2.record.cityTitles,
    cities: t2.record.cityTitles.map((title) => cityByTitle.get(caseFold(title))).filter((c) => c !== void 0),
    departure: t2.record.departure,
    return: t2.record.return,
    currency: t2.record.currency,
    budget: t2.record.budget,
    rates: t2.record.rates,
    travelType: t2.record.travelType,
    travelStatus: t2.record.travelStatus,
    effectiveStatus: t2.effectiveStatus,
    archived: t2.archived,
    archivedOn: t2.archivedOn,
    reviewStatus: t2.record.reviewStatus,
    rating: t2.record.rating,
    personTitles: t2.record.personTitles,
    extendsTitle: t2.record.extendsTitle,
    // Both filled in by the extensions pass below, once every trip object
    // exists to point at. This is the trip's own claim before it is joined
    // up, the same shape the Country/State/City skeletons take.
    extendsTrip: null,
    extensions: [],
    days: t2.record.days,
    stops: t2.record.stops.map(
      (stop) => resolveStop(stop, cityByTitle, placeByTitle, excursionByTitle)
    ),
    nights: t2.record.nights.map((night) => resolveNight(night, placeByTitle)),
    transport: t2.record.transport.map((leg) => ({
      ...leg,
      vehicle: leg.vehicleTitle ? vehicleByTitle.get(caseFold(leg.vehicleTitle)) ?? null : null
    }))
  }));
  const tripByTitle = indexByTitle(trips);
  for (const trip of trips) {
    if (!trip.extendsTitle || trip.extendsTitle === trip.title) continue;
    const parent = tripByTitle.get(caseFold(trip.extendsTitle));
    if (!parent) continue;
    trip.extendsTrip = parent;
    parent.extensions.push(trip);
  }
  for (const trip of trips) {
    trip.extensions.sort((a, b) => (a.departure ?? "").localeCompare(b.departure ?? ""));
  }
  applyDerivedVisits(cities, places, trips, dayVisits);
  return {
    trips: trips.sort((a, b) => a.title.localeCompare(b.title)),
    vehicles,
    excursions,
    bookings: readTravelBookings(host, settings),
    countries: countries.sort((a, b) => a.title.localeCompare(b.title)),
    states: states.sort((a, b) => a.title.localeCompare(b.title)),
    cities: cities.sort((a, b) => a.title.localeCompare(b.title)),
    places: places.sort((a, b) => a.title.localeCompare(b.title))
  };
}

// packages/apertrail/src/crm/entity-types.ts
var CRM_FOLDER_SETTING = {
  person: "personsFolder",
  company: "companiesFolder"
};

// packages/apertrail/src/crm/crm-note.ts
function crmPropertyNames(settings) {
  return {
    // A blank property NAME is a cleared field rather than a decision, so it
    // falls back to the literal. A blank type VALUE is a decision, and means
    // "match nothing", so it does not.
    typePropertyName: settings.typePropertyName.trim() || "type",
    personTypeValue: settings.personTypeValue.trim(),
    companyTypeValue: settings.companyTypeValue.trim(),
    personTagProperty: settings.personTagProperty.trim() || "tags",
    companyTagProperty: settings.companyTagProperty.trim() || "tags",
    descriptionProperty: settings.descriptionProperty,
    addressProperty: settings.addressProperty,
    websiteProperty: settings.websiteProperty,
    emailProperty: settings.emailProperty,
    phoneProperty: settings.phoneProperty,
    mobileProperty: settings.mobileProperty,
    personRolesProperty: settings.personRolesProperty,
    companyRolesProperty: settings.companyRolesProperty
  };
}
function fields(frontmatter, properties, kind) {
  return parseCrmNote(frontmatter, properties, kind);
}
function parsePersonRecord(frontmatter, properties) {
  const { description, tags, roles, address, email, mobile } = fields(
    frontmatter,
    properties,
    "person"
  );
  return { description, tags, roles, address, email, mobile };
}
function parseCompanyRecord(frontmatter, properties) {
  const { description, tags, roles, address, website, email, phone } = fields(
    frontmatter,
    properties,
    "company"
  );
  return { description, tags, roles, address, website, email, phone };
}

// packages/apertrail/src/crm/crm-reader.ts
function crmNotesOfKind(host, settings, properties, kind) {
  return readNotesOfType(host, {
    folders: [settings[CRM_FOLDER_SETTING[kind]]],
    typePropertyName: properties.typePropertyName,
    typeValue: crmTypeValue(properties, kind)
  });
}
function readCrmBoardFrom(host, settings) {
  const properties = crmPropertyNames(settings);
  const persons = crmNotesOfKind(host, settings, properties, "person").map(
    ({ file, title, frontmatter }) => ({
      file,
      title,
      ...parsePersonRecord(frontmatter, properties)
    })
  );
  const companies = crmNotesOfKind(host, settings, properties, "company").map(
    ({ file, title, frontmatter }) => ({
      file,
      title,
      ...parseCompanyRecord(frontmatter, properties)
    })
  );
  return {
    persons: persons.sort((a, b) => a.title.localeCompare(b.title)),
    companies: companies.sort((a, b) => a.title.localeCompare(b.title))
  };
}

// packages/apertrail/src/interchange/sections.ts
function apertrailFamilies(host, settings, dayVisits, today) {
  const board = readTravelBoardFrom(host, settings, dayVisits, today);
  const crm = readCrmBoardFrom(host, settings);
  return {
    trip: familyEntries(board.trips),
    booking: familyEntries(board.bookings),
    country: familyEntries(board.countries),
    state: familyEntries(board.states),
    city: familyEntries(board.cities),
    place: familyEntries(board.places),
    vehicle: familyEntries(board.vehicles),
    excursion: familyEntries(board.excursions),
    person: familyEntries(crm.persons),
    company: familyEntries(crm.companies)
  };
}

// packages/apertrail/scripts/interchange/fs-host.ts
var import_yaml = __toESM(require_dist());
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
function refuse() {
  throw new Error("The interchange export does not write to the vault.");
}
function diskVault(root) {
  const diskPath = /* @__PURE__ */ new Map();
  const folders = /* @__PURE__ */ new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      const vaultPath = relative(root, full).split(sep).join("/").normalize("NFC");
      if (statSync(full).isDirectory()) {
        folders.add(vaultPath);
        walk(full);
      } else if (entry.endsWith(".md")) {
        diskPath.set(vaultPath, full);
      }
    }
  };
  walk(root);
  const text = (path) => readFileSync(diskPath.get(path) ?? "", "utf8");
  const fileAt = (path) => ({
    path,
    basename: (path.split("/").pop() ?? path).replace(/\.md$/, "")
  });
  const frontmatter = /* @__PURE__ */ new Map();
  const unparsable = [];
  for (const path of diskPath.keys()) {
    const { header } = splitFrontmatterBlock(text(path));
    if (!header) continue;
    try {
      const parsed = (0, import_yaml.parse)(header.split("\n").slice(1, -2).join("\n"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        frontmatter.set(path, parsed);
      }
    } catch {
      unparsable.push(path);
    }
  }
  const host = {
    vault: {
      read: (file) => Promise.resolve(text(file.path)),
      create: refuse,
      modify: refuse,
      append: refuse,
      createFolder: refuse,
      getFile: (path) => diskPath.has(path) ? fileAt(path) : null,
      exists: (path) => diskPath.has(path) || folders.has(path),
      markdownFiles: () => [...diskPath.keys()].map(fileAt)
    },
    metadata: { frontmatterOf: (file) => frontmatter.get(file.path) ?? null },
    frontmatter: { process: refuse }
  };
  return { host, unparsable, folders };
}

// packages/apertrail/scripts/interchange/link-index.ts
var LINK = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
async function dayVisitsOnDisk(host) {
  const files = [...host.vault.markdownFiles()].sort((a, b) => a.path < b.path ? -1 : 1);
  const byTitle2 = /* @__PURE__ */ new Map();
  for (const file of files) {
    const key = caseFold(file.basename);
    if (!byTitle2.has(key)) byTitle2.set(key, file.path);
  }
  const resolve2 = (target) => {
    const clean = target.trim().replace(/\.md$/, "");
    if (!clean.includes("/")) return byTitle2.get(caseFold(clean)) ?? null;
    const suffix = `/${caseFold(clean)}.md`;
    const found = files.find((file) => caseFold(`/${file.path}`).endsWith(suffix));
    return found?.path ?? null;
  };
  const visits = /* @__PURE__ */ new Map();
  for (const file of files) {
    if (detectPeriodLevel(file.basename) !== "day") continue;
    const text = await host.vault.read(file);
    const targets = /* @__PURE__ */ new Set();
    for (const match of text.matchAll(LINK)) {
      const path = resolve2(match[1]);
      if (path && path !== file.path) targets.add(path);
    }
    for (const path of targets) visits.set(path, [...visits.get(path) ?? [], file.basename]);
  }
  return visits;
}

// packages/apertrail/scripts/interchange/cli.ts
import {
  existsSync,
  mkdirSync,
  readFileSync as readFileSync2,
  readdirSync as readdirSync2,
  realpathSync,
  writeFileSync
} from "node:fs";
import { join as join2, relative as relative2, resolve, isAbsolute } from "node:path";
function exportArgs(argv, usage) {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  if (positional.length !== 2) {
    process.stderr.write(`${usage}
`);
    process.exit(2);
  }
  const vault = realpathSync(resolve(positional[0]));
  const out = resolve(positional[1]);
  const inside = relative2(vault, out);
  if (inside === "" || !inside.startsWith("..") && !isAbsolute(inside)) {
    process.stderr.write(`Refusing to write into the vault: ${out}
`);
    process.exit(2);
  }
  mkdirSync(out, { recursive: true });
  return { vault, out, flags };
}
function savedSettings(vault, pluginId) {
  for (const entry of readdirSync2(vault, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(".")) continue;
    const candidate = join2(vault, entry.name, "plugins", pluginId, "data.json");
    if (existsSync(candidate)) return JSON.parse(readFileSync2(candidate, "utf8"));
  }
  return {};
}
function missingFolders(settings, folders) {
  return Object.entries(settings).filter(
    ([key, value]) => key.endsWith("Folder") && !/.ArchiveFolder$/.test(key) && typeof value === "string"
  ).map(([key, value]) => [key, value.trim().replace(/^\/+|\/+$/g, "")]).filter(([, folder]) => folder !== "" && !folders.has(folder.normalize("NFC"))).map(([key, folder]) => `${key} = ${folder}`);
}
function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}
`, "utf8");
}
function sourceVersion() {
  return process.env.TRAIL_SOURCE_VERSION ?? "unknown";
}

// packages/apertrail/scripts/interchange/export.ts
var USAGE = "npm run interchange -- <vault> <out>";
async function main() {
  const { vault, out } = exportArgs(process.argv.slice(2), USAGE);
  const disk = diskVault(vault);
  const settings = mergeSettings(savedSettings(vault, "apertrail"));
  const now = /* @__PURE__ */ new Date();
  const meta = { sourceVersion: sourceVersion(), generatedAt: now.toISOString() };
  for (const line of missingFolders(settings, disk.folders)) {
    process.stderr.write(`apertrail: folder not in vault: ${line}
`);
  }
  for (const path of disk.unparsable) {
    process.stderr.write(`apertrail: frontmatter does not parse, read as none: ${path}
`);
  }
  const families = apertrailFamilies(
    disk.host,
    settings,
    await dayVisitsOnDisk(disk.host),
    formatDayTitle(now)
  );
  writeJson(join3(out, "apertrail.json"), sectionFile("apertrail", meta, families));
  process.stdout.write(
    `apertrail: ${Object.entries(families).map(([family, entries]) => `${entries.length} ${family}`).join(", ")}
`
  );
}
main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : JSON.stringify(error);
  process.stderr.write(`${message}
`);
  process.exit(1);
});
