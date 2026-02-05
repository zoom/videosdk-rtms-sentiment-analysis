// Import the RTMS SDK
import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import KJUR from 'jsrsasign';
import util from "util";
import { runDetection, trainModel } from './public/transcript-sentiment.js';
import rtms from "@zoom/rtms";

dotenv.config({ quiet: true });
const PORT = process.env.PORT || 3012;
const ZoomSecretToken = process.env.ZOOM_SECRET_TOKEN;
const ZoomClientId = process.env.ZOOM_VIDEO_SDK_KEY;
const ZoomClientSecret = process.env.ZOOM_VIDEO_SDK_SECRET;
const WordThreshold = parseInt(process.env.WORD_THRESHOLD || '35');

if (!ZoomClientId || !ZoomClientSecret || !ZoomSecretToken) {
  console.error('Missing required environment variables:');
  if (!ZoomClientId) console.error('  - ZOOM_VIDEO_SDK_CLIENT');
  if (!ZoomClientSecret) console.error('  - ZOOM_VIDEO_SDK_SECRET');
  if (!ZoomSecretToken) console.error('  - ZOOM_SECRET_TOKEN');
  process.exit(1);
}

await trainModel(250, 50);

const app = express();
app.use(cors());

// Create a webhook handler that can be mounted on your existing server
const webhookHandler = rtms.createWebhookHandler(
    (payload) => {
        console.log(`Received webhook: ${util.inspect(payload, {depth: null, colors: true })}`);

        if (payload.event === "session.rtms_started") {
            const client = new rtms.Client();
            const { session_id, rtms_stream_id, server_urls } = payload.payload;

            client.onTranscriptData((buffer, size, timestamp, metadata) => {
              const text = buffer.toString('utf8');
              console.log(`Transcript from ${metadata.userName}: ${text}`);
              if (text.length > WordThreshold) {
                runDetection(text);
              }
            });

            client.join({
              client: ZoomClientId,
              secret: ZoomClientSecret,
              session_id,
              rtms_stream_id,
              server_urls,
            });
        }
    },
    '/zoom/webhook'
);

app.post('/zoom/webhook', webhookHandler);
app.use(express.json());


function generateJWT(sessionName, role) {
  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const oHeader = { alg: "HS256", typ: "JWT" };

  const oPayload = {
    app_key: ZoomClientId,
    tpc: sessionName,
    role_type: role,
    version: 1,
    iat: iat,
    exp: exp,
  };

  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const sdkJWT = KJUR.KJUR.jws.JWS.sign("HS256", sHeader, sPayload, ZoomClientSecret);
  return sdkJWT;
}

app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.send('RTMS for Video SDK Sample Server Running.');
});

app.post("/jwt", (req, res) => {
   const {sessionName, role} = req.body;
   res.status(200).send({jwtToken: generateJWT(sessionName, role)});
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
});
