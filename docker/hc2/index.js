import bodyParser from 'body-parser';
import express from 'express';
import http from 'http';

import morgan from 'morgan';
import figlet from 'figlet';
import { HC2Instance } from './service.js';


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


(async function HC2() {
    /******** CONTAINER ENVIRONMENT VARIABLES ********/
    const SERVICE_NAME= process.env.SERVICE_NAME;
    const HC2_INSTANCE_NAME = process.env.HC2_INSTANCE_NAME;
    const VERSION = process.env.VERSION;
    const HC2_INSTANCE_ID = process.env.HC2_INSTANCE_ID;
    const PORT = process.env.PORT || 3000;
    
    try {
        const banner = await figlet.text(`${SERVICE_NAME} v${VERSION}`);
        console.log(banner);

        const { publicKey, privateKey } = await generateKeyPair();
        const hc2Instance = new HC2Instance({ publicKey, privateKey, instanceId: HC2_INSTANCE_ID });

        /******** HTTP SERVER ********/
        const app = express();
        app.use(bodyParser.json());
        app.use(morgan('combined'));

        app.get('/health', (req, res) => {
            res.status(200).json({
                publicKey,
                instanceName: HC2_INSTANCE_NAME,
                instanceId: HC2_INSTANCE_ID,
                timestamp: new Date().toISOString(),
                version: VERSION,
            });
        });

        app.post('/api/v1/certs', async (req, res) => {
            try {
                const certificateRequest = req.body;
                const serviceCertificate =  await hc2Instance.generateServiceCert(certificateRequest);

               res.status(400).send({});
            } catch(ex) {
                console.error(`INTERNAL_ERROR (honeycomb.HC2.instance): **EXCEPTION ENCOUNTERED** while generating service certificate . See details -> ${ex.message}`);
                next(ex);
            }
        });

        app.post('/api/v1/certs/:id/verify', async (req, res) => {
            const serviceCert = req.body;
            const certId = req.params.id;
            const certStatus =  await hc2Instance.verifyHC2ServiceCertificate(serviceCert);

            if (!certStatus.isVerified) {
                console.error(`INTERNAL_ERROR (honeycomb.HC2.instance): Cannot complete registration for service (${serviceCert.payload.service}). The HC2 service certificate could not be verified. See docs.`);

                res.status(403).json({
                    type: "/probs/cert-invalid",
                    title: `The integrity of the service certificate (${certId}) could not be verified`,
                    detail: 'Service registraion requests **MUST** be accompanied by a **VALID** service certificate issued by an HC2 instance. See docs.',
                    instance: `/certs/${certId}/msgs/${crypto.randomUUID()}`,
                });
                return;
            }

            const certClaimsStatus = await hc2Instance.validateCertificateClaims(serviceCert);

            if (!certClaimsStatus.isValid) {
                console.error(`INTERNAL_ERROR (honeycomb.HC2.Proxy): Cannot complete registration for service (${serviceCert.payload.service}). The HC2 service certificate claims could not be validated. See docs.`);

                res.status(401).json({
                    type: "/probs/cert-claims-invalid",
                    title: 'The service certificate claims could not be validated against the registration request',
                    detail: 'All claims asserted in the HC2 service certificate **MUST** match those in the service registration request. See docs.',
                    instance: `/certs/${certId}/msgs/${crypto.randomUUID()}`,
                });
                return;
            }

            res.status(200).json({});
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
        console.error(`INTERNAL_ERROR (honeycomb.HC2.instance): **EXCEPTION ENCOUNTERED** while running the HC2 instance (${HC2_INSTANCE_ID}). See details -> ${ex.message}` );
    }
}());