import sha256 from 'js-sha256';
import { Sandbox } from './core/index.js';

/******** PLUGINS ********/
import { PluginNOOP } from './plugins/noop.js';


//*Example sandboxed application with Honeycomb
(async function main() {
  try {
    await Sandbox.modules.autoLoad();

    // Define policies
    const policies = {
      // NOOPService: {
      //   allowedAPIs: ['CacheService'], // only Cache allowed
      // },
      FeedService: {
        allowedAPIs: ['NOOPService'], // can only call NOOPService
      },
    };

    const app = new Sandbox(
      ['NOOPService', 'FeedService', 'CacheService'],
      async (sandbox) => {
        const res = await sandbox.my.NOOPService.hello('host');
        console.log(res);
      },
      policies
    );

    app.plugin(PluginNOOP);
  } catch (ex) {
    console.error(
      `INTERNAL_ERROR (Main): Exception encountered. See details -> ${ex.message}`
    );
  }
})();
