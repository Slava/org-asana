import fs from 'fs-promise';
import minimist from 'minimist';
import org from 'org';
import assign from 'object-assign';

class Node {
  constructor({type, parent, text, attrs}) {
    this.type = type;
    this.parent = parent || null;
    this.text = text || null;
    this.attrs = attrs || {};
    this.children = [];
  }

  addHeadingNode(text) {
    this.children.push(
      new HeadingNode({text, parent: this}));
  }

  lastChild() {
    return this.children[this.children.length - 1];
  }

  prettyPrint(level = 0) {
    console.log(`${pad(level)} #${this.type} ${this.text} ${JSON.stringify(this.attrs)}`);
    this.children.forEach(child => child.prettyPrint(level + 1));
  }
}

class HeadingNode extends Node {
  constructor({text, parent}) {
    const type = 'heading';
    const {attrs, parsedText} = parseHeadingText(text);
    super({text: parsedText, type, parent, attrs});
  }

  addAttrs(attrs) {
    this.attrs = assign(this.attrs, attrs);
  }

  addTextNode(text) {
    this.children.push(
      new TextNode({text, parent: this}));
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

function pad(num) {
  return new Array(num + 1).join(' ');
}

// expects `this` to be the current mutable tree
function walk(node, level = 1) {
  //console.log(`${pad(level * 2)}${node.type}(${node.level || '-'}) - ${node.value || 'N/A'}`);
  const heading = this.lastChild();
  if (node.type === 'header') {
    this.addHeadingNode(node.children[0].children[0].value);
  } else if (node.type === 'inlineContainer') {
    heading.addTextNode(node.children[0].value);
  } else if (node.type === 'paragraph') {
    heading.addTextNode(node.children[0].children[0].value);
  }
}

async function main (filepath) {
  try {
    const parser = new org.Parser();
    const orgCode = await fs.readFile(filepath, 'utf8');
    const orgDocument = parser.parse(orgCode);

    const ast = new Node({
      type: 'root'
    });

    orgDocument.nodes.forEach(n => walk.call(ast, n));
    ast.prettyPrint();
  } catch (err) {
    console.log('main async code threw an error:');
    console.log(err.stack);
  }
}

const argv = minimist(process.argv.slice(2));
main(argv._[0]);
