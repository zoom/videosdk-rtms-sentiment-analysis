// Import the RTMS SDK
import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import { runDetection, trainModel } from './public/transcript-sentiment.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.json());

await trainModel(250,50);

function generateSignature(sessionID, streamId) {
  const message = `${process.env.ZM_RTMS_CLIENT},${sessionID},${streamId}`;
  const signature = crypto.createHmac('sha256', process.env.ZM_RTMS_SECRET).update(message).digest('hex');
  console.log("Generated Signature:", signature);
  return signature;
}

function connectToSignalingWebSocket(session_id, rtmsStreamId, serverUrls) {
  const signalingWs = new WebSocket(serverUrls);

  signalingWs.on('open', () => {
    try {
      console.log(`Signaling WebSocket opened for session ${session_id}`);

      const handshakeMsg = {
        msg_type: 1, 
        meeting_uuid: session_id,
        session_id, 
        rtms_stream_id: rtmsStreamId,
        signature: generateSignature(session_id, rtmsStreamId)
      };

      console.log('Sending handshake message:', handshakeMsg);
      signalingWs.send(JSON.stringify(handshakeMsg));
    } catch(err) {
      console.error(`[Signaling] Error in WebSocket open handler for ${session_id}: ${err}`);
      signalingWs.close();
    }
  });

  signalingWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log(`ws message received: ${msg}`);
      if (msg.msg_type === 12) { // KEEP_ALIVE_REQ
        console.log('Received KEEP_ALIVE_REQ, responding with KEEP_ALIVE_RESP');
        signalingWs.send(JSON.stringify({
          msg_type: 13, // KEEP_ALIVE_RESP
          timestamp: msg.timestamp
        }));
      }
      else if (msg.msg_type === 2) {
        if (msg.status_code === 0) {
          const mediaUrl = msg.media_server?.server_urls?.audio;
          console.log(`[Signaling] Handshake OK. Media URL: ${mediaUrl}`);
          console.log(`[Signaling] Initiating media WebSocket connection`);
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
  const mediaWs = new WebSocket(mediaUrl);

  mediaWs.on('open', () => {
    const handshakeMsg = {
      msg_type: 3, // DATA_HAND_SHAKE_REQ
      protocol_version: 1,
      sequence: 0,
      meeting_uuid: session_id,
      rtms_stream_id: rtmsStreamId,
      signature: generateSignature(session_id, rtmsStreamId),
      media_type: 1 // Request only audio (AUDIO enum)
    };

    signalingWs.on('message', (event) => {
      const msg = event.data;
      console.log(`ws message received: ${msg}`);
      if (msg.msg_type === 14) {
        console.log('Received audio:', msg.content);
        runDetection(msg.content);
      }
      else if (msg.msg_type === 4 && msg.status_code === 0) {
          console.log('Media handshake successful, sending CLIENT_READY_ACK via signaling socket');
          signalingSocket.send(JSON.stringify({
            msg_type: 7, // CLIENT_READY_ACK
            rtms_stream_id: rtmsStreamId
        }));
      }
      else if (msg.msg_type === 12) { // KEEP_ALIVE_REQ
        console.log('Received KEEP_ALIVE_REQ, responding with KEEP_ALIVE_ACK');
        mediaWs.send(JSON.stringify({
          msg_type: 13, // KEEP_ALIVE_ACK
          timestamp: msg.timestamp
        }));
      }
    });

    console.log('Sending transcript handshake:', handshakeMsg);
    mediaWs.send(JSON.stringify(handshakeMsg));
  });

  // Listen for incoming transcript data packets
  mediaWs.on('message', (data) => {
    console.log('Received audio data:', data);
  });
}

app.get('/', (req, res) => {
  res.send('RTMS for Video SDK Sample Server Running.');
});

app.post('/webhook', (req, res) => {
  const { event, payload } = req.body;
  if (event === 'session.rtms_started') {
    const { session_id, rtms_stream_id, server_urls } = payload;
    console.log("Starting RTMS for session:", {payload});
    connectToSignalingWebSocket(session_id, rtms_stream_id, server_urls);
  } else if (event === 'session.rtms_stopped') {
    const { session_id } = payload;
    console.log(`Stopping RTMS for Video session ${session_id}`);
  } else {
    console.log('Unknown event:', event);
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
