import express from 'express';
import http from 'http';
import morgan from 'morgan';

import { createProxyMiddleware } from 'http-proxy-middleware';
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
        const app = express();
        const proxy = createProxyMiddleware({
            target: HC2_INSTANCE_URL,
            changeOrigin: true,
            pathFilter: [ '/api' ]
        });

        app.use(proxy);
        app.use(morgan('combined'));    
        
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
            console.log(banner);
            console.log(`HC2Proxy serving instance (${HC2_INSTANCE_ID}) listening on port ${PORT}`);
        });
                
    } catch(ex) {
        console.error(`INTERNAL_ERROR (HC2.Proxy): **EXCEPTION ENCOUNTERED** while running the HC2 service proxy (${SERVICE_NAME}). See details -> ${ex.message}` );
    }
}());