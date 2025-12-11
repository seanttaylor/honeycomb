import bodyParser from 'body-parser';
import express from 'express';
import http from 'http';

import morgan from 'morgan';
import Ajv from 'ajv';
import figlet from 'figlet';


(async function HC2Instance() {
    /******** CONTAINER ENVIRONMENT VARIABLES ********/
    const SERVICE_NAME=process.env.SERVICE_NAME;
    const HC2_INSTANCE_NAME = process.env.HC2_INSTANCE_NAME;
    const VERSION = process.env.VERSION;
    const HC2_INSTANCE_ID = process.env.HC2_INSTANCE_ID;
    const PORT = process.env.PORT || 3000;
    
    try {
        const banner = await figlet.text(`${SERVICE_NAME} v${VERSION}`);
        console.log(banner);

        /******** HTTP SERVER ********/
        const app = express();
        app.use(bodyParser.json());
        app.use(morgan('combined'));

        app.get('/health', (req, res) => {
            res.status(200).json({
                name: 'HC2Proxy',
                hc2InstanceId: HC2_INSTANCE_ID,
                timestamp: new Date().toISOString()
            });
        });

        app.post('/api/v1/certs', async (req, res) => {
            try {

               res.status(401).send({});
            } catch(ex) {
                console.error(`INTERNAL_ERROR (honeycomb.HC2Proxy): **EXCEPTION ENCOUNTERED** while executing service method. See details -> ${ex.message}`);
                next(ex);
            }
        });

        app.post('/api/v1/certs/:id/verify', async (res, req) => {
            console.log('verifying certificate...');
            console.log(req.body);
            res.status(401).send({});
        });

        app.use((err, req, res, next) => {
            const status = err.status || 500;
            console.error(err);
            res.status(status).send({ status, error: 'There was an error.' });
        });

        http.createServer(app).listen(PORT, () => {
            console.log(`HC2 instance (${HC2_INSTANCE_ID}) listening on port ${PORT}`);
        });
                
    } catch(ex) {
        console.error(`INTERNAL_ERROR (HC2.Service): **EXCEPTION ENCOUNTERED** while running the HC2 instance (${HC2_INSTANCE_ID}). See details -> ${ex.message}` );
    }
}());