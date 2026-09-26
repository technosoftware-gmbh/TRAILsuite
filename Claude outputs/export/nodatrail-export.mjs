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
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
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
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
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
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
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
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
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
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
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
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
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
        ctx.indentAtStart = str.length + 1;
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
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
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
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
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
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
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
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
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
      resolve: (str) => str,
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
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
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
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
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
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
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
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
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
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
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
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
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
        resolve: (str) => str,
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
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
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
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
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
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
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
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
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
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
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
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
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
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
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
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
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
      resolve(str) {
        const match = str.match(timestamp.test);
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
    var bool = require_bool2();
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
      bool.trueTag,
      bool.falseTag,
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
    var bool = require_bool();
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
      bool: bool.boolTag,
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
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
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

// packages/nodatrail/scripts/interchange/export.ts
import { readdirSync as readdirSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join3 } from "node:path";

// packages/core/dist/dates/day.js
function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}
function formatDayTitle(date = /* @__PURE__ */ new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
var DAY_TITLE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseDayTitle(title) {
  const match = DAY_TITLE.exec(title.trim());
  if (!match)
    return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// packages/core/dist/text/case-fold.js
function caseFold(value) {
  if (!value)
    return "";
  return value.normalize("NFC").trim().toLowerCase();
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
function readStringList(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((entry2) => typeof entry2 === "string" ? entry2.split(",") : []).map((entry2) => entry2.trim()).filter((entry2) => entry2 !== "");
}
function readPathList(value) {
  return wholeEntries(value);
}
function wholeEntries(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry2) => typeof entry2 === "string" ? entry2.trim() : "").filter((entry2) => entry2 !== "");
}

// packages/core/dist/dates/iso-week.js
function startOfIsoWeek(date) {
  const result = startOfDay(date);
  const isoDayIndex = (result.getDay() + 6) % 7;
  return addDays(result, -isoDayIndex);
}
function isoWeekOf(date) {
  const thursday = addDays(startOfIsoWeek(date), 3);
  const firstThursday = addDays(startOfIsoWeek(new Date(thursday.getFullYear(), 0, 4)), 3);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1e3));
  return { weekYear: thursday.getFullYear(), week };
}
var WEEK_TITLE = /^(\d{4})-W(\d{1,2})$/;
function parseWeekTitle(title) {
  const match = WEEK_TITLE.exec(title.trim());
  if (!match)
    return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53)
    return null;
  return { weekYear: Number(match[1]), week };
}
function startOfWeekTitle(title) {
  const parsed = parseWeekTitle(title);
  if (!parsed)
    return null;
  const week1Monday = startOfIsoWeek(new Date(parsed.weekYear, 0, 4));
  return addDays(week1Monday, (parsed.week - 1) * 7);
}

// packages/core/dist/dates/periods.js
var MONTH_TITLE = /^(\d{4})-(\d{2})$/;
function parseMonthTitle(title) {
  const match = MONTH_TITLE.exec(title.trim());
  if (!match)
    return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return Number.isNaN(date.getTime()) ? null : date;
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
var QUARTER_TITLE = /^(\d{4})-Q([1-4])$/;
function parseQuarterTitle(title) {
  const match = QUARTER_TITLE.exec(title.trim());
  if (!match)
    return null;
  const date = new Date(Number(match[1]), (Number(match[2]) - 1) * 3, 1);
  return Number.isNaN(date.getTime()) ? null : date;
}
function startOfQuarter(date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}
function endOfQuarter(date) {
  const start = startOfQuarter(date);
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}
var YEAR_TITLE = /^(\d{4})$/;
function parseYearTitle(title) {
  const match = YEAR_TITLE.exec(title.trim());
  if (!match)
    return null;
  const date = new Date(Number(match[1]), 0, 1);
  return Number.isNaN(date.getTime()) ? null : date;
}
function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}
function endOfYear(date) {
  return new Date(date.getFullYear(), 11, 31);
}

// packages/core/dist/dates/read.js
function readIsoDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDayTitle(value);
  }
  if (typeof value !== "string")
    return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] ?? null : null;
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
function linkOrText(raw) {
  if (typeof raw !== "string")
    return null;
  const target = stripWikilink(raw);
  return target === "" ? null : target;
}

// packages/core/dist/expense/types.js
var PURCHASE_STATUSES = ["ordered", "delivered", "returned", "cancelled"];
var BILL_STATUSES = ["open", "due", "overdue", "paid", "cancelled"];
var RECURRING_CADENCES = [
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "once"
];
var RECURRING_STATUSES = ["active", "paused", "ended"];
function isPurchaseStatus(value) {
  return typeof value === "string" && PURCHASE_STATUSES.includes(value.trim());
}
function isBillStatus(value) {
  return typeof value === "string" && BILL_STATUSES.includes(value.trim());
}
function isRecurringCadence(value) {
  return typeof value === "string" && RECURRING_CADENCES.includes(value.trim());
}
function isRecurringStatus(value) {
  return typeof value === "string" && RECURRING_STATUSES.includes(value.trim());
}

// packages/core/dist/money/format.js
function roundCents(amount) {
  return Math.round(amount * 100) / 100;
}
function normalizeCurrency(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

// packages/core/dist/expense/purchase-delivery.js
function readDelivery(entry2, p) {
  if (typeof entry2 !== "object" || entry2 === null)
    return null;
  const row = entry2;
  const rawItems = row[p.deliveryItemsField];
  return {
    date: readIsoDate(row[p.deliveryDateField]),
    items: Array.isArray(rawItems) ? rawItems.map((item) => readDeliveredLine(item, p)).filter((line) => line !== null) : [],
    note: readString(row[p.deliveryNoteField])
  };
}
function readDeliveredLine(entry2, p) {
  if (typeof entry2 === "string") {
    const name2 = entry2.trim();
    return name2 ? { name: name2, quantity: 1 } : null;
  }
  if (typeof entry2 !== "object" || entry2 === null)
    return null;
  const row = entry2;
  const name = linkOrText(row[p.deliveryItemNameField])?.trim();
  if (!name)
    return null;
  const quantity = readNumberLike(row[p.deliveryItemQuantityField]);
  return { name, quantity: quantity === null ? 1 : Math.max(1, Math.round(quantity)) };
}
function readPurchaseDeliveries(frontmatter, p) {
  const raw = frontmatter[p.deliveriesProperty];
  if (!Array.isArray(raw))
    return [];
  return raw.map((entry2) => readDelivery(entry2, p)).filter((delivery) => delivery !== null);
}

// packages/core/dist/expense/purchase.js
function parsePurchaseFilenameStem(stem) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:-(.+))?$/.exec(stem.trim());
  const date = match?.[1];
  if (!date)
    return null;
  return { date, reference: match?.[2] ?? "" };
}
function readLine(entry2, properties) {
  if (typeof entry2 === "string") {
    const name2 = entry2.trim();
    return name2 ? { name: name2, price: null, quantity: 1, discount: null, note: null } : null;
  }
  if (typeof entry2 !== "object" || entry2 === null)
    return null;
  const record = entry2;
  const name = readString(record[properties.itemNameField]);
  if (!name)
    return null;
  return {
    name,
    price: readNumberLike(record[properties.itemPriceField]),
    // Floored at 1: a line with a quantity of zero is a line nobody bought, and
    // reading it as free would understate the total rather than say so.
    quantity: Math.max(1, Math.round(readNumberLike(record[properties.itemQuantityField]) ?? 1)),
    discount: readNumberLike(record[properties.itemDiscountField]),
    note: readString(record[properties.itemNoteField])
  };
}
function parsePurchase(input) {
  const { frontmatter, properties: p } = input;
  const fromFilename = parsePurchaseFilenameStem(input.stem);
  const rawStatus = readString(frontmatter[p.statusProperty]);
  const rawItems = frontmatter[p.itemsProperty];
  return {
    // The property wins, so a note named the new way is read correctly and one
    // named the old way still gives up its reference.
    reference: readString(frontmatter[p.referenceProperty]) ?? fromFilename?.reference ?? "",
    companyTitle: linkOrText(frontmatter[p.companyProperty]),
    areaTitle: linkOrText(frontmatter[p.areaProperty]),
    projectTitle: linkOrText(frontmatter[p.projectProperty]),
    category: readString(frontmatter[p.categoryProperty]),
    status: isPurchaseStatus(rawStatus) ? rawStatus.trim() : "ordered",
    date: readIsoDate(frontmatter[p.dateProperty]) ?? fromFilename?.date ?? null,
    deliveryDate: readIsoDate(frontmatter[p.deliveryDateProperty]),
    amount: readNumberLike(frontmatter[p.amountProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    discount: readNumberLike(frontmatter[p.discountProperty]),
    shipping: readNumberLike(frontmatter[p.shippingProperty]),
    vatRate: readNumberLike(frontmatter[p.vatRateProperty]),
    vatAmount: readNumberLike(frontmatter[p.vatAmountProperty]),
    items: Array.isArray(rawItems) ? rawItems.map((entry2) => readLine(entry2, p)).filter((line) => line !== null) : [],
    deliveries: readPurchaseDeliveries(frontmatter, p),
    documentPaths: readPathList(frontmatter[p.documentProperty]),
    billTitle: linkOrText(frontmatter[p.billProperty])
  };
}

// packages/core/dist/expense/bill.js
function readBillDirection(value) {
  return value === "outgoing" ? "outgoing" : "incoming";
}
function parseBill(frontmatter, properties) {
  const p = properties;
  const rawStatus = readString(frontmatter[p.statusProperty]);
  return {
    companyTitle: linkOrText(frontmatter[p.companyProperty]),
    areaTitle: linkOrText(frontmatter[p.areaProperty]),
    category: readString(frontmatter[p.categoryProperty]),
    amount: readNumberLike(frontmatter[p.amountProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    issueDate: readIsoDate(frontmatter[p.issueDateProperty]),
    dueDate: readIsoDate(frontmatter[p.dueDateProperty]),
    paidDate: readIsoDate(frontmatter[p.paidDateProperty]),
    reference: readString(frontmatter[p.referenceProperty]),
    documentPaths: readPathList(frontmatter[p.documentProperty]),
    direction: readBillDirection(frontmatter[p.directionProperty]),
    recurringTitle: linkOrText(frontmatter[p.recurringProperty]),
    purchaseTitle: linkOrText(frontmatter[p.purchaseProperty]),
    account: readNumberLike(frontmatter[p.accountProperty]),
    lines: readBillLines(frontmatter[p.linesProperty], p),
    paidFrom: readNumberLike(frontmatter[p.paidFromProperty]),
    statedStatus: isBillStatus(rawStatus) ? rawStatus.trim() : null
  };
}
function readBillLines(raw, p) {
  if (!Array.isArray(raw))
    return [];
  const lines = [];
  for (const entry2 of raw) {
    if (typeof entry2 !== "object" || entry2 === null)
      continue;
    const record = entry2;
    const account = readNumberLike(record[p.lineAccountField]);
    if (account === null)
      continue;
    lines.push({
      account,
      amount: roundCents(readNumberLike(record[p.lineAmountField]) ?? 0),
      note: readString(record[p.lineNoteField]) ?? ""
    });
  }
  return lines;
}

// packages/core/dist/expense/recurring.js
function parseRecurring(frontmatter, properties) {
  const p = properties;
  const rawCadence = readString(frontmatter[p.cadenceProperty]);
  const rawStatus = readString(frontmatter[p.statusProperty]);
  return {
    companyTitle: linkOrText(frontmatter[p.companyProperty]),
    areaTitle: linkOrText(frontmatter[p.areaProperty]),
    category: readString(frontmatter[p.categoryProperty]),
    amount: readNumberLike(frontmatter[p.amountProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    cadence: isRecurringCadence(rawCadence) ? rawCadence.trim() : "monthly",
    interval: Math.max(1, Math.round(readNumberLike(frontmatter[p.intervalProperty]) ?? 1)),
    startDate: readIsoDate(frontmatter[p.startDateProperty]),
    endDate: readIsoDate(frontmatter[p.endDateProperty]),
    status: isRecurringStatus(rawStatus) ? rawStatus.trim() : "active",
    documentPaths: readPathList(frontmatter[p.documentProperty]),
    account: readNumberLike(frontmatter[p.accountProperty]),
    reference: readString(frontmatter[p.referenceProperty])
  };
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
var VAULT_SOURCE = "vault";

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
  for (const [key, field] of Object.entries(object)) {
    if (depth === 0 && key === "file")
      continue;
    const converted = plain(field, depth + 1);
    if (converted !== void 0)
      out[key] = converted;
  }
  return out;
}
function toInterchangeRecord(record) {
  return plain(record, 0);
}

// packages/core/dist/interchange/manifest.js
async function readRawNote(host, file) {
  const text = await host.vault.read(file);
  return {
    path: file.path,
    title: file.basename,
    frontmatter: host.metadata.frontmatterOf(file),
    body: splitFrontmatterBlock(text).body
  };
}
async function vaultManifest(host, meta) {
  const files = [...host.vault.markdownFiles()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const notes = [];
  for (const file of files)
    notes.push(await readRawNote(host, file));
  return {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    source: VAULT_SOURCE,
    sourceVersion: meta.sourceVersion,
    generatedAt: meta.generatedAt,
    notes
  };
}

// packages/core/dist/interchange/section.js
function familyEntries(records2) {
  return records2.map((record) => ({ path: record.file.path, record: toInterchangeRecord(record) })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function lineEntries(records2) {
  return records2.map((record) => ({
    path: record.file.path,
    line: record.line,
    record: toInterchangeRecord(record)
  })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line);
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

// packages/core/dist/interchange/report.js
function refsIn(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value)
      refsIn(item, found);
  } else if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    const ref = value.ref;
    if (keys.length === 1 && typeof ref === "string")
      found.push(ref);
    else
      for (const field of Object.values(value))
        refsIn(field, found);
  }
  return found;
}
function folderOf(path) {
  const parts = path.split("/");
  return parts.length <= 1 ? "(vault root)" : parts.slice(0, Math.min(2, parts.length - 1)).join("/");
}
function interchangeReport(manifest, sections) {
  const inVault = new Set(manifest.notes.map((note) => note.path));
  const claims = /* @__PURE__ */ new Map();
  const report = {
    notes: manifest.notes.length,
    families: [],
    lines: [],
    unrecognised: [],
    unrecognisedByFolder: [],
    claimedTwice: [],
    missingFromVault: [],
    danglingRefs: []
  };
  for (const section of sections) {
    for (const [family, entries] of Object.entries(section.families)) {
      const by = `${section.source}/${family}`;
      report.families.push({ source: section.source, family, count: entries.length });
      for (const entry2 of entries) {
        claims.set(entry2.path, [...claims.get(entry2.path) ?? [], by]);
        if (!inVault.has(entry2.path))
          report.missingFromVault.push({ path: entry2.path, by });
        for (const ref of refsIn(entry2.record)) {
          if (!inVault.has(ref))
            report.danglingRefs.push({ from: entry2.path, ref });
        }
      }
    }
  }
  for (const section of sections) {
    for (const [family, entries] of Object.entries(section.lines ?? {})) {
      const by = `${section.source}/${family}`;
      report.lines.push({ source: section.source, family, count: entries.length });
      for (const entry2 of entries) {
        if (!inVault.has(entry2.path))
          report.missingFromVault.push({ path: entry2.path, by });
        for (const ref of refsIn(entry2.record)) {
          if (!inVault.has(ref))
            report.danglingRefs.push({ from: entry2.path, ref });
        }
      }
    }
  }
  const folders = /* @__PURE__ */ new Map();
  for (const note of manifest.notes) {
    const by = claims.get(note.path);
    if (!by) {
      report.unrecognised.push(note.path);
      folders.set(folderOf(note.path), (folders.get(folderOf(note.path)) ?? 0) + 1);
    } else if (by.length > 1) {
      report.claimedTwice.push({ path: note.path, by });
    }
  }
  report.unrecognisedByFolder = [...folders].map(([folder, count]) => ({ folder, count })).sort((a, b) => b.count - a.count || (a.folder < b.folder ? -1 : 1));
  return report;
}
function formatInterchangeReport(report) {
  const claimed = report.notes - report.unrecognised.length;
  const lines = [
    "# Interchange export",
    "",
    `${report.notes} notes in the vault: ${claimed} recognised, ${report.unrecognised.length} carried raw only.`,
    "",
    "| Source | Family | Records |",
    "| --- | --- | --- |",
    ...report.families.map((row) => `| ${row.source} | ${row.family} | ${row.count} |`),
    ""
  ];
  if (report.lines.length > 0) {
    lines.push("## Lines inside notes", "", "| Source | Family | Lines |", "| --- | --- | --- |", ...report.lines.map((row) => `| ${row.source} | ${row.family} | ${row.count} |`), "");
  }
  lines.push("## Carried raw only, by folder", "", "| Folder | Notes |", "| --- | --- |", ...report.unrecognisedByFolder.map((row) => `| ${row.folder} | ${row.count} |`), "", "## Checks", "", `- Notes claimed by two families: ${report.claimedTwice.length}`, `- Records for a note the vault does not hold: ${report.missingFromVault.length}`, `- References to a note the vault does not hold: ${report.danglingRefs.length}`);
  const problems = [
    ...report.claimedTwice.map((row) => `- claimed twice: ${row.path} (${row.by.join(", ")})`),
    ...report.missingFromVault.map((row) => `- not in vault: ${row.path} (${row.by})`),
    ...report.danglingRefs.map((row) => `- dangling: ${row.from} -> ${row.ref}`)
  ];
  if (problems.length > 0)
    lines.push("", "## Details", "", ...problems);
  return `${lines.join("\n")}
`;
}

// packages/core/dist/ledger/types.js
var ACCOUNT_KINDS = ["asset", "liability", "income", "expense"];
function isAccountKind(value) {
  return typeof value === "string" && ACCOUNT_KINDS.includes(value);
}

// packages/core/dist/ledger/account.js
var DEFAULT_NUMBER_RANGES = [
  { from: 1e3, to: 1999, kind: "asset" },
  { from: 2e3, to: 2999, kind: "liability" },
  { from: 3e3, to: 3999, kind: "income" },
  { from: 4e3, to: 5999, kind: "expense" }
];
function kindForNumber(value, ranges = DEFAULT_NUMBER_RANGES) {
  for (const range of ranges) {
    if (value >= range.from && value <= range.to)
      return range.kind;
  }
  return null;
}
function parseAccount(frontmatter, title, properties, ranges = DEFAULT_NUMBER_RANGES) {
  const p = properties;
  const number = readNumberLike(frontmatter[p.numberProperty]);
  if (number === null)
    return null;
  const statedKind = readString(frontmatter[p.kindProperty]);
  const kind = isAccountKind(statedKind) ? statedKind : kindForNumber(number, ranges) ?? "expense";
  return {
    number,
    title,
    kind,
    group: (readString(frontmatter[p.groupProperty]) ?? "").trim().replace(/^\/+|\/+$/g, ""),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    opening: readNumberLike(frontmatter[p.openingProperty]) ?? 0,
    openingDate: readIsoDate(frontmatter[p.openingDateProperty]),
    closed: readIsoDate(frontmatter[p.closedProperty]),
    iban: normalizeIban(readString(frontmatter[p.ibanProperty])),
    bankAccount: normalizeBankAccount(readString(frontmatter[p.bankAccountProperty])),
    personTitle: linkOrText(frontmatter[p.personProperty])
  };
}
function normalizeIban(value) {
  const stripped = (value ?? "").replace(/[\s-]/g, "").toUpperCase();
  return stripped === "" ? null : stripped;
}
function normalizeBankAccount(value) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits === "" ? null : digits;
}

// packages/core/dist/ledger/journal.js
var JOURNAL_LANGUAGE = "noda-journal";
var FIELD_SEPARATOR = "|";
var DAY = /^\d{4}-\d{2}-\d{2}$/;
function extractJournalBlocks(markdown, language = JOURNAL_LANGUAGE) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let open = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fence = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)\s*$/.exec(line);
    if (open) {
      if (fence && fence[1] && fence[1][0] === open.fence[0] && fence[1].length >= open.fence.length && !fence[2]) {
        blocks.push({ source: open.body.join("\n"), fenceLine: open.fenceLine });
        open = null;
      } else {
        open.body.push(line);
      }
      continue;
    }
    if (fence && fence[2]?.toLowerCase() === language.toLowerCase()) {
      open = { fenceLine: index, fence: fence[1] ?? "```", body: [] };
    }
  }
  if (open)
    blocks.push({ source: open.body.join("\n"), fenceLine: open.fenceLine });
  return blocks;
}
function parseAmount(text) {
  const sides = text.split("=");
  const near = parseOneAmount(sides[0] ?? "");
  if (!near)
    return null;
  const far = sides.length > 1 ? parseOneAmount(sides[1] ?? "") : null;
  return {
    amount: near.value,
    currency: near.currency,
    counterAmount: far ? far.value : null,
    counterCurrency: far ? far.currency : null
  };
}
function parseOneAmount(text) {
  const trimmed = text.trim();
  if (!trimmed)
    return null;
  const currency = /([A-Za-z]{3})/.exec(trimmed);
  const figure = trimmed.replace(/[A-Za-z]/g, "").replace(/['’\s]/g, "").trim();
  if (!figure)
    return null;
  let normalized = figure;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastComma > lastDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized))
    return null;
  return {
    value: roundCents(Number(normalized)),
    currency: currency?.[1] ? currency[1].toUpperCase() : null
  };
}
function parseJournal(source, lineOffset = 0) {
  const postings = [];
  const problems = [];
  const rows = readRows(source, lineOffset);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row)
      continue;
    if (row.indented) {
      problems.push({ line: row.line, raw: row.raw, reason: "orphan-continuation" });
      continue;
    }
    const legs = [];
    while (rows[index + 1]?.indented) {
      const next = rows[index + 1];
      if (next)
        legs.push(next);
      index += 1;
    }
    readPosting(row, legs, postings, problems);
  }
  return { postings, problems };
}
function readRows(source, lineOffset) {
  const rows = [];
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//"))
      continue;
    rows.push({
      line: lineOffset + index + 1,
      raw,
      indented: /^\s/.test(raw),
      fields: trimmed.split(FIELD_SEPARATOR).map((field) => field.trim())
    });
  }
  return rows;
}
function readPosting(header, legs, postings, problems) {
  const [date, debitText, creditText, amountText, text, reference, importKey] = header.fields;
  if (!date || !DAY.test(date) || !isRealDay(date)) {
    problems.push({ line: header.line, raw: header.raw, reason: "no-date" });
    return;
  }
  const money = parseAmount(amountText ?? "");
  if (!money) {
    problems.push({ line: header.line, raw: header.raw, reason: "no-amount" });
    return;
  }
  const debit = readAccountNumber(debitText);
  const credit = readAccountNumber(creditText);
  if (debit === null && credit === null) {
    problems.push({ line: header.line, raw: header.raw, reason: "no-accounts" });
    return;
  }
  const description = (text ?? "").trim();
  const shared = {
    date,
    currency: money.currency,
    reference: (reference ?? "").trim() || null,
    importKey: (importKey ?? "").trim() || null,
    counterAmount: money.counterAmount,
    counterCurrency: money.counterCurrency
  };
  if (legs.length === 0) {
    if (debit === null || credit === null) {
      problems.push({ line: header.line, raw: header.raw, reason: "no-accounts" });
      return;
    }
    postings.push({
      ...shared,
      debit,
      credit,
      amount: money.amount,
      text: description,
      line: header.line,
      entryLine: header.line,
      splitOf: null
    });
    return;
  }
  const parts = [];
  for (const leg of legs) {
    const [accountText, legAmountText, legText] = leg.fields;
    const account = readAccountNumber(accountText);
    const legMoney = parseAmount(legAmountText ?? "");
    if (account === null || !legMoney) {
      problems.push({ line: leg.line, raw: leg.raw, reason: "unreadable" });
      continue;
    }
    parts.push({ row: leg, account, amount: legMoney.amount, text: (legText ?? "").trim() });
  }
  const total = roundCents(parts.reduce((sum, part) => sum + part.amount, 0));
  if (total !== money.amount) {
    problems.push({
      line: header.line,
      raw: header.raw,
      reason: "split-does-not-sum",
      difference: roundCents(money.amount - total)
    });
    return;
  }
  for (const part of parts) {
    postings.push({
      ...shared,
      debit: debit ?? part.account,
      credit: credit ?? part.account,
      amount: part.amount,
      text: part.text || description,
      line: part.row.line,
      // Every leg points at the header, which is what makes them one entry
      // however the header was described, or whether it was described at all.
      entryLine: header.line,
      splitOf: description || null,
      counterAmount: null,
      counterCurrency: null
    });
  }
}
function isRealDay(text) {
  const parsed = parseDayTitle(text);
  return parsed !== null && formatDayTitle(parsed) === text;
}
function readAccountNumber(text) {
  const trimmed = (text ?? "").trim();
  if (!/^\d+$/.test(trimmed))
    return null;
  return Number(trimmed);
}

// packages/core/dist/ledger/account-budget.js
var BUDGET_RHYTHMS = [
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "once"
];
function isBudgetRhythm(value) {
  return typeof value === "string" && BUDGET_RHYTHMS.includes(value);
}
function clampClosedThrough(value) {
  if (value === null || value === void 0 || !Number.isFinite(value))
    return 0;
  return Math.min(12, Math.max(0, Math.trunc(value)));
}
function parseAccountBudget(frontmatter, properties) {
  const p = properties;
  const raw = frontmatter[p.linesProperty];
  const list = Array.isArray(raw) ? raw : [];
  const lines = [];
  for (const entry2 of list) {
    if (typeof entry2 !== "object" || entry2 === null)
      continue;
    const record = entry2;
    const account = readNumberLike(record[p.lineAccountField]);
    if (account === null)
      continue;
    const rhythm = readString(record[p.lineRhythmField]);
    lines.push({
      account,
      amount: roundCents(readNumberLike(record[p.lineAmountField]) ?? 0),
      rhythm: isBudgetRhythm(rhythm) ? rhythm : "monthly",
      startMonth: readNumberLike(record[p.lineMonthField]),
      fromMonth: readMonth(record[p.lineFromField]),
      toMonth: readMonth(record[p.lineToField]),
      note: readString(record[p.lineNoteField]) ?? "",
      overrides: readOverrides(record[p.lineOverridesField]),
      via: readNumberLike(record[p.lineViaField])
    });
  }
  return {
    period: readString(frontmatter[p.periodProperty]),
    currency: normalizeCurrency(readString(frontmatter[p.currencyProperty])),
    lines,
    closedThrough: clampClosedThrough(readNumberLike(frontmatter[p.closedThroughProperty])),
    via: readNumberLike(frontmatter[p.viaProperty])
  };
}
function readMonth(value) {
  const month = readNumberLike(value);
  return month !== null && Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}
function readOverrides(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {};
  const overrides = {};
  for (const [key, amount] of Object.entries(value)) {
    const month = Number(key);
    const figure = readNumberLike(amount);
    if (Number.isInteger(month) && month >= 1 && month <= 12 && figure !== null) {
      overrides[month] = roundCents(figure);
    }
  }
  return overrides;
}

// packages/core/dist/paths/folders.js
function normalizePath(path) {
  return path.replace(/\\/g, "/").split("/").filter((segment) => segment !== "" && segment !== ".").join("/");
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
function parsePeriodTitle(level, title) {
  switch (level) {
    case "day":
      return parseDayTitle(title);
    case "week":
      return startOfWeekTitle(title);
    case "month":
      return parseMonthTitle(title);
    case "quarter":
      return parseQuarterTitle(title);
    case "year":
      return parseYearTitle(title);
  }
}
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
function startOfPeriod(level, date) {
  switch (level) {
    case "day":
      return startOfDay(date);
    case "week":
      return startOfIsoWeek(date);
    case "month":
      return startOfMonth(date);
    case "quarter":
      return startOfQuarter(date);
    case "year":
      return startOfYear(date);
  }
}
function endOfPeriod(level, date) {
  switch (level) {
    case "day":
      return startOfDay(date);
    case "week":
      return addDays(startOfIsoWeek(date), 6);
    case "month":
      return startOfDay(endOfMonth(date));
    case "quarter":
      return startOfDay(endOfQuarter(date));
    case "year":
      return startOfDay(endOfYear(date));
  }
}
function periodRange(level, date) {
  return {
    from: formatDayTitle(startOfPeriod(level, date)),
    to: formatDayTitle(endOfPeriod(level, date))
  };
}

// packages/core/dist/period/path.js
function tokenValues(date) {
  const week = isoWeekOf(date);
  return {
    YYYY: String(date.getFullYear()),
    MM: pad2(date.getMonth() + 1),
    DD: pad2(date.getDate()),
    GGGG: String(week.weekYear),
    WW: pad2(week.week),
    Q: String(Math.floor(date.getMonth() / 3) + 1)
  };
}
function expandPeriodPath(template, date) {
  const values = tokenValues(date);
  return normalizePath(template.replace(/\{([A-Za-z]+)\}/g, (whole, token) => values[token] ?? whole));
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
var TASK_PRIORITIES = ["highest", "high", "medium", "low", "lowest"];
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

// packages/core/dist/tasks/line.js
var CHECKBOX = /^(\s*)([-*+]|\d+[.)])\s+\[(.)\]\s?(.*)$/;
var RECURRENCE = "\u{1F501}";
var ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
var TAG = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;
var WIKILINK2 = /!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
function statusFor(char) {
  const normalized = char.toLowerCase();
  if (normalized === "x")
    return "done";
  if (normalized === "/")
    return "inProgress";
  if (normalized === "-")
    return "cancelled";
  return "todo";
}
function dateAfter(text, marker) {
  const index = text.indexOf(marker);
  if (index === -1)
    return null;
  const rest = text.slice(index + marker.length).trimStart();
  const candidate = rest.slice(0, 10);
  return ISO_DAY.test(candidate) ? candidate : null;
}
function recurrenceAfter(text) {
  const index = text.indexOf(RECURRENCE);
  if (index === -1)
    return null;
  const rest = text.slice(index + RECURRENCE.length);
  const stop = markerPositions(rest).sort((a, b) => a - b)[0] ?? rest.length;
  const rule = rest.slice(0, stop).trim();
  return rule === "" ? null : rule;
}
function markerPositions(text) {
  return [...Object.values(DATE_MARKERS), ...Object.values(PRIORITY_MARKERS)].map((marker) => text.indexOf(marker)).filter((index) => index !== -1);
}
function priorityIn(text) {
  return TASK_PRIORITIES.find((priority) => text.includes(PRIORITY_MARKERS[priority])) ?? null;
}
function descriptionOf(body) {
  const cut = markerPositions(body).sort((a, b) => a - b)[0];
  const recurrenceAt = body.indexOf(RECURRENCE);
  const first = [cut, recurrenceAt === -1 ? void 0 : recurrenceAt].filter((index) => index !== void 0).sort((a, b) => a - b)[0];
  return (first === void 0 ? body : body.slice(0, first)).trim();
}
function parseTaskLine(line) {
  const match = CHECKBOX.exec(line);
  if (!match)
    return null;
  const body = match[4] ?? "";
  const char = match[3] ?? " ";
  return {
    raw: line,
    indent: match[1] ?? "",
    marker: match[2] ?? "-",
    statusChar: char,
    status: statusFor(char),
    text: descriptionOf(body),
    priority: priorityIn(body),
    created: dateAfter(body, DATE_MARKERS.created),
    start: dateAfter(body, DATE_MARKERS.start),
    scheduled: dateAfter(body, DATE_MARKERS.scheduled),
    due: dateAfter(body, DATE_MARKERS.due),
    done: dateAfter(body, DATE_MARKERS.done),
    cancelled: dateAfter(body, DATE_MARKERS.cancelled),
    recurrence: recurrenceAfter(body),
    tags: [...body.matchAll(TAG)].map((tag) => tag[2] ?? "").filter((tag) => tag !== ""),
    links: [...body.matchAll(WIKILINK2)].map((link) => (link[1] ?? "").split("#")[0]?.split("^")[0]?.trim() ?? "").filter((target) => target !== "")
  };
}

// packages/core/dist/tasks/fields.js
var TRAILING_DUE = new RegExp(`\\s+${DATE_MARKERS.due}\\s+(\\d{4}-\\d{2}-\\d{2})$`, "u");
var TRAILING_LINK = /\s+\[\[([^[\]]+)\]\]$/;
var NAMES_A_DAY = new RegExp(`[${DATE_MARKERS.due}${DATE_MARKERS.scheduled}${DATE_MARKERS.start}]\\s*\\d{4}-\\d{2}-\\d{2}`, "u");
function splitTaskLink(description) {
  const linked2 = TRAILING_LINK.exec(description);
  if (!linked2)
    return { text: description.trim(), context: "" };
  return {
    text: description.slice(0, linked2.index).trim(),
    context: (linked2[1] ?? "").trim()
  };
}
function splitTaskFields(description) {
  let text = description;
  let due = "";
  const dated = TRAILING_DUE.exec(text);
  if (dated && !NAMES_A_DAY.test(text.slice(0, dated.index))) {
    due = dated[1] ?? "";
    text = text.slice(0, dated.index);
  }
  const { text: rest, context } = splitTaskLink(text);
  return { text: rest, context, due };
}

// packages/core/dist/tasks/scan.js
var FENCE = /^\s*(```|~~~)/;
function scanTasks(text) {
  const lines = text.split("\n");
  const found = [];
  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    const task = parseTaskLine(line);
    if (task)
      found.push({ ...task, line: index });
  }
  return found;
}

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

// packages/core/dist/vault/resolve-link.js
function linkTargetOf(raw) {
  const inner = raw.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
  return (inner.split(/[|#^]/)[0] ?? "").trim();
}
function linkResolver(files) {
  const sorted = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const byTitle = /* @__PURE__ */ new Map();
  for (const file of sorted) {
    const key = caseFold(file.basename);
    if (!byTitle.has(key))
      byTitle.set(key, file);
  }
  return (target) => {
    const clean = linkTargetOf(target).replace(/\.md$/i, "");
    if (!clean)
      return null;
    if (!clean.includes("/"))
      return byTitle.get(caseFold(clean)) ?? null;
    const suffix = `/${caseFold(clean)}.md`;
    return sorted.find((file) => caseFold(`/${file.path}`).endsWith(suffix)) ?? null;
  };
}

// packages/nodatrail/tests/obsidian-stub.ts
function unmocked(name) {
  throw new Error(`obsidian.${name}() called without vi.mock('obsidian') in the suite.`);
}
var getLanguage = () => unmocked("getLanguage");

// packages/nodatrail/src/lang/translations/en.ts
var enTranslations = {
  plugin: {
    name: "NODAtrail",
    tagline: "Map your mind"
  },
  common: {
    name: "Name",
    description: "Description",
    period: "Period",
    add: "Add",
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    remove: "Remove",
    open: "Open",
    close: "Close",
    refresh: "Refresh",
    none: "None",
    delete: "Delete",
    status: "Status",
    date: "Date",
    all: "All",
    today: "Today",
    search: "Search",
    incomplete: "Something this needs is still missing.",
    needsTitle: "This needs a name.",
    untitled: "Untitled",
    unknown: "Unknown",
    yes: "Yes",
    no: "No"
  },
  trip: {
    departure: "Departure",
    return: "Return",
    persons: "Travelling",
    stops: "Itinerary",
    place: "Place",
    day: "Day of the trip",
    excursion: "Excursion",
    optional: "Optional",
    chosen: "Taken",
    seed: "Seed a day from a trip",
    trip: "Trip",
    noTrips: "No trip notes in the trips folder. Check the folder on the Folders page, or leave it blank to switch this off.",
    noStops: "This trip has no itinerary yet.",
    undated: "A stop with neither a date nor a day number cannot be placed on a day. Give the trip a departure, or the stop a date.",
    counts: "{write} to write, {present} already there, {skipped} skipped.",
    daysTouched: "Days it would touch: {days}",
    write: "Write the entries",
    wrote: "Wrote {count} entries into {days} day notes.",
    nothing: "Nothing to write. Every entry is already in its day note.",
    status: {
      new: "Will be written",
      alreadyPresent: "Already in the note",
      duplicate: "Said twice by this trip",
      notChosen: "Optional, not taken",
      undated: "No date and no day number"
    }
  },
  types: {
    area: "Area",
    goal: "Goal",
    project: "Project",
    resource: "Resource",
    purchase: "Purchase",
    bill: "Bill",
    recurring: "Recurring cost",
    budget: "Budget",
    account: "Account",
    journal: "Journal",
    day: "Day",
    week: "Week",
    month: "Month",
    quarter: "Quarter",
    year: "Year"
  },
  typesPlural: {
    area: { one: "area", other: "areas" },
    goal: { one: "goal", other: "goals" },
    project: { one: "project", other: "projects" },
    resource: { one: "resource", other: "resources" },
    purchase: { one: "purchase", other: "purchases" },
    bill: { one: "bill", other: "bills" },
    task: { one: "task", other: "tasks" }
  },
  status: {
    para: {
      backlog: "Backlog",
      planned: "Planned",
      ongoing: "Ongoing",
      blocked: "Blocked",
      done: "Done",
      review: "Review",
      closed: "Closed",
      removed: "Removed"
    },
    purchase: {
      ordered: "Ordered",
      partial: "Partly delivered",
      delivered: "Delivered",
      returned: "Returned",
      cancelled: "Cancelled"
    },
    bill: {
      open: "Open",
      due: "Due",
      overdue: "Overdue",
      paid: "Paid",
      cancelled: "Cancelled"
    },
    recurring: {
      active: "Active",
      paused: "Paused",
      ended: "Ended"
    },
    task: {
      todo: "To do",
      inProgress: "In progress",
      done: "Done",
      cancelled: "Cancelled"
    }
  },
  cadence: {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    semiannual: "Twice a year",
    annual: "Yearly",
    once: "Once"
  },
  /**
   * Category labels, keyed by the id written into the note.
   *
   * An id this table does not know is shown exactly as written, so a vault
   * that invents `pets` gets `pets` on screen rather than a blank.
   */
  categories: {
    housing: "Housing",
    utilities: "Utilities",
    insurance: "Insurance",
    health: "Health",
    transport: "Transport",
    food: "Food",
    household: "Household",
    leisure: "Leisure",
    education: "Education",
    tax: "Tax",
    fees: "Fees",
    savings: "Savings",
    gifts: "Gifts",
    other: "Other"
  },
  priority: {
    critical: "Critical",
    highest: "Highest",
    high: "High",
    medium: "Medium",
    low: "Low",
    lowest: "Lowest",
    none: "No priority"
  },
  day: {
    headings: {
      focus: "## \u{1F3AF} Focus",
      schedule: "## \u{1F4C5} Schedule",
      notes: "## \u{1F9E0} Thoughts"
    },
    add: "Add to day",
    edit: "Edit entry",
    updated: "Entry changed.",
    deleted: "Entry deleted.",
    moved: "The note changed since this view was drawn. Refresh it and try again.",
    readOnly: "This line says more than the dialog can write. Edit it in the note.",
    linkKind: {
      area: "Area",
      goal: "Goal",
      project: "Project",
      resource: "Resource",
      person: "Person",
      company: "Company",
      trip: "Trip",
      booking: "Booking",
      country: "Country",
      state: "State",
      city: "City",
      accommodation: "Accommodation",
      fnb: "Food & drink",
      landmark: "Landmark",
      location: "Location",
      photospot: "Photo spot",
      vehicle: "Vehicle",
      excursion: "Excursion"
    },
    thoughtsLabel: "Notes and ideas",
    scheduleLabel: "Schedule",
    blankDay: "With no date: {period}.",
    byDate: "into the period note, due by {date}",
    kind: "Kind",
    kinds: {
      task: "Task",
      meeting: "Meeting",
      span: "Several days",
      note: "Note",
      idea: "Idea"
    },
    text: "Text",
    context: "Project or area",
    place: "Where",
    placeHint: "A note title. It is written on its own line under the entry, so the entry itself is unchanged and a place typed before its note exists starts resolving the day it is written.",
    persons: "Who was there",
    personsEmpty: "Nobody named yet.",
    noNamingDays: "No day entries name this person yet.",
    moreNamingDays: "And {count} more, further back.",
    from: "From",
    until: "Until",
    lastDay: "Last day",
    lastDayHint: "Leave blank for one day. With a last day, the same line is written into every day note from the date above to that one, and the notes that do not exist yet are created.",
    spanWrote: "Written into {count} day notes.",
    spanNothing: "Every one of those days already says this. Nothing written.",
    spanScope: "Applies to",
    spanScopeDay: "This day only",
    spanScopeAll: "The whole span, {from} to {to} ({count} days)",
    spanBroken: "Not the whole span: {count} of those days say this twice, or say it differently. Those days are left alone.",
    spanChanged: "Changed on {count} days.",
    spanDeleted: "Removed from {count} days.",
    spanRefused: "Left as they were, because those notes changed since this was opened: {days}",
    lastDayBefore: "The last day is before the first.",
    attendance: {
      label: "Attending",
      going: "Yes",
      tentative: "Maybe",
      unanswered: "Not answered",
      declined: "No"
    },
    meetingNotes: "What was said",
    meetingFollowUps: "What follows",
    followUpRows: "One row per task, each with its own project and date. With no date it takes the meeting\u2019s day.",
    addFollowUp: "Add a task",
    noFollowUps: "No tasks yet.",
    perLine: "One line per entry.",
    added: "Added to the day note."
  },
  calendar: {
    import: "Import a calendar",
    file: "Calendar file",
    chooseFile: "Choose an .ics export to see what would be added.",
    from: "From",
    to: "Until",
    thisWeek: "This week",
    nextWeek: "Next week",
    thisMonth: "This month",
    summary: "{file}: {events} events read, {lines} lines in range. {write} to add, {update} to correct, {present} already there, {attention} need a look.",
    touches: "Writes into {count} day notes, {first} to {last}.",
    outsideRange: "Some of those days fall outside the range, because an event that starts inside it is imported whole.",
    gap: "Nothing was imported for {from} to {last}. Anything that started in those days is not in your notes.",
    unsupported: "{count} series use rules this cannot read ({parts}). Nothing from them is added, because the dates would be wrong rather than missing.",
    truncated: "{count} series start too far back to expand. Nothing from them is added.",
    missingHeading: "No longer in the export",
    missingNote: "Still in your notes. Nothing is removed here; a task is added for today.",
    missingGone: "Not in your notes either.",
    checkTask: 'Check {day}: "{text}" is still in the notes and no longer in the calendar',
    checked: "{count} tasks added for today",
    checkedSkipped: "{count} were already on the list",
    answer: { tentative: "You said maybe", unanswered: "Not answered", declined: "You declined" },
    statusAnswerChanged: "You answered differently since",
    updated: "{count} meeting markers corrected",
    refused: "{count} could not be corrected; they say more than the dialog can write. Edit them in the note.",
    statusNew: "New",
    statusPresent: "Already there",
    statusChanged: "Changed, replaces: {old}",
    statusEdited: "Edited here, left alone",
    statusDuplicate: "Same as another line in this file",
    statusUnsupported: "Rule cannot be read",
    spanOf: "day {index} of {count}",
    write: "Add {count} meetings",
    writeChecks: "Note {count} tasks for today",
    writeAndCheck: "Add {count} meetings and note {checks} tasks",
    added: "{count} meetings added to {notes} day notes",
    kept: "Calendar kept at {path}",
    nothingRead: "Nothing in this file could be read as a calendar.",
    repair: {
      title: "Repair imported meeting times",
      reading: "Reading the archived calendar files. This takes a moment; they hold thousands of events.",
      intro: "{count} lines will have their time corrected in place. Nothing is deleted, nothing is added: only the clock on the line changes.",
      heading: "{count} lines to correct",
      blockedHeading: "{count} lines this cannot correct",
      movesDay: "This meeting really happens on {wanted}, not on {day}. The line has to move from the {day} note into the {wanted} note, and this command does not move lines between notes. Please move it by hand.",
      notFound: "No line in the {day} note says this any more. It was edited, or never written.",
      ambiguous: "Two lines on {day} say exactly this, so there is no telling which one is meant. Please correct them in the note.",
      notEditable: "This line says more than the dialog can write back. Please correct it in the note.",
      unreadable: "These archived files could not be read: {files}. Nothing in them was checked.",
      nothing: "Every imported meeting time is right. There is nothing to correct.",
      noneRepairable: "None of these lines can be corrected here. The reason is on each one below.",
      button: "Correct {count} lines",
      done: "{count} lines corrected in {notes} day notes",
      refused: "{count} lines were left alone, because they changed while this was on screen. Run the command again to see them."
    }
  },
  period: {
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
    quarter: "Quarterly",
    year: "Yearly",
    level: "Period",
    jump: "Jump to a date",
    previous: "Previous",
    next: "Next",
    thisWeek: "This week",
    thisMonth: "This month",
    weekNumber: "Week {week}"
  },
  dashboard: {
    title: "Life",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    today: "Today",
    dueSoon: "Due soon",
    overdue: "Overdue",
    activeProjects: "Active projects",
    openTasks: "Open tasks",
    outstandingBills: "Outstanding",
    thisMonthsBudget: "This month's budget",
    nothingDue: "Nothing is due.",
    nothingOpen: "Nothing open.",
    noBudget: "No budget for this month yet.",
    showAll: "Show all",
    noGoals: "No goals yet.",
    noProjects: "No projects yet.",
    noGoalsInArea: "No goals in this area.",
    noProjectsInArea: "No projects in this area.",
    openPara: "PARA",
    openPlan: "Plan",
    openFinance: "Finance",
    openLedger: "Ledger",
    moreBills: { one: "{count} more bill", other: "{count} more bills" }
  },
  para: {
    title: "PARA",
    areas: "Areas",
    goals: "Goals",
    projects: "Projects",
    resources: "Resources",
    archive: "Archive",
    showArchived: "Show archived",
    noAreas: "No areas yet.",
    noGoals: "No goals in this area.",
    noProjects: "No projects for this goal.",
    deadline: "Deadline",
    achieved: "Achieved",
    completed: "Completed",
    created: "Created on",
    done: "Done on",
    closed: "Closed on",
    archived: "Archived",
    imageMissing: "This picture could not be shown: {value}",
    summary: "Summary",
    summaryHint: "A sentence or two about what this is. Sits at the top of the note.",
    archiveNote: "Archive",
    unarchiveNote: "Unarchive",
    openTasks: "{count} open",
    priority: "Priority",
    image: "Image",
    imageNone: "No image",
    imagePending: "Written into the note\u2019s folder when you save.",
    imageFromVault: "Image from the vault",
    imageFromDisk: "Image from your machine",
    goalsCount: { one: "{count} goal", other: "{count} goals" },
    projectsCount: { one: "{count} project", other: "{count} projects" }
  },
  plan: {
    closeTask: "Close task",
    editTask: "Edit task",
    closeDone: "Done",
    closeCancelled: "Cancelled",
    closeComment: "Comment",
    closeCommentHint: "Why it ended this way. Written as indented lines under the task, so nothing else that reads the line is disturbed. Leave empty to close without one.",
    closeTaskStale: "The note has changed since this task was read. Reopen the view and try again.",
    title: "Plan",
    openToday: "Open today",
    openThisWeek: "Open this week",
    openThisMonth: "Open this month",
    openThisQuarter: "Open this quarter",
    openThisYear: "Open this year",
    removeNavigation: "Remove navigation block",
    dueInPeriod: "Due in this period",
    tasksInPeriod: "Tasks",
    band: { morning: "Morning", lunch: "Lunch", afternoon: "Afternoon" },
    moreMeetings: { one: "+{count} more", other: "+{count} more" },
    countMeetings: { one: "{count} appointment", other: "{count} appointments" },
    countTasks: { one: "{count} task", other: "{count} tasks" },
    countDeadlines: { one: "{count} deadline", other: "{count} deadlines" },
    countMoney: { one: "{count} payment", other: "{count} payments" },
    billsInPeriod: "Bills",
    recurringInPeriod: "Recurring",
    defer: "Move",
    deferOn: "{weekday}, {date}",
    until: {
      week: "This week, by {date}",
      month: "This month, by {date}",
      day: "By {date}",
      quarter: "This quarter, by {date}",
      year: "This year, by {date}"
    },
    nothingInPeriod: "Nothing falls in this period."
  },
  crm: {
    title: "People and companies",
    persons: "People",
    unclassified: "Without a role",
    anyRole: "in every list",
    searchPlaceholder: "Search names, tags and contact details",
    noMatches: "Nothing matches that.",
    tab: {
      persons: "People",
      companies: "Companies"
    },
    empty: {
      persons: "No people yet.",
      companies: "No companies yet."
    },
    newCompany: "New company",
    description: "Description",
    address: "Address",
    website: "Website",
    email: "Email",
    companies: "Companies",
    defaultsFor: "Remember for {company}",
    defaultsHint: "This company usually books to {where}.",
    defaultsRemembered: "{company} will use this from now on.",
    addCompany: "Add a company",
    newPerson: "New person",
    editCompany: "Edit company",
    editPerson: "Edit person",
    mobile: "Mobile",
    phonePrivate: "Phone (private)",
    phoneWork: "Phone (work)",
    roles: "What they are (meals, hotel, \u2026)",
    paymentProvider: "Payment provider",
    paymentProviderHint: "Collects for other companies, so its statement rows name it and not the shop."
  },
  ledger: {
    journal: "Journal",
    account: "Account",
    accounts: "Accounts",
    number: "Number",
    kind: "Kind",
    group: "Group",
    opening: "Opening balance",
    openingDate: "Opening balance as of",
    closed: "Closed",
    iban: "IBAN",
    bankAccount: "Bank account number",
    person: "Person",
    paidInto: "Received into",
    paidFrom: "Paid from",
    earnedOn: "Earned on",
    bookedTo: "Booked to",
    basisAccrual: "What the period cost",
    basisCash: "What left the accounts",
    basisAccrualHint: "An invoice counts when it was incurred, paid or not.",
    basisCashHint: "Only money that actually left an account in this period.",
    basisSettled: "Paid against debts",
    basisOut: "Total out",
    keepStatement: "Keep the file",
    statementAlreadyKept: "This statement is already kept.",
    statementKept: "Statement kept at {path}",
    statementNotKept: "The postings were written, but the statement could not be kept: {reason}",
    archive: "Statements kept",
    archiveNone: "No statements kept yet. One is filed each time an import writes.",
    archiveAllPosted: "All posted",
    archiveUnreadable: "This file cannot be read as a statement.",
    archiveUnposted: {
      one: "{count} row not posted",
      other: "{count} rows not posted"
    },
    archiveSettled: {
      one: "{count} statement kept, all posted",
      other: "{count} statements kept, all posted"
    },
    archiveShow: "Show",
    archiveHide: "Hide",
    archiveFinish: "Finish",
    landingAgrees: "After writing, this account lands on {balance}, which is where the file ends.",
    landingDiffers: "After writing, this account lands on {ledger}. The file ends at {statement}, {difference} away.",
    landingUndecided: {
      one: "{count} row still has no account, and it comes to {amount}.",
      other: "{count} rows still have no account, and they come to {amount}."
    },
    handoverFits: "This file starts from the balance held by {accounts}. It may be the statement for that account rather than this one.",
    nearMissAccount: "A payment of this amount is already booked on {date}, but to {booked} rather than {expected}. Saving would write a second posting for it.",
    nearMissDate: "This payment is already booked on {date}, outside the days searched around this bill. Set the paid date to that day and it will be recognised.",
    wouldWrite: "Saving now would write:",
    alreadyPosted: "Already in the ledger. Marking it paid will not post it again:",
    noInvoice: "No invoice",
    remember: "Remember",
    rememberAs: 'Book anything matching "{match}" to this account from now on',
    legNeedsAccount: "A line has an amount but no account.",
    editPosting: "Edit posting",
    deleteConfirm: "Delete for good?",
    postingDeleted: "Posting deleted",
    postingGone: "That line is not there any more. The note was edited elsewhere; reopen the ledger and try again.",
    alreadySettled: "Already posted from the invoice",
    settlesBill: "Pays {title}",
    alsoOpen: "{count} other open invoices fit this row",
    billsPaid: "{count} invoices marked paid",
    payNeedsAccounts: "To post this payment, name the account it is booked to and the account it was paid from.",
    overrides: "Per month",
    yearPlan: "The year planned",
    yearTotal: "Year total",
    closedThrough: "Months closed",
    via: "Via account",
    viaDefault: "Default via account",
    viaNone: "No account",
    lineNote: "Comment",
    rangeFrom: "From month",
    rangeTo: "Until month",
    viaFromNote: "The budget\u2019s default",
    closeMonth: "Close {month}",
    budgetModeYear: "The year",
    budgetModeMonth: "One month",
    budgetModeYearHint: "What happened in the closed months, the plan for the rest.",
    budgetModeMonthHint: "The month on screen, planned against actual.",
    closedMonth: "{month} closed: it now shows what happened.",
    reopenedMonth: "{month} reopened: it shows the plan again.",
    nothingToReopen: "No month of {year} is closed.",
    allMonthsClosed: "Every month of {year} is closed.",
    noBudgetForYear: "No budget note for {year}. Create one to plan the year.",
    postingCount: "{count} postings",
    debit: "Debit",
    credit: "Credit",
    balance: "Balance",
    importStatement: "Import a bank statement",
    intoAccount: "Statement for",
    format: "Format",
    file: "File",
    chooseFile: "Choose a file to see what would be posted.",
    chooseAccount: "Which account?",
    noAccounts: 'No account notes yet. Run "Create the chart of accounts" first.',
    importSummary: "{file}: {read} rows read, {accepted} to post. {ready} ready, {attention} need a decision, {skipped} already in the ledger.",
    handoverAgrees: "The ledger already has this account at {balance} the day before this file starts. They agree.",
    handoverDiffers: "The ledger has this account at {ledger} the day before this file starts; the file starts from {statement}. Out by {difference}. Something is missing between them.",
    chainHolds: "The running balance adds up from the first row to the last. Opening balance {opening}.",
    chainBreaks: "The running balance stops adding up at {count} row(s). Check the format before writing.",
    alreadyImported: "Already imported",
    mirrorsExisting: "Other side already posted",
    batchOf: "{count} payments in one line",
    split: "Split",
    legsSet: "{count} legs",
    splitOf: "Split: {label}",
    addLeg: "Add a line",
    legText: "What for",
    splitTotals: "{entered} of {total}",
    splitDifference: "Out by {difference}",
    writePostings: "Write {count} postings",
    imported: "{count} postings written to {notes} journal notes",
    title: "Ledger",
    problems: "Needs a look",
    assets: "Assets",
    liabilities: "Liabilities",
    net: "Net",
    income: "Income",
    expense: "Expenses",
    result: "Result",
    postings: "Postings",
    noPostings: "Nothing posted to this account yet.",
    noText: "(no description)",
    unassigned: "unassigned",
    nothingInPeriod: "Nothing posted in this period.",
    heldAt: "holds {held}, at {rate}",
    heldNoRate: "holds {held}, and no rate reaches {currency}",
    tab: {
      accounts: "Chart",
      statement: "Statement",
      income: "Profit",
      balance: "Balance sheet",
      budget: "Budget"
    },
    problem: {
      unreadable: "Line cannot be read",
      "no-date": "No readable date",
      "no-amount": "No readable amount",
      "no-accounts": "No account named",
      "split-does-not-sum": "Split does not add up to its total",
      "orphan-continuation": "Split line with no posting above it",
      "unknown-account": "No account note numbered {number}",
      "order-differs": "Order {order} was priced differently",
      "self-posting": "Account {number} on both sides, so this moves nothing",
      "currency-mismatch": "Account {number} is in {held}, and this figure is written in {written}"
    },
    newPosting: "New posting",
    movement: "Movement",
    postingDate: "Date",
    toAccount: "grows",
    fromAccount: "pays",
    splitHint: "One amount across several accounts?",
    fromSplit: "from the split",
    ordersFound: "{count} of these are orders the vault already knows.",
    fillFromOrders: "Fill {count} from the orders",
    orderDiffers: "{order}: the card charged {charged}, the order says {ordered}.",
    paysOrder: "Pays order {title}",
    ordersAmbiguous: "{count} orders fit this charge equally well, so none is used.",
    needsNumber: "This needs an account number.",
    needsYear: "This needs a year.",
    needsDate: "This needs a date.",
    needsAmount: "This needs an amount.",
    needsBothAccounts: "Name both accounts: the one that grows and the one that pays.",
    needsDebit: "Name the account that grows.",
    needsCredit: "Name the account that pays.",
    needsOneAccount: "The split names one side. Name the other.",
    needsCounterAmount: "Two currencies, so this needs the figure in {currency} as well.",
    amountFirst: "Enter the amount first.",
    splitUnreadable: "These lines cannot be put back the way they were written, so this form will not save them. Edit the journal note directly.",
    twoCurrencies: "These accounts are in {near} and {far}, so both figures are needed.",
    useRate: "Use {currency} {amount} from your rate",
    newAccount: "New account",
    accountPersonShared: "Shared",
    kindFromNumber: "From the number",
    kindAsset: "Asset",
    kindLiability: "Liability",
    kindIncome: "Income",
    kindExpense: "Expense",
    numberTaken: "Account {number} already exists.",
    accountSetup: "Set up accounts",
    accountSetupDesc: "What each account held on the opening date, and what the bank calls it. The bank number is what lets a transfer between two of your own accounts resolve itself instead of asking every time.",
    ibanOrNumber: "IBAN or account number",
    openingSaved: "{count} opening balances written",
    asOf: "As of",
    seedChart: "Create the chart of accounts",
    vehicle: "Vehicle",
    seeded: "{created} accounts created, {skipped} already there"
  },
  finance: {
    deliveries: "Deliveries",
    deliveryItemName: "Delivered line name",
    deliveryItemQuantity: "Delivered quantity",
    recordDelivery: "Record a delivery",
    deliveryArrivedOn: "Arrived on",
    deliveryNote: "Tracking or note",
    deliveryNothingChosen: "Tick at least one line that arrived.",
    deliveryNothingOutstanding: "Everything on this purchase has arrived.",
    deliveryAlready: "{count} already recorded, the last on {last}.",
    outstandingLines: "{count} of {total} still to come",
    title: "Finance",
    purchases: "Purchases",
    bills: "Bills",
    recurring: "Recurring",
    budget: "Budget",
    amount: "Amount",
    currency: "Currency",
    company: "Company",
    counterparty: "Company or person",
    area: "Area",
    project: "Project",
    cadence: "Cadence",
    category: "Category",
    openDocument: "Open the document",
    openDocuments: {
      one: "Open the document",
      other: "Open one of {count} documents"
    },
    documentMissing: "This note points at {path}, which is not in the vault.",
    reference: "Reference",
    oneAccount: "Booked to one account",
    splitBill: "Split across accounts",
    document: "Document",
    documentNone: "No document",
    documentPending: "Will be filed beside the note when you save",
    documentFromVault: "Choose from the vault",
    documentFromDisk: "Choose from this computer",
    orderDate: "Order date",
    deliveryDate: "Delivery date",
    direction: "Direction",
    directions: {
      incoming: "We owe this (Kreditorenrechnung)",
      outgoing: "They owe us (Debitorenrechnung)"
    },
    issueDate: "Issue date",
    dueDate: "Due date",
    paidDate: "Paid on",
    startDate: "Starts",
    endDate: "Ends",
    interval: "Every",
    items: "Items",
    itemName: "Item",
    quantity: "Quantity",
    price: "Price",
    discount: "Discount",
    shipping: "Shipping",
    vatRate: "VAT rate",
    vatAmount: "VAT amount",
    subtotal: "Subtotal",
    total: "Total",
    stated: "Stated",
    computed: "Computed",
    totalsDisagree: "The stated total does not match the lines.",
    planned: "Planned",
    actual: "Actual",
    variance: "Left",
    unbudgeted: "Unbudgeted",
    nothingInPeriod: "Nothing in this period.",
    noCompanyNote: "No company note to write that to.",
    salesInvoices: "Invoices we sent",
    owedToUs: "Owed to us",
    outstandingElsewhere: "Still open, outside this period",
    outstanding: "Outstanding",
    allBudgets: "All budgets",
    editLines: "Edit this note\u2019s lines",
    lineCount: { one: "{count} line", other: "{count} lines" },
    markPaid: "Paid",
    markUnpaid: "Not paid after all",
    occurrences: { one: "{count} occurrence", other: "{count} occurrences" },
    noPurchases: "No purchases yet.",
    noBills: "No bills yet.",
    noRecurring: "No recurring costs yet.",
    createBillFromOccurrence: "Create a bill for this occurrence"
  },
  projects: {
    title: "Projects",
    search: "Name",
    searchHint: "Part of a project name",
    noneMatch: "No project matches these filters.",
    clearFilters: "Clear the filters"
  },
  tasks: {
    title: "Tasks",
    open: "Open",
    overdue: "Overdue",
    dueToday: "Due today",
    done: "Done",
    noTasks: "No tasks here.",
    count: { one: "{count} task", other: "{count} tasks" }
  },
  // The one-off move of archived imports out of the documents folder. Only the
  // dialog: the files themselves carry no translated text.
  imports: {
    migrate: {
      title: "Move imported files into the imports folder",
      nothing: "Nothing to move. Every kept import is already in its imports folder.",
      intro: "{count} files will be moved beside the notes they fed, into the imports folder, and renamed so the name leads with when they were imported. Nothing is written, nothing is deleted, and no note is touched.",
      stamps: "The old names carried no time of import, so the time each file was created in the vault is used instead. These files are all older than anything a new import will keep, so they stay in the right order whatever that time is off by.",
      heading: "{count} files to move",
      button: "Move {count} files",
      done: "{count} files moved.",
      failed: "Left where they were: {files}"
    }
  },
  sheets: {
    export: "Export sheet",
    written: "Sheet written to {path}",
    failed: "The sheet could not be written.",
    credit: "Created by {author} on {date} with NODAtrail",
    creditAnonymous: "Created on {date} with NODAtrail",
    truth: "This page is a print of the ledger at the moment it was made. The notes in the vault are what counts: every figure is computed from the postings.",
    currencyRule: "Accounts in another currency are converted at the rates in the settings. One with no rate stays out of every total.",
    chart: {
      title: "Chart of accounts {period}"
    },
    balance: {
      title: "Balance sheet on {day}",
      fileName: "Balance sheet {day}"
    },
    income: {
      title: "Profit {period}",
      titleCash: "Profit {period} (cash)"
    },
    statement: {
      title: "Statement {account}",
      fileName: "Statement {account} {period}",
      text: "Description",
      inward: "In",
      outward: "Out",
      closing: "Closing balance"
    },
    report: {
      total: "Total {section}",
      asOf: "Balances as of {day}",
      period: "Period {period}"
    },
    budget: {
      title: "Budget year {year}",
      fileName: "Budget year {year}",
      currency: "Figures in {currency}",
      closedThrough: "Actual through {month}, plan from then on",
      noneClosed: "No month closed yet: the whole year is plan",
      allClosed: "All twelve months closed",
      flows: "Income and expenses",
      income: "Total income",
      expense: "Total expenses",
      result: "Income less expenses",
      balances: "Net worth",
      netWorth: "Net worth",
      unassigned: "Not assigned",
      opening: "Brought forward",
      total: "Total",
      plan: "Plan",
      variance: "Variance",
      actual: "Actual",
      planned: "Plan",
      unbudgeted: "not budgeted",
      noRate: "no rate",
      totalHint: "Total is what happened in the closed months plus the plan for the rest. Plan is the year as it was planned; Variance is Total less Plan.",
      projectedHint: "After the last closed month every balance is carried forward by the planned postings, in italics. What the plan moves without naming an account is under Not assigned.",
      openingProjectedHint: "{previous} is not yet closed through December, so the carried-forward balance is its planned December, in italics. It becomes the booked balance once December is closed.",
      strayLines: "Budget lines on accounts that are not income or expense are not shown: {numbers}"
    }
  },
  commands: {
    openDashboard: "Open the life dashboard",
    openPara: "Open PARA",
    openPlan: "Open the plan",
    openFinance: "Open finance",
    openLedger: "Open ledger",
    exportLedgerSheet: "Export the ledger tab on screen as a sheet",
    reopenBudgetMonth: "Reopen the last closed budget month",
    newArea: "New area",
    newGoal: "New goal",
    newProject: "New project",
    newResource: "New resource",
    newPurchase: "New purchase",
    newBill: "New bill",
    newRecurring: "New recurring cost",
    newBudget: "New budget",
    archiveNote: "Archive this note",
    unarchiveNote: "Move this note out of the archive",
    runHealthCheck: "Check the vault",
    createSampleVault: "Create the sample notes",
    migrateImports: "Move imported files into the imports folder"
  },
  // The sample vault. Only the command name, the modal's labels and its notices
  // are translated: the note content itself is English in every vault, because
  // it is product material rather than an interface.
  sample: {
    title: "Create the sample notes",
    intro: "This writes notes into this vault: a week of day notes, a PARA tree, the money notes and a month of the ledger. Nothing already here is overwritten.",
    createHeading: { one: "Would create {count} note", other: "Would create {count} notes" },
    skipHeading: {
      one: "{count} note is already here and is left alone",
      other: "{count} notes are already here and are left alone"
    },
    augmentHeading: { one: "Would edit {count} note", other: "Would edit {count} notes" },
    augmentExplain: "These already exist and would gain a NODAtrail block at the end, so they render here as well. Nothing else in them is touched.",
    // Not a warning, and not a refusal. `CRM/People` is written by all three
    // plugins and by whoever keeps contacts in this vault, so a person note this
    // run does not name is somebody's colleague rather than a stranger and the
    // run goes ahead. These three strings are the preview being honest about a
    // folder it writes into and does not own.
    sharedHeading: "Written beside what is already there",
    sharedExplain: "This folder is shared with the other TRAILsuite plugins and with your own contacts. What is already in it stays exactly as it is; the sample notes are added beside it.",
    alreadyThere: {
      one: "{count} note already here: {titles}",
      other: "{count} notes already here: {titles}"
    },
    blockedHeading: "Nothing can be written yet",
    occupiedExplain: "These folders hold notes this command did not write. It will not add to a folder somebody is already using.",
    strangers: "already holds: {titles}",
    unconfigured: "These notes have no folder or no type value configured: {titles}",
    nothingToDo: "Every sample note is already in this vault.",
    createButton: "Create the notes",
    createdNotice: { one: "{count} note created.", other: "{count} notes created." },
    augmentedNotice: {
      one: "{count} note gained a block.",
      other: "{count} notes gained a block."
    },
    failedNotice: "Could not write: {titles}"
  },
  health: {
    title: "Vault check",
    run: "Check again",
    allClear: "Nothing to report.",
    wrongType: "The type does not match the folder",
    missingType: "No type property",
    brokenLink: "Points at a note that does not exist",
    missingImage: "The image does not resolve",
    billWithoutAmount: "No amount",
    dueBeforeIssue: "Due before it was issued",
    totalsDisagree: "The stated total disagrees with the lines",
    unknownBudgetArea: "Names an area that does not exist",
    oldStampShape: "The created or modified stamp is in an older shape",
    fix: "Fix",
    fixAll: "Fix {count}",
    issuesFound: { one: "{count} issue", other: "{count} issues" }
  },
  notices: {
    noteExists: "A note already exists at {path}.",
    noteUpdated: "{title} updated",
    fixesApplied: { one: "{count} fixed", other: "{count} fixed" },
    noteCreated: "{title} created.",
    archived: "{title} moved to the archive.",
    unarchived: "{title} moved out of the archive.",
    navigationRemoved: "Navigation block removed.",
    notAPeriodNote: "This is not a periodic note.",
    nothingToArchive: "This note is not one NODAtrail can archive.",
    folderNotConfigured: "That folder is not configured yet. Check the settings.",
    typeValueNotConfigured: "That type value is not configured yet. Check the settings."
  },
  settings: {
    title: "NODAtrail",
    version: "Version",
    releaseNotes: "Release notes",
    support: "Support",
    contact: "Contact",
    about: "About",
    aboutBody: "NODAtrail is part of TRAILsuite, beside APERtrail for travel and CULItrail for the kitchen. All three share one library and one folder of Person and Company notes.",
    aboutUsage: "Free for personal use. Any use in or for a business needs a commercial licence.",
    aboutLicensingLink: "Commercial licence",
    vault: {
      heading: "Vault setup",
      rootFolder: "Root folder",
      rootFolderDesc: "An optional folder above everything NODAtrail owns. Empty means the vault root, which is what a vault using the numbered PARA folders wants.",
      showRibbonIcon: "Show the ribbon icon",
      showRibbonIconDesc: "Opens the life dashboard."
    },
    display: {
      heading: "Display",
      displayLocale: "Number format",
      displayLocaleDesc: "How money is written, as a locale code. de-CH gives 1'309.98, de-DE gives 1.309,98, en-GB gives 1,309.98. Separate from the interface language: a Swiss household on a machine set to German still reads its own money the Swiss way.",
      rates: "Exchange rates",
      ratesDesc: "What one unit of a foreign currency is worth in the home one, as EUR 0.93458, USD 1.14. A rate quoted the other way round can be written as a division: EUR 1/1.07 is the same thing. Nothing is fetched: a rate nobody chose is a rate nobody can check. A currency with no rate here stays out of the totals and its row says so.",
      exportAuthor: "Name on printed sheets",
      exportAuthorDesc: 'Who a printed sheet says made it: "Created by Thomas on ...". Leave blank to leave the name out. APERtrail has the same setting.',
      homeCurrency: "Home currency",
      homeCurrencyDesc: "The currency a figure is taken to be in when a note does not say.",
      currencyOptions: "Currency options",
      currencyOptionsDesc: "The codes the editors offer, comma separated.",
      dayHeading: "Day view",
      showClosedTasks: "Keep finished tasks",
      showClosedTasksDesc: "Tasks that are done or cancelled stay in the day\u2019s list, faint and struck through. They cannot be changed there; clicking one opens the note it is written in.",
      weekHeading: "Week view",
      workdaysOnly: "Work week only",
      workdaysOnlyDesc: "Show Monday to Friday. Saturday and Sunday are summarised in one line under the grid, so nothing on them is hidden.",
      lunchStart: "Lunch from",
      lunchEnd: "Lunch until",
      lunchDesc: "Splits each day column into morning, lunch and afternoon. A meeting is placed by when it starts, so one running from 10:00 to 14:00 is a morning meeting. Clear both to split the day in two.",
      dueSoonDays: "Call a bill due this many days ahead",
      dueSoonDaysDesc: "Inside this window a bill reads as due rather than merely open.",
      categories: "Expense categories",
      categoriesDesc: "The category ids the editors offer, comma separated. An id this list does not know is still read and shown exactly as written.",
      taskFolders: "Look for tasks in",
      taskFoldersDesc: "Comma separated folders. Deliberately not the whole vault: a shopping list inside a meal note is not a life task."
    },
    day: {
      heading: "Day note",
      description: 'What the "Add to day" dialog writes into a day note. A heading appears when the first entry needs it -- a day note is never created from a template.',
      blankUsesDefault: 'Leave blank for "{example}".',
      focusHeading: "Heading for tasks",
      scheduleHeading: "Heading for meetings",
      notesHeading: "Heading for notes and ideas",
      meetingMarker: "Marker for a meeting",
      tentativeMarker: "Meeting marker: maybe",
      unansweredMarker: "Meeting marker: not answered",
      declinedMarker: "Meeting marker: declined",
      attendanceDesc: "An imported invitation is written with the marker for what you answered. Clear one to write those like any other meeting.",
      noteMarker: "Marker for a note",
      ideaMarker: "Marker for an idea",
      spanMarker: "Marker for several days",
      placeMarker: "Marker for where it was",
      personMarker: "Marker for who was there",
      markerDesc: "A task needs no marker: it is a checkbox in the Tasks plugin format. Blank writes a plain bullet."
    },
    folders: {
      heading: "Folders",
      description: "Where each kind of note lives.",
      openPage: "Folders",
      planSection: "Plan",
      paraSection: "PARA",
      financeSection: "Finance",
      archiveSubfolder: "Archive: {kind}",
      archiveSubfolderDesc: "The archive sub-folder for each kind. Changing one while notes are already filed there leaves the old ones behind -- the folder is not renamed with it.",
      projectFolderPerNote: "A folder per project",
      projectFolderPerNoteDesc: "A new project gets a folder named after it. Note, documents and image sit together, and archiving moves the whole folder. Existing projects and grouping folders stay as they are -- both read the same.",
      archiveYearFolders: "File the archive by year",
      archiveYearFoldersDesc: "An archived note goes into a year folder under its category. Worth it from about a hundred notes a year; off puts everything straight in the category. Both read the same, and a year already filed is never moved.",
      projectDefaultImageName: "Fallback picture named",
      projectDefaultImageNameDesc: 'A picture in the projects folder\u2019s image subfolder with this name is shown for every project that has none of its own. Put a prefix in front of it to narrow the family: with "Default", a file called CN-Default is used by every project whose title starts with CN-, and the longest matching prefix wins. Nothing is written into a note, so renaming the file re-points every project at once. Leave blank to switch it off.',
      imageSubfolder: "Subfolder for images",
      imageSubfolderDesc: "Under the note\u2019s own folder. An image chosen from your machine is written there; one chosen from the vault is linked where it already is and never moved.",
      crmSection: "People and companies",
      crmFolder: "CRM root",
      eligiblePersonTags: "Eligible person tags",
      eligiblePersonTagsDesc: "Comma-separated tags. Only people carrying one of them are offered when an account needs an owner. Leave it blank to offer everybody.",
      billVendorRole: "Role for companies that invoice you",
      billVendorRoleDesc: 'One role, for example "vendor". Only companies carrying it are offered on an incoming invoice. Leave it blank to offer every company.',
      billCustomerRole: "Role for companies you invoice",
      billCustomerRoleDesc: 'One role, for example "customer". Only companies carrying it are offered on an outgoing invoice. Leave it blank to offer every company.',
      planRootFolder: "Plan root",
      dailyPath: "Daily note path",
      weeklyPath: "Weekly note path",
      monthlyPath: "Monthly note path",
      quarterlyPath: "Quarterly note path",
      yearlyPath: "Yearly note path",
      pathTokens: "Tokens: {YYYY} year, {MM} month, {DD} day, {GGGG} ISO week-year, {WW} ISO week, {Q} quarter.",
      areasFolder: "Areas",
      goalsFolder: "Goals",
      projectsFolder: "Projects",
      resourcesFolder: "Resources",
      archiveFolder: "Archive",
      financeFolder: "Finance root",
      purchasesFolder: "Purchases",
      billsFolder: "Bills",
      ordersFolder: "Orders (read only)",
      recurringFolder: "Recurring costs",
      ordersNote: "Where a sibling plugin keeps its order notes. NODAtrail reads them so a card line naming an order number can fill itself in, and never writes one. Leave blank to switch it off.",
      tripsFolder: "Trips (read only)",
      tripsNote: "Where a sibling plugin keeps its trip notes. NODAtrail reads an itinerary so a day's entries can be seeded from it, and never writes a trip. Leave blank to switch it off.",
      budgetsFolder: "Budgets",
      accountsFolder: "Accounts",
      journalFolder: "Journal",
      documentSubfolder: "Documents beside a note",
      documentSubfolderDesc: "The folder an invoice or a statement is filed into, beside the note about it, the way an attachment folder works. Leave blank to keep documents wherever they already are. A document already in the vault is moved and its links follow; one chosen from this computer is copied in.",
      exportsSubfolder: "Printed sheets",
      exportsSubfolderDesc: "The folder inside the finance folder the ledger\u2019s printed sheets are written to. A sheet is made again from the notes whenever it is exported, so everything in it can be deleted. Leave blank to write them into the finance folder itself.",
      importSubfolder: "Imported files beside a note",
      importSubfolderDesc: "The folder a calendar export or a bank statement is kept in after it has been imported, beside the notes it fed. Not the same folder as documents: these files are read back by name, to work out what an earlier import offered and which rows are still unposted. Leave blank to keep nothing, which switches both of those off.",
      subfolder: "file under",
      subfolderDesc: "Where a new note goes beneath its folder. Tokens: {YYYY} and {MM}, filled in from the date the note is about. Leave one blank to file that kind flat. Only new notes are affected; every reader looks through the whole folder whatever is in here.",
      personsFolder: "People",
      companiesFolder: "Companies",
      defaults: {
        rootFolderPath: "",
        planFolderName: "0 Plan",
        areasFolderName: "1 Areas",
        goalsFolderName: "2 Goals",
        projectsFolderName: "3 Projects",
        resourcesFolderName: "4 Resources",
        archiveFolderName: "6 Archive",
        areasArchiveFolderName: "Areas",
        goalsArchiveFolderName: "Goals",
        projectsArchiveFolderName: "Projects",
        resourcesArchiveFolderName: "Resources",
        financeFolderName: "Finance",
        purchasesFolderName: "Purchases",
        billsFolderName: "Bills",
        recurringFolderName: "Recurring",
        budgetsFolderName: "Budgets",
        accountsFolderName: "Accounts",
        journalFolderName: "Journal",
        dailyFolderName: "1 Daily",
        weeklyFolderName: "2 Weekly",
        monthlyFolderName: "3 Monthly",
        quarterlyFolderName: "4 Quarterly",
        yearlyFolderName: "5 Yearly",
        personsFolderName: "People",
        companiesFolderName: "Companies",
        crmFolderName: "CRM"
      }
    },
    importRules: {
      heading: "Import rules",
      openPage: "Import rules",
      description: "Which account a statement line belongs to, decided by what its text contains. Nearly all of these are written by the import itself as you assign accounts; this page is for removing one that has started catching the wrong lines. The longest matching rule wins.",
      none: "No rules yet. They appear here as you assign accounts during an import.",
      add: "Add a rule",
      match: "Text contains"
    },
    properties: {
      heading: "Property keys",
      description: "Every frontmatter name NODAtrail reads or writes.",
      ordersSection: "Orders (another plugin's notes)",
      tripsSection: "Trips (another plugin's notes)",
      openPage: "Property keys",
      unlock: "Let me edit property names",
      unlockDesc: "A folder row and a property row look alike and are nothing alike to get wrong. Repointing a folder finds every note again; renaming a property makes every note carrying the old name stop answering, with no error anywhere. Nothing is migrated.",
      lockedNotice: "Read only. Turn on the switch above to edit these.",
      sharedSection: "Shared",
      paraSection: "PARA",
      financeSection: "Finance",
      typePropertyName: "Type property",
      createdProperty: "Created stamp",
      modifiedProperty: "Modified stamp",
      imageProperty: "Image",
      iconProperty: "Icon",
      priorityProperty: "Priority",
      deadlineProperty: "Deadline",
      archivedProperty: "Archived on"
    }
  }
};

// packages/nodatrail/src/lang/translations/de.ts
var deTranslations = {
  plugin: {
    name: "NODAtrail",
    tagline: "Ordne deine Gedanken"
  },
  common: {
    name: "Name",
    description: "Beschreibung",
    period: "Zeitraum",
    add: "Hinzuf\xFCgen",
    cancel: "Abbrechen",
    save: "Speichern",
    edit: "Bearbeiten",
    remove: "Entfernen",
    open: "\xD6ffnen",
    close: "Schliessen",
    refresh: "Aktualisieren",
    none: "Keine",
    delete: "L\xF6schen",
    status: "Status",
    date: "Datum",
    all: "Alle",
    today: "Heute",
    search: "Suchen",
    incomplete: "Es fehlt noch etwas, das gebraucht wird.",
    needsTitle: "Hier fehlt der Name.",
    untitled: "Ohne Titel",
    unknown: "Unbekannt",
    yes: "Ja",
    no: "Nein"
  },
  trip: {
    departure: "Abreise",
    return: "Rueckkehr",
    persons: "Mitreisende",
    stops: "Reiseverlauf",
    place: "Ort",
    day: "Reisetag",
    excursion: "Ausflug",
    optional: "Optional",
    chosen: "Gebucht",
    seed: "Tag aus einer Reise erzeugen",
    trip: "Reise",
    noTrips: "Keine Reisenotizen im Reisenordner. Bitte den Ordner auf der Ordnerseite pruefen oder leer lassen, um dies auszuschalten.",
    noStops: "Diese Reise hat noch keinen Reiseverlauf.",
    undated: "Ein Halt ohne Datum und ohne Reisetag kann keinem Tag zugeordnet werden. Bitte der Reise eine Abreise geben oder dem Halt ein Datum.",
    counts: "{write} zu schreiben, {present} bereits vorhanden, {skipped} uebersprungen.",
    daysTouched: "Betroffene Tage: {days}",
    write: "Eintraege schreiben",
    wrote: "{count} Eintraege in {days} Tagesnotizen geschrieben.",
    nothing: "Nichts zu schreiben. Jeder Eintrag steht bereits in seiner Tagesnotiz.",
    status: {
      new: "Wird geschrieben",
      alreadyPresent: "Steht bereits in der Notiz",
      duplicate: "Von dieser Reise doppelt genannt",
      notChosen: "Optional, nicht gebucht",
      undated: "Kein Datum und kein Reisetag"
    }
  },
  types: {
    area: "Bereich",
    goal: "Ziel",
    project: "Projekt",
    resource: "Ressource",
    purchase: "Einkauf",
    bill: "Rechnung",
    recurring: "Wiederkehrende Kosten",
    budget: "Budget",
    account: "Konto",
    journal: "Journal",
    day: "Tag",
    week: "Woche",
    month: "Monat",
    quarter: "Quartal",
    year: "Jahr"
  },
  typesPlural: {
    area: { one: "Bereich", other: "Bereiche" },
    goal: { one: "Ziel", other: "Ziele" },
    project: { one: "Projekt", other: "Projekte" },
    resource: { one: "Ressource", other: "Ressourcen" },
    purchase: { one: "Einkauf", other: "Eink\xE4ufe" },
    bill: { one: "Rechnung", other: "Rechnungen" },
    task: { one: "Aufgabe", other: "Aufgaben" }
  },
  status: {
    para: {
      backlog: "Backlog",
      planned: "Geplant",
      ongoing: "Laufend",
      blocked: "Blockiert",
      done: "Erledigt",
      review: "Abnahme",
      closed: "Geschlossen",
      removed: "Verworfen"
    },
    purchase: {
      ordered: "Bestellt",
      partial: "Teilweise geliefert",
      delivered: "Geliefert",
      returned: "Zur\xFCckgesandt",
      cancelled: "Storniert"
    },
    bill: {
      open: "Offen",
      due: "F\xE4llig",
      overdue: "\xDCberf\xE4llig",
      paid: "Bezahlt",
      cancelled: "Storniert"
    },
    recurring: {
      active: "Aktiv",
      paused: "Pausiert",
      ended: "Beendet"
    },
    task: {
      todo: "Offen",
      inProgress: "In Arbeit",
      done: "Erledigt",
      cancelled: "Abgebrochen"
    }
  },
  cadence: {
    weekly: "W\xF6chentlich",
    monthly: "Monatlich",
    quarterly: "Viertelj\xE4hrlich",
    semiannual: "Halbj\xE4hrlich",
    annual: "J\xE4hrlich",
    once: "Einmalig"
  },
  categories: {
    housing: "Wohnen",
    utilities: "Nebenkosten",
    insurance: "Versicherungen",
    health: "Gesundheit",
    transport: "Verkehr",
    food: "Lebensmittel",
    household: "Haushalt",
    leisure: "Freizeit",
    education: "Bildung",
    tax: "Steuern",
    fees: "Geb\xFChren",
    savings: "Sparen",
    gifts: "Geschenke",
    other: "Sonstiges"
  },
  priority: {
    critical: "Kritisch",
    highest: "H\xF6chste",
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
    lowest: "Niedrigste",
    none: "Ohne Priorit\xE4t"
  },
  day: {
    headings: {
      focus: "## \u{1F3AF} Fokus",
      schedule: "## \u{1F4C5} Termine",
      notes: "## \u{1F9E0} Gedanken"
    },
    add: "Zum Tag hinzuf\xFCgen",
    edit: "Eintrag bearbeiten",
    updated: "Eintrag ge\xE4ndert.",
    deleted: "Eintrag gel\xF6scht.",
    moved: "Die Notiz wurde seit dem letzten Aktualisieren ge\xE4ndert. Bitte die Ansicht neu laden und es noch einmal versuchen.",
    readOnly: "Diese Zeile enth\xE4lt mehr, als der Dialog schreiben kann. Sie wird in der Notiz bearbeitet.",
    linkKind: {
      area: "Bereich",
      goal: "Ziel",
      project: "Projekt",
      resource: "Ressource",
      person: "Person",
      company: "Firma",
      trip: "Reise",
      booking: "Buchung",
      country: "Land",
      state: "Bundesland",
      city: "Stadt",
      accommodation: "Unterkunft",
      fnb: "Essen & Trinken",
      landmark: "Sehensw\xFCrdigkeit",
      location: "Ort",
      photospot: "Fotospot",
      vehicle: "Verkehrsmittel",
      excursion: "Ausflug"
    },
    thoughtsLabel: "Notizen und Ideen",
    scheduleLabel: "Termine",
    blankDay: "Ohne Datum: {period}.",
    byDate: "in die Periodennotiz, faellig bis {date}",
    kind: "Art",
    kinds: {
      task: "Aufgabe",
      meeting: "Termin",
      span: "Mehrere Tage",
      note: "Notiz",
      idea: "Idee"
    },
    text: "Text",
    context: "Projekt oder Bereich",
    place: "Wo",
    placeHint: "Ein Notiztitel. Er wird als eigene Zeile unter den Eintrag geschrieben, der Eintrag selbst bleibt also unveraendert, und ein Ort, den es noch nicht als Notiz gibt, loest sich auf, sobald sie geschrieben ist.",
    persons: "Wer dabei war",
    personsEmpty: "Noch niemand genannt.",
    noNamingDays: "Noch keine Tageseintraege nennen diese Person.",
    moreNamingDays: "Und {count} weitere, weiter zurueck.",
    from: "Von",
    until: "Bis",
    lastDay: "Letzter Tag",
    lastDayHint: "Leer lassen fuer einen einzelnen Tag. Mit einem letzten Tag wird dieselbe Zeile in jede Tagesnotiz vom Datum oben bis dorthin geschrieben, und die noch fehlenden Notizen werden angelegt.",
    spanWrote: "In {count} Tagesnotizen geschrieben.",
    spanNothing: "An jedem dieser Tage steht das bereits. Nichts geschrieben.",
    spanScope: "Gilt fuer",
    spanScopeDay: "Nur diesen Tag",
    spanScopeAll: "Den ganzen Zeitraum, {from} bis {to} ({count} Tage)",
    spanBroken: "Nicht der ganze Zeitraum: an {count} dieser Tage steht das zweimal oder anders. Diese Tage bleiben unveraendert.",
    spanChanged: "An {count} Tagen geaendert.",
    spanDeleted: "An {count} Tagen entfernt.",
    spanRefused: "Unveraendert geblieben, weil sich diese Notizen seit dem Oeffnen geaendert haben: {days}",
    lastDayBefore: "Der letzte Tag liegt vor dem ersten.",
    attendance: {
      label: "Teilnahme",
      going: "Ja",
      tentative: "Vielleicht",
      unanswered: "Nicht beantwortet",
      declined: "Nein"
    },
    meetingNotes: "Was gesagt wurde",
    meetingFollowUps: "Was daraus folgt",
    followUpRows: "Eine Zeile je Aufgabe, mit eigenem Projekt und eigenem Datum. Ohne Datum gilt der Tag des Termins.",
    addFollowUp: "Aufgabe hinzuf\xFCgen",
    noFollowUps: "Noch keine Aufgaben.",
    perLine: "Eine Zeile pro Eintrag.",
    added: "Zur Tagesnotiz hinzugef\xFCgt."
  },
  calendar: {
    import: "Kalender importieren",
    file: "Kalenderdatei",
    chooseFile: "Eine .ics-Datei waehlen, um zu sehen was eingetragen wuerde.",
    from: "Von",
    to: "Bis",
    thisWeek: "Diese Woche",
    nextWeek: "Naechste Woche",
    thisMonth: "Dieser Monat",
    summary: "{file}: {events} Termine gelesen, {lines} Zeilen im Zeitraum. {write} einzutragen, {update} zu korrigieren, {present} schon da, {attention} zum Anschauen.",
    touches: "Schreibt in {count} Tagesnotizen, {first} bis {last}.",
    outsideRange: "Einige dieser Tage liegen ausserhalb des Zeitraums, weil ein Termin der darin beginnt ganz importiert wird.",
    gap: "Fuer {from} bis {last} wurde nichts importiert. Was in diesen Tagen begann steht nicht in den Notizen.",
    unsupported: "{count} Serien nutzen Regeln die hier nicht lesbar sind ({parts}). Daraus wird nichts eingetragen, weil die Daten falsch waeren statt zu fehlen.",
    truncated: "{count} Serien beginnen zu weit zurueck. Daraus wird nichts eingetragen.",
    missingHeading: "Nicht mehr im Export",
    missingNote: "Steht noch in den Notizen. Hier wird nichts geloescht; dafuer entsteht eine Aufgabe fuer heute.",
    missingGone: "Steht auch nicht in den Notizen.",
    checkTask: 'Pruefen {day}: "{text}" steht noch in der Notiz und nicht mehr im Kalender',
    checked: "{count} Aufgaben fuer heute eingetragen",
    checkedSkipped: "{count} standen schon auf der Liste",
    answer: { tentative: "Vielleicht", unanswered: "Nicht beantwortet", declined: "Abgesagt" },
    statusAnswerChanged: "Seither anders beantwortet",
    updated: "{count} Terminzeichen korrigiert",
    refused: "{count} konnten nicht korrigiert werden; sie sagen mehr als der Dialog schreiben kann. Bitte in der Notiz bearbeiten.",
    statusNew: "Neu",
    statusPresent: "Schon da",
    statusChanged: "Geaendert, ersetzt: {old}",
    statusEdited: "Hier bearbeitet, bleibt stehen",
    statusDuplicate: "Gleich wie eine andere Zeile in dieser Datei",
    statusUnsupported: "Regel nicht lesbar",
    spanOf: "Tag {index} von {count}",
    write: "{count} Termine eintragen",
    writeChecks: "{count} Aufgaben fuer heute eintragen",
    writeAndCheck: "{count} Termine eintragen und {checks} Aufgaben notieren",
    added: "{count} Termine in {notes} Tagesnotizen eingetragen",
    kept: "Kalender abgelegt unter {path}",
    nothingRead: "In dieser Datei war kein Kalender lesbar.",
    repair: {
      title: "Importierte Terminzeiten korrigieren",
      reading: "Die abgelegten Kalenderdateien werden gelesen. Das dauert einen Moment, sie enthalten Tausende von Terminen.",
      intro: "{count} Zeilen bekommen ihre Uhrzeit an Ort und Stelle korrigiert. Nichts wird geloescht, nichts kommt dazu: nur die Uhrzeit auf der Zeile aendert sich.",
      heading: "{count} Zeilen werden korrigiert",
      blockedHeading: "{count} Zeilen koennen hier nicht korrigiert werden",
      movesDay: "Dieser Termin findet in Wirklichkeit am {wanted} statt, nicht am {day}. Die Zeile muss aus der Notiz {day} in die Notiz {wanted} umziehen, und dieser Befehl verschiebt keine Zeilen zwischen Notizen. Bitte von Hand umtragen.",
      notFound: "In der Notiz {day} steht keine solche Zeile mehr. Sie wurde bearbeitet oder nie geschrieben.",
      ambiguous: "Am {day} stehen zwei gleichlautende Zeilen, es ist also nicht zu entscheiden welche gemeint ist. Bitte in der Notiz korrigieren.",
      notEditable: "Diese Zeile sagt mehr, als der Dialog zurueckschreiben kann. Bitte in der Notiz korrigieren.",
      unreadable: "Diese abgelegten Dateien waren nicht lesbar: {files}. Ihr Inhalt wurde nicht geprueft.",
      nothing: "Alle importierten Terminzeiten stimmen. Es gibt nichts zu korrigieren.",
      noneRepairable: "Keine dieser Zeilen laesst sich hier korrigieren. Der Grund steht unten bei jeder einzelnen.",
      button: "{count} Zeilen korrigieren",
      done: "{count} Zeilen in {notes} Tagesnotizen korrigiert",
      refused: "{count} Zeilen blieben unveraendert, weil sie sich geaendert haben waehrend dieser Dialog offen war. Den Befehl noch einmal ausfuehren, um sie zu sehen."
    }
  },
  period: {
    day: "T\xE4glich",
    week: "W\xF6chentlich",
    month: "Monatlich",
    quarter: "Viertelj\xE4hrlich",
    year: "J\xE4hrlich",
    level: "Zeitraum",
    jump: "Zu einem Datum springen",
    previous: "Zur\xFCck",
    next: "Weiter",
    thisWeek: "Diese Woche",
    thisMonth: "Dieser Monat",
    weekNumber: "Woche {week}"
  },
  dashboard: {
    title: "Leben",
    greetingMorning: "Guten Morgen",
    greetingAfternoon: "Guten Tag",
    greetingEvening: "Guten Abend",
    today: "Heute",
    dueSoon: "Demn\xE4chst f\xE4llig",
    overdue: "\xDCberf\xE4llig",
    activeProjects: "Laufende Projekte",
    openTasks: "Offene Aufgaben",
    outstandingBills: "Offene Betr\xE4ge",
    thisMonthsBudget: "Budget dieses Monats",
    nothingDue: "Nichts ist f\xE4llig.",
    nothingOpen: "Nichts offen.",
    noBudget: "F\xFCr diesen Monat gibt es noch kein Budget.",
    showAll: "Alle zeigen",
    noGoals: "Noch keine Ziele.",
    noProjects: "Noch keine Projekte.",
    noGoalsInArea: "Keine Ziele in diesem Bereich.",
    noProjectsInArea: "Keine Projekte in diesem Bereich.",
    openPara: "PARA",
    openPlan: "Plan",
    openFinance: "Finanzen",
    openLedger: "Buchhaltung",
    moreBills: { one: "{count} weitere Rechnung", other: "{count} weitere Rechnungen" }
  },
  para: {
    title: "PARA",
    areas: "Bereiche",
    goals: "Ziele",
    projects: "Projekte",
    resources: "Ressourcen",
    archive: "Archiv",
    showArchived: "Archivierte anzeigen",
    noAreas: "Noch keine Bereiche.",
    noGoals: "Keine Ziele in diesem Bereich.",
    noProjects: "Keine Projekte zu diesem Ziel.",
    deadline: "Frist",
    achieved: "Erreicht am",
    completed: "Abgeschlossen am",
    created: "Erstellt am",
    done: "Erledigt am",
    closed: "Geschlossen am",
    archived: "Archiviert am",
    imageMissing: "Dieses Bild konnte nicht angezeigt werden: {value}",
    summary: "Zusammenfassung",
    summaryHint: "Ein bis zwei S\xE4tze dazu, worum es geht. Stehen oben in der Notiz.",
    archiveNote: "Archivieren",
    unarchiveNote: "Zur\xFCckholen",
    openTasks: "{count} offen",
    priority: "Priorit\xE4t",
    image: "Bild",
    imageNone: "Kein Bild",
    imagePending: "Wird beim Speichern in den Ordner der Notiz geschrieben.",
    imageFromVault: "Bild aus dem Tresor",
    imageFromDisk: "Bild vom Rechner",
    goalsCount: { one: "{count} Ziel", other: "{count} Ziele" },
    projectsCount: { one: "{count} Projekt", other: "{count} Projekte" }
  },
  plan: {
    closeTask: "Aufgabe abschliessen",
    editTask: "Aufgabe bearbeiten",
    closeDone: "Erledigt",
    closeCancelled: "Abgebrochen",
    closeComment: "Kommentar",
    closeCommentHint: "Warum es so ausgegangen ist. Wird als einger\xFCckte Zeilen unter der Aufgabe geschrieben, damit nichts anderes, das die Zeile liest, gest\xF6rt wird. Leer lassen, um ohne Kommentar abzuschliessen.",
    closeTaskStale: "Die Notiz hat sich ge\xE4ndert, seit die Aufgabe gelesen wurde. Ansicht neu \xF6ffnen und erneut versuchen.",
    title: "Plan",
    openToday: "Heute \xF6ffnen",
    openThisWeek: "Diese Woche \xF6ffnen",
    openThisMonth: "Diesen Monat \xF6ffnen",
    openThisQuarter: "Dieses Quartal \xF6ffnen",
    openThisYear: "Dieses Jahr \xF6ffnen",
    removeNavigation: "Navigationsblock entfernen",
    dueInPeriod: "In diesem Zeitraum f\xE4llig",
    tasksInPeriod: "Aufgaben",
    band: { morning: "Vormittag", lunch: "Mittag", afternoon: "Nachmittag" },
    moreMeetings: { one: "+{count} weiterer", other: "+{count} weitere" },
    countMeetings: { one: "{count} Termin", other: "{count} Termine" },
    countTasks: { one: "{count} Aufgabe", other: "{count} Aufgaben" },
    countDeadlines: { one: "{count} Frist", other: "{count} Fristen" },
    countMoney: { one: "{count} Zahlung", other: "{count} Zahlungen" },
    billsInPeriod: "Rechnungen",
    recurringInPeriod: "Wiederkehrend",
    defer: "Verschieben",
    deferOn: "{weekday}, {date}",
    until: {
      week: "Diese Woche, bis {date}",
      month: "Diesen Monat, bis {date}",
      day: "Bis {date}",
      quarter: "Dieses Quartal, bis {date}",
      year: "Dieses Jahr, bis {date}"
    },
    nothingInPeriod: "In diesen Zeitraum f\xE4llt nichts."
  },
  crm: {
    title: "Personen und Firmen",
    persons: "Personen",
    unclassified: "Ohne Rolle",
    anyRole: "in jeder Liste",
    searchPlaceholder: "Namen, Tags und Kontaktdaten durchsuchen",
    noMatches: "Dazu passt nichts.",
    tab: {
      persons: "Personen",
      companies: "Firmen"
    },
    empty: {
      persons: "Noch keine Personen.",
      companies: "Noch keine Firmen."
    },
    newCompany: "Neue Firma",
    description: "Beschreibung",
    address: "Adresse",
    website: "Webseite",
    email: "E-Mail",
    companies: "Firmen",
    defaultsFor: "Fuer {company} merken",
    defaultsHint: "Diese Firma bucht sonst auf {where}.",
    defaultsRemembered: "{company} verwendet das ab jetzt.",
    addCompany: "Firma hinzufuegen",
    newPerson: "Neue Person",
    editCompany: "Firma bearbeiten",
    editPerson: "Person bearbeiten",
    mobile: "Mobil",
    phonePrivate: "Telefon (privat)",
    phoneWork: "Telefon (Arbeit)",
    roles: "Was sie sind (meals, hotel, \u2026)",
    paymentProvider: "Zahlungsdienstleister",
    paymentProviderHint: "Zieht fuer andere Firmen ein, die Belege nennen darum nicht den Haendler."
  },
  ledger: {
    journal: "Journal",
    account: "Konto",
    accounts: "Konten",
    number: "Nummer",
    kind: "Art",
    group: "Gruppe",
    opening: "Anfangsbestand",
    openingDate: "Anfangsbestand per",
    closed: "Geschlossen",
    iban: "IBAN",
    bankAccount: "Bankkontonummer",
    person: "Person",
    paidInto: "Eingegangen auf",
    paidFrom: "Bezahlt ab Konto",
    earnedOn: "Ertrag auf",
    bookedTo: "Gebucht auf",
    basisAccrual: "Was die Periode gekostet hat",
    basisCash: "Was die Konten verlassen hat",
    basisAccrualHint: "Eine Rechnung zaehlt, wenn sie angefallen ist, bezahlt oder nicht.",
    basisCashHint: "Nur Geld, das in dieser Periode wirklich abgeflossen ist.",
    basisSettled: "Auf Schulden bezahlt",
    basisOut: "Total abgeflossen",
    keepStatement: "Datei ablegen",
    statementAlreadyKept: "Dieser Auszug ist bereits abgelegt.",
    statementKept: "Auszug abgelegt unter {path}",
    statementNotKept: "Die Buchungen wurden geschrieben, der Auszug konnte aber nicht abgelegt werden: {reason}",
    archive: "Abgelegte Auszuege",
    archiveNone: "Noch keine Auszuege abgelegt. Bei jedem Import wird einer abgelegt.",
    archiveAllPosted: "Alles gebucht",
    archiveUnreadable: "Diese Datei laesst sich nicht als Auszug lesen.",
    archiveUnposted: {
      one: "{count} Zeile nicht gebucht",
      other: "{count} Zeilen nicht gebucht"
    },
    archiveSettled: {
      one: "{count} Auszug abgelegt, alles gebucht",
      other: "{count} Auszuege abgelegt, alles gebucht"
    },
    archiveShow: "Zeigen",
    archiveHide: "Ausblenden",
    archiveFinish: "Fertig buchen",
    landingAgrees: "Nach dem Schreiben steht dieses Konto auf {balance}, dort endet die Datei.",
    landingDiffers: "Nach dem Schreiben steht dieses Konto auf {ledger}. Die Datei endet bei {statement}, {difference} daneben.",
    landingUndecided: {
      one: "{count} Zeile hat noch kein Konto, sie macht {amount} aus.",
      other: "{count} Zeilen haben noch kein Konto, sie machen zusammen {amount} aus."
    },
    handoverFits: "Diese Datei beginnt beim Saldo von {accounts}. Moeglicherweise ist es der Auszug dieses Kontos und nicht dieses hier.",
    nearMissAccount: "Am {date} ist bereits eine Zahlung dieses Betrags gebucht, aber auf {booked} statt {expected}. Beim Speichern entsteht eine zweite Buchung dafuer.",
    nearMissDate: "Diese Zahlung ist am {date} bereits gebucht, ausserhalb der Tage, die um diese Rechnung herum durchsucht werden. Setze das Zahldatum auf diesen Tag, dann wird sie erkannt.",
    wouldWrite: "Speichern wuerde schreiben:",
    alreadyPosted: "Schon gebucht. Als bezahlt markieren bucht es nicht nochmals:",
    noInvoice: "Keine Rechnung",
    remember: "Merken",
    rememberAs: 'Kuenftig alles mit "{match}" auf dieses Konto buchen',
    legNeedsAccount: "Eine Zeile hat einen Betrag, aber kein Konto.",
    editPosting: "Buchung bearbeiten",
    deleteConfirm: "Endgueltig loeschen?",
    postingDeleted: "Buchung geloescht",
    postingGone: "Diese Zeile gibt es nicht mehr. Die Notiz wurde anderswo geaendert; Buchhaltung neu oeffnen und nochmals versuchen.",
    alreadySettled: "Bereits ueber die Rechnung gebucht",
    settlesBill: "Zahlt {title}",
    alsoOpen: "{count} weitere offene Rechnungen passen zu dieser Zeile",
    billsPaid: "{count} Rechnungen als bezahlt markiert",
    payNeedsAccounts: "Fuer die Buchung dieser Zahlung das Gegenkonto und das Zahlkonto angeben.",
    overrides: "Pro Monat",
    yearPlan: "Jahresplanung",
    yearTotal: "Jahrestotal",
    closedThrough: "Abgeschlossene Monate",
    via: "\xDCber Konto",
    viaDefault: "Standardkonto (via)",
    viaNone: "Kein Konto",
    lineNote: "Kommentar",
    rangeFrom: "Von Monat",
    rangeTo: "Bis Monat",
    viaFromNote: "Standard des Budgets",
    closeMonth: "{month} abschliessen",
    budgetModeYear: "Das Jahr",
    budgetModeMonth: "Ein Monat",
    budgetModeYearHint: "Was in den abgeschlossenen Monaten geschah, f\xFCr den Rest der Plan.",
    budgetModeMonthHint: "Der angezeigte Monat, Plan gegen Ist.",
    closedMonth: "{month} abgeschlossen: der Monat zeigt jetzt, was geschah.",
    reopenedMonth: "{month} wieder ge\xF6ffnet: der Monat zeigt wieder den Plan.",
    nothingToReopen: "Kein Monat von {year} ist abgeschlossen.",
    allMonthsClosed: "Alle Monate von {year} sind abgeschlossen.",
    noBudgetForYear: "Keine Budgetnotiz fuer {year}. Eine anlegen, um das Jahr zu planen.",
    postingCount: "{count} Buchungen",
    debit: "Soll",
    credit: "Haben",
    balance: "Saldo",
    importStatement: "Kontoauszug importieren",
    intoAccount: "Auszug fuer",
    format: "Format",
    file: "Datei",
    chooseFile: "Datei waehlen, um zu sehen was gebucht wuerde.",
    chooseAccount: "Welches Konto?",
    noAccounts: 'Noch keine Kontonotizen. Zuerst "Kontenplan anlegen" ausfuehren.',
    importSummary: "{file}: {read} Zeilen gelesen, {accepted} zu buchen. {ready} bereit, {attention} brauchen eine Entscheidung, {skipped} schon gebucht.",
    handoverAgrees: "Die Buchhaltung hat dieses Konto am Tag vor Dateibeginn bei {balance}. Das stimmt ueberein.",
    handoverDiffers: "Die Buchhaltung hat dieses Konto am Tag vor Dateibeginn bei {ledger}, die Datei beginnt bei {statement}. Differenz {difference}. Dazwischen fehlt etwas.",
    chainHolds: "Der Saldo geht von der ersten bis zur letzten Zeile auf. Anfangsbestand {opening}.",
    chainBreaks: "Der Saldo geht bei {count} Zeile(n) nicht auf. Format pruefen, bevor geschrieben wird.",
    alreadyImported: "Schon importiert",
    mirrorsExisting: "Gegenseite schon gebucht",
    batchOf: "{count} Zahlungen in einer Zeile",
    split: "Aufteilen",
    legsSet: "{count} Zeilen",
    splitOf: "Aufteilung: {label}",
    addLeg: "Zeile hinzufuegen",
    legText: "Wofuer",
    splitTotals: "{entered} von {total}",
    splitDifference: "Differenz {difference}",
    writePostings: "{count} Buchungen schreiben",
    imported: "{count} Buchungen in {notes} Journalnotizen geschrieben",
    title: "Buchhaltung",
    problems: "Zu pruefen",
    assets: "Aktiven",
    liabilities: "Passiven",
    net: "Reinvermoegen",
    income: "Einnahmen",
    expense: "Ausgaben",
    result: "Ergebnis",
    postings: "Buchungen",
    noPostings: "Auf dieses Konto wurde noch nichts gebucht.",
    noText: "(ohne Text)",
    unassigned: "nicht zugewiesen",
    nothingInPeriod: "In dieser Periode wurde nichts gebucht.",
    heldAt: "haelt {held}, zu {rate}",
    heldNoRate: "haelt {held}, und kein Kurs fuehrt zu {currency}",
    tab: {
      accounts: "Kontenplan",
      statement: "Kontoauszug",
      income: "Gewinnermittlung",
      balance: "Bestandeskonten",
      budget: "Budget"
    },
    problem: {
      unreadable: "Zeile nicht lesbar",
      "no-date": "Kein lesbares Datum",
      "no-amount": "Kein lesbarer Betrag",
      "no-accounts": "Kein Konto genannt",
      "split-does-not-sum": "Aufteilung ergibt nicht das Total",
      "orphan-continuation": "Aufteilungszeile ohne Buchung darueber",
      "unknown-account": "Keine Kontonotiz mit Nummer {number}",
      "order-differs": "Bestellung {order} ist anders bepreist",
      "self-posting": "Konto {number} auf beiden Seiten, dadurch bewegt sich nichts",
      "currency-mismatch": "Konto {number} laeuft in {held}, dieser Betrag ist in {written} geschrieben"
    },
    newPosting: "Neue Buchung",
    movement: "Bewegung",
    postingDate: "Datum",
    toAccount: "waechst",
    fromAccount: "zahlt",
    splitHint: "Ein Betrag auf mehrere Konten?",
    fromSplit: "aus der Aufteilung",
    ordersFound: "{count} davon sind Bestellungen, die im Vault schon stehen.",
    fillFromOrders: "{count} aus den Bestellungen fuellen",
    orderDiffers: "{order}: die Karte belastet {charged}, die Bestellung sagt {ordered}.",
    paysOrder: "Bezahlt Bestellung {title}",
    ordersAmbiguous: "{count} Bestellungen passen gleich gut, darum wird keine verwendet.",
    needsNumber: "Hier fehlt die Kontonummer.",
    needsYear: "Hier fehlt das Jahr.",
    needsDate: "Hier fehlt das Datum.",
    needsAmount: "Hier fehlt der Betrag.",
    needsBothAccounts: "Beide Konten angeben: das wachsende und das zahlende.",
    needsDebit: "Das wachsende Konto angeben.",
    needsCredit: "Das zahlende Konto angeben.",
    needsOneAccount: "Die Aufteilung nennt eine Seite. Die andere fehlt.",
    needsCounterAmount: "Zwei Waehrungen, daher wird auch der Betrag in {currency} gebraucht.",
    amountFirst: "Zuerst den Betrag eingeben.",
    splitUnreadable: "Diese Zeilen lassen sich nicht so zurueckschreiben, wie sie geschrieben wurden. Dieses Formular speichert sie darum nicht. Bitte die Journalnotiz direkt bearbeiten.",
    twoCurrencies: "Diese Konten laufen in {near} und {far}, daher werden beide Betraege gebraucht.",
    useRate: "{currency} {amount} aus deinem Kurs uebernehmen",
    newAccount: "Neues Konto",
    accountPersonShared: "Gemeinsam",
    kindFromNumber: "Aus der Nummer",
    kindAsset: "Aktiven",
    kindLiability: "Passiven",
    kindIncome: "Ertrag",
    kindExpense: "Aufwand",
    numberTaken: "Konto {number} gibt es schon.",
    accountSetup: "Konten einrichten",
    accountSetupDesc: "Was jedes Konto am Stichtag hielt, und wie die Bank es nennt. Die Kontonummer ist es, was einen Uebertrag zwischen zwei eigenen Konten von selbst aufloest, statt jedes Mal zu fragen.",
    ibanOrNumber: "IBAN oder Kontonummer",
    openingSaved: "{count} Anfangsbestaende geschrieben",
    asOf: "Per",
    seedChart: "Kontenplan anlegen",
    vehicle: "Fahrzeug",
    seeded: "{created} Konten angelegt, {skipped} schon vorhanden"
  },
  finance: {
    deliveries: "Lieferungen",
    deliveryItemName: "Name der gelieferten Position",
    deliveryItemQuantity: "Gelieferte Menge",
    recordDelivery: "Lieferung erfassen",
    deliveryArrivedOn: "Angekommen am",
    deliveryNote: "Sendungsnummer oder Notiz",
    deliveryNothingChosen: "W\xE4hle mindestens eine gelieferte Position.",
    deliveryNothingOutstanding: "Alles zu diesem Einkauf ist angekommen.",
    deliveryAlready: "{count} bereits erfasst, zuletzt am {last}.",
    outstandingLines: "{count} von {total} noch ausstehend",
    title: "Finanzen",
    purchases: "Eink\xE4ufe",
    bills: "Rechnungen",
    recurring: "Wiederkehrend",
    budget: "Budget",
    amount: "Betrag",
    currency: "W\xE4hrung",
    company: "Firma",
    counterparty: "Firma oder Person",
    area: "Bereich",
    project: "Projekt",
    cadence: "Rhythmus",
    category: "Kategorie",
    openDocument: "Beleg oeffnen",
    openDocuments: {
      one: "Beleg oeffnen",
      other: "Einen von {count} Belegen oeffnen"
    },
    documentMissing: "Diese Notiz zeigt auf {path}, das nicht im Vault liegt.",
    reference: "Referenz",
    oneAccount: "Auf ein Konto gebucht",
    splitBill: "Auf Konten aufteilen",
    document: "Beleg",
    documentNone: "Kein Dokument",
    documentPending: "Wird beim Speichern neben die Notiz abgelegt",
    documentFromVault: "Aus dem Tresor waehlen",
    documentFromDisk: "Von diesem Rechner waehlen",
    orderDate: "Bestelldatum",
    deliveryDate: "Lieferdatum",
    direction: "Richtung",
    directions: {
      incoming: "Wir schulden das (Kreditorenrechnung)",
      outgoing: "Uns wird geschuldet (Debitorenrechnung)"
    },
    issueDate: "Rechnungsdatum",
    dueDate: "F\xE4llig am",
    paidDate: "Bezahlt am",
    startDate: "Beginnt",
    endDate: "Endet",
    interval: "Alle",
    items: "Positionen",
    itemName: "Position",
    quantity: "Menge",
    price: "Preis",
    discount: "Rabatt",
    shipping: "Versand",
    vatRate: "MWST-Satz",
    vatAmount: "MWST-Betrag",
    subtotal: "Zwischensumme",
    total: "Total",
    stated: "Angegeben",
    computed: "Berechnet",
    totalsDisagree: "Das angegebene Total passt nicht zu den Positionen.",
    planned: "Geplant",
    actual: "Tats\xE4chlich",
    variance: "Rest",
    unbudgeted: "Ausserhalb des Budgets",
    nothingInPeriod: "Nichts in dieser Periode.",
    noCompanyNote: "Keine Firmennotiz, in die das geschrieben werden koennte.",
    salesInvoices: "Gestellte Rechnungen",
    owedToUs: "Uns geschuldet",
    outstandingElsewhere: "Noch offen, ausserhalb dieser Periode",
    outstanding: "Offen",
    allBudgets: "Alle Budgets",
    editLines: "Zeilen dieser Notiz bearbeiten",
    lineCount: { one: "{count} Zeile", other: "{count} Zeilen" },
    markPaid: "Bezahlt",
    markUnpaid: "Doch nicht bezahlt",
    occurrences: { one: "{count} F\xE4lligkeit", other: "{count} F\xE4lligkeiten" },
    noPurchases: "Noch keine Eink\xE4ufe.",
    noBills: "Noch keine Rechnungen.",
    noRecurring: "Noch keine wiederkehrenden Kosten.",
    createBillFromOccurrence: "Rechnung f\xFCr diese F\xE4lligkeit anlegen"
  },
  projects: {
    title: "Projekte",
    search: "Name",
    searchHint: "Teil eines Projektnamens",
    noneMatch: "Kein Projekt passt zu diesen Filtern.",
    clearFilters: "Filter zur\xFCcksetzen"
  },
  tasks: {
    title: "Aufgaben",
    open: "Offen",
    overdue: "\xDCberf\xE4llig",
    dueToday: "Heute f\xE4llig",
    done: "Erledigt",
    noTasks: "Hier gibt es keine Aufgaben.",
    count: { one: "{count} Aufgabe", other: "{count} Aufgaben" }
  },
  // Der einmalige Umzug archivierter Importe aus dem Belegordner. Nur der
  // Dialog: die Dateien selbst enthalten keinen uebersetzten Text.
  imports: {
    migrate: {
      title: "Importierte Dateien in den Importordner verschieben",
      nothing: "Nichts zu verschieben. Jeder aufbewahrte Import liegt bereits in seinem Importordner.",
      intro: "{count} Dateien werden neben die Notizen verschoben, die sie gefuellt haben, in den Importordner, und so umbenannt, dass der Name mit dem Zeitpunkt des Imports beginnt. Es wird nichts geschrieben, nichts geloescht und keine Notiz veraendert.",
      stamps: "Die alten Namen enthielten keinen Importzeitpunkt, deshalb wird ersatzweise der Zeitpunkt verwendet, zu dem die Datei im Tresor angelegt wurde. Diese Dateien sind alle aelter als alles, was ein neuer Import aufbewahrt, und stehen daher in der richtigen Reihenfolge, wie weit dieser Zeitpunkt auch danebenliegt.",
      heading: "{count} Dateien zu verschieben",
      button: "{count} Dateien verschieben",
      done: "{count} Dateien verschoben.",
      failed: "Unveraendert geblieben: {files}"
    }
  },
  sheets: {
    export: "Als Blatt exportieren",
    written: "Blatt gespeichert unter {path}",
    failed: "Das Blatt konnte nicht gespeichert werden.",
    credit: "Erstellt von {author} am {date} mit NODAtrail",
    creditAnonymous: "Erstellt am {date} mit NODAtrail",
    truth: "Diese Seite ist ein Ausdruck des Journals zum Zeitpunkt der Erstellung. Massgeblich sind die Notizen im Vault: jede Zahl wird aus den Buchungen berechnet.",
    currencyRule: "Konten in einer anderen W\xE4hrung sind zu den Kursen aus den Einstellungen umgerechnet. Eines ohne Kurs bleibt aus allen Summen heraus.",
    chart: {
      title: "Kontenplan {period}"
    },
    balance: {
      title: "Bestandeskonten am {day}",
      fileName: "Bestandeskonten {day}"
    },
    income: {
      title: "Gewinnermittlung {period}",
      titleCash: "Gewinnermittlung {period} (Geldfluss)"
    },
    statement: {
      title: "Kontoauszug {account}",
      fileName: "Kontoauszug {account} {period}",
      text: "Text",
      inward: "Eingang",
      outward: "Ausgang",
      closing: "Schlussbestand"
    },
    report: {
      total: "Total {section}",
      asOf: "Best\xE4nde per {day}",
      period: "Periode {period}"
    },
    budget: {
      title: "Jahresplanung {year}",
      fileName: "Jahresplanung {year}",
      currency: "Betr\xE4ge in {currency}",
      closedThrough: "Ist bis {month}, danach Plan",
      noneClosed: "Noch kein Monat abgeschlossen: das ganze Jahr ist Plan",
      allClosed: "Alle zw\xF6lf Monate abgeschlossen",
      flows: "Einnahmen und Ausgaben",
      income: "Total Einnahmen",
      expense: "Total Ausgaben",
      result: "Einnahmen - Ausgaben",
      balances: "Verm\xF6gen",
      netWorth: "Verm\xF6gen",
      unassigned: "Nicht zugeordnet",
      opening: "Vortrag",
      total: "Total",
      plan: "Plan",
      variance: "Abweichung",
      actual: "Ist",
      planned: "Plan",
      unbudgeted: "nicht budgetiert",
      noRate: "kein Kurs",
      totalHint: "Total ist, was in den abgeschlossenen Monaten geschah, plus der Plan f\xFCr den Rest. Plan ist das Jahr, wie es geplant wurde; Abweichung ist Total weniger Plan.",
      projectedHint: "Nach dem letzten abgeschlossenen Monat wird jeder Bestand um die geplanten Buchungen fortgeschrieben, kursiv. Was der Plan bewegt, ohne ein Konto zu nennen, steht unter Nicht zugeordnet.",
      openingProjectedHint: "Das Jahr {previous} ist noch nicht bis Dezember abgeschlossen. Der Vortrag ist deshalb sein geplanter Dezember, kursiv, und wird zum gebuchten Bestand, sobald Dezember abgeschlossen ist.",
      strayLines: "Budgetzeilen auf Konten, die weder Einnahmen noch Ausgaben sind, werden nicht gezeigt: {numbers}"
    }
  },
  commands: {
    openDashboard: "Lebens-Dashboard \xF6ffnen",
    openPara: "PARA \xF6ffnen",
    openPlan: "Plan \xF6ffnen",
    openLedger: "Buchhaltung oeffnen",
    exportLedgerSheet: "Angezeigten Buchhaltungs-Tab als Blatt exportieren",
    reopenBudgetMonth: "Letzten abgeschlossenen Budgetmonat wieder \xF6ffnen",
    openFinance: "Finanzen \xF6ffnen",
    newArea: "Neuer Bereich",
    newGoal: "Neues Ziel",
    newProject: "Neues Projekt",
    newResource: "Neue Ressource",
    newPurchase: "Neuer Einkauf",
    newBill: "Neue Rechnung",
    newRecurring: "Neue wiederkehrende Kosten",
    newBudget: "Neues Budget",
    archiveNote: "Diese Notiz archivieren",
    unarchiveNote: "Diese Notiz aus dem Archiv holen",
    runHealthCheck: "Vault pr\xFCfen",
    createSampleVault: "Beispielnotizen anlegen",
    migrateImports: "Importierte Dateien in den Importordner verschieben"
  },
  // Der Beispiel-Vault. Übersetzt sind nur der Befehlsname, die Beschriftungen
  // des Dialogs und seine Meldungen: der Inhalt der Notizen selbst ist in jedem
  // Vault englisch, weil er Produktmaterial ist und keine Oberfläche.
  sample: {
    title: "Beispielnotizen anlegen",
    intro: "Das schreibt Notizen in diesen Vault: eine Woche Tagesnotizen, einen PARA-Baum, die Finanznotizen und einen Monat Buchhaltung. Nichts, was schon da ist, wird \xFCberschrieben.",
    createHeading: {
      one: "W\xFCrde {count} Notiz anlegen",
      other: "W\xFCrde {count} Notizen anlegen"
    },
    skipHeading: {
      one: "{count} Notiz ist schon da und bleibt unber\xFChrt",
      other: "{count} Notizen sind schon da und bleiben unber\xFChrt"
    },
    augmentHeading: {
      one: "W\xFCrde {count} Notiz \xE4ndern",
      other: "W\xFCrde {count} Notizen \xE4ndern"
    },
    augmentExplain: "Diese Notizen gibt es schon; sie bek\xE4men am Ende einen NODAtrail-Block, damit sie auch hier dargestellt werden. Sonst wird nichts an ihnen ver\xE4ndert.",
    // Keine Warnung und keine Ablehnung. `CRM/People` beschreiben alle drei
    // Plugins, und ausserdem jeder, der seine Kontakte in diesem Vault führt:
    // eine Personennotiz, die dieser Lauf nicht kennt, gehört jemandem und ist
    // kein Fremdkörper, der Lauf geht weiter. Diese drei Texte sind die Vorschau,
    // die ehrlich über einen Ordner spricht, der ihr nicht gehört.
    sharedHeading: "Wird neben das Vorhandene geschrieben",
    sharedExplain: "Dieser Ordner wird gemeinsam mit den anderen TRAILsuite-Plugins und mit Ihren eigenen Kontakten benutzt. Was schon darin liegt, bleibt unver\xE4ndert; die Beispielnotizen kommen daneben.",
    alreadyThere: {
      one: "{count} Notiz liegt schon darin: {titles}",
      other: "{count} Notizen liegen schon darin: {titles}"
    },
    blockedHeading: "Es kann noch nichts geschrieben werden",
    occupiedExplain: "In diesen Ordnern liegen Notizen, die dieser Befehl nicht geschrieben hat. Er schreibt nicht in einen Ordner, den jemand schon benutzt.",
    strangers: "enth\xE4lt bereits: {titles}",
    unconfigured: "F\xFCr diese Notizen ist kein Ordner oder kein Typwert eingestellt: {titles}",
    nothingToDo: "Alle Beispielnotizen sind schon in diesem Vault.",
    createButton: "Notizen anlegen",
    createdNotice: { one: "{count} Notiz angelegt.", other: "{count} Notizen angelegt." },
    augmentedNotice: {
      one: "{count} Notiz hat einen Block bekommen.",
      other: "{count} Notizen haben einen Block bekommen."
    },
    failedNotice: "Nicht geschrieben: {titles}"
  },
  health: {
    title: "Vault-Pr\xFCfung",
    run: "Erneut pr\xFCfen",
    allClear: "Nichts zu melden.",
    wrongType: "Der Typ passt nicht zum Ordner",
    missingType: "Keine Typ-Eigenschaft",
    brokenLink: "Verweist auf eine Notiz, die es nicht gibt",
    missingImage: "Das Bild l\xE4sst sich nicht aufl\xF6sen",
    billWithoutAmount: "Kein Betrag",
    dueBeforeIssue: "F\xE4llig vor dem Rechnungsdatum",
    totalsDisagree: "Das angegebene Total passt nicht zu den Positionen",
    unknownBudgetArea: "Nennt einen Bereich, den es nicht gibt",
    oldStampShape: "Der Erstellt- oder Ge\xE4ndert-Stempel hat eine \xE4ltere Form",
    fix: "Beheben",
    fixAll: "{count} beheben",
    issuesFound: { one: "{count} Befund", other: "{count} Befunde" }
  },
  notices: {
    noteExists: "Unter {path} gibt es bereits eine Notiz.",
    noteUpdated: "{title} aktualisiert",
    fixesApplied: { one: "{count} behoben", other: "{count} behoben" },
    noteCreated: "{title} angelegt.",
    archived: "{title} ins Archiv verschoben.",
    unarchived: "{title} aus dem Archiv geholt.",
    navigationRemoved: "Navigationsblock entfernt.",
    notAPeriodNote: "Das ist keine Zeitraum-Notiz.",
    nothingToArchive: "Diese Notiz kann NODAtrail nicht archivieren.",
    folderNotConfigured: "Dieser Ordner ist noch nicht eingerichtet. Siehe Einstellungen.",
    typeValueNotConfigured: "Dieser Typwert ist noch nicht eingerichtet. Siehe Einstellungen."
  },
  settings: {
    title: "NODAtrail",
    version: "Version",
    releaseNotes: "Versionshinweise",
    support: "Support",
    contact: "Kontakt",
    about: "\xDCber",
    aboutBody: "NODAtrail geh\xF6rt zu TRAILsuite, neben APERtrail f\xFCr Reisen und CULItrail f\xFCr die K\xFCche. Alle drei teilen sich eine Bibliothek und einen Ordner mit Personen- und Firmennotizen.",
    aboutUsage: "F\xFCr die private Nutzung kostenlos. Jede gesch\xE4ftliche Nutzung erfordert eine kommerzielle Lizenz.",
    aboutLicensingLink: "Kommerzielle Lizenz",
    vault: {
      heading: "Vault-Einrichtung",
      rootFolder: "Wurzelordner",
      rootFolderDesc: "Ein optionaler Ordner \xFCber allem, was NODAtrail verwaltet. Leer bedeutet die Vault-Wurzel, was ein Vault mit den nummerierten PARA-Ordnern will.",
      showRibbonIcon: "Symbol in der Seitenleiste zeigen",
      showRibbonIconDesc: "\xD6ffnet das Lebens-Dashboard."
    },
    display: {
      heading: "Anzeige",
      displayLocale: "Zahlenformat",
      displayLocaleDesc: "Wie Betraege geschrieben werden, als Locale-Code. de-CH ergibt 1'309.98, de-DE ergibt 1.309,98, en-GB ergibt 1,309.98. Unabhaengig von der Sprache der Oberflaeche: ein Schweizer Haushalt auf einem deutsch eingestellten Rechner liest sein Geld trotzdem schweizerisch.",
      rates: "Wechselkurse",
      ratesDesc: "Was eine Einheit einer Fremdwaehrung in der Hauptwaehrung wert ist, als EUR 0.93458, USD 1.14. Ein umgekehrt notierter Kurs kann als Division geschrieben werden: EUR 1/1.07 ergibt dasselbe. Es wird nichts abgerufen: ein Kurs, den niemand gewaehlt hat, ist ein Kurs, den niemand pruefen kann. Eine Waehrung ohne Kurs bleibt aus den Summen heraus und ihre Zeile sagt es.",
      exportAuthor: "Name auf gedruckten Bl\xE4ttern",
      exportAuthorDesc: 'Wen ein gedrucktes Blatt als Ersteller nennt: "Erstellt von Thomas am ...". Leer lassen l\xE4sst den Namen weg. APERtrail hat dieselbe Einstellung.',
      homeCurrency: "Eigene W\xE4hrung",
      homeCurrencyDesc: "Die W\xE4hrung, in der ein Betrag gilt, wenn eine Notiz nichts sagt.",
      currencyOptions: "W\xE4hrungen zur Auswahl",
      currencyOptionsDesc: "Die Codes, die die Editoren anbieten, mit Komma getrennt.",
      dayHeading: "Tagesansicht",
      showClosedTasks: "Erledigte Aufgaben weiter anzeigen",
      showClosedTasksDesc: "Erledigte und abgebrochene Aufgaben bleiben in der Tagesliste stehen, blass und durchgestrichen. \xC4ndern lassen sie sich dort nicht; ein Klick \xF6ffnet die Notiz, in der sie stehen.",
      weekHeading: "Wochenansicht",
      workdaysOnly: "Nur Arbeitswoche",
      workdaysOnlyDesc: "Zeigt Montag bis Freitag. Samstag und Sonntag stehen zusammengefasst in einer Zeile unter dem Raster, es geht also nichts verloren.",
      lunchStart: "Mittag von",
      lunchEnd: "Mittag bis",
      lunchDesc: "Teilt jede Tagesspalte in Vormittag, Mittag und Nachmittag. Ein Termin z\xE4hlt nach seinem Beginn -- einer von 10:00 bis 14:00 ist ein Vormittagstermin. Beide Felder leeren teilt den Tag in zwei.",
      dueSoonDays: "Rechnung so viele Tage im Voraus als f\xE4llig zeigen",
      dueSoonDaysDesc: "Innerhalb dieses Fensters gilt eine Rechnung als f\xE4llig statt nur als offen.",
      categories: "Ausgabenkategorien",
      categoriesDesc: "Die Kategorie-Ids, die die Editoren anbieten, mit Komma getrennt. Eine unbekannte Id wird trotzdem gelesen und genau so angezeigt, wie sie dasteht.",
      taskFolders: "Aufgaben suchen in",
      taskFoldersDesc: "Mit Komma getrennte Ordner. Bewusst nicht der ganze Vault: eine Einkaufsliste in einer Mahlzeit-Notiz ist keine Lebensaufgabe."
    },
    day: {
      heading: "Tagesnotiz",
      description: 'Was der Dialog "Zum Tag hinzuf\xFCgen" in eine Tagesnotiz schreibt. \xDCberschriften entstehen erst, wenn der erste Eintrag sie braucht -- eine Tagesnotiz wird nie mit einer Vorlage angelegt.',
      blankUsesDefault: 'Leer lassen f\xFCr "{example}".',
      focusHeading: "\xDCberschrift f\xFCr Aufgaben",
      scheduleHeading: "\xDCberschrift f\xFCr Termine",
      notesHeading: "\xDCberschrift f\xFCr Notizen und Ideen",
      meetingMarker: "Zeichen f\xFCr einen Termin",
      tentativeMarker: "Terminzeichen: vielleicht",
      unansweredMarker: "Terminzeichen: nicht beantwortet",
      declinedMarker: "Terminzeichen: abgesagt",
      attendanceDesc: "Ein importierter Termin wird mit dem Zeichen fuer die eigene Antwort geschrieben. Leer lassen, um ihn wie jeden anderen zu schreiben.",
      noteMarker: "Zeichen f\xFCr eine Notiz",
      ideaMarker: "Zeichen f\xFCr eine Idee",
      spanMarker: "Zeichen f\xFCr mehrere Tage",
      placeMarker: "Zeichen f\xFCr den Ort",
      personMarker: "Zeichen f\xFCr die Beteiligten",
      markerDesc: "Aufgaben brauchen kein Zeichen: sie sind Kontrollk\xE4stchen im Format des Tasks-Plugins. Leer lassen schreibt einen einfachen Aufz\xE4hlungspunkt."
    },
    folders: {
      heading: "Ordner",
      description: "Wo jede Art von Notiz liegt.",
      openPage: "Ordner",
      planSection: "Plan",
      paraSection: "PARA",
      financeSection: "Finanzen",
      archiveSubfolder: "Archiv: {kind}",
      archiveSubfolderDesc: "Der Unterordner im Archiv je Art. Wird eine dieser Angaben ge\xE4ndert, w\xE4hrend dort schon Notizen liegen, bleiben die alten liegen -- der Ordner wird nicht mitbenannt.",
      projectFolderPerNote: "Eigener Ordner je Projekt",
      projectFolderPerNoteDesc: "Ein neues Projekt bekommt einen Ordner mit seinem Namen. Notiz, Dokumente und Bild liegen zusammen, und beim Archivieren wandert der ganze Ordner. Bestehende Projekte und Sammelordner bleiben, wie sie sind -- gelesen wird beides gleich.",
      archiveYearFolders: "Archiv nach Jahr ablegen",
      archiveYearFoldersDesc: "Archivierte Notizen landen in einem Jahresordner unter ihrer Kategorie. Sinnvoll ab etwa hundert Notizen pro Jahr; aus l\xE4sst alles direkt in der Kategorie. Gelesen wird beides gleich, ein bereits abgelegtes Jahr wird nie verschoben.",
      projectDefaultImageName: "Ersatzbild heisst",
      projectDefaultImageNameDesc: 'Ein Bild im Bilderordner des Projektordners mit diesem Namen wird f\xFCr jedes Projekt ohne eigenes Bild gezeigt. Ein Pr\xE4fix davor grenzt die Familie ein: mit "Default" nutzt jedes Projekt, dessen Titel mit CN- beginnt, die Datei CN-Default; das l\xE4ngste passende Pr\xE4fix gewinnt. In die Notiz wird nichts geschrieben, ein Umbenennen der Datei \xE4ndert also alle Projekte auf einmal. Leer lassen schaltet es ab.',
      imageSubfolder: "Unterordner f\xFCr Bilder",
      imageSubfolderDesc: "Unter dem Ordner der Notiz. Ein vom Rechner gew\xE4hltes Bild wird dorthin geschrieben; ein Bild aus dem Tresor wird dort verlinkt, wo es liegt, und nie verschoben.",
      crmSection: "Personen und Firmen",
      crmFolder: "CRM-Wurzel",
      eligiblePersonTags: "Tags f\xFCr ausw\xE4hlbare Personen",
      eligiblePersonTagsDesc: "Kommagetrennte Tags. Nur Personen mit einem dieser Tags werden angeboten, wenn ein Konto eine Person braucht. Leer lassen, um alle anzubieten.",
      billVendorRole: "Rolle f\xFCr Firmen, die Ihnen Rechnungen stellen",
      billVendorRoleDesc: 'Eine Rolle, zum Beispiel "vendor". Nur Firmen mit dieser Rolle werden bei einer Eingangsrechnung angeboten. Leer lassen, um alle Firmen anzubieten.',
      billCustomerRole: "Rolle f\xFCr Firmen, denen Sie Rechnungen stellen",
      billCustomerRoleDesc: 'Eine Rolle, zum Beispiel "customer". Nur Firmen mit dieser Rolle werden bei einer Ausgangsrechnung angeboten. Leer lassen, um alle Firmen anzubieten.',
      planRootFolder: "Plan-Wurzel",
      dailyPath: "Pfad der Tagesnotiz",
      weeklyPath: "Pfad der Wochennotiz",
      monthlyPath: "Pfad der Monatsnotiz",
      quarterlyPath: "Pfad der Quartalsnotiz",
      yearlyPath: "Pfad der Jahresnotiz",
      pathTokens: "Platzhalter: {YYYY} Jahr, {MM} Monat, {DD} Tag, {GGGG} ISO-Wochenjahr, {WW} ISO-Woche, {Q} Quartal.",
      areasFolder: "Bereiche",
      goalsFolder: "Ziele",
      projectsFolder: "Projekte",
      resourcesFolder: "Ressourcen",
      archiveFolder: "Archiv",
      financeFolder: "Finanz-Wurzel",
      purchasesFolder: "Eink\xE4ufe",
      billsFolder: "Rechnungen",
      ordersFolder: "Bestellungen (nur lesend)",
      recurringFolder: "Wiederkehrende Kosten",
      ordersNote: "Wo ein Schwester-Plugin seine Bestellnotizen fuehrt. NODAtrail liest sie, damit eine Kartenzeile mit einer Bestellnummer sich selbst ausfuellen kann, und schreibt nie eine. Leer lassen schaltet es aus.",
      tripsFolder: "Reisen (nur lesend)",
      tripsNote: "Wo ein Schwester-Plugin seine Reisenotizen fuehrt. NODAtrail liest den Reiseverlauf, damit die Eintraege eines Tages daraus entstehen koennen, und schreibt nie eine Reise. Leer lassen schaltet es aus.",
      budgetsFolder: "Budgets",
      accountsFolder: "Konten",
      journalFolder: "Journal",
      documentSubfolder: "Belege neben der Notiz",
      documentSubfolderDesc: "Der Ordner, in den eine Rechnung oder ein Auszug neben der zugehoerigen Notiz abgelegt wird, wie ein Anhangordner. Leer lassen, um Belege dort zu lassen, wo sie schon sind. Ein Beleg im Tresor wird verschoben und seine Verweise folgen; einer von diesem Rechner wird hineinkopiert.",
      exportsSubfolder: "Gedruckte Bl\xE4tter",
      exportsSubfolderDesc: "Der Ordner im Finanzordner, in den die gedruckten Bl\xE4tter der Buchhaltung geschrieben werden. Ein Blatt wird bei jedem Export neu aus den Notizen erstellt, alles darin kann also gel\xF6scht werden. Leer lassen schreibt sie direkt in den Finanzordner.",
      importSubfolder: "Importierte Dateien neben der Notiz",
      importSubfolderDesc: "Der Ordner, in dem ein Kalender-Export oder ein Kontoauszug nach dem Import aufbewahrt wird, neben den Notizen, die er gefuellt hat. Nicht derselbe Ordner wie fuer Belege: diese Dateien werden am Namen wiedererkannt und erneut gelesen, um zu ermitteln, was ein frueherer Import angeboten hat und welche Zeilen noch nicht gebucht sind. Leer lassen bewahrt nichts auf und schaltet beides ab.",
      subfolder: "ablegen unter",
      subfolderDesc: "Wohin eine neue Notiz unterhalb ihres Ordners kommt. Platzhalter: {YYYY} und {MM}, gef\xFCllt aus dem Datum, um das es in der Notiz geht. Leer lassen heisst flach ablegen. Betrifft nur neue Notizen; die Leser durchsuchen den ganzen Ordner, was immer hier steht.",
      personsFolder: "Personen",
      companiesFolder: "Firmen",
      defaults: {
        rootFolderPath: "",
        planFolderName: "0 Planung",
        areasFolderName: "1 Bereiche",
        goalsFolderName: "2 Ziele",
        projectsFolderName: "3 Projekte",
        resourcesFolderName: "4 Ressourcen",
        archiveFolderName: "6 Archiv",
        areasArchiveFolderName: "Bereiche",
        goalsArchiveFolderName: "Ziele",
        projectsArchiveFolderName: "Projekte",
        resourcesArchiveFolderName: "Ressourcen",
        financeFolderName: "Finanzen",
        purchasesFolderName: "Eink\xE4ufe",
        billsFolderName: "Rechnungen",
        recurringFolderName: "Wiederkehrend",
        budgetsFolderName: "Budgets",
        accountsFolderName: "Konten",
        journalFolderName: "Journal",
        dailyFolderName: "1 T\xE4glich",
        weeklyFolderName: "2 W\xF6chentlich",
        monthlyFolderName: "3 Monatlich",
        quarterlyFolderName: "4 Viertelj\xE4hrlich",
        yearlyFolderName: "5 J\xE4hrlich",
        personsFolderName: "Personen",
        companiesFolderName: "Firmen",
        crmFolderName: "CRM"
      }
    },
    importRules: {
      heading: "Importregeln",
      openPage: "Importregeln",
      description: "Zu welchem Konto eine Auszugszeile gehoert, entschieden anhand ihres Textes. Fast alle entstehen beim Import selbst, wenn Konten zugewiesen werden; diese Seite dient dazu, eine Regel zu entfernen, die falsche Zeilen einfaengt. Die laengste passende Regel gewinnt.",
      none: "Noch keine Regeln. Sie entstehen, wenn beim Import Konten zugewiesen werden.",
      add: "Regel hinzufuegen",
      match: "Text enthaelt"
    },
    properties: {
      ordersSection: "Bestellungen (Notizen eines anderen Plugins)",
      tripsSection: "Reisen (Notizen eines anderen Plugins)",
      heading: "Eigenschaftsnamen",
      description: "Jeder Frontmatter-Name, den NODAtrail liest oder schreibt.",
      openPage: "Eigenschaftsnamen",
      unlock: "Eigenschaftsnamen bearbeiten",
      unlockDesc: "Eine Ordnerzeile und eine Eigenschaftszeile sehen gleich aus und sind ganz unterschiedlich falsch zu machen. Einen Ordner umzustellen findet jede Notiz wieder; eine Eigenschaft umzubenennen sorgt daf\xFCr, dass jede Notiz mit dem alten Namen nicht mehr antwortet, ohne dass irgendwo ein Fehler erscheint. Es wird nichts migriert.",
      lockedNotice: "Schreibgesch\xFCtzt. Schalte oben um, um diese zu bearbeiten.",
      sharedSection: "Gemeinsam",
      paraSection: "PARA",
      financeSection: "Finanzen",
      typePropertyName: "Typ-Eigenschaft",
      createdProperty: "Erstellt-Stempel",
      modifiedProperty: "Ge\xE4ndert-Stempel",
      imageProperty: "Bild",
      iconProperty: "Symbol",
      priorityProperty: "Priorit\xE4t",
      deadlineProperty: "Frist",
      archivedProperty: "Archiviert am"
    }
  }
};

// packages/nodatrail/src/lang/translations/index.ts
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

// packages/nodatrail/src/lang/plural.ts
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

// packages/nodatrail/src/lang/all-locales.ts
function nestedValue(table, path) {
  return path.split(".").reduce((node, part) => {
    if (node && typeof node === "object" && part in node) return node[part];
    return void 0;
  }, table);
}
function translationsOf(key) {
  const seen = /* @__PURE__ */ new Set();
  for (const locale of LOCALES) {
    const value = nestedValue(locale.table, key);
    if (typeof value === "string") seen.add(value);
  }
  return [...seen];
}

// packages/nodatrail/src/lang/I18nManager.ts
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
        const entry2 = candidate ? localeEntry(candidate) : void 0;
        if (entry2) return entry2.code;
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
function interpolate(template, variables) {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key) => variables[key]?.toString() ?? match
  );
}

// packages/nodatrail/src/settings/split-list.ts
function splitList(value) {
  return value.split(",").map((entry2) => entry2.trim()).filter((entry2) => entry2 !== "");
}

// packages/nodatrail/src/settings/defaults.ts
var DEFAULT_SETTINGS = {
  rootFolder: "",
  showRibbonIcon: true,
  // Locked on a fresh install as much as on an old one: every property name
  // below is what existing notes are read by, and a vault that needs different
  // ones turns this on once and off again.
  unlockPropertyNames: false,
  language: "auto",
  planRootFolder: "0 Plan",
  dailyPath: "0 Plan/1 Daily/{YYYY}/{YYYY}-{MM}-{DD}.md",
  weeklyPath: "0 Plan/2 Weekly/{GGGG}/{GGGG}-W{WW}.md",
  monthlyPath: "0 Plan/3 Monthly/{YYYY}/{YYYY}-{MM}.md",
  quarterlyPath: "0 Plan/4 Quarterly/{YYYY}/{YYYY}-Q{Q}.md",
  yearlyPath: "0 Plan/5 Yearly/{YYYY}.md",
  areasFolder: "1 Areas",
  goalsFolder: "2 Goals",
  projectsFolder: "3 Projects",
  resourcesFolder: "4 Resources",
  archiveFolder: "6 Archive",
  financeFolder: "Finance",
  purchasesFolder: "Finance/Purchases",
  billsFolder: "Finance/Bills",
  recurringFolder: "Finance/Recurring",
  budgetsFolder: "Finance/Budgets",
  accountsFolder: "Finance/Accounts",
  journalFolder: "Finance/Journal",
  // A year of bills is a few hundred notes and a month of them is a handful,
  // which is the size a folder is still worth opening. A budget and a standing
  // charge are a handful per year already, so a month folder there would hold
  // one note and cost a click.
  billSubfolder: "{YYYY}/{MM}",
  purchaseSubfolder: "{YYYY}/{MM}",
  budgetSubfolder: "{YYYY}",
  recurringSubfolder: "{YYYY}",
  // A journal note is one a month by construction, so the year is the only
  // level that could hold anything.
  journalSubfolder: "{YYYY}",
  documentSubfolder: "_documents",
  importSubfolder: "_imports",
  exportsSubfolder: SHEET_CONTRACT.exportsSubfolder,
  taskFolders: "0 Plan, 1 Areas, 2 Goals, 3 Projects",
  crmFolder: "CRM",
  // The seven values below come from trail-core's CRM_CONTRACT rather than
  // being spelled here, because APERtrail and CULItrail ship the identical ones
  // and all three have to find each other's Person and Company notes in a fresh
  // vault. tests/crm-contract.test.ts fails if this stops matching.
  personsFolder: CRM_CONTRACT.personsFolder,
  companiesFolder: CRM_CONTRACT.companiesFolder,
  personTypeValue: CRM_CONTRACT.personTypeValue,
  companyTypeValue: CRM_CONTRACT.companyTypeValue,
  personTagProperty: CRM_CONTRACT.personTagProperty,
  companyTagProperty: CRM_CONTRACT.companyTagProperty,
  personRolesProperty: CRM_CONTRACT.personRolesProperty,
  companyRolesProperty: CRM_CONTRACT.companyRolesProperty,
  eligiblePersonTags: "",
  // Blank on purpose: see the note on these in `types.ts`. Blank is not "no
  // heading", it is "the heading this vault's language calls it".
  dayFocusHeading: "",
  dayScheduleHeading: "",
  dayNotesHeading: "",
  // On. A day view is looked back at as much as it is planned from, and a task
  // that vanishes when it is ticked takes the evidence of the afternoon with
  // it.
  dayShowClosedTasks: true,
  // Off, so the view keeps the seven days it already had. A working week is a
  // preference about somebody's job, not a default about calendars.
  weekWorkdaysOnly: false,
  weekLunchStart: "12:00",
  weekLunchEnd: "13:00",
  closedProperty: "closed",
  areasArchiveFolder: "Areas",
  goalsArchiveFolder: "Goals",
  projectsArchiveFolder: "Projects",
  resourcesArchiveFolder: "Resources",
  projectFolderPerNote: true,
  archiveYearFolders: true,
  imageSubfolder: "_resources",
  projectDefaultImageName: "Default",
  dayMeetingMarker: "\u{1F465}",
  dayMeetingTentativeMarker: "\u2753",
  dayMeetingUnansweredMarker: "\u2709\uFE0F",
  dayMeetingDeclinedMarker: "\u{1F6AB}",
  dayNoteMarker: "\u{1F4DD}",
  dayIdeaMarker: "\u{1F4A1}",
  dayPlaceMarker: "\u{1F4CD}",
  dayPersonMarker: "\u{1F9D1}",
  daySpanMarker: "\u{1F3D6}\uFE0F",
  // Blank on purpose: see the note on these in `types.ts`. Narrowing an
  // unclassified vault's pickers to nothing would be worse than not narrowing.
  billVendorRole: "",
  billCustomerRole: "",
  homeCurrency: "CHF",
  currencyOptions: "CHF, EUR, USD",
  billDueSoonDays: 7,
  expenseCategories: "housing, utilities, insurance, health, transport, food, household, leisure, education, tax, fees, savings, gifts, other",
  typePropertyName: CRM_CONTRACT.typePropertyName,
  createdProperty: "created",
  modifiedProperty: "modified",
  imageProperty: "image",
  iconProperty: "icon",
  priorityProperty: "priority",
  deadlineProperty: "deadline",
  archivedProperty: "archived",
  areaTypeValue: "area",
  goalTypeValue: "goal",
  projectTypeValue: "project",
  resourceTypeValue: "resource",
  dayTypeValue: "day",
  weekTypeValue: "week",
  monthTypeValue: "month",
  // The vault's one existing quarter note says `month`, which is a note that is
  // wrong rather than a default that should be. The health check reports it and
  // a command fixes it; nothing here rewrites it.
  quarterTypeValue: "quarter",
  yearTypeValue: "year",
  purchaseTypeValue: "purchase",
  billTypeValue: "bill",
  recurringTypeValue: "recurring",
  budgetTypeValue: "budget",
  accountTypeValue: "account",
  journalTypeValue: "journal",
  accountNumberProperty: "number",
  accountKindProperty: "kind",
  accountGroupProperty: "group",
  accountCurrencyProperty: "currency",
  accountOpeningProperty: "opening",
  accountOpeningDateProperty: "openingDate",
  accountClosedProperty: "closed",
  accountIbanProperty: "iban",
  accountBankNumberProperty: "bankAccount",
  accountPersonProperty: "person",
  importRules: [],
  displayLocale: DISPLAY_CONTRACT.displayLocale,
  exportAuthor: SHEET_CONTRACT.exportAuthor,
  exchangeRates: [],
  ledgerAccountProperty: "account",
  paidFromProperty: "paidFrom",
  goalAreaProperty: "area",
  goalStatusProperty: "status",
  achievedProperty: "achieved",
  projectGoalsProperty: "goals",
  projectAreaProperty: "area",
  projectStatusProperty: "status",
  completedProperty: "completed",
  resourceAreaProperty: "area",
  resourceTopicProperty: "topic",
  resourceSourceProperty: "source",
  resourceTagProperty: "tags",
  purchaseCompanyProperty: "company",
  purchaseAreaProperty: "area",
  purchaseProjectProperty: "project",
  purchaseCategoryProperty: "category",
  purchaseStatusProperty: "status",
  purchaseDateProperty: "orderDate",
  purchaseDeliveryDateProperty: "deliveryDate",
  purchaseAmountProperty: "amount",
  purchaseCurrencyProperty: "currency",
  purchaseDiscountProperty: "discount",
  purchaseShippingProperty: "shipping",
  purchaseVatRateProperty: "vatRate",
  purchaseVatAmountProperty: "vatAmount",
  purchaseItemsProperty: "items",
  purchaseDocumentProperty: "document",
  purchaseReferenceProperty: "reference",
  purchaseBillProperty: "bill",
  purchaseItemNameField: "name",
  purchaseItemPriceField: "price",
  purchaseItemQuantityField: "quantity",
  purchaseItemDiscountField: "discount",
  purchaseItemNoteField: "note",
  purchaseDeliveriesProperty: "deliveries",
  purchaseDeliveryDateField: "date",
  purchaseDeliveryItemsField: "items",
  purchaseDeliveryItemNameField: "name",
  purchaseDeliveryItemQuantityField: "quantity",
  purchaseDeliveryNoteField: "note",
  billCompanyProperty: "company",
  billAreaProperty: "area",
  billCategoryProperty: "category",
  billAmountProperty: "amount",
  billCurrencyProperty: "currency",
  billIssueDateProperty: "issueDate",
  billDueDateProperty: "dueDate",
  billPaidDateProperty: "paidDate",
  billReferenceProperty: "reference",
  billDocumentProperty: "document",
  billDirectionProperty: "direction",
  billRecurringProperty: "recurring",
  billPurchaseProperty: "purchase",
  billStatusProperty: "status",
  billLinesProperty: "lines",
  billLineAccountField: "account",
  billLineAmountField: "amount",
  billLineNoteField: "note",
  recurringCompanyProperty: "company",
  recurringAreaProperty: "area",
  recurringCategoryProperty: "category",
  recurringAmountProperty: "amount",
  recurringCurrencyProperty: "currency",
  recurringCadenceProperty: "cadence",
  recurringIntervalProperty: "interval",
  recurringStartProperty: "startDate",
  recurringEndProperty: "endDate",
  recurringStatusProperty: "status",
  recurringDocumentProperty: "document",
  recurringReferenceProperty: "reference",
  recurringAccountProperty: "account",
  companyAccountProperty: "account",
  companyCategoryProperty: "category",
  companyPaymentProviderProperty: "paymentProvider",
  // CULItrail's own defaults, held in trail-core's ORDER_CONTRACT so both sides
  // ship one set of values rather than two lists of literals that nothing
  // compares. Adopted from the sibling's settings when it is installed; when it
  // is not, these are what an order note written by a fresh CULItrail looks
  // like. tests/order-contract.test.ts fails if this stops matching.
  // APERtrail's trip note, held in trail-core's TRIP_CONTRACT for the same
  // reason the order fields below are: two lists of literals that nothing
  // compares is how `place` and `ort` end up in one vault. Adopted from
  // APERtrail's own settings when it is installed, which is what hands a German
  // vault `Reisen`. tests/trip-contract.test.ts fails if this stops matching.
  tripsFolder: TRIP_CONTRACT.tripsFolder,
  travelStatusProperty: TRIP_CONTRACT.travelStatusProperty,
  departureProperty: TRIP_CONTRACT.departureProperty,
  returnProperty: TRIP_CONTRACT.returnProperty,
  personsProperty: TRIP_CONTRACT.personsProperty,
  stopsProperty: TRIP_CONTRACT.stopsProperty,
  stopPlaceField: TRIP_CONTRACT.stopPlaceField,
  stopDayField: TRIP_CONTRACT.stopDayField,
  stopFromField: TRIP_CONTRACT.stopFromField,
  stopToField: TRIP_CONTRACT.stopToField,
  stopExcursionField: TRIP_CONTRACT.stopExcursionField,
  stopPersonsField: TRIP_CONTRACT.stopPersonsField,
  stopOptionalField: TRIP_CONTRACT.stopOptionalField,
  stopChosenField: TRIP_CONTRACT.stopChosenField,
  ordersFolder: ORDER_CONTRACT.ordersFolder,
  orderTypeValue: ORDER_CONTRACT.orderTypeValue,
  orderCompanyProperty: ORDER_CONTRACT.orderCompanyProperty,
  orderDateProperty: ORDER_CONTRACT.orderDateProperty,
  orderPriceProperty: ORDER_CONTRACT.orderPriceProperty,
  orderPriceCurrencyProperty: ORDER_CONTRACT.orderPriceCurrencyProperty,
  budgetPeriodProperty: "period",
  budgetCurrencyProperty: "currency",
  budgetLinesProperty: "lines",
  budgetLineAccountField: "account",
  budgetLineAmountField: "amount",
  budgetLineRhythmField: "rhythm",
  budgetLineMonthField: "month",
  budgetLineNoteField: "note",
  budgetLineOverridesField: "months",
  budgetClosedThroughProperty: "closedThrough",
  budgetLineViaField: "via",
  budgetLineFromField: "from",
  budgetLineToField: "to",
  budgetViaProperty: "via"
};

// packages/nodatrail/src/settings/validate.ts
var MINIMUMS = {
  billDueSoonDays: 0
};
var LISTS = {
  importRules: readImportRule,
  exchangeRates: readExchangeRate
};
function readImportRule(row) {
  const match = typeof row["match"] === "string" ? row["match"].trim() : "";
  const account = Number(row["account"]);
  if (!match || !Number.isInteger(account) || account <= 0) return null;
  return { match, account };
}
function readExchangeRate(row) {
  const currency = typeof row["currency"] === "string" ? row["currency"].trim().toUpperCase() : "";
  const rate = Number(row["rate"]);
  if (currency.length !== 3 || !Number.isFinite(rate) || rate <= 0) return null;
  return { currency, rate };
}
function mergeSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const merged = { ...DEFAULT_SETTINGS };
  if (typeof source.displayLocale !== "string" && typeof source.numberLocale === "string") {
    source.displayLocale = source.numberLocale;
  }
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const fallback = DEFAULT_SETTINGS[key];
    const value = source[key];
    if (typeof fallback === "boolean") {
      if (typeof value === "boolean") assign(merged, key, value);
      continue;
    }
    if (typeof fallback === "number") {
      const number = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(number)) {
        const floor = MINIMUMS[key] ?? Number.NEGATIVE_INFINITY;
        assign(merged, key, Math.max(floor, Math.round(number)));
      }
      continue;
    }
    if (Array.isArray(fallback)) {
      const read = LISTS[key];
      if (read && Array.isArray(value)) {
        const rows = value.filter((row) => typeof row === "object" && row !== null).map(read).filter((row) => row !== null);
        assignList(merged, key, rows);
      }
      continue;
    }
    if (typeof value === "string") assign(merged, key, value);
  }
  return merged;
}
function assignList(settings, key, value) {
  settings[key] = value;
}
function assign(settings, key, value) {
  settings[key] = value;
}

// packages/nodatrail/src/vault/entity-types.ts
var KINDS = Object.freeze({
  area: {
    folderKey: "areasFolder",
    typeValueKey: "areaTypeValue",
    archiveCategoryKey: "areasArchiveFolder"
  },
  goal: {
    folderKey: "goalsFolder",
    typeValueKey: "goalTypeValue",
    archiveCategoryKey: "goalsArchiveFolder"
  },
  project: {
    folderKey: "projectsFolder",
    typeValueKey: "projectTypeValue",
    archiveCategoryKey: "projectsArchiveFolder"
  },
  resource: {
    folderKey: "resourcesFolder",
    typeValueKey: "resourceTypeValue",
    archiveCategoryKey: "resourcesArchiveFolder"
  },
  purchase: { folderKey: "purchasesFolder", typeValueKey: "purchaseTypeValue" },
  bill: { folderKey: "billsFolder", typeValueKey: "billTypeValue" },
  recurring: { folderKey: "recurringFolder", typeValueKey: "recurringTypeValue" },
  budget: { folderKey: "budgetsFolder", typeValueKey: "budgetTypeValue" },
  account: { folderKey: "accountsFolder", typeValueKey: "accountTypeValue" },
  journal: { folderKey: "journalFolder", typeValueKey: "journalTypeValue" }
});
function folderFor(settings, type) {
  return String(settings[KINDS[type].folderKey]).trim();
}
function typeValueFor(settings, type) {
  return String(settings[KINDS[type].typeValueKey]).trim();
}
function archiveFolderFor(settings, type) {
  const key = KINDS[type].archiveCategoryKey;
  const category = key ? String(settings[key]).trim() : "";
  const root = settings.archiveFolder.trim();
  if (!category || !root) return null;
  return `${root}/${category}`;
}
function queryFor(settings, type) {
  return {
    folders: [folderFor(settings, type)],
    typePropertyName: settings.typePropertyName,
    typeValue: typeValueFor(settings, type)
  };
}
function anyQueryFor(settings, type) {
  const archive = archiveFolderFor(settings, type);
  return {
    folders: archive ? [folderFor(settings, type), archive] : [folderFor(settings, type)],
    typePropertyName: settings.typePropertyName,
    typeValue: typeValueFor(settings, type)
  };
}
function taskFolders(settings) {
  return splitList(settings.taskFolders);
}

// packages/nodatrail/src/vault/notes-reader.ts
function readNotesFrom(host, settings, type) {
  return readNotesOfType(host, queryFor(settings, type));
}
function readAllNotesFrom(host, settings, type) {
  return readNotesOfType(host, anyQueryFor(settings, type));
}
function isArchivedPath(path, archiveRoot) {
  const root = archiveRoot.trim();
  return root !== "" && (path === root || path.startsWith(`${root}/`));
}

// packages/nodatrail/src/para/types.ts
var PARA_STATUSES = [
  "backlog",
  "planned",
  "ongoing",
  "blocked",
  "done",
  "review",
  "closed",
  "removed"
];
var LEGACY_STATUSES = Object.freeze({
  paused: "blocked",
  completed: "done",
  achieved: "done",
  dropped: "removed"
});
function readParaStatus(value) {
  if (typeof value !== "string") return null;
  const trimmed = caseFold(value);
  const known = PARA_STATUSES.find((status) => status === trimmed);
  return known ?? LEGACY_STATUSES[trimmed] ?? null;
}

// packages/nodatrail/src/para/parse.ts
function parseCommon(frontmatter, properties) {
  return {
    // Read as text rather than as a strict wikilink: an image is written as a
    // path, an embed or a link depending on how it got there, and all three
    // mean the same file.
    image: readString(frontmatter[properties.imageProperty]),
    priority: readNumberLike(frontmatter[properties.priorityProperty]),
    archived: readIsoDate(frontmatter[properties.archivedProperty])
  };
}
function parseArea(frontmatter, properties) {
  return parseCommon(frontmatter, properties);
}
function parseGoal(frontmatter, properties) {
  const raw = readString(frontmatter[properties.statusProperty]);
  return {
    ...parseCommon(frontmatter, properties),
    areaTitle: linkOrText(frontmatter[properties.areaProperty]),
    // Through `readParaStatus`, not a cast: it is what turns a note's `paused`
    // into `blocked`, and casting the raw string would have left the old word
    // in the parsed value where every reader keys off the new one.
    //
    // An absent or unreadable status reads as `backlog`, which is what a note
    // that has not said anything means under this vocabulary.
    status: readParaStatus(raw) ?? "backlog",
    deadline: readIsoDate(frontmatter[properties.deadlineProperty]),
    achieved: readIsoDate(frontmatter[properties.achievedProperty]),
    closed: readIsoDate(frontmatter[properties.closedProperty])
  };
}
function parseProject(frontmatter, properties) {
  const raw = readString(frontmatter[properties.statusProperty]);
  return {
    ...parseCommon(frontmatter, properties),
    // Strict here, unlike the single-value links: a `goals:` list is a list of
    // references, and reading a stray sentence in it as a goal title would
    // invent a relationship the vault does not have.
    goalTitles: wikilinkTargets(frontmatter[properties.goalsProperty]),
    areaTitle: linkOrText(frontmatter[properties.areaProperty]),
    status: readParaStatus(raw) ?? "backlog",
    deadline: readIsoDate(frontmatter[properties.deadlineProperty]),
    completed: readIsoDate(frontmatter[properties.completedProperty]),
    closed: readIsoDate(frontmatter[properties.closedProperty])
  };
}
function parseResource(frontmatter, properties) {
  return {
    ...parseCommon(frontmatter, properties),
    areaTitle: linkOrText(frontmatter[properties.areaProperty]),
    topic: readString(frontmatter[properties.topicProperty]),
    source: readString(frontmatter[properties.sourceProperty]),
    tags: readStringList(frontmatter[properties.tagProperty])
  };
}

// packages/nodatrail/src/para/properties.ts
function commonProperties(settings) {
  return {
    imageProperty: settings.imageProperty,
    priorityProperty: settings.priorityProperty,
    archivedProperty: settings.archivedProperty
  };
}
function goalProperties(settings) {
  return {
    ...commonProperties(settings),
    areaProperty: settings.goalAreaProperty,
    statusProperty: settings.goalStatusProperty,
    deadlineProperty: settings.deadlineProperty,
    achievedProperty: settings.achievedProperty,
    closedProperty: settings.closedProperty
  };
}
function projectProperties(settings) {
  return {
    ...commonProperties(settings),
    goalsProperty: settings.projectGoalsProperty,
    areaProperty: settings.projectAreaProperty,
    statusProperty: settings.projectStatusProperty,
    deadlineProperty: settings.deadlineProperty,
    completedProperty: settings.completedProperty,
    closedProperty: settings.closedProperty
  };
}
function resourceProperties(settings) {
  return {
    ...commonProperties(settings),
    areaProperty: settings.resourceAreaProperty,
    topicProperty: settings.resourceTopicProperty,
    sourceProperty: settings.resourceSourceProperty,
    tagProperty: settings.resourceTagProperty
  };
}

// packages/nodatrail/src/para/para-reader.ts
function records(host, settings, type, parse) {
  const archiveRoot = archiveFolderFor(settings, type) ?? "";
  return readAllNotesFrom(host, settings, type).map((note) => ({
    file: note.file,
    title: note.title,
    note: parse(note.frontmatter),
    archived: isArchivedPath(note.file.path, archiveRoot)
  }));
}
function readAreasFrom(host, settings) {
  const properties = commonProperties(settings);
  return records(host, settings, "area", (fm) => parseArea(fm, properties));
}
function readGoalsFrom(host, settings) {
  const properties = goalProperties(settings);
  return records(host, settings, "goal", (fm) => parseGoal(fm, properties));
}
function readProjectsFrom(host, settings) {
  const properties = projectProperties(settings);
  return records(host, settings, "project", (fm) => parseProject(fm, properties));
}
function readResourcesFrom(host, settings) {
  const properties = resourceProperties(settings);
  return records(host, settings, "resource", (fm) => parseResource(fm, properties));
}
function readParaBoardFrom(host, settings) {
  return {
    areas: readAreasFrom(host, settings),
    goals: readGoalsFrom(host, settings),
    projects: readProjectsFrom(host, settings),
    resources: readResourcesFrom(host, settings)
  };
}

// packages/nodatrail/src/finance/properties.ts
function purchaseProperties(settings) {
  return {
    typePropertyName: settings.typePropertyName,
    typeValue: settings.purchaseTypeValue,
    companyProperty: settings.purchaseCompanyProperty,
    areaProperty: settings.purchaseAreaProperty,
    projectProperty: settings.purchaseProjectProperty,
    categoryProperty: settings.purchaseCategoryProperty,
    statusProperty: settings.purchaseStatusProperty,
    dateProperty: settings.purchaseDateProperty,
    deliveryDateProperty: settings.purchaseDeliveryDateProperty,
    amountProperty: settings.purchaseAmountProperty,
    currencyProperty: settings.purchaseCurrencyProperty,
    discountProperty: settings.purchaseDiscountProperty,
    shippingProperty: settings.purchaseShippingProperty,
    vatRateProperty: settings.purchaseVatRateProperty,
    vatAmountProperty: settings.purchaseVatAmountProperty,
    itemsProperty: settings.purchaseItemsProperty,
    itemNameField: settings.purchaseItemNameField,
    itemPriceField: settings.purchaseItemPriceField,
    itemQuantityField: settings.purchaseItemQuantityField,
    itemDiscountField: settings.purchaseItemDiscountField,
    itemNoteField: settings.purchaseItemNoteField,
    documentProperty: settings.purchaseDocumentProperty,
    referenceProperty: settings.purchaseReferenceProperty,
    billProperty: settings.purchaseBillProperty,
    deliveriesProperty: settings.purchaseDeliveriesProperty,
    deliveryDateField: settings.purchaseDeliveryDateField,
    deliveryItemsField: settings.purchaseDeliveryItemsField,
    deliveryItemNameField: settings.purchaseDeliveryItemNameField,
    deliveryItemQuantityField: settings.purchaseDeliveryItemQuantityField,
    deliveryNoteField: settings.purchaseDeliveryNoteField
  };
}
function billProperties(settings) {
  return {
    typePropertyName: settings.typePropertyName,
    typeValue: settings.billTypeValue,
    companyProperty: settings.billCompanyProperty,
    areaProperty: settings.billAreaProperty,
    categoryProperty: settings.billCategoryProperty,
    amountProperty: settings.billAmountProperty,
    currencyProperty: settings.billCurrencyProperty,
    issueDateProperty: settings.billIssueDateProperty,
    dueDateProperty: settings.billDueDateProperty,
    paidDateProperty: settings.billPaidDateProperty,
    referenceProperty: settings.billReferenceProperty,
    documentProperty: settings.billDocumentProperty,
    directionProperty: settings.billDirectionProperty,
    recurringProperty: settings.billRecurringProperty,
    purchaseProperty: settings.billPurchaseProperty,
    statusProperty: settings.billStatusProperty,
    accountProperty: settings.ledgerAccountProperty,
    linesProperty: settings.billLinesProperty,
    lineAccountField: settings.billLineAccountField,
    lineAmountField: settings.billLineAmountField,
    lineNoteField: settings.billLineNoteField,
    paidFromProperty: settings.paidFromProperty
  };
}
function recurringProperties(settings) {
  return {
    typePropertyName: settings.typePropertyName,
    typeValue: settings.recurringTypeValue,
    companyProperty: settings.recurringCompanyProperty,
    areaProperty: settings.recurringAreaProperty,
    categoryProperty: settings.recurringCategoryProperty,
    amountProperty: settings.recurringAmountProperty,
    currencyProperty: settings.recurringCurrencyProperty,
    cadenceProperty: settings.recurringCadenceProperty,
    intervalProperty: settings.recurringIntervalProperty,
    startDateProperty: settings.recurringStartProperty,
    endDateProperty: settings.recurringEndProperty,
    statusProperty: settings.recurringStatusProperty,
    documentProperty: settings.recurringDocumentProperty,
    referenceProperty: settings.recurringReferenceProperty,
    accountProperty: settings.recurringAccountProperty
  };
}
function budgetProperties(settings) {
  return {
    typePropertyName: settings.typePropertyName,
    typeValue: settings.budgetTypeValue,
    periodProperty: settings.budgetPeriodProperty,
    currencyProperty: settings.budgetCurrencyProperty,
    linesProperty: settings.budgetLinesProperty,
    lineAccountField: settings.budgetLineAccountField,
    lineAmountField: settings.budgetLineAmountField,
    lineRhythmField: settings.budgetLineRhythmField,
    lineMonthField: settings.budgetLineMonthField,
    lineNoteField: settings.budgetLineNoteField,
    lineOverridesField: settings.budgetLineOverridesField,
    closedThroughProperty: settings.budgetClosedThroughProperty,
    lineViaField: settings.budgetLineViaField,
    lineFromField: settings.budgetLineFromField,
    lineToField: settings.budgetLineToField,
    viaProperty: settings.budgetViaProperty
  };
}

// packages/nodatrail/src/finance/finance-reader.ts
function readPurchasesFrom(host, settings) {
  const properties = purchaseProperties(settings);
  return readNotesFrom(host, settings, "purchase").map((note) => ({
    file: note.file,
    title: note.title,
    ...parsePurchase({
      stem: note.title,
      frontmatter: note.frontmatter,
      properties
    })
  }));
}
function readBillsFrom(host, settings) {
  const properties = billProperties(settings);
  return readNotesFrom(host, settings, "bill").map((note) => ({
    file: note.file,
    title: note.title,
    ...parseBill(note.frontmatter, properties)
  }));
}
function readRecurringFrom(host, settings) {
  const properties = recurringProperties(settings);
  return readNotesFrom(host, settings, "recurring").map((note) => ({
    file: note.file,
    title: note.title,
    ...parseRecurring(note.frontmatter, properties)
  }));
}
function readFinanceBoardFrom(host, settings) {
  return {
    purchases: readPurchasesFrom(host, settings),
    bills: readBillsFrom(host, settings),
    recurring: readRecurringFrom(host, settings)
  };
}

// packages/nodatrail/src/ledger/properties.ts
function accountProperties(settings) {
  return {
    numberProperty: settings.accountNumberProperty,
    kindProperty: settings.accountKindProperty,
    groupProperty: settings.accountGroupProperty,
    currencyProperty: settings.accountCurrencyProperty,
    openingProperty: settings.accountOpeningProperty,
    openingDateProperty: settings.accountOpeningDateProperty,
    closedProperty: settings.accountClosedProperty,
    ibanProperty: settings.accountIbanProperty,
    bankAccountProperty: settings.accountBankNumberProperty,
    personProperty: settings.accountPersonProperty
  };
}

// packages/nodatrail/src/ledger/ledger-reader.ts
function readAccountsFrom(host, settings) {
  const properties = accountProperties(settings);
  const records2 = [];
  for (const note of readNotesFrom(host, settings, "account")) {
    const account = parseAccount(note.frontmatter, note.title, properties);
    if (account) records2.push({ file: note.file, account });
  }
  return records2.sort((a, b) => a.account.number - b.account.number);
}
async function readJournalsFrom(host, settings) {
  const notes = readNotesFrom(host, settings, "journal");
  const records2 = await Promise.all(
    notes.map(async (note) => {
      const markdown = await host.vault.read(note.file);
      const postings = [];
      const problems = [];
      for (const block of extractJournalBlocks(markdown)) {
        const parsed = parseJournal(block.source, block.fenceLine + 1);
        postings.push(...parsed.postings);
        problems.push(...parsed.problems);
      }
      return { file: note.file, title: note.title, postings, problems };
    })
  );
  return records2.sort((a, b) => a.title.localeCompare(b.title));
}
function readBudgetsFrom(host, settings) {
  const properties = budgetProperties(settings);
  return readNotesFrom(host, settings, "budget").map((note) => ({
    file: note.file,
    title: note.title,
    ...parseAccountBudget(note.frontmatter, properties)
  })).sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""));
}

// packages/nodatrail/src/plan/day-headings.ts
function dayHeadings(settings, kind, translations) {
  const scheduled = kind === "meeting" || kind === "span";
  const configured = (kind === "task" ? settings.dayFocusHeading : scheduled ? settings.dayScheduleHeading : settings.dayNotesHeading).trim();
  const key = kind === "task" ? "focus" : scheduled ? "schedule" : "notes";
  const candidates = configured ? [configured, ...translations(`day.headings.${key}`)] : translations(`day.headings.${key}`);
  return [...new Set(candidates.filter((heading) => heading.trim() !== ""))];
}

// packages/nodatrail/src/plan/day-draft.ts
function emptyDraft(kind = "task") {
  return {
    kind,
    text: "",
    context: "",
    due: null,
    priority: null,
    startTime: "",
    endTime: "",
    attendance: "",
    place: "",
    persons: [],
    notes: "",
    followUps: []
  };
}

// packages/nodatrail/src/plan/schedule-line.ts
function scheduleMarkers(settings) {
  return {
    accepted: settings.dayMeetingMarker,
    tentative: settings.dayMeetingTentativeMarker,
    unanswered: settings.dayMeetingUnansweredMarker,
    declined: settings.dayMeetingDeclinedMarker,
    span: settings.daySpanMarker,
    place: settings.dayPlaceMarker,
    person: settings.dayPersonMarker
  };
}
var SPAN = /^(\d{1,2}:\d{2})?(?:-(\d{1,2}:\d{2}))?(?=\s|$)/;
var WIKILINK3 = /\[\[([^\]]+)\]\]/g;
function parseScheduleLine(line, markers) {
  const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
  if (!bullet) return null;
  let rest = (bullet[1] ?? "").trim();
  if (/^\[.\]/.test(rest)) return null;
  for (const child of [markers.place, markers.person]) {
    const mark = child.trim();
    if (mark && rest.startsWith(mark)) return null;
  }
  const found = ["span", "declined", "unanswered", "tentative", "accepted"].map((key) => ({ key, mark: markers[key].trim() })).filter((one) => one.mark !== "" && rest.startsWith(one.mark)).sort((a, b) => b.mark.length - a.mark.length)[0];
  let attendance = "";
  let kind = "meeting";
  if (found) {
    rest = rest.slice(found.mark.length).trim();
    if (found.key === "span") kind = "span";
    else if (found.key !== "accepted") attendance = found.key;
  }
  const span = SPAN.exec(rest);
  const from = span?.[1] ?? "";
  const to = span?.[2] ?? "";
  if (span?.[0]) rest = rest.slice(span[0].length).trim();
  const links = [...rest.matchAll(WIKILINK3)].map((match) => (match[1] ?? "").trim());
  const text = rest.replace(WIKILINK3, "").replace(/\s+/g, " ").trim();
  if (!text && links.length === 0) return null;
  return kind === "span" ? { kind, attendance: "", from: "", to: "", text, links } : { kind, attendance, from, to, text, links };
}

// packages/nodatrail/src/plan/day-entries.ts
function sectionLines(body, headings) {
  const lines = body.split("\n");
  const start = lines.findIndex(
    (line) => headings.some((heading) => line.trim() === heading.trim())
  );
  if (start === -1) return [];
  const level = (/^(#{1,6})\s/.exec(lines[start] ?? "")?.[1] ?? "").length;
  const out = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const next = (/^(#{1,6})\s/.exec(lines[index] ?? "")?.[1] ?? "").length;
    if (next > 0 && next <= level) break;
    out.push({ line: lines[index] ?? "", at: index });
  }
  return out;
}
function childrenOf(lines, index) {
  let end = index + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end]?.line ?? "")) end += 1;
  return end;
}
function meetingsOf(body, settings, headings, reproduces) {
  const lines = sectionLines(body, headings);
  const out = [];
  for (let index = 0; index < lines.length; index += 1) {
    const row = lines[index];
    if (!row || /^\s/.test(row.line)) continue;
    const parsed = parseScheduleLine(row.line, scheduleMarkers(settings));
    if (!parsed) continue;
    const end = childrenOf(lines, index);
    const own = lines.slice(index, end).map((entry2) => entry2.line);
    const place = childLinks(own, settings.dayPlaceMarker).at(0) ?? "";
    const persons = childLinks(own, settings.dayPersonMarker);
    const draft = parsed.kind === "span" ? {
      ...emptyDraft("span"),
      text: parsed.text,
      context: parsed.links[0] ?? "",
      place,
      persons
    } : {
      ...emptyDraft("meeting"),
      attendance: parsed.attendance,
      text: parsed.text,
      context: parsed.links[0] ?? "",
      startTime: parsed.from,
      endTime: parsed.to,
      place,
      persons,
      notes: childText(own, settings),
      followUps: childTasks(own)
    };
    out.push({
      kind: parsed.kind,
      draft,
      label: parsed.text,
      span: parsed.from && parsed.to ? `${parsed.from}-${parsed.to}` : parsed.from || parsed.to,
      // **Every link the entry carries, headline and children alike.** What a
      // view may show is everything the note says; what the dialog may rewrite
      // is only what composes back, and a read-only entry still gets its chips.
      links: [...parsed.links, ...place ? [place] : [], ...persons],
      from: row.at,
      to: (lines[end - 1]?.at ?? row.at) + 1,
      editable: reproduces(draft, own)
    });
    index = end - 1;
  }
  return out;
}
function childLinks(own, marker) {
  const mark = marker.trim();
  if (!mark) return [];
  return own.slice(1).flatMap((line) => {
    const rest = /^\s*[-*+]\s+(.*)$/.exec(line)?.[1]?.trim() ?? "";
    if (!rest.startsWith(mark)) return [];
    const link = /^\[\[([^\]]+)\]\]$/.exec(rest.slice(mark.length).trim());
    return link ? [(link[1] ?? "").trim()] : [];
  });
}
function childText(own, settings) {
  const mark = settings.dayNoteMarker.trim();
  const others = [settings.dayPlaceMarker.trim(), settings.dayPersonMarker.trim()].filter(Boolean);
  return own.slice(1).filter((line) => !/^\s*[-*+]\s+\[.\]/.test(line)).map((line) => /^\s*[-*+]\s+(.*)$/.exec(line)?.[1]?.trim() ?? "").filter((rest) => !others.some((other) => rest.startsWith(other))).map((rest) => mark && rest.startsWith(mark) ? rest.slice(mark.length).trim() : rest).filter((line) => line !== "").join("\n");
}
function childTasks(own) {
  return own.slice(1).map((line) => /^\s*[-*+]\s+\[.\]\s*(.*)$/.exec(line)?.[1] ?? "").filter((line) => line !== "").map((line) => splitTaskFields(line));
}
function thoughtsOf(body, settings, headings, reproduces) {
  const lines = sectionLines(body, headings);
  const out = [];
  for (const row of lines) {
    if (/^\s/.test(row.line)) continue;
    const parsed = parseScheduleLine(row.line, {
      accepted: "",
      tentative: "",
      unanswered: "",
      declined: "",
      span: "",
      // Blank for the same reason as the five above: this section's lines are
      // thoughts, and a note that merely starts with the same emoji must not
      // be refused for it. Nothing writes a child under a thought anyway, and
      // an indented line is skipped before this is reached.
      place: "",
      person: ""
    });
    if (!parsed) continue;
    const idea = settings.dayIdeaMarker.trim();
    const rest = /^\s*[-*+]\s+(.*)$/.exec(row.line)?.[1]?.trim() ?? "";
    const kind = idea && rest.startsWith(idea) ? "idea" : "note";
    const marker = kind === "idea" ? idea : settings.dayNoteMarker.trim();
    const text = marker && rest.startsWith(marker) ? rest.slice(marker.length).trim() : rest;
    const links = [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => (match[1] ?? "").trim());
    const draft = {
      ...emptyDraft(kind),
      text: text.replace(/\[\[[^\]]+\]\]/g, "").replace(/\s+/g, " ").trim(),
      context: links[0] ?? ""
    };
    out.push({
      kind,
      draft,
      label: draft.text,
      span: "",
      links,
      from: row.at,
      to: row.at + 1,
      editable: reproduces(draft, [row.line])
    });
  }
  return out;
}

// packages/nodatrail/src/plan/paths.ts
function templateFor(settings, level) {
  switch (level) {
    case "day":
      return settings.dailyPath;
    case "week":
      return settings.weeklyPath;
    case "month":
      return settings.monthlyPath;
    case "quarter":
      return settings.quarterlyPath;
    case "year":
      return settings.yearlyPath;
  }
}
function notePathFor(settings, level, date) {
  return expandPeriodPath(templateFor(settings, level), date);
}

// packages/nodatrail/src/plan/period-reader.ts
function periodOf(settings, file) {
  const level = detectPeriodLevel(file.basename);
  if (!level) return null;
  const date = parsePeriodTitle(level, file.basename);
  if (!date) return null;
  const expected = notePathFor(settings, level, date).normalize("NFC");
  return expected === file.path.normalize("NFC") ? { level, date } : null;
}
function linkedAll(resolve2, titles) {
  const out = [];
  for (const title of titles) {
    const one = linked(resolve2, title);
    if (one) out.push(one);
  }
  return out;
}
function linked(resolve2, title) {
  const clean = title.trim();
  if (!clean) return null;
  const file = resolve2(clean);
  return { title: clean, note: file ? { ref: file.path } : null };
}
function entry(resolve2, record, offset, complete) {
  const { draft } = record;
  const kind = record.kind === "task" ? "note" : record.kind;
  return {
    kind,
    attendance: draft.attendance,
    start: draft.startTime,
    end: draft.endTime,
    text: draft.text,
    context: linked(resolve2, draft.context),
    place: linked(resolve2, draft.place),
    persons: linkedAll(resolve2, draft.persons),
    notes: draft.notes,
    links: linkedAll(resolve2, record.links),
    lines: { from: record.from + offset, to: record.to + offset },
    complete: complete(record)
  };
}
async function readPeriodNotesFrom(host, settings) {
  const files = host.vault.markdownFiles();
  const resolve2 = linkResolver(files);
  const schedule = dayHeadings(settings, "meeting", translationsOf);
  const thoughts = dayHeadings(settings, "idea", translationsOf);
  const found = [];
  for (const file of files) {
    const period = periodOf(settings, file);
    if (!period) continue;
    const text = await host.vault.read(file);
    const { body } = splitFrontmatterBlock(text);
    const offset = text.split("\n").length - body.split("\n").length;
    const range = periodRange(period.level, period.date);
    found.push({
      file,
      title: file.basename,
      level: period.level,
      from: range.from,
      to: range.to,
      schedule: meetingsOf(body, settings, schedule, () => true).map(
        (record) => entry(resolve2, record, offset, fieldsHoldAll)
      ),
      thoughts: thoughtsOf(body, settings, thoughts, () => true).map(
        (record) => entry(resolve2, record, offset, fieldsHoldAll)
      )
    });
  }
  return found.sort((a, b) => a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0);
}
function fieldsHoldAll(record) {
  const { draft } = record;
  const held = new Set(
    [draft.context, draft.place, ...draft.persons].filter(Boolean).map((title) => title.trim())
  );
  return record.links.every((title) => held.has(title.trim()));
}

// packages/nodatrail/src/tasks/task-reader.ts
async function readTasksFrom(host, settings) {
  const folders = taskFolders(settings);
  if (folders.length === 0) return [];
  const files = host.vault.markdownFiles().filter((file) => isUnderAnyFolder(file.path, folders));
  const found = [];
  for (const file of files) {
    const text = await host.vault.read(file);
    if (!text.includes("- [") && !text.includes("* [") && !text.includes("+ [")) continue;
    for (const task of scanTasks(text)) found.push({ ...task, file });
  }
  return found;
}

// packages/nodatrail/src/interchange/sections.ts
async function nodatrailFamilies(host, settings) {
  const para = readParaBoardFrom(host, settings);
  const finance = readFinanceBoardFrom(host, settings);
  return {
    area: familyEntries(para.areas),
    goal: familyEntries(para.goals),
    project: familyEntries(para.projects),
    resource: familyEntries(para.resources),
    purchase: familyEntries(finance.purchases),
    bill: familyEntries(finance.bills),
    recurring: familyEntries(finance.recurring),
    account: familyEntries(readAccountsFrom(host, settings)),
    journal: familyEntries(await readJournalsFrom(host, settings)),
    budget: familyEntries(readBudgetsFrom(host, settings)),
    period: familyEntries(await readPeriodNotesFrom(host, settings))
  };
}
async function nodatrailLines(host, settings) {
  const resolve2 = linkResolver(host.vault.markdownFiles());
  const tasks = (await readTasksFrom(host, settings)).map((task) => ({
    ...task,
    links: linkedAll(resolve2, task.links)
  }));
  return { task: lineEntries(tasks) };
}

// packages/nodatrail/scripts/interchange/fs-host.ts
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
    for (const entry2 of readdirSync(dir)) {
      if (entry2.startsWith(".")) continue;
      const full = join(dir, entry2);
      const vaultPath = relative(root, full).split(sep).join("/").normalize("NFC");
      if (statSync(full).isDirectory()) {
        folders.add(vaultPath);
        walk(full);
      } else if (entry2.endsWith(".md")) {
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

// packages/nodatrail/scripts/interchange/cli.ts
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
  for (const entry2 of readdirSync2(vault, { withFileTypes: true })) {
    if (!entry2.isDirectory() || !entry2.name.startsWith(".")) continue;
    const candidate = join2(vault, entry2.name, "plugins", pluginId, "data.json");
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
function readJson(path) {
  return JSON.parse(readFileSync2(path, "utf8"));
}
function sourceVersion() {
  return process.env.TRAIL_SOURCE_VERSION ?? "unknown";
}

// packages/nodatrail/scripts/interchange/export.ts
var USAGE = "npm run interchange -- <vault> <out> [--manifest]";
async function main() {
  const { vault, out, flags } = exportArgs(process.argv.slice(2), USAGE);
  const disk = diskVault(vault);
  const settings = mergeSettings(savedSettings(vault, "nodatrail"));
  const meta = { sourceVersion: sourceVersion(), generatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  for (const line of missingFolders(settings, disk.folders)) {
    process.stderr.write(`nodatrail: folder not in vault: ${line}
`);
  }
  for (const path of disk.unparsable) {
    process.stderr.write(`nodatrail: frontmatter does not parse, read as none: ${path}
`);
  }
  writeJson(
    join3(out, "nodatrail.json"),
    sectionFile(
      "nodatrail",
      meta,
      await nodatrailFamilies(disk.host, settings),
      await nodatrailLines(disk.host, settings)
    )
  );
  if (!flags.has("--manifest")) return;
  const manifest = await vaultManifest(disk.host, meta);
  writeJson(join3(out, "vault.json"), manifest);
  const sections = readdirSync3(out).filter((name) => name.endsWith(".json") && name !== "vault.json").map((name) => readJson(join3(out, name))).filter((file) => file.format === INTERCHANGE_FORMAT && file.source !== VAULT_SOURCE);
  const report = interchangeReport(manifest, sections);
  writeJson(join3(out, "report.json"), report);
  const text = formatInterchangeReport(report);
  writeFileSync2(join3(out, "report.md"), text, "utf8");
  process.stdout.write(text);
}
main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : JSON.stringify(error);
  process.stderr.write(`${message}
`);
  process.exit(1);
});
