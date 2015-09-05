import fs from 'fs-promise';
import asana from 'asana';
import minimist from 'minimist';
import parseOrg, {Visitor} from './parser';

// walks through the tree and returns trees with :project: tag
// as soon as a tagged tree is found, the traverse terminates
class ProjectNodesCollector extends Visitor {
  visitHeading(heading, next) {
    if (heading.attrs.tags.indexOf('project') !== -1)
      return [heading];
    return next();
  }
  visitText() {
    return [];
  }
  combine(rets) {
    const res = [];
    rets.forEach(ret => res.push(...ret));
    return res;
  }
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
    const projectNodes =
          new ProjectNodesCollector(ast).startVisitor();

    console.log(projectNodes);
  } catch (err) {
    console.log('main async code threw an error:');
    console.log(err.stack);
  }
}

const argv = minimist(process.argv.slice(2));
main(argv._[0], argv);
