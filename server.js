// Import the RTMS SDK
import http from 'http';
import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import { runDetection, trainModel } from './public/transcript-sentiment.js';

dotenv.config({ quiet: true });
const PORT = process.env.PORT || 3000;
const ZoomSecretToken = process.env.ZOOM_SECRET_TOKEN;
const ZoomClientId = process.env.VITE_SDK_KEY;
const ZoomClientSecret = process.env.VITE_SDK_SECRET;
const WordThreshold = parseInt(process.env.WORD_THRESHOLD || '100');
let transcriptBuffer = "";

if (!ZoomClientId || !ZoomClientSecret || !ZoomSecretToken) {
  console.error('Missing required environment variables:');
  if (!ZoomClientId) console.error('  - ZOOM_RTMS_CLIENT');
  if (!ZoomClientSecret) console.error('  - ZOOM_RTMS_SECRET');
  if (!ZoomSecretToken) console.error('  - ZOOM_SECRET_TOKEN');
  process.exit(1);
}

const app = express();
app.use(express.json());

await trainModel(250, 50);

function generateSignature(sessionID, streamId) {
  const message = `${ZoomClientId},${sessionID},${streamId}`;
  return crypto.createHmac('sha256', ZoomClientSecret).update(message).digest('hex');
}

function connectToSignalingWebSocket(session_id, rtmsStreamId, serverUrls) {
  const signalingWs = new WebSocket(serverUrls, [], { rejectUnauthorized: false });
  signalingWs.on('open', () => {
    try {
      const handshakeMsg = {
        msg_type: 1,
        meeting_uuid: session_id,
        session_id,
        rtms_stream_id: rtmsStreamId,
        signature: generateSignature(session_id, rtmsStreamId)
      };

      signalingWs.send(JSON.stringify(handshakeMsg));
    } catch (err) {
      console.error(`[Signaling] Error in WebSocket open handler for ${session_id}: ${err}`);
      signalingWs.close();
    }
  });

  signalingWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.msg_type === 12) { // KEEP_ALIVE_REQ
      signalingWs.send(JSON.stringify({
        msg_type: 13, // KEEP_ALIVE_RESP
        timestamp: msg.timestamp
      }));
    }
    else if (msg.msg_type === 2) {
      if (msg.status_code === 0) {
        const mediaUrl = msg.media_server?.server_urls?.audio;
        connectToMediaWebSocket(mediaUrl, session_id, rtmsStreamId, signalingWs);
      }
    }
  });

  signalingWs.on('error', (error) => {
    console.error('Signaling WebSocket error:', error);
  });

  signalingWs.on('close', (code, reason) => {
    console.log('Signaling WebSocket closed:', code, reason);
  });
}

function connectToMediaWebSocket(mediaUrl, session_id, rtmsStreamId, signalingSocket) {
  const mediaWs = new WebSocket(mediaUrl, [], { rejectUnauthorized: false });

  mediaWs.on('open', () => {
    const handshakeMsg = {
      msg_type: 3, // DATA_HAND_SHAKE_REQ
      protocol_version: 1,
      sequence: 0,
      meeting_uuid: session_id,
      rtms_stream_id: rtmsStreamId,
      signature: generateSignature(session_id, rtmsStreamId),
      media_type: 8, // Request only transcript (TEXT enum)
    };

    mediaWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.msg_type === 17)  // TRANSCRIPT
      {
        console.log('Transcript data received', msg.content?.data);
        if (msg.content?.data) {
          transcriptBuffer += msg.content.data;
          if (transcriptBuffer.length > WordThreshold) {
            runDetection(msg.content.data).then(() => {
              transcriptBuffer = "";
            });
          }
        }
      }
      else if (msg.msg_type === 4 && msg.status_code === 0) {
        signalingSocket.send(JSON.stringify({
          msg_type: 7, // CLIENT_READY_ACK
          rtms_stream_id: rtmsStreamId
        }));
      }
      else if (msg.msg_type === 12) { // KEEP_ALIVE_REQ
        mediaWs.send(JSON.stringify({
          msg_type: 13, // KEEP_ALIVE_ACK
          timestamp: msg.timestamp
        }));
      }
    });
    mediaWs.send(JSON.stringify(handshakeMsg));
  });
}

app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.send('RTMS for Video SDK Sample Server Running.');
});

app.post('/webhook', (req, res) => {
  const { event, payload } = req.body;
  if (event === 'endpoint.url_validation' && payload?.plainToken) {
    const hash = crypto.createHmac('sha256', ZoomSecretToken).update(payload.plainToken).digest('hex');
    return res.json({
      plainToken: payload.plainToken,
      encryptedToken: hash,
    });
  }

  // Send response immediately, then process the event
  res.sendStatus(200);

  if (event === 'session.rtms_started') {
    const { session_id, rtms_stream_id, server_urls } = payload;
    console.log("Starting RTMS for session:", { payload });
    connectToSignalingWebSocket(session_id, rtms_stream_id, server_urls);
  } else if (event === 'session.rtms_stopped') {
    const { session_id } = payload;
    console.log(`Stopping RTMS for Video session ${session_id}`);
  } else {
    console.log('Unknown event:', event);
  }
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
});
