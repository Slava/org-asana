import assign from 'object-assign';
import lexer from './lexer';

class Node {
  constructor({type, parent, text, attrs}) {
    this.type = type;
    this.parent = parent || null;
    this.text = text || null;
    this.attrs = attrs || {};
    this.children = [];
  }

  addHeadingNode(text) {
    const node = new HeadingNode({
      text,
      parent: this,
      level: (this.level || 0) + 1
    });

    this.children.push(node);
  }

  lastChild() {
    return this.children[this.children.length - 1];
  }

  prettyPrint(level = 0) {
    console.log(`${pad(level * 2)} #${this.type} ${this.text} ${JSON.stringify(this.attrs)}`);
    this.children.forEach(child => child.prettyPrint(level + 1));
  }
}

class HeadingNode extends Node {
  constructor({text, parent, level}) {
    const type = 'heading';
    const {attrs, parsedText} = parseHeadingText(text);
    super({text: parsedText, type, parent, attrs});

    this.level = level || 1;
  }

  addAttrs(attrs) {
    this.attrs = assign(this.attrs, attrs);
  }

  addTextNode(text) {
    const node = new TextNode({text, parent: this});
    this.children.push(node);
  }
}

class TextNode extends Node {
  constructor({text, parent}) {
    const type = 'text';
    super({type, parent, text});
  }

  addHeadingNode() {
    throw new Error('bad idea?');
  }
  addTextNode() {
    throw new Error('bad idea?');
  }
}

function parseHeadingText(text) {
  const attrs = {};
  let parsedText = text;

  if (text.match(/^TODO /)) {
    attrs.todo = 'todo';
    parsedText = text.slice('TODO '.length);
  } else if (text.match(/^DONE/)) {
    attrs.todo = 'done';
    parsedText = text.slice('DONE '.length);
  } else {
    attrs.todo = null;
  }

  const tags = [];
  parsedText = text.replace(/:[^:]+:/g, function (t) {
    tags.push(t.slice(1, t.length - 1));
    return '';
  });
  attrs.tags = tags;

  parsedText = parsedText.trim();

  return {attrs, parsedText};
}

function parseTextHeadingExt(text) {
  // parses the metadata in the text related to the subheading
  // XXX right now has an assumption that the text either contains
  // only attrs or only text.
  const regexps = [
    [/^DEADLINE: <([^>]+)>\s*/, 'deadline'],
    [/^SCHEDULED: <([^>]+)>\s*/, 'scheduled'],
    [/^CLOSED: \[([^\]]+)]\s*/, 'closed'],
  ];

  const attrs = {};

  let lastMatch;
  do {
    lastMatch = null;
    regexps.forEach((tuple) => {
      const [r, tag] = tuple;
      if (text.match(r)) {
        const value = parseDate(text.match(r)[1]);
        text = text.replace(r, '');
        lastMatch = r;

        attrs[tag] = value;
      }
    });
  } while(lastMatch);

  // parsed some attrs
  if (Object.keys(attrs).length > 0) {
    return {
      attrs,
      parsedText: null
    };
  }

  // didn't really parse much
  return {
    parsedText: text,
    attrs: {}
  };
}

function parseDate(text) {
  const [, dateStr, , timeStr] = text.match(
      /^\s*([0-9]+-[0-9]+-[0-9]+)\s*([a-zA-Z]+)(\s*(.+:.+))?\s*$/);
  return new Date(`${dateStr} ${timeStr || ''}`);
}

function pad(num) {
  return new Array(num + 1).join(' ');
}

function getTextValue(node) {
  return node.value;
}

// expects `this` to be the current mutable tree
function walk(node, level = 1) {
  //console.log(`${pad(level * 2)}${node.type}(${node.level || '-'}) - ${node.value || 'N/A'}`);
  if (node.type === 'header') {
    const newHeading = this.addHeadingNode(getTextValue(node));
  } else if (node.type === 'paragraph') {
    const text = getTextValue(node);
    const {parsedText, attrs} = parseTextHeadingExt(text);
    if (parsedText) {
      this.addTextNode(parsedText);
    }
    this.addAttrs(attrs);
  } else {
    throw new Error('unsupported type of node ' + node.type);
  }
}

export default function parseOrg(orgCode) {
  const lx = new lexer(orgCode);

  const ast = new Node({
    type: 'root'
  });

  // because of the way 'org' parses the org-mode structure, we need
  // to maintain a stack and recreate the tree structure of the
  // document
  const headingsStack = [];
  headingsStack.push(ast);
  lx.getLexemes().forEach(n => {
    let node = headingsStack[headingsStack.length - 1];
    if (n.level) {
      while (node.level && node.level >= n.level) {
        headingsStack.pop();
        node = headingsStack[headingsStack.length - 1];
      }
    }

    walk.call(node, n);

    if (n.level) {
      headingsStack.push(node.lastChild());
    }
  });

  return ast;
}

class Visitor {
  constructor(ast) {
    this.ast = ast;
  }

  startVisitor() {
    return this.visitRoot(this.ast);
  }

  visitRoot(root) {
    ;
  }
  visitHeading() {
  }
  visitText() {}
}
