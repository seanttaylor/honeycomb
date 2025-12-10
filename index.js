import { Sandbox } from './core/index.js';

/******** PLUGINS ********/
import { PluginNOOP } from './plugins/noop.js';

/******** SERVICES ********/
import { NOOPService } from './services/noop.js';
import { FeedService } from './services/feed.js';
import { CacheService } from './services/cache.js';
import { HC2Instance } from './hc2/index.js';
import { HC2Proxy } from './hc2/proxy.js';

/******** VARS ********/
const HC2_INSTANCE_URL = 'https://httpbin.org/anything';
const NOOPSERVICE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAazUZm7Pg90AgMQNNIeKWmX7VchCaNbWjexypZVb2iKk=
-----END PUBLIC KEY-----`;
const NOOPSERVICE_PUBLIC_KEY_B64 =
  'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUNvd0JRWURLMlZ3QXlFQWF6VVptN1BnOTBBZ01RTk5JZUtXbVg3VmNoQ2FOYldqZXh5cFpWYjJpS2s9Ci0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQ==';
const NOOPSERVICE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MFECAQEwBQYDK2VwBCIEIACSWk6eUal2jZdl4EDBRnNh+l3Zj65SpgAqqD9r/IFe
gSEAazUZm7Pg90AgMQNNIeKWmX7VchCaNbWjexypZVb2iKk=
-----END PRIVATE KEY-----
`;

const app = 'current.ly';
const service = 'NOOPService';
const version = 1;
const callbackURL = 'http://foo.bar.baz.cloud';
const schema = {
  name: 'hello',
  params: {
    type: 'object',
    properties: {
      receiver: {
        type: 'string',
      },
      sender: {
        type: 'string',
      },
    },
    required: ['receiver'],
    additionalProperties: false,
  },
};

/*
 * Metadata extracted from the service image afer the image is build but before it is deployed; used
 * to request a signed certificate from an HC2 instance for request verification when the
 * service is stood up
 */
const stubCertificateRequestPayload = {
  app,
  version,
  callbackURL,
  service,
  // Base64-encoded public key
  publicKey: NOOPSERVICE_PUBLIC_KEY_B64,
};

/**
 * Service registration payload - registers an active application service with an HC2 instance
 * @type {HC2ProxyRegistration}
 */
const registrationPayload = {
  app,
  service,
  version,
  api: {
    methods: [schema],
  },
  callbackURL,
  HC2ServiceCertificate: null,
};

(async function main() {
  try {
    console.log(`v1.0.0`);

    // HC2 service spins up an HC2 instance
    const hc2Instance = new HC2Instance();

    // HC2 generates service certificates for services containers that want to connect to an instance
    const cert = await hc2Instance.generateServiceCert(
      stubCertificateRequestPayload
    );

    // HC2 injects the service certificate into the runtime prior to service container boot

    // Service container downloads/installs @honeycomb/hc2Proxy NPM package on boot
    const hc2Proxy = new HC2Proxy(hc2Instance, 'current.ly');

    // Service generates keypair at container boot

    const noopService = new NOOPService(hc2Proxy);
    noopService.assignServiceCertificate(cert);

    // Service registers with HC2 instance via HC2Proxy; the HC2 instance URL is injected prior to container boot

    // Service container receives registration receipt confirming successful connection to HC2 instance

    // Service container can make and receive calls via the HC2Proxy's JSONRPC interface

    noopService.run(async (hc2) => {
      const greeting = await hc2.my.NOOPService.hello();
    });
  } catch (ex) {
    console.error(
      `INTERNAL_ERROR (host): Exception encountered. See details -> ${ex.message}`
    );
  }
})();
