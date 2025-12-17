import express from 'express';
import http from 'http';
import morgan from 'morgan';

import { createProxyMiddleware } from 'http-proxy-middleware';
import figlet from 'figlet';

(async function HC2ProxyServer() {
  /******** CONTAINER ENVIRONMENT VARIABLES ********/
  const HC2_INSTANCE_URL = process.env.HC2_INSTANCE_URL;
  const HC2_INSTANCE_ID = process.env.HC2_INSTANCE_ID;
  const SERVICE_INSTANCE_NAME = process.env.SERVICE_INSTANCE_NAME;
  const SERVICE_NAME = process.env.SERVICE_NAME;

  const PORT = process.env.PORT || 3000;
  const VERSION = process.env.VERSION;

  try {
    const banner = await figlet.text(`${SERVICE_NAME} v${VERSION}`);
    const app = express();
    const proxy = createProxyMiddleware({
      target: HC2_INSTANCE_URL,
      changeOrigin: true,
    });
    
    app.use(morgan('combined'));

    app.get('/api/v1/profiles', async(req, res, next) => {
      try {
        res.set('X-Count', 1);
        res.set('X-HC2-Resource', 'urn:hcp:hc2:service-profile:4173dbd4-fcf8-4768-8b87-a8e2a2b2f24f');
        res.status(200).json([{
          serviceId: '4173dbd4-fcf8-4768-8b87-a8e2a2b2f24f',
          name: 'NOOPService',
          version: '0.0.1',
          dependsOn: [
            'CacheService'
          ],
          api: {
            description: 'This service is just used as a sanity check to ensure the module system is working',
            methods: [
              {
                name: 'hello',
                params: {
                  type: 'object',
                  properties: {
                    receiver: {
                      type: 'string'
                    },
                    sender: {
                      type: 'string'
                    }
                  },
                  required: [
                    'receiver'
                  ],
                  additionalProperties: false
                }
              }
            ]
          },
          serviceAlias: 'strong-jackal',
          callbackURL: 'http://noop_service:3001/rpc',
          createdAt: '2025-12-16T19:18:53.196Z'  
        }]);
      } catch(ex) {
        console.error(`INTERNAL_ERROR (honeycomb.HC2.proxy): **EXCEPTION ENCOUNTERED** while fetching service profiles. See details -> ${ex.message}`);
        next(ex);
      }
    });

    app.get('/health', (req, res) => {
      res.status(200).json({
        name: 'HC2Proxy',
        hc2InstanceId: HC2_INSTANCE_ID,
        timestamp: new Date().toISOString()
      });
    });

    app.use(proxy);

    app.use((err, req, res, next) => {
      const status = err.status || 500;
      console.error(err);
      res.status(status).send({ status, error: 'There was an error.' });
    });

    http.createServer(app).listen(PORT, () => {
      console.log(banner);
      console.log(`HC2Proxy serving instance (${HC2_INSTANCE_ID}) listening on port ${PORT} as alias (${SERVICE_INSTANCE_NAME})`);
    });
              
  } catch(ex) {
    console.error(`INTERNAL_ERROR (HC2.Proxy): **EXCEPTION ENCOUNTERED** while running the HC2 service proxy (${SERVICE_INSTANCE_NAME}). See details -> ${ex.message}` );
  }
}());