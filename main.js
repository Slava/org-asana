import fs from 'fs-promise';
import minimist from 'minimist';
import org from 'org';
import assign from 'object-assign';
import asana from 'asana';

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
  // only one attr or only text.
  if (text.match(/^DEADLINE: /)) {
    const deadline = parseDate(text.match(/^DEADLINE: (.*)$/)[1]);

    return {
      parsedText: null,
      attrs: {deadline}
    };
  }

  if (text.match(/^SCHEDULED: /)) {
    const scheduled = parseDate(text.match(/^SCHEDULED: (.*)$/)[1]);

    return {
      parsedText: null,
      attrs: {scheduled}
    };
  }

  return {
    parsedText: text,
    attrs: {}
  };
}

function parseDate(text) {
  const [, dateStr, , timeStr] = text.match(
      /^\s*<([0-9]+-[0-9]+-[0-9]+)\s*([a-zA-Z]+)(\s*(.+:.+))?\>\s*$/);
  return new Date(`${dateStr} ${timeStr || ''}`);
}

function pad(num) {
  return new Array(num + 1).join(' ');
}

function getTextValue(node) {
  while (node && node.type !== 'text') {
    node = node.children[0];
  }

  return node.value;
}

// expects `this` to be the current mutable tree
function walk(node, level = 1) {
  //console.log(`${pad(level * 2)}${node.type}(${node.level || '-'}) - ${node.value || 'N/A'}`);
  if (node.type === 'header') {
    const newHeading = this.addHeadingNode(getTextValue(node));
    node.children.slice(1).forEach(child => walk.call(newHeading, child, level + 1));
  } else if (node.type === 'inlineContainer' || node.type === 'paragraph') {
    const text = getTextValue(node);
    const {parsedText, attrs} = parseTextHeadingExt(text);
    if (parsedText) {
      this.addTextNode(parsedText);
    }
    this.addAttrs(attrs);
  } else {
    console.log(node.children[2].toString())
    throw new Error('unsupported type of node ' + node.type);
  }
}

function parseOrg(orgCode) {
  const parser = new org.Parser();
  const orgDocument = parser.parse(orgCode);

  const ast = new Node({
    type: 'root'
  });

  // because of the way 'org' parses the org-mode structure, we need
  // to maintain a stack and recreate the tree structure of the
  // document
  const headingsStack = [];
  headingsStack.push(ast);
  orgDocument.nodes.forEach(n => {
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

async function main (filepath, options) {
  try {
    const settings = JSON.parse(await fs.readFile(options.settings, 'utf8'));
    const orgCode = await fs.readFile(filepath, 'utf8');

    const ast = parseOrg(orgCode);

    ast.prettyPrint();

    const asanaClient = asana.Client.create();
    asanaClient.useOauth({
      credentials: settings.key
    });

    const me = await asanaClient.users.me();
    const projectsCollection = await asanaClient.projects.findByWorkspace(+settings.workspace);
    const projects = await projectsCollection.fetch(100);

    // nuke everything
    projects.forEach((project) => {
      asanaClient.projects.delete(project.id);
    });

    // create new projects
    ;
  } catch (err) {
    console.log('main async code threw an error:');
    console.log(err.stack);
  }
}

const argv = minimist(process.argv.slice(2));
main(argv._[0], argv);
