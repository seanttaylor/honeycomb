import sha256 from 'js-sha256';
import { Sandbox } from './core/index.js';

/******** PLUGINS ********/
import { PluginNOOP } from './plugins/noop.js';

/******** SERVICES ********/
import { NOOPService } from './services/noop.js';
import { FeedService } from './services/feed.js';
import { CacheService } from './services/cache.js';


//*Example sandboxed application with Honeycomb
(async function main() {
  try {
    Sandbox.modules.of('NOOPService', NOOPService);
    Sandbox.modules.of('FeedService', FeedService);
    Sandbox.modules.of('CacheService', CacheService);

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
