import { HC2Proxy, HC2Utilities } from '@honeycomb/cloud';
/**
  * @returns {Object}
  */
async function generateKeyPair() {
    try {
      return await crypto.subtle.generateKey(
        {
          name: 'RSA-PSS',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true, // extractable
        ['sign', 'verify']
      );
    } catch (ex) {
      console.error(
        `INTERNAL_ERROR (honeycomb.HC2): Could not generate instance key pair. See details -> ${ex.message}`
      );
    }
}

/**
 * 
 * @param {Object} payload 
 * @param {String} privateKey 
 * @returns {Object}
 */
async function signPayload(payload, privateKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const signature = await crypto.subtle.sign(
      {
        name: 'RSA-PSS',
        saltLength: 32,
      },
      privateKey,
      data
    );

    return {
      payload,
      signature: HC2Utilities.ArrayBuffer.toBase64(signature),
    };
  }

(async function HC2NOOPService() {
    /** CONTAINER ENVIRONMENT VARIABLES **/
    const SERVICE_NAME = process.env.SERVICE_NAME;
    const VERSION = process.env.VERSION;
    const HC2_INSTANCE_URL = process.env.HC2_INSTANCE_URL;
    const HC2_SERVICE_CERTIFICATE = JSON.parse(atob(process.env.HC2_SERVICE_CERTIFICATE));
    
    const { publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY } = await generateKeyPair();
    const serviceRegistrationRequest = {
        app: 'current.ly',
        service: 'NOOPService',
        version: 1,
        api: {
          methods: [
            {
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
            },
          ],
        },
        callbackURL: 'http://foo.bar.baz.cloud',
        HC2ServiceCertificate: HC2_SERVICE_CERTIFICATE
    };
    const SERVICE_SIGNED_REGISTRATION_REQ = await signPayload(serviceRegistrationRequest, PRIVATE_KEY);

    try {
        console.info(`${SERVICE_NAME} v${VERSION}`);
        const hc2 = new HC2Proxy(HC2_INSTANCE_URL);
        const hc2ServiceRegistrationReceipt = await hc2.register(SERVICE_SIGNED_REGISTRATION_REQ);
        const reply = await hc2.my.FeedService.hello({ from: SERVICE_NAME });
        
        console.log({ reply });
        
    } catch(ex) {
        console.error(`INTERNAL_ERROR (HC2.Service): **EXCEPTION ENCOUNTERED** while running the HC2 service (${SERVICE_NAME}). See details -> ${ex.message}` );
    }
}());