import fs from 'fs-promise';
import asana from 'asana';
import minimist from 'minimist';
import parseOrg from './parser';

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
