import fs from 'fs-promise';
import minimist from 'minimist';
import org from 'org';

function pad(num) {
  return new Array(num + 1).join(' ');
}

function walk(node, level = 1) {
  console.log(`${pad(level * 2)}${node.type}(${node.level || '-'}) - ${node.value || 'N/A'}`);
  node.children.forEach(n => walk(n, level + 1));
}

async function main (filepath) {
  const parser = new org.Parser();
  const orgCode = await fs.readFile(filepath, 'utf8');
  const orgDocument = parser.parse(orgCode);
  orgDocument.nodes.forEach(n => walk(n));
}

const argv = minimist(process.argv.slice(2));
main(argv._[0]);
