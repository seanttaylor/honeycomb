import bodyParser from 'body-parser';
import express from 'express';
import http from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';

import morgan from 'morgan';
import Ajv from 'ajv';
import figlet from 'figlet';


(async function HC2ProxyServer() {
    /******** CONTAINER ENVIRONMENT VARIABLES ********/
    const SERVICE_NAME = process.env.SERVICE_NAME;
    const VERSION = process.env.VERSION;
    const HC2_INSTANCE_URL = process.env.HC2_INSTANCE_URL;
    const HC2_INSTANCE_ID = process.env.HC2_INSTANCE_ID;
    const PORT = process.env.PORT || 3000;
    
    try {
        const banner = await figlet.text(`${SERVICE_NAME} v${VERSION}`);
        console.log(banner);

        /******** HTTP SERVER ********/
        const app = express();
        const proxyMiddleware = createProxyMiddleware({
            target: HC2_INSTANCE_URL,
            pathFilter: ['/api']
        });

        app.use(bodyParser.json());
        app.use(morgan('combined'));
        app.use(proxyMiddleware);

        app.get('/health', (req, res) => {
            res.status(200).json({
                name: 'HC2Proxy',
                hc2InstanceId: HC2_INSTANCE_ID,
                timestamp: new Date().toISOString()
            });
        });

        app.use((err, req, res, next) => {
            const status = err.status || 500;
            console.error(err);
            res.status(status).send({ status, error: 'There was an error.' });
        });

        http.createServer(app).listen(PORT, () => {
            console.log(`HC2Proxy serving instance (${HC2_INSTANCE_ID}) listening on port ${PORT}`);
        });
                
    } catch(ex) {
        console.error(`INTERNAL_ERROR (HC2.Service): **EXCEPTION ENCOUNTERED** while running the HC2 service (${SERVICE_NAME}). See details -> ${ex.message}` );
    }
}());