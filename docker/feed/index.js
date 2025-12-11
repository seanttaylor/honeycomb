import { HC2Proxy, HC2Utilities } from '@honeycomb/cloud';
import bodyParser from 'body-parser';
import express from 'express';
import http from 'http';

import morgan from 'morgan';
import Ajv from 'ajv';
import figlet from 'figlet';
import { FeedService } from './service.js';

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

(async function HC2FeedService() {
    /******** CONTAINER ENVIRONMENT VARIABLES ********/
    const SERVICE_NAME = process.env.SERVICE_NAME;
    const VERSION = process.env.VERSION;
    const HC2_INSTANCE_URL = process.env.HC2_INSTANCE_URL;
    const PORT = process.env.PORT || 3000;
    const HC2_SERVICE_CERTIFICATE = JSON.parse(atob(process.env.HC2_SERVICE_CERTIFICATE));
    
    try {
        const banner = await figlet.text(`${SERVICE_NAME} v${VERSION}`);
        console.log(banner);

        const { publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY } = await generateKeyPair();
        const serviceRegistrationRequest = {
            app: 'current.ly',
            service: 'FeedService',
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

        console.info(`${SERVICE_NAME} v${VERSION}`);
        
        const hc2 = new HC2Proxy(HC2_INSTANCE_URL);
        const feedService = new FeedService(hc2);
        const hc2ServiceRegistrationReceipt = await hc2.register(SERVICE_SIGNED_REGISTRATION_REQ);

        //const reply = await hc2.my.FeedService.hello({ from: SERVICE_NAME });

        /******** HTTP SERVER ********/
        const app = express();
        app.use(bodyParser.json());
        app.use(morgan('combined'));

        app.get('/health', (req, res) => {
            const serviceStatus = feedService.status;
            res.status(200).json(serviceStatus);
        });

        app.post('/rpc', async (req, res) => {
            try {
                const ajv = new Ajv();
                const { name, params: methodParams } = req.body;
                const schema = serviceRegistrationRequest.api.methods.find((el, idx) => {
                    return el.name === name;
                });

                if (!schema) {
                    console.error(`INTERNAL_ERROR (${SERVICE_NAME}): Service method (${name})`);
                    res.set('content-type', 'application/problem+json');
                    res.status(404).json({
                        type: 'https://hc2.io/probs/invalid-service-method',
                        title: `The service method specified does not exist on target service`,
                        instance: `/requests/${crypto.randomUUID()}`,
                    });
                    return;
                }

                const validation = ajv.validate(schema.params, methodParams);

                if (!validation) {
                    console.error(`INTERNAL_ERROR (${SERVICE_NAME}): Invalid params for service method (${schema.name})`);
                    res.set('content-type', 'application/problem+json');
                    res.status(404).json({
                        type: 'https://hc2.io/probs/invalid-service-method',
                        title: `The service method specified does not exist on ${SERVICE_NAME}`,
                        detail: `${JSON.stringify(validation.errors)}`,
                        instance: `/requests/${crypto.randomUUID()}`,
                    });
                    return;
                }

                const response = await feedService[name](methodParams);
                res.status(200).json({
                    message: response
                });
            } catch(ex) {
                console.error(`INTERNAL_ERROR (FeedService): **EXCEPTION ENCOUNTERED** while executing service method. See details -> ${ex.message}`);
                next(ex);
            }
        });

        app.use((err, req, res, next) => {
            const status = err.status || 500;
            console.error(err);
            res.status(status).send({ status, error: 'There was an error.' });
        });

        http.createServer(app).listen(PORT, () => {
            console.log(`honeycomb.HC2 service (${SERVICE_NAME}) listening on port ${PORT}`);
        });
                
    } catch(ex) {
        console.error(`INTERNAL_ERROR (HC2.Service): **EXCEPTION ENCOUNTERED** while running the HC2 service (${SERVICE_NAME}). See details -> ${ex.message}` );
    }
}())
